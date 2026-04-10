// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Hamza Ghandouri

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useBlocker, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api, userFacingApiError } from "../../lib/api";
import type { ErrorCategory, ErrorSeverity, Paginated, RecitationPublic, Room, SessionDetail } from "../../types";
import { useAuthStore } from "../../stores/authStore";
import { useMushafInteraction, type MushafWordClickData } from "../../hooks/useMushafInteraction";
import { useAnnotations } from "../../hooks/useAnnotations";
import { useSessionState } from "../../hooks/useSessionState";
import { MushafCanvas } from "../../components/mushaf/MushafCanvas";
import { MushafReader } from "../../components/mushaf/MushafReader";
import { SessionControlsCorner } from "../../components/session/SessionControlsCorner";
import {
  LiveSessionMobileBottomBar,
  LiveSessionMobileTopBar,
  LiveSessionOverflowSheet,
} from "../../components/session/LiveSessionMobileChrome";
import { ParticipantDrawer } from "../../components/session/ParticipantDrawer";
import { Modal } from "../../components/ui/Modal";
import { Button } from "../../components/ui/Button";
import {
  findJuzStartingAtPage,
  getHizbForAyah,
  getJuz,
  getJuzForAyah,
  getNextAyah,
  getPrevAyah,
  getSurahAyahAtPageStart,
  getSurahName,
  getSurahRangeOnPage,
  getTotalPages,
} from "../../lib/quranService";
import type { Riwaya } from "../../lib/quranService";
import { AutoFollowBadge } from "../../components/session/AutoFollowBadge";
import { GradingPanel } from "../../components/session/GradingPanel";
import { GradeToast } from "../../components/session/GradeToast";
import { ReconnectingOverlay } from "../../components/session/ReconnectingOverlay";
import { AnnotationToolbar, type AnnotationTarget } from "../../components/session/AnnotationToolbar";
import { useWebRTCConnection } from "../../hooks/useWebRTCConnection";
import { cn } from "@/lib/utils";
import { MEET_ICON_BTN_BASE } from "../../components/session/sessionMeetButtonStyles";
import { Info, Menu, MessageSquare, Users } from "lucide-react";

