// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useBlocker, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api, userFacingApiError } from "../../lib/api";
import type {
  ErrorAnnotation,
  ErrorCategory,
  ErrorSeverity,
  Paginated,
  RecitationPublic,
  Room,
  SessionDetail,
} from "../../types";
import { useAuthStore } from "../../stores/authStore";
import { useMushafInteraction, type MushafWordClickData } from "../../hooks/useMushafInteraction";
import { useAnnotations } from "../../hooks/useAnnotations";
import { useSessionState, type SessionParticipant } from "../../hooks/useSessionState";
import { MushafCanvas } from "../../components/mushaf/MushafCanvas";
import { MushafNavigatorSheet } from "../../components/mushaf/MushafNavigatorSheet";
import { MushafReader } from "../../components/mushaf/MushafReader";
import { SessionControlsCorner } from "../../components/session/SessionControlsCorner";
import {
  LiveSessionMobileBottomBar,
  LiveSessionMobileTopBar,
  LiveSessionOverflowSheet,
} from "../../components/session/LiveSessionMobileChrome";
import { ParticipantDrawer } from "../../components/session/ParticipantDrawer";
import { Modal } from "../../components/ui/Modal";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
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
import { AudioMigrationBanner } from "../../components/session/AudioMigrationBanner";
import { AnnotationToolbar, type AnnotationTarget } from "../../components/session/AnnotationToolbar";
import { StudentAnnotationPopover } from "../../components/session/StudentAnnotationPopover";
import { AyahRangeAudioButton } from "../../components/recitations/AyahRangeAudioButton";
import { cn } from "@/lib/utils";
import { MEET_ICON_BTN_BASE, MENU_ICON_BUTTON_CLASS } from "../../components/session/sessionMeetButtonStyles";
import { Info, LogOut, Menu, MessageSquare, PhoneOff, Users } from "lucide-react";
function formatElapsed(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

function shouldShowStudentPopoverContent(found: ErrorAnnotation[]): boolean {
  if (found.length === 0) return false;
  const onlyRepeat =
    found.every((a) => a.annotation_kind === "repeat") &&
    !found.some((a) => a.teacher_comment?.trim());
  return !onlyRepeat;
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
  const [navigatorOpen, setNavigatorOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [endSessionOpen, setEndSessionOpen] = useState(false);
  const [endingSession, setEndingSession] = useState(false);
  const [endError, setEndError] = useState<string | null>(null);
  const [gradeToast, setGradeToast] = useState<{ grade: string; notes?: string } | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const hadServerCurrentAyahRef = useRef(false);
  const teacherSeededFromServer = useRef(false);
  const [anotherTab, setAnotherTab] = useState(false);
  const [announce, setAnnounce] = useState("");
  const [reconnectedToast, setReconnectedToast] = useState(false);
  const [annotationTarget, setAnnotationTarget] = useState<AnnotationTarget | null>(null);
  const [annotationMode, setAnnotationMode] = useState(false);
  const [currentRecitationId, setCurrentRecitationId] = useState<string | null>(null);
  /** Bumped when the active-reciter fetch starts and when grading creates a recitation; stale fetch completions must not overwrite `currentRecitationId`. */
  const recitationFetchEpochRef = useRef(0);
  /** Deduplicates concurrent `ensureRecitation` POSTs while the first is in flight. */
  const ensureRecitationInFlightRef = useRef<Promise<string | null> | null>(null);
  const [studentPopover, setStudentPopover] = useState<{
    annotations: ErrorAnnotation[];
    rect: DOMRect;
    pinned: boolean;
  } | null>(null);
  const [studentAudioHover, setStudentAudioHover] = useState<{
    surah: number;
    ayah: number;
    rect: DOMRect;
  } | null>(null);
  const [studentAudioHighlight, setStudentAudioHighlight] = useState<{
    surah: number;
    ayahStart: number;
    ayahEnd: number;
  } | null>(null);

  const [gradingDialogOpen, setGradingDialogOpen] = useState(false);
  /** Bumps when the grading modal opens so GradingPanel remounts with fresh surah/ayah state. */
  const [gradingDialogSeq, setGradingDialogSeq] = useState(0);
  const [gradingDialogContext, setGradingDialogContext] = useState<{
    participant: SessionParticipant;
    currentAyah: { surah: number; ayah: number } | null;
    highlightRange: { surah: number; ayahStart: number; ayahEnd: number } | null;
  } | null>(null);
  const skipGradingModalRef = useRef(false);
  const prevActiveReciterIdRef = useRef<string | null>(null);
  const gradingContextSnapshotRef = useRef<{
    participant: SessionParticipant;
    currentAyah: { surah: number; ayah: number } | null;
    highlightRange: { surah: number; ayahStart: number; ayahEnd: number } | null;
  } | null>(null);

  const studentPopoverPinnedRef = useRef(false);
  const hoverCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const studentAudioHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelHoverCloseTimer = useCallback(() => {
    if (hoverCloseTimerRef.current != null) {
      clearTimeout(hoverCloseTimerRef.current);
      hoverCloseTimerRef.current = null;
    }
  }, []);

  const scheduleHoverClose = useCallback(() => {
    cancelHoverCloseTimer();
    hoverCloseTimerRef.current = window.setTimeout(() => {
      hoverCloseTimerRef.current = null;
      setStudentPopover((prev) => (prev?.pinned ? prev : null));
    }, 200);
  }, [cancelHoverCloseTimer]);

  useLayoutEffect(() => {
    studentPopoverPinnedRef.current = studentPopover?.pinned ?? false;
  }, [studentPopover]);

  useEffect(
    () => () => {
      cancelHoverCloseTimer();
    },
    [cancelHoverCloseTimer],
  );

  const closeStudentPopover = useCallback(() => {
    cancelHoverCloseTimer();
    studentPopoverPinnedRef.current = false;
    setStudentPopover(null);
  }, [cancelHoverCloseTimer]);

  const cancelStudentAudioHideTimer = useCallback(() => {
    if (studentAudioHideTimerRef.current != null) {
      clearTimeout(studentAudioHideTimerRef.current);
      studentAudioHideTimerRef.current = null;
    }
  }, []);

  const scheduleStudentAudioHide = useCallback(
    (delayMs = 5000) => {
      cancelStudentAudioHideTimer();
      studentAudioHideTimerRef.current = window.setTimeout(() => {
        studentAudioHideTimerRef.current = null;
        setStudentAudioHover(null);
      }, delayMs);
    },
    [cancelStudentAudioHideTimer],
  );

  useEffect(
    () => () => {
      cancelStudentAudioHideTimer();
    },
    [cancelStudentAudioHideTimer],
  );

  const {
    loadAnnotations,
    getWordAnnotationClass,
    getWordAnnotations,
    receiveAnnotationFromWs,
    removeAnnotationFromWs,
  } = useAnnotations(currentRecitationId);

  const annotationTargetRef = useRef<AnnotationTarget | null>(null);
  annotationTargetRef.current = annotationTarget;
  const isTeacherRef = useRef(false);

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
    onAnnotationAdded: (annotation) => {
      receiveAnnotationFromWs(annotation);
      if (isTeacherRef.current === false && annotation.annotation_kind === "repeat") {
        setAnnounce(t("annotation.repeatRequested"));
      }
      setStudentPopover((prev) => {
        if (!prev || prev.annotations.length === 0) return prev;
        if (prev.annotations.some((a) => a.id === annotation.id)) return prev;
        const first = prev.annotations[0];
        if (
          annotation.surah === first.surah &&
          annotation.ayah === first.ayah &&
          (annotation.word_position === first.word_position || annotation.word_position === null)
        ) {
          return { ...prev, annotations: [...prev.annotations, annotation] };
        }
        return prev;
      });
    },
    onAnnotationRemoved: (annotationId) => {
      removeAnnotationFromWs(annotationId);
      setStudentPopover((prev) => {
        if (!prev) return prev;
        const next = prev.annotations.filter((a) => a.id !== annotationId);
        if (next.length === 0) return null;
        return { ...prev, annotations: next };
      });
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

  isTeacherRef.current = sessionState.isTeacher;

  // TODO(MEDIA-MIGRATION P4/P5): replace with useLivekitConnection
  const audioMigrating = true;

  const browserSupported = typeof RTCPeerConnection !== "undefined";
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

  /** When a student is set as active reciter, turn on pen/annotation mode so the teacher can mark without an extra click. */
  useEffect(() => {
    if (!sessionReady || !isTeacher || !sessionDetail) return;
    const rid = sessionState.state.activeReciterId;
    const tid = sessionDetail.teacher_id;
    if (!rid || rid === tid) return;
    setAnnotationMode(true);
  }, [sessionReady, isTeacher, sessionDetail, sessionState.state.activeReciterId]);

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

  const canNavigate = isTeacher || (!isTeacher && !autoFollow);
  const navigatorSide = i18n.language?.startsWith("ar") ? "right" : "left";

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!sessionReady || anotherTab) return;
      const el = e.target as HTMLElement;
      if (el.closest("input,textarea,[contenteditable=true]")) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setNavigatorOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sessionReady, anotherTab]);

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

  const handleStudentWordEnter = useCallback(
    (data: MushafWordClickData) => {
      if (studentPopoverPinnedRef.current) return;
      if (!data.rect) return;
      const found = getWordAnnotations(data.surah, data.ayah, data.wordIndex);
      if (!shouldShowStudentPopoverContent(found)) return;
      cancelHoverCloseTimer();
      studentPopoverPinnedRef.current = false;
      setStudentPopover({ annotations: found, rect: data.rect, pinned: false });
    },
    [getWordAnnotations, cancelHoverCloseTimer],
  );

  const handleStudentWordLeave = useCallback(() => {
    if (studentPopoverPinnedRef.current) return;
    scheduleHoverClose();
  }, [scheduleHoverClose]);

  const handleStudentAyahMarkerEnter = useCallback(
    (data: { surah: number; ayah: number; rect?: DOMRect }) => {
      if (!data.rect) return;
      cancelStudentAudioHideTimer();
      setStudentAudioHover({
        surah: data.surah,
        ayah: data.ayah,
        rect: data.rect,
      });
    },
    [cancelStudentAudioHideTimer],
  );

  const handleStudentAyahMarkerLeave = useCallback(() => {
    scheduleStudentAudioHide(2000);
  }, [scheduleStudentAudioHide]);

  const handleStudentWordClick = useCallback(
    (data: MushafWordClickData) => {
      const found = getWordAnnotations(data.surah, data.ayah, data.wordIndex);
      if (found.length > 0 && data.rect) {
        if (!shouldShowStudentPopoverContent(found)) {
          interaction.handleWordClick(data);
          return;
        }
        cancelHoverCloseTimer();
        studentPopoverPinnedRef.current = true;
        setStudentPopover({ annotations: found, rect: data.rect, pinned: true });
        return;
      }
      interaction.handleWordClick(data);
    },
    [getWordAnnotations, interaction, cancelHoverCloseTimer],
  );

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

  const ensureRecitation = useCallback(async (): Promise<string | null> => {
    if (currentRecitationId) return currentRecitationId;
    if (!activeReciterParticipant?.userId) {
      setAnnounce(t("annotation.noActiveReciter"));
      return null;
    }
    if (!id || !sessionDetail?.room_id) {
      setAnnounce(t("annotation.creationFailed"));
      return null;
    }
    if (ensureRecitationInFlightRef.current) {
      return ensureRecitationInFlightRef.current;
    }
    const p = (async () => {
      try {
        const hr = interaction.highlightRange;
        let surah: number;
        let ayah_start: number;
        let ayah_end: number;
        if (hr) {
          surah = hr.surah;
          ayah_start = hr.ayahStart;
          ayah_end = Math.max(hr.ayahStart, hr.ayahEnd);
        } else {
          const [s, a] = getSurahAyahAtPageStart(page, riwaya);
          surah = s;
          ayah_start = a;
          ayah_end = a;
        }
        const { data } = await api.post<RecitationPublic>("recitations", {
          student_id: activeReciterParticipant.userId,
          room_id: sessionDetail.room_id,
          session_id: id,
          surah,
          ayah_start,
          ayah_end,
          riwaya,
        });
        recitationFetchEpochRef.current++;
        setCurrentRecitationId(data.id);
        setAnnounce(t("annotation.recitationCreated"));
        return data.id;
      } catch {
        setAnnounce(t("annotation.creationFailed"));
        return null;
      }
    })();
    ensureRecitationInFlightRef.current = p;
    return p.finally(() => {
      ensureRecitationInFlightRef.current = null;
    });
  }, [
    currentRecitationId,
    activeReciterParticipant?.userId,
    id,
    sessionDetail?.room_id,
    interaction.highlightRange,
    page,
    riwaya,
    t,
  ]);

  const handleMarkAnnotationError = useCallback(
    (severity: ErrorSeverity, category: ErrorCategory, comment?: string) => {
      if (!annotationTarget) return;
      void (async () => {
        const recId = currentRecitationId ?? (await ensureRecitation());
        if (!recId) return;
        sessionState.sendCreateAnnotation({
          recitation_id: recId,
          surah: annotationTarget.surah,
          ayah: annotationTarget.ayah,
          word_position: annotationTarget.wordIndex,
          error_severity: severity,
          error_category: category,
          teacher_comment: comment ?? null,
          annotation_kind: "error",
        });
        closeAnnotationToolbar();
      })();
    },
    [
      annotationTarget,
      currentRecitationId,
      ensureRecitation,
      sessionState.sendCreateAnnotation,
      closeAnnotationToolbar,
    ],
  );

  const handleAnnotationComment = useCallback(
    (comment: string) => {
      if (!annotationTarget) return;
      void (async () => {
        const recId = currentRecitationId ?? (await ensureRecitation());
        if (!recId) return;
        sessionState.sendCreateAnnotation({
          recitation_id: recId,
          surah: annotationTarget.surah,
          ayah: annotationTarget.ayah,
          word_position: annotationTarget.wordIndex,
          error_severity: "khafi",
          error_category: "other",
          teacher_comment: comment,
          annotation_kind: "note",
        });
        closeAnnotationToolbar();
      })();
    },
    [
      annotationTarget,
      currentRecitationId,
      ensureRecitation,
      sessionState.sendCreateAnnotation,
      closeAnnotationToolbar,
    ],
  );

  const handleAnnotationRepeat = useCallback(() => {
    if (!annotationTarget) return;
    void (async () => {
      const recId = currentRecitationId ?? (await ensureRecitation());
      if (!recId) return;
      sessionState.sendCreateAnnotation({
        recitation_id: recId,
        surah: annotationTarget.surah,
        ayah: annotationTarget.ayah,
        word_position: annotationTarget.wordIndex,
        error_severity: "khafi",
        error_category: "other",
        teacher_comment: null,
        annotation_kind: "repeat",
      });
      closeAnnotationToolbar();
    })();
  }, [
    annotationTarget,
    currentRecitationId,
    ensureRecitation,
    sessionState.sendCreateAnnotation,
    closeAnnotationToolbar,
  ]);

  const handleAnnotationGood = useCallback(() => {
    if (!annotationTarget) return;
    void (async () => {
      const recId = currentRecitationId ?? (await ensureRecitation());
      if (!recId) return;
      sessionState.sendCreateAnnotation({
        recitation_id: recId,
        surah: annotationTarget.surah,
        ayah: annotationTarget.ayah,
        word_position: annotationTarget.wordIndex,
        error_severity: "khafi",
        error_category: "other",
        teacher_comment: null,
        annotation_kind: "good",
      });
      closeAnnotationToolbar();
    })();
  }, [
    annotationTarget,
    currentRecitationId,
    ensureRecitation,
    sessionState.sendCreateAnnotation,
    closeAnnotationToolbar,
  ]);

  useEffect(() => {
    if (activeReciterParticipant) {
      const [pageSurah, pageAyah] = getSurahAyahAtPageStart(page, riwaya);
      const fallbackAyah = { surah: pageSurah, ayah: pageAyah };
      gradingContextSnapshotRef.current = {
        participant: activeReciterParticipant,
        currentAyah: sessionState.state.currentAyah ?? fallbackAyah,
        highlightRange: interaction.highlightRange,
      };
    }
  }, [
    activeReciterParticipant,
    sessionState.state.currentAyah,
    interaction.highlightRange,
    page,
    riwaya,
  ]);

  useEffect(() => {
    const cur = sessionState.state.activeReciterId;
    const prev = prevActiveReciterIdRef.current;

    if (prev && !cur && isTeacher && id) {
      if (skipGradingModalRef.current) {
        skipGradingModalRef.current = false;
      } else {
        const ctx = gradingContextSnapshotRef.current;
        if (ctx && ctx.participant.userId === prev) {
          setGradingDialogContext(ctx);
          setGradingDialogOpen(true);
          setGradingDialogSeq((n) => n + 1);
        }
      }
    }

    prevActiveReciterIdRef.current = cur;
  }, [sessionState.state.activeReciterId, isTeacher, id]);

  useEffect(() => {
    if (!currentRecitationId) return;
    void loadAnnotations(currentRecitationId);
  }, [currentRecitationId, loadAnnotations]);

  // Same recitation row for teacher and all students: the active reciter's latest for this session.
  // Defensive `session_id === id` avoids picking legacy rows with NULL or a different session (WS create-annotation rejects those).
  useEffect(() => {
    if (!id || !activeReciterParticipant?.userId) {
      setCurrentRecitationId(null);
      return;
    }
    const epoch = ++recitationFetchEpochRef.current;
    let cancelled = false;
    void (async () => {
      try {
        const { data } = await api.get<Paginated<RecitationPublic>>("recitations", {
          params: { session_id: id, limit: 50 },
        });
        if (cancelled || epoch !== recitationFetchEpochRef.current) return;
        const forActiveStudent = data.items.filter((r) => r.student_id === activeReciterParticipant.userId);
        const forSessionAndStudent = forActiveStudent.filter((r) => r.session_id === id);
        forSessionAndStudent.sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        );
        if (forSessionAndStudent.length === 0 && forActiveStudent.length > 0 && isTeacher) {
          setAnnounce(t("annotation.noRecitation"));
        }
        setCurrentRecitationId(forSessionAndStudent[0]?.id ?? null);
      } catch {
        if (!cancelled && epoch === recitationFetchEpochRef.current) setCurrentRecitationId(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, activeReciterParticipant?.userId, isTeacher, t]);

  useEffect(() => {
    setAnnotationTarget(null);
  }, [activeReciterParticipant?.userId]);

  const handleLeave = useCallback(() => {
    setLeaveOpen(true);
  }, []);

  const disconnectWebrtc = () => {};

  const confirmLeave = useCallback(() => {
    skipGradingModalRef.current = true;
    disconnectWebrtc();
    sessionState.disconnect();
    setLeaveOpen(false);
    navigate(`/sessions/${id}`, { replace: true });
  }, [disconnectWebrtc, sessionState, navigate, id]);

  const confirmEndSession = useCallback(async () => {
    if (!id) return;
    skipGradingModalRef.current = true;
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
  }, [sessionState, isTeacher, stepAyah, mobileOverflowOpen]);

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
      {audioMigrating ? (
        <div className="fixed inset-x-[max(0.5rem,env(safe-area-inset-left))] top-[max(0.5rem,env(safe-area-inset-top))] z-[70]">
          <AudioMigrationBanner />
        </div>
      ) : null}
      {!browserSupported ? (
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
          browserSupported
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
            onOpenMenu={() => setNavigatorOpen(true)}
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
              canChangePage={canNavigate}
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
                    onClick={() => setNavigatorOpen(true)}
                    title={t("liveSession.tooltip.openMenu")}
                    aria-label={t("common.openMenu")}
                    className={MENU_ICON_BUTTON_CLASS}
                  >
                    <Menu className="h-5 w-5" strokeWidth={2.25} />
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
              <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                <MushafCanvas
                  page={page}
                  riwaya={riwaya}
                  highlightRange={studentAudioHighlight ?? interaction.highlightRange}
                  activeWord={interaction.activeWord}
                  onWordClick={isTeacher ? handleLiveWordClick : handleStudentWordClick}
                  onWordMouseEnter={!isTeacher ? handleStudentWordEnter : undefined}
                  onWordMouseLeave={!isTeacher ? handleStudentWordLeave : undefined}
                  onAyahMarkerMouseEnter={!isTeacher ? handleStudentAyahMarkerEnter : undefined}
                  onAyahMarkerMouseLeave={!isTeacher ? handleStudentAyahMarkerLeave : undefined}
                  onAyahClick={interaction.handleAyahClick}
                  getWordAnnotationClass={getWordAnnotationClass}
                />
              </div>
            </MushafReader>
          </div>

          <LiveSessionMobileBottomBar
            isTeacher={isTeacher}
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
                className={cn(
                  MEET_ICON_BTN_BASE,
                  "bg-gradient-to-b from-slate-100 to-slate-200/90 text-slate-700 hover:from-slate-200 hover:to-slate-300/90",
                )}
              >
                <LogOut className="h-5 w-5" strokeWidth={2.25} />
              </button>
              {isTeacher ? (
                <button
                  type="button"
                  onClick={() => setEndSessionOpen(true)}
                  title={t("liveSession.tooltip.endSession")}
                  aria-label={t("liveSession.endSession")}
                  className={cn(
                    MEET_ICON_BTN_BASE,
                    "bg-gradient-to-b from-[#EF5350] to-[#E53935] text-white hover:from-[#E53935] hover:to-[#C62828]",
                  )}
                >
                  <PhoneOff className="h-5 w-5" strokeWidth={2.25} />
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

      <MushafNavigatorSheet
        open={navigatorOpen}
        onOpenChange={setNavigatorOpen}
        riwaya={riwaya}
        page={page}
        totalPages={totalPages}
        canNavigate={canNavigate}
        onNavigateToPage={goPage}
        side={navigatorSide}
      />

      <LiveSessionOverflowSheet
        open={mobileOverflowOpen}
        onOpenChange={setMobileOverflowOpen}
        connectionStatus={sessionState.wsStatus}
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
        onClearReciter={sessionState.clearReciter}
      />

      {sessionState.isTeacher && id ? (
        <Dialog
          open={gradingDialogOpen}
          onOpenChange={(open) => {
            if (!open) {
              setGradingDialogOpen(false);
              setGradingDialogContext(null);
            }
          }}
        >
          {gradingDialogContext ? (
            <DialogContent
              className="max-h-[min(90dvh,800px)] gap-0 overflow-y-auto p-0 sm:max-w-lg"
              showCloseButton
            >
              <div className="border-b border-border px-4 pt-4 pb-3 pe-12">
                <DialogHeader className="gap-1 space-y-0 text-start">
                  <DialogTitle className="text-start font-heading text-lg">
                    {t("liveSession.gradeRecitation")}
                  </DialogTitle>
                  <DialogDescription className="text-start text-sm text-muted-foreground">
                    {t("liveSession.gradeRecitationModalDescription")}
                  </DialogDescription>
                </DialogHeader>
              </div>
              <GradingPanel
                key={`grading-${gradingDialogSeq}-${gradingDialogContext.participant.userId}`}
                hideTitle
                className="border-0 bg-transparent px-4 pb-4 pt-2"
                activeReciter={gradingDialogContext.participant}
                currentAyah={gradingDialogContext.currentAyah}
                highlightRange={gradingDialogContext.highlightRange}
                sessionId={id}
                roomId={sessionDetail.room_id}
                riwaya={riwaya}
                locale={loc}
                onGradeSubmitted={(studentId, grade, notes) => {
                  sessionState.sendGradeNotification(studentId, grade, notes);
                }}
                onRecitationCreated={(rec) => {
                  recitationFetchEpochRef.current++;
                  setCurrentRecitationId(rec.id);
                }}
              />
            </DialogContent>
          ) : null}
        </Dialog>
      ) : null}

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
              skipGradingModalRef.current = true;
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
          key={
            annotationTarget
              ? `${annotationTarget.surah}-${annotationTarget.ayah}-${annotationTarget.wordIndex}`
              : "none"
          }
          target={annotationTarget}
          onMarkError={handleMarkAnnotationError}
          onRepeat={handleAnnotationRepeat}
          onComment={handleAnnotationComment}
          onGood={handleAnnotationGood}
          onClose={closeAnnotationToolbar}
        />
      ) : null}

      {!isTeacher ? (
        <StudentAnnotationPopover
          key={
            studentPopover?.rect && (studentPopover.annotations?.length ?? 0) > 0
              ? `${[...(studentPopover.annotations ?? [])]
                  .map((a) => a.id)
                  .sort()
                  .join("-")}-${Math.round(studentPopover.rect.top)}-${Math.round(studentPopover.rect.left)}`
              : "closed"
          }
          annotations={studentPopover?.annotations ?? []}
          rect={studentPopover?.rect ?? null}
          onClose={closeStudentPopover}
          onPopoverCardEnter={cancelHoverCloseTimer}
          onPopoverCardLeave={() => {
            if (studentPopoverPinnedRef.current) return;
            scheduleHoverClose();
          }}
        />
      ) : null}
      {!isTeacher && studentAudioHover ? (
        <div
          className="pointer-events-auto fixed z-[319]"
          style={{
            top: Math.max(
              8,
              Math.min(window.innerHeight - 40, studentAudioHover.rect.top + studentAudioHover.rect.height / 2 - 16),
            ),
            left: Math.max(
              8,
              Math.min(window.innerWidth - 40, studentAudioHover.rect.left + studentAudioHover.rect.width / 2 - 16),
            ),
          }}
          onMouseEnter={() => cancelStudentAudioHideTimer()}
          onMouseLeave={() => scheduleStudentAudioHide(1800)}
        >
          <AyahRangeAudioButton
            surah={studentAudioHover.surah}
            ayahStart={studentAudioHover.ayah}
            ayahEnd={studentAudioHover.ayah}
            variant="icon"
            onPlaybackStateChange={({ playing, surah, currentAyah }) => {
              if (playing && currentAyah != null) {
                setStudentAudioHighlight({ surah, ayahStart: currentAyah, ayahEnd: currentAyah });
              } else {
                setStudentAudioHighlight(null);
              }
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
