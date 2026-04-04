// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Hamza Ghandouri

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useBlocker, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api, userFacingApiError } from "../../lib/api";
import type { Room, SessionDetail } from "../../types";
import { useAuthStore } from "../../stores/authStore";
import { useMushafInteraction } from "../../hooks/useMushafInteraction";
import { useSessionState } from "../../hooks/useSessionState";
import { MushafCanvas } from "../../components/mushaf/MushafCanvas";
import { MushafReader } from "../../components/mushaf/MushafReader";
import { SessionTopBar } from "../../components/session/SessionTopBar";
import { SessionBottomBar } from "../../components/session/SessionBottomBar";
import { ParticipantDrawer } from "../../components/session/ParticipantDrawer";
import { Modal } from "../../components/ui/Modal";
import { Button } from "../../components/ui/Button";
import { getNextAyah, getPrevAyah, getSurahName, getTotalPages } from "../../lib/quranService";
import type { Riwaya } from "../../lib/quranService";
import { AyahControls } from "../../components/session/AyahControls";
import { AutoFollowBadge } from "../../components/session/AutoFollowBadge";
import { GradingPanel } from "../../components/session/GradingPanel";
import { GradeToast } from "../../components/session/GradeToast";
import { ReconnectingOverlay } from "../../components/session/ReconnectingOverlay";
import { useWebRTCConnection } from "../../hooks/useWebRTCConnection";