function formatElapsed(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

/** Desktop session chrome regions (`data-session-zone` for tests / layout hooks). */
function SessionLayoutZone({
  zoneId,
  ariaLabel,
  className,
  children,
}: {
  zoneId: string;
  ariaLabel: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      aria-label={ariaLabel}
      data-session-zone={zoneId}
      className={cn("flex min-h-0 min-w-0 flex-col p-2", className)}
    >
      <div className="min-h-0 flex-1">{children}</div>
    </section>
  );
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
  const [mobileOverflowOpen, setMobileOverflowOpen] = useState(false);
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
  const [annotationTarget, setAnnotationTarget] = useState<AnnotationTarget | null>(null);
  const [annotationMode, setAnnotationMode] = useState(false);
  const [currentRecitationId, setCurrentRecitationId] = useState<string | null>(null);

  const {
    loadAnnotations,
    addError,
    addComment,
    getWordAnnotationClass,
  } = useAnnotations(currentRecitationId);

  const annotationTargetRef = useRef<AnnotationTarget | null>(null);
  annotationTargetRef.current = annotationTarget;

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

  const closeAnnotationToolbar = useCallback(() => setAnnotationTarget(null), []);

  const handleLiveWordClick = useCallback(
    (data: MushafWordClickData) => {
      interaction.handleWordClick(data);
      if (annotationMode && isTeacher && data.rect) {
        setAnnotationTarget({
          surah: data.surah,
          ayah: data.ayah,
          wordIndex: data.wordIndex,
          rect: data.rect,
        });
      }
    },
    [interaction, annotationMode, isTeacher],
  );

  useEffect(() => {
    if (!annotationMode) setAnnotationTarget(null);
  }, [annotationMode]);

  const handleMarkAnnotationError = useCallback(
    async (severity: ErrorSeverity, category: ErrorCategory, comment?: string) => {
      if (!annotationTarget || !currentRecitationId) {
        setAnnounce(t("annotation.noRecitation"));
        return;
      }
      await addError(
        currentRecitationId,
        annotationTarget.surah,
        annotationTarget.ayah,
        annotationTarget.wordIndex,
        severity,
        category,
        comment,
      );
    },
    [annotationTarget, currentRecitationId, addError, t],
  );

  const handleAnnotationComment = useCallback(
    async (comment: string) => {
      if (!annotationTarget || !currentRecitationId) {
        setAnnounce(t("annotation.noRecitation"));
        return;
      }
      await addComment(
        currentRecitationId,
        annotationTarget.surah,
        annotationTarget.ayah,
        annotationTarget.wordIndex,
        comment,
      );
    },
    [annotationTarget, currentRecitationId, addComment, t],
  );

  const handleAnnotationRepeat = useCallback(
    (surah: number, ayah: number) => {
      interaction.setHighlightRange({ surah, ayahStart: ayah, ayahEnd: ayah });
      sessionState.setCurrentAyah(surah, ayah);
    },
    [interaction, sessionState],
  );

  const handleAutoFollowToggle = useCallback(() => {
    setAutoFollow((prev) => {
      if (prev) {
        setStudentBrowsePage(sessionState.state.currentPage ?? 1);
        return false;
      }
      return true;
    });
  }, [sessionState.state.currentPage]);

  const navCornerLabels = useMemo(() => {
    const { startSurah, endSurah } = getSurahRangeOnPage(page, riwaya);
    const [s, a] = getSurahAyahAtPageStart(page, riwaya);
    const juzAtPageStart = findJuzStartingAtPage(page, riwaya);
    const juz = juzAtPageStart ?? getJuz(getJuzForAyah(s, a, riwaya));
    const surahLabel =
      startSurah === endSurah
        ? getSurahName(startSurah, loc)
        : `${getSurahName(startSurah, loc)} – ${getSurahName(endSurah, loc)}`;
    const hizbN = getHizbForAyah(s, a, riwaya);
    return { surahLabel, juzN: juz?.number ?? 0, hizbN };
  }, [page, riwaya, loc]);

  useEffect(() => {
    if (!sessionDetail?.scheduled_at) return;
    const start = new Date(sessionDetail.scheduled_at).getTime();
    const tick = () => setElapsedMs(Math.max(0, Date.now() - start));
    tick();
    const idTimer = window.setInterval(tick, 1000);
    return () => clearInterval(idTimer);
  }, [sessionDetail?.scheduled_at]);

  const activeReciterParticipant = useMemo(() => {
    const rid = sessionState.state.activeReciterId;
    if (!rid) return null;
    return sessionState.state.participants.find((p) => p.userId === rid) ?? null;
  }, [sessionState.state.activeReciterId, sessionState.state.participants]);

  useEffect(() => {
    if (!currentRecitationId) return;
    void loadAnnotations(currentRecitationId);
  }, [currentRecitationId, loadAnnotations]);

  useEffect(() => {
    if (!id || !activeReciterParticipant?.userId || !isTeacher) return;
    let cancelled = false;
    void (async () => {
      try {
        const { data } = await api.get<Paginated<RecitationPublic>>("recitations", {
          params: { session_id: id, limit: 50 },
        });
        if (cancelled) return;
        const mine = data.items.filter((r) => r.student_id === activeReciterParticipant.userId);
        mine.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        setCurrentRecitationId(mine[0]?.id ?? null);
      } catch {
        if (!cancelled) setCurrentRecitationId(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, activeReciterParticipant?.userId, isTeacher]);

  useEffect(() => {
    setAnnotationTarget(null);
  }, [activeReciterParticipant?.userId]);

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

  /** Current ayah for teacher nav (keyboard N/P); UI strip removed until product decides. */
  const currentAyahForNav = sessionState.state.currentAyah;

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
        if (annotationTargetRef.current) {
          setAnnotationTarget(null);
          return;
        }
        if (mobileOverflowOpen) {
          setMobileOverflowOpen(false);
          return;
        }
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
  }, [canToggleMute, sessionState, isTeacher, stepAyah, mobileOverflowOpen]);

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
      className="relative flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden bg-white"
      dir={i18n.language?.startsWith("ar") ? "rtl" : "ltr"}
    >
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {announce}
      </div>
      {!webrtc.browserSupported ? (
        <div
          className="fixed top-[max(0.5rem,env(safe-area-inset-top))] left-0 right-0 z-[60] border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm text-amber-900"
          role="alert"
        >
          {t("liveSession.browserNotSupported")}
        </div>
      ) : null}
      
      {reconnectedToast ? (
        <div
          className="fixed top-[max(3rem,env(safe-area-inset-top))] left-1/2 z-[60] -translate-x-1/2 rounded-full border border-green-200 bg-green-50 px-4 py-2 text-sm text-green-900 shadow-md"
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

      <main
        className={
          webrtc.browserSupported
            ? "relative flex min-h-0 w-full flex-1 flex-col overflow-hidden pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-[max(env(safe-area-inset-top),0.5rem)]"
            : "relative flex min-h-0 w-full flex-1 flex-col overflow-hidden py-[max(calc(3rem+4px),env(safe-area-inset-top),env(safe-area-inset-bottom))]"
        }
        aria-label="Mushaf content"
      >
        <div
          className={cn(
            "grid min-h-0 flex-1",
            "grid-cols-1 grid-rows-[auto_minmax(0,1fr)_auto] gap-0 px-1",
            "md:grid-cols-3 md:grid-rows-[minmax(0,1fr)_minmax(0,auto)] md:gap-2 md:px-2",
          )}
        >
          <LiveSessionMobileTopBar
            surahLabel={navCornerLabels.surahLabel}
            page={page}
            juzN={navCornerLabels.juzN}
            hizbN={navCornerLabels.hizbN}
            onOpenMenu={() => window.alert(t("common.comingSoon"))}
          />

          <div
            className="relative flex min-h-0 min-w-0 flex-col overflow-hidden rounded-md bg-white md:col-span-3 md:row-start-1"
            aria-label={t("mushaf.title")}
          >
            <ReconnectingOverlay visible={sessionState.wsStatus === "reconnecting"} />
            <MushafReader
              page={page}
              onPageChange={isTeacher ? goPage : autoFollow ? noopPage : goPage}
              riwaya={riwaya}
              canChangePage={isTeacher || (!isTeacher && !autoFollow)}
              hideNavigation
              omitMenuStrip
              className="h-full min-h-0"
              immersiveHeader={
                <nav
                  className="hidden min-h-9 w-full flex-row flex-wrap items-start justify-start gap-2 md:flex"
                  aria-label={t("mushaf.menuNavigationZone")}
                  data-testid="quran-menu-navigation-zone"
                >
                  <button
                    type="button"
                    onClick={() => window.alert(t("common.comingSoon"))}
                    title={t("liveSession.tooltip.openMenu")}
                    aria-label={t("common.openMenu")}
                    className={cn(
                      MEET_ICON_BTN_BASE,
                      "h-9 w-9 shrink-0 bg-gradient-to-b from-slate-100 to-slate-200/90 text-slate-700 hover:from-slate-200 hover:to-slate-300/90",
                    )}
                  >
                    <Menu className="h-4 w-4" strokeWidth={2.25} />
                  </button>
                  <div className="min-w-0 flex-1 text-start leading-snug">
                    <p
                      className="truncate text-sm font-semibold text-[#2c5f7c]"
                      style={{ fontFamily: "var(--font-ui)" }}
                    >
                      {navCornerLabels.surahLabel}
                    </p>
                    <p className="mt-0.5 flex flex-wrap items-baseline gap-x-1.5 text-xs">
                      <span className="font-medium text-[#374151]">{t("mushaf.pageOf", { n: page })}</span>
                      {navCornerLabels.juzN > 0 ? (
                        <>
                          <span className="text-muted-foreground/60" aria-hidden>
                            ·
                          </span>
                          <span className="text-muted-foreground">{t("mushaf.juzN", { n: navCornerLabels.juzN })}</span>
                        </>
                      ) : null}
                      {navCornerLabels.hizbN > 0 ? (
                        <>
                          <span className="text-muted-foreground/60" aria-hidden>
                            /
                          </span>
                          <span className="text-muted-foreground">
                            {t("mushaf.hizb")} {navCornerLabels.hizbN}
                          </span>
                        </>
                      ) : null}
                    </p>
                  </div>
                </nav>
              }
            >
              <MushafCanvas
                page={page}
                riwaya={riwaya}
                highlightRange={interaction.highlightRange}
                activeWord={interaction.activeWord}
                onWordClick={isTeacher ? handleLiveWordClick : interaction.handleWordClick}
                onAyahClick={interaction.handleAyahClick}
                getWordAnnotationClass={isTeacher ? getWordAnnotationClass : undefined}
              />
            </MushafReader>
          </div>

          <LiveSessionMobileBottomBar
            isTeacher={isTeacher}
            isMuted={sessionState.isMuted}
            canToggleMute={canToggleMute}
            onToggleMute={sessionState.toggleMute}
            annotationMode={annotationMode}
            onToggleAnnotation={isTeacher ? () => setAnnotationMode((m) => !m) : undefined}
            onOpenParticipants={() => setDrawerOpen(true)}
            onOpenMore={() => setMobileOverflowOpen(true)}
            onLeave={handleLeave}
            onEndSession={() => setEndSessionOpen(true)}
          />

          <SessionLayoutZone
            zoneId="bl"
            ariaLabel={t("liveSession.layoutZoneBottomLeft")}
            className="hidden min-h-[3rem] md:col-start-1 md:row-start-2 md:flex"
          >
            <div className="flex min-h-10 flex-wrap items-center justify-start gap-2">
              <button
                type="button"
                onClick={handleLeave}
                title={t("liveSession.tooltip.leave")}
                aria-label={t("liveSession.leave")}
                className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-[#555] shadow-sm transition hover:bg-gray-50"
                style={{ fontFamily: "var(--font-ui)" }}
              >
                {t("liveSession.leave")}
              </button>
              {isTeacher ? (
                <button
                  type="button"
                  onClick={() => setEndSessionOpen(true)}
                  title={t("liveSession.tooltip.endSession")}
                  aria-label={t("liveSession.endSession")}
                  className="rounded-lg bg-[#EF5350] px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-[#E53935]"
                  style={{ fontFamily: "var(--font-ui)" }}
                >
                  {t("liveSession.endSession")}
                </button>
              ) : null}
            </div>
          </SessionLayoutZone>

          <SessionLayoutZone
            zoneId="bm"
            ariaLabel={t("liveSession.layoutZoneBottomMiddle")}
            className="hidden md:col-start-2 md:row-start-2 md:flex"
          >
            <div className="flex min-h-10 flex-wrap items-center justify-center gap-2">
              <SessionControlsCorner
                isMuted={sessionState.isMuted}
                canToggleMute={canToggleMute}
                onToggleMute={sessionState.toggleMute}
                isTeacher={isTeacher}
                annotationMode={annotationMode}
                onToggleAnnotation={isTeacher ? () => setAnnotationMode((m) => !m) : undefined}
              />
              {!isTeacher ? (
                <AutoFollowBadge enabled={autoFollow} onToggle={handleAutoFollowToggle} inline />
              ) : null}
            </div>
          </SessionLayoutZone>

          <SessionLayoutZone
            zoneId="br"
            ariaLabel={t("liveSession.layoutZoneBottomRight")}
            className="hidden md:col-start-3 md:row-start-2 md:flex"
          >
            <div className="flex min-h-10 flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => window.alert(t("common.comingSoon"))}
                title={t("liveSession.tooltip.sessionInfo")}
                aria-label={t("liveSession.sessionInfo")}
                className={cn(
                  MEET_ICON_BTN_BASE,
                  "bg-gradient-to-b from-sky-50 to-sky-100/90 text-sky-700 hover:from-sky-100 hover:to-sky-200/90",
                )}
              >
                <Info className="h-5 w-5" strokeWidth={2.25} />
              </button>
              <button
                type="button"
                onClick={() => setDrawerOpen(true)}
                title={t("liveSession.tooltip.participants")}
                aria-label={t("liveSession.participants")}
                className={cn(
                  MEET_ICON_BTN_BASE,
                  "bg-gradient-to-b from-emerald-50 to-emerald-100/90 text-emerald-800 hover:from-emerald-100 hover:to-emerald-200/90",
                )}
              >
                <Users className="h-5 w-5" strokeWidth={2.25} />
              </button>
              <button
                type="button"
                onClick={() => window.alert(t("common.comingSoon"))}
                title={t("liveSession.tooltip.chat")}
                aria-label={t("liveSession.chat")}
                className={cn(
                  MEET_ICON_BTN_BASE,
                  "bg-gradient-to-b from-violet-50 to-violet-100/90 text-violet-700 hover:from-violet-100 hover:to-violet-200/90",
                )}
              >
                <MessageSquare className="h-5 w-5" strokeWidth={2.25} />
              </button>
            </div>
          </SessionLayoutZone>
        </div>
      </main>

      <LiveSessionOverflowSheet
        open={mobileOverflowOpen}
        onOpenChange={setMobileOverflowOpen}
        connectionStatus={sessionState.wsStatus}
        networkQuality={webrtc.networkQuality}
        participantCount={sessionState.state.participants.length}
        elapsedLabel={formatElapsed(elapsedMs)}
        isTeacher={isTeacher}
        autoFollow={autoFollow}
        onAutoFollowToggle={handleAutoFollowToggle}
      />

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
              onRecitationCreated={(rec) => setCurrentRecitationId(rec.id)}
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

      {isTeacher ? (
        <AnnotationToolbar
          target={annotationTarget}
          onMarkError={handleMarkAnnotationError}
          onRepeat={handleAnnotationRepeat}
          onComment={handleAnnotationComment}
          onGood={closeAnnotationToolbar}
          onClose={closeAnnotationToolbar}
        />
      ) : null}
    </div>
  );
}