function formatElapsed(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

export function LiveSessionPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);

  const [sessionDetail, setSessionDetail] = useState<SessionDetail | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [teacherPage, setTeacherPage] = useState(1);
  const [studentBrowsePage, setStudentBrowsePage] = useState(1);
  const [autoFollow, setAutoFollow] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [endSessionOpen, setEndSessionOpen] = useState(false);
  const [endingSession, setEndingSession] = useState(false);
  const [endError, setEndError] = useState<string | null>(null);
  const [gradeToast, setGradeToast] = useState<{ grade: string; notes?: string } | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const teacherVideoRef = useRef<HTMLVideoElement>(null);
  const hadServerCurrentAyahRef = useRef(false);
  const teacherSeededFromServer = useRef(false);
  const webrtcHandlersRef = useRef({
    handleOffer: (_sdp: string) => {},
    handleIce: (_c: string) => {},
  });
  const [anotherTab, setAnotherTab] = useState(false);
  const [announce, setAnnounce] = useState("");
  const [reconnectedToast, setReconnectedToast] = useState(false);

  const riwaya = (room?.riwaya ?? "hafs") as Riwaya;
  const totalPages = getTotalPages(riwaya);
  const loc = i18n.language === "ar" ? "ar" : i18n.language === "fr" ? "fr" : "en";

  const onSessionEndedNav = useCallback(() => {
    navigate(`/sessions/${id}`, {
      replace: true,
      state: { sessionEndedMessage: t("liveSession.sessionEndedMessage") },
    });
  }, [id, navigate, t]);

  const onGradeNotification = useCallback(
    (grade: string, notes?: string) => {
      setGradeToast({ grade, notes });
      const gradeLabel = t(`recitations.${grade === "needs_work" ? "needsWork" : grade}`);
      setAnnounce(t("liveSession.gradeAnnouncement", { grade: gradeLabel }));
    },
    [t],
  );

  const loadSessionAndRoom = useCallback(async () => {
    if (!id) return;
    setLoadError(null);
    setLoading(true);
    try {
      const { data } = await api.get<SessionDetail>(`sessions/${id}`);
      if (data.status !== "in_progress") {
        navigate(`/sessions/${id}`, {
          replace: true,
          state: { liveSessionError: t("liveSession.sessionNotActive") },
        });
        return;
      }
      setSessionDetail(data);
      const { data: roomData } = await api.get<Room>(`rooms/${data.room_id}`);
      setRoom(roomData);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 403) {
        navigate(`/sessions/${id}`, {
          replace: true,
          state: { liveSessionError: t("liveSession.notEnrolled") },
        });
        return;
      }
      setLoadError(userFacingApiError(err));
    } finally {
      setLoading(false);
    }
  }, [id, navigate, t]);

  useEffect(() => {
    void loadSessionAndRoom();
  }, [loadSessionAndRoom]);

  const sessionReady = !!(sessionDetail && room && id && user && token);

  const sessionState = useSessionState({
    sessionId: id ?? "",
    token: token ?? "",
    myUserId: user?.id ?? "",
    teacherId: sessionDetail?.teacher_id ?? "",
    enabled: sessionReady && !anotherTab,
    onSessionEnded: onSessionEndedNav,
    onGradeNotification,
    onOffer: (sdp) => {
      void webrtcHandlersRef.current.handleOffer(sdp);
    },
    onIceCandidate: (c) => {
      void webrtcHandlersRef.current.handleIce(c);
    },
    onAnotherTab: () => setAnotherTab(true),
    onJoinRejected: (message) => {
      if (message === "Room is full") {
        navigate(`/sessions/${id}`, {
          replace: true,
          state: { liveSessionError: t("liveSession.roomFull") },
        });
      }
    },
    onReconnected: () => setReconnectedToast(true),
    onParticipantJoined: (u) => setAnnounce(t("liveSession.userJoinedAnnounce", { name: u.name })),
    onParticipantLeft: (_userId, name) => {
      if (name) setAnnounce(t("liveSession.userLeftAnnounce", { name }));
    },
  });

  const webrtc = useWebRTCConnection({
    enabled: sessionReady && !anotherTab,
    sendAnswer: sessionState.sendAnswer,
    sendIceCandidate: sessionState.sendIceCandidate,
    publishAudio: sessionState.isTeacher || sessionState.isActiveReciter,
  });

  useLayoutEffect(() => {
    webrtcHandlersRef.current = {
      handleOffer: webrtc.handleRemoteOffer,
      handleIce: webrtc.handleRemoteIce,
    };
  }, [webrtc.handleRemoteOffer, webrtc.handleRemoteIce]);

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      sessionReady &&
      !anotherTab &&
      currentLocation.pathname !== nextLocation.pathname,
  );

  useEffect(() => {
    if (!sessionReady || anotherTab) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [sessionReady, anotherTab]);

  useEffect(() => {
    if (!announce) return;
    const tm = window.setTimeout(() => setAnnounce(""), 4000);
    return () => clearTimeout(tm);
  }, [announce]);

  useEffect(() => {
    if (!reconnectedToast) return;
    const tm = window.setTimeout(() => setReconnectedToast(false), 2600);
    return () => clearTimeout(tm);
  }, [reconnectedToast]);

  const prevReciterRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const rid = sessionState.state.activeReciterId;
    if (prevReciterRef.current === undefined) {
      prevReciterRef.current = rid;
      return;
    }
    if (rid === prevReciterRef.current) return;
    prevReciterRef.current = rid;
    if (rid == null) return;
    const name = sessionState.state.participants.find((p) => p.userId === rid)?.name;
    if (name) setAnnounce(t("liveSession.reciterChangedAnnounce", { name }));
  }, [sessionState.state.activeReciterId, sessionState.state.participants, t]);

  const isTeacher = sessionState.isTeacher;

  const page = isTeacher
    ? teacherPage
    : autoFollow
      ? (sessionState.state.currentPage ?? 1)
      : studentBrowsePage;

  const noopPage = useCallback(() => {}, []);

  const goPage = useCallback(
    (p: number) => {
      const next = Math.min(totalPages, Math.max(1, p));
      if (isTeacher) {
        setTeacherPage(next);
        sessionState.setCurrentPage(next);
      } else if (!autoFollow) {
        setStudentBrowsePage(next);
      }
    },
    [isTeacher, autoFollow, totalPages, sessionState.setCurrentPage],
  );

  useEffect(() => {
    if (!sessionReady || !isTeacher) return;
    const cp = sessionState.state.currentPage;
    if (cp != null && !teacherSeededFromServer.current) {
      setTeacherPage(cp);
      teacherSeededFromServer.current = true;
    }
  }, [sessionReady, isTeacher, sessionState.state.currentPage]);

  const broadcastAyahToRoom = useCallback(
    (data: { surah: number; ayah: number }) => {
      sessionState.setCurrentAyah(data.surah, data.ayah);
    },
    [sessionState.setCurrentAyah],
  );

  const followHighlight = isTeacher || (autoFollow && !isTeacher);

  const interaction = useMushafInteraction({
    initialPage: page,
    riwaya,
    onPageChange: isTeacher ? goPage : autoFollow ? noopPage : goPage,
    onAyahSelect: sessionState.isTeacher ? broadcastAyahToRoom : undefined,
    followHighlightPage: followHighlight,
  });

  const { setHighlightRange, setActiveWord } = interaction;

  const syncSurah = sessionState.state.currentAyah?.surah;
  const syncAyah = sessionState.state.currentAyah?.ayah;

  useEffect(() => {
    if (!isTeacher && !autoFollow) return;
    if (syncSurah != null && syncAyah != null) {
      setHighlightRange({ surah: syncSurah, ayahStart: syncAyah, ayahEnd: syncAyah });
      hadServerCurrentAyahRef.current = true;
    } else if (hadServerCurrentAyahRef.current) {
      setHighlightRange(null);
      setActiveWord(null);
      hadServerCurrentAyahRef.current = false;
    }
  }, [syncSurah, syncAyah, autoFollow, isTeacher, setHighlightRange, setActiveWord]);

  const handleAutoFollowToggle = useCallback(() => {
    setAutoFollow((prev) => {
      if (prev) {
        setStudentBrowsePage(sessionState.state.currentPage ?? 1);
        return false;
      }
      return true;
    });
  }, [sessionState.state.currentPage]);

  const surahLabel = useMemo(() => {
    const ca = sessionState.state.currentAyah;
    const hr = interaction.highlightRange;
    const surahNum = ca?.surah ?? hr?.surah ?? null;
    if (!surahNum) return "—";
    return getSurahName(surahNum, loc);
  }, [sessionState.state.currentAyah, interaction.highlightRange, loc]);

  const sessionTitle = sessionDetail?.title?.trim() || sessionDetail?.room_name || "—";

  useEffect(() => {
    if (!sessionDetail?.scheduled_at) return;
    const start = new Date(sessionDetail.scheduled_at).getTime();
    const tick = () => setElapsedMs(Math.max(0, Date.now() - start));
    tick();
    const idTimer = window.setInterval(tick, 1000);
    return () => clearInterval(idTimer);
  }, [sessionDetail?.scheduled_at]);

  const activeReciterName = useMemo(() => {
    const rid = sessionState.state.activeReciterId;
    if (!rid) return null;
    return sessionState.state.participants.find((p) => p.userId === rid)?.name ?? null;
  }, [sessionState.state.activeReciterId, sessionState.state.participants]);

  const activeReciterParticipant = useMemo(() => {
    const rid = sessionState.state.activeReciterId;
    if (!rid) return null;
    return sessionState.state.participants.find((p) => p.userId === rid) ?? null;
  }, [sessionState.state.activeReciterId, sessionState.state.participants]);

  const canToggleMute = sessionState.isTeacher || sessionState.isActiveReciter;

  const handleLeave = useCallback(() => {
    setLeaveOpen(true);
  }, []);

  const disconnectWebrtc = webrtc.disconnect;

  const confirmLeave = useCallback(() => {
    disconnectWebrtc();
    sessionState.disconnect();
    setLeaveOpen(false);
    navigate(`/sessions/${id}`, { replace: true });
  }, [disconnectWebrtc, sessionState, navigate, id]);

  const confirmEndSession = useCallback(async () => {
    if (!id) return;
    setEndingSession(true);
    setEndError(null);
    try {
      await api.put(`sessions/${id}`, { status: "completed" });
      disconnectWebrtc();
      sessionState.disconnect();
      setEndSessionOpen(false);
      navigate(`/sessions/${id}`, {
        replace: true,
        state: { sessionEndedMessage: t("liveSession.sessionEndedMessage") },
      });
    } catch (err: unknown) {
      setEndError(userFacingApiError(err));
    } finally {
      setEndingSession(false);
    }
  }, [id, navigate, sessionState, t, disconnectWebrtc]);

  const currentAyahForNav = sessionState.state.currentAyah;
  const ayahNavDisabled = !isTeacher || !currentAyahForNav;

  const stepAyah = useCallback(
    (direction: "next" | "prev") => {
      if (!isTeacher || !currentAyahForNav) return;
      const { surah, ayah } = currentAyahForNav;
      const next =
        direction === "next"
          ? getNextAyah(surah, ayah, riwaya)
          : getPrevAyah(surah, ayah, riwaya);
      if (next) sessionState.setCurrentAyah(next.surah, next.ayah);
    },
    [isTeacher, currentAyahForNav, riwaya, sessionState.setCurrentAyah],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "Escape") {
        e.preventDefault();
        setDrawerOpen(false);
        return;
      }
      if (e.key === "m" || e.key === "M") {
        e.preventDefault();
        if (canToggleMute) sessionState.toggleMute();
        return;
      }
      if (isTeacher) {
        if (e.key === "n" || e.key === "N") {
          e.preventDefault();
          stepAyah("next");
          return;
        }
        if (e.key === "p" || e.key === "P") {
          e.preventDefault();
          stepAyah("prev");
          return;
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canToggleMute, sessionState, isTeacher, stepAyah]);

  if (!id) {
    return null;
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--color-bg)]">
        <div
          className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--color-primary)] border-t-transparent"
          role="status"
          aria-label={t("common.loading")}
        />
      </div>
    );
  }

  if (loadError || !sessionDetail || !room || !user || !token) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[var(--color-bg)] p-6">
        <p className="text-center text-[var(--color-text-muted)]">{loadError ?? t("errors.not_found")}</p>
        <Button type="button" variant="outline" onClick={() => navigate(`/sessions/${id}`)}>
          {t("common.back")}
        </Button>
      </div>
    );
  }

  if (anotherTab) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[var(--color-bg)] p-6">
        <p className="max-w-md text-center text-[var(--color-text)]">{t("liveSession.connectedFromAnotherTab")}</p>
        <Button type="button" variant="primary" onClick={() => window.location.reload()}>
          {t("liveSession.refreshPage")}
        </Button>
      </div>
    );
  }

  return (
    <div
      className="relative flex min-h-0 h-[100dvh] max-h-[100dvh] flex-col overflow-hidden bg-[var(--color-bg)]"
      dir={i18n.language?.startsWith("ar") ? "rtl" : "ltr"}
    >
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {announce}
      </div>
      {!webrtc.browserSupported ? (
        <div
          className="fixed top-[max(3.5rem,env(safe-area-inset-top))] left-0 right-0 z-[45] border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm text-amber-900"
          role="alert"
        >
          {t("liveSession.browserNotSupported")}
        </div>
      ) : null}
      {webrtc.micDenied ? (
        <div
          className="fixed top-[max(3.5rem,env(safe-area-inset-top))] left-0 right-0 z-[44] border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm text-amber-900"
          role="status"
        >
          {t("liveSession.micDeniedListener")}
        </div>
      ) : null}
      {reconnectedToast ? (
        <div
          className="fixed top-[max(4.5rem,env(safe-area-inset-top))] left-1/2 z-[55] -translate-x-1/2 rounded-full border border-green-200 bg-green-50 px-4 py-2 text-sm text-green-900 shadow-md"
          role="status"
        >
          {t("liveSession.reconnected")}
        </div>
      ) : null}
      {gradeToast ? (
        <GradeToast
          grade={gradeToast.grade}
          notes={gradeToast.notes}
          onDismiss={() => setGradeToast(null)}
        />
      ) : null}

      <div className="fixed top-0 left-0 right-0 z-30 border-b border-gray-100 bg-[var(--color-surface)]/95 shadow-sm backdrop-blur-sm">
        <SessionTopBar
          connectionStatus={sessionState.wsStatus}
          networkQuality={webrtc.networkQuality}
          surahLabel={surahLabel}
          sessionTitle={sessionTitle}
          elapsedLabel={formatElapsed(elapsedMs)}
          onLeave={handleLeave}
          showEndSession={isTeacher}
          onEndSession={() => setEndSessionOpen(true)}
        />
      </div>

      <main
        className="relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden pt-[max(3.5rem,env(safe-area-inset-top))] pb-[max(9rem,env(safe-area-inset-bottom))] md:pb-24"
        aria-label="Mushaf content"
      >
        <ReconnectingOverlay visible={sessionState.wsStatus === "reconnecting"} />
        <MushafReader
          page={page}
          onPageChange={isTeacher ? goPage : autoFollow ? noopPage : goPage}
          riwaya={riwaya}
          canChangePage={isTeacher || (!isTeacher && !autoFollow)}
          mobileBottomClassName="bottom-[5.5rem] z-[25]"
        >
          <MushafCanvas
            page={page}
            riwaya={riwaya}
            highlightRange={interaction.highlightRange}
            activeWord={interaction.activeWord}
            onWordClick={interaction.handleWordClick}
            onAyahClick={interaction.handleAyahClick}
          />
        </MushafReader>
      </main>

      {!isTeacher ? <AutoFollowBadge enabled={autoFollow} onToggle={handleAutoFollowToggle} /> : null}

      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-gray-100 bg-[#FFFFFF]/95 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] backdrop-blur-sm">
        <SessionBottomBar
          activeReciterName={activeReciterName}
          canToggleMute={canToggleMute}
          isMuted={sessionState.isMuted}
          onToggleMute={sessionState.toggleMute}
          onOpenParticipants={() => setDrawerOpen(true)}
          ayahControls={
            isTeacher ? (
              <AyahControls
                disabled={ayahNavDisabled}
                onNext={() => stepAyah("next")}
                onPrev={() => stepAyah("prev")}
              />
            ) : undefined
          }
        />
      </div>

      <ParticipantDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        participants={sessionState.state.participants}
        teacherId={sessionDetail.teacher_id}
        activeReciterId={sessionState.state.activeReciterId}
        isTeacher={sessionState.isTeacher}
        onSetReciter={sessionState.setReciter}
        teacherVideoRef={teacherVideoRef}
        gradingPanel={
          sessionState.isTeacher && id ? (
            <GradingPanel
              activeReciter={activeReciterParticipant}
              currentAyah={sessionState.state.currentAyah}
              highlightRange={interaction.highlightRange}
              sessionId={id}
              roomId={sessionDetail.room_id}
              riwaya={riwaya}
              locale={loc}
              onGradeSubmitted={(studentId, grade, notes) => {
                sessionState.sendGradeNotification(studentId, grade, notes);
              }}
            />
          ) : undefined
        }
      />

      <Modal open={leaveOpen} title={t("liveSession.leave")} onClose={() => setLeaveOpen(false)}>
        <p className="mb-6 text-sm text-[var(--color-text-muted)]">{t("liveSession.leaveConfirm")}</p>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => setLeaveOpen(false)}>
            {t("common.cancel")}
          </Button>
          <Button type="button" variant="primary" onClick={confirmLeave}>
            {t("liveSession.leave")}
          </Button>
        </div>
      </Modal>

      <Modal open={endSessionOpen} title={t("liveSession.endSession")} onClose={() => setEndSessionOpen(false)}>
        <p className="mb-4 text-sm text-[var(--color-text-muted)]">{t("liveSession.endSessionConfirm")}</p>
        {endError ? <p className="mb-4 text-sm text-red-600">{endError}</p> : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => setEndSessionOpen(false)}>
            {t("common.cancel")}
          </Button>
          <Button type="button" variant="danger" loading={endingSession} onClick={() => void confirmEndSession()}>
            {t("liveSession.endSession")}
          </Button>
        </div>
      </Modal>

      <Modal
        open={blocker.state === "blocked"}
        title={t("liveSession.leaveSessionConfirm")}
        onClose={() => blocker.reset?.()}
      >
        <p className="mb-6 text-sm text-[var(--color-text-muted)]">{t("liveSession.navigationLeaveHint")}</p>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => blocker.reset?.()}>
            {t("liveSession.stay")}
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={() => {
              disconnectWebrtc();
              sessionState.disconnect();
              blocker.proceed?.();
            }}
          >
            {t("liveSession.leave")}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
