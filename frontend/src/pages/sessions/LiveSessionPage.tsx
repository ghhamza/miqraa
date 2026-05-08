// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useBlocker, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api, userFacingApiError } from "../../lib/api";
import type { PlanStatusChangedMessage } from "../../hooks/useSessionWebSocket";
import { useSessionPlans } from "../../hooks/useSessionPlans";
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
import {
  LiveSessionMobileBottomBar,
  LiveSessionMobileTopBar,
  LiveSessionOverflowSheet,
} from "../../components/session/LiveSessionMobileChrome";
import { ParticipantDrawer } from "../../components/session/ParticipantDrawer";
import { AdHocStartModal } from "../../components/session/AdHocStartModal";
import { ErrorBoundary } from "../../components/ui/ErrorBoundary";
import {
  LiveSessionAnotherTab,
  LiveSessionLoadError,
  LiveSessionLoading,
} from "./components/LiveSessionEarlyStates";
import { LiveSessionDesktopActionBar } from "./components/LiveSessionDesktopActionBar";
import { LiveSessionConfirmModals } from "./components/LiveSessionConfirmModals";
import { LiveSessionToastsAndOverlays } from "./components/LiveSessionToastsAndOverlays";
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
import { GradingPanel } from "../../components/session/GradingPanel";
import { ReconnectingOverlay } from "../../components/session/ReconnectingOverlay";
import { SessionStatusCorner } from "../../components/session/SessionStatusCorner";
import {
  StudentPlanPauseSkipNotice,
  type StudentPlanNoticeKind,
} from "../../components/session/StudentPlanPauseSkipNotice";
import {
  TeacherActiveReciterPeek,
  type TeacherReciterPeek,
} from "../../components/session/TeacherActiveReciterPeek";
import { AnnotationToolbar, type AnnotationTarget } from "../../components/session/AnnotationToolbar";
import { StudentAnnotationPopover } from "../../components/session/StudentAnnotationPopover";
import { AyahRangeAudioButton } from "../../components/recitations/AyahRangeAudioButton";
import { cn } from "@/lib/utils";
import { useLivekitConnection } from "@/hooks/useLivekitConnection";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useApiMutation } from "../../lib/useApiMutation";
import { recitationKeys, roomKeys, sessionKeys } from "../../lib/queryKeys";
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

export function LiveSessionPage() {
  return (
    <ErrorBoundary scope="live-session" fallback={LiveSessionErrorFallback}>
      <LiveSessionPageInner />
    </ErrorBoundary>
  );
}

function LiveSessionErrorFallback({ error, reset }: { error: Error; reset: () => void }) {
  const { t } = useTranslation();
  return (
    <div
      role="alert"
      className="flex min-h-[100dvh] w-full flex-col items-center justify-center gap-4 bg-background px-6 py-10 text-center"
    >
      <h1 className="text-xl font-semibold">{t("errorBoundary.liveSession.title")}</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        {t("errorBoundary.liveSession.description")}
      </p>
      {import.meta.env.DEV && (
        <pre className="max-w-full overflow-auto rounded bg-muted p-2 text-start text-xs text-muted-foreground">
          {error.message}
        </pre>
      )}
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button variant="secondary" onClick={reset}>
          {t("errorBoundary.tryAgain")}
        </Button>
        <Button onClick={() => (window.location.href = "/live")}>
          {t("errorBoundary.liveSession.leave")}
        </Button>
      </div>
    </div>
  );
}

function LiveSessionPageInner() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const queryClient = useQueryClient();
  const [teacherPage, setTeacherPage] = useState(1);
  const [studentBrowsePage, setStudentBrowsePage] = useState(1);
  const [autoFollow, setAutoFollow] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [mobileOverflowOpen, setMobileOverflowOpen] = useState(false);
  const [navigatorOpen, setNavigatorOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [endSessionOpen, setEndSessionOpen] = useState(false);
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
  const [currentRecitationId, setCurrentRecitation] = useState<string | null>(null);
  /** Bumped when grading creates a recitation; used as an invalidation signal in existing handlers. */
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

  const [adHocStudentId, setAdHocStudentId] = useState<string | null>(null);
  const [planEndGradeDialogOpen, setPlanEndGradeDialogOpen] = useState(false);
  const [planEndGradePlanId, setPlanEndGradePlanId] = useState<string | null>(null);

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

  const loc = i18n.language === "ar" ? "ar" : i18n.language === "fr" ? "fr" : "en";

  const onSessionEndedNav = useCallback(() => {
    navigate(`/sessions/${id}`, {
      replace: true,
      state: { sessionEndedMessage: t("liveSession.sessionEndedMessage") },
    });
  }, [id, navigate, t]);

  /**
   * Session plans. Source of truth for the plans list.
   *
   * WebSocket events (`plan_added`, `plan_status_changed`, `plan_reordered`)
   * reconcile through query cache updates on this key.
   */
  const sessionPlansQuery = useQuery({
    queryKey: recitationKeys.list({ session: id }),
    queryFn: async ({ signal }) => {
      const { data } = await api.get<Paginated<RecitationPublic>>("recitations", {
        signal,
        params: { session_id: id, limit: 100 },
      });
      return data.items;
    },
    enabled: !!id,
  });
  const sessionPlans = sessionPlansQuery.data ?? [];

  const refetchPlans = useCallback(async () => {
    await sessionPlansQuery.refetch();
  }, [sessionPlansQuery]);

  const handlePlanStatusChanged = useCallback(
    (evt: PlanStatusChangedMessage) => {
      const key = recitationKeys.list({ session: id });
      const current = queryClient.getQueryData<RecitationPublic[]>(key) ?? [];
      const idx = current.findIndex((p) => p.id === evt.recitation_id);
      if (idx === -1) {
        void refetchPlans();
        return;
      }
      const next = [...current];
      const row = next[idx]!;
      next[idx] = { ...row, plan_status: evt.plan_status };
      queryClient.setQueryData<RecitationPublic[]>(key, next);
    },
    [id, queryClient, refetchPlans],
  );

  const onGradeNotification = useCallback(
    (grade: string, notes?: string) => {
      setGradeToast({ grade, notes });
      const gradeLabel = t(`recitations.${grade === "needs_work" ? "needsWork" : grade}`);
      setAnnounce(t("liveSession.gradeAnnouncement", { grade: gradeLabel }));
    },
    [t],
  );

  /**
   * Session detail. Source of truth for `sessionDetail`, gating most other
   * queries on this resolving first.
   *
   * WebSocket events that mutate session state (`session_status_changed`,
   * `reciter_changed`) reconcile through this same cache key.
   */
  const sessionDetailQuery = useQuery({
    queryKey: sessionKeys.detail(id ?? ""),
    queryFn: async ({ signal }) => {
      const { data } = await api.get<SessionDetail>(`sessions/${id}`, { signal });
      return data;
    },
    enabled: !!id,
    retry: (failureCount, err) => {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 403) return false;
      return failureCount < 2;
    },
  });

  /**
   * Room detail. Depends on the session's `room_id`. Doesn't change during a
   * session, so a long staleTime is appropriate.
   */
  const roomQuery = useQuery({
    queryKey: roomKeys.detail(sessionDetailQuery.data?.room_id ?? ""),
    queryFn: async ({ signal }) => {
      const { data } = await api.get<Room>(
        `rooms/${sessionDetailQuery.data!.room_id}`,
        { signal },
      );
      return data;
    },
    enabled: !!sessionDetailQuery.data?.room_id,
    staleTime: 5 * 60_000,
  });

  const sessionDetail = sessionDetailQuery.data ?? null;
  const room = roomQuery.data ?? null;
  const riwaya = (room?.riwaya ?? "hafs") as Riwaya;
  const totalPages = getTotalPages(riwaya);
  const loading = sessionDetailQuery.isPending || roomQuery.isPending;
  const detailErrorStatus =
    (sessionDetailQuery.error as { response?: { status?: number } } | null)?.response?.status;
  const loadError =
    sessionDetailQuery.error && detailErrorStatus !== 403
      ? userFacingApiError(sessionDetailQuery.error)
      : null;

  useEffect(() => {
    if (!id) return;
    if (sessionDetailQuery.data && sessionDetailQuery.data.status !== "in_progress") {
      navigate(`/sessions/${id}`, {
        replace: true,
        state: { liveSessionError: t("liveSession.sessionNotActive") },
      });
      return;
    }
    if (detailErrorStatus === 403) {
      navigate(`/sessions/${id}`, {
        replace: true,
        state: { liveSessionError: t("liveSession.notEnrolled") },
      });
    }
  }, [id, sessionDetailQuery.data, detailErrorStatus, navigate, t]);

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
    onPlanStatusChanged: handlePlanStatusChanged,
  });

  isTeacherRef.current = sessionState.isTeacher;

  const planOps = useSessionPlans({ sessionId: id ?? "" });

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
  const isActiveReciter = sessionState.state.activeReciterId === (user?.id ?? "");
  const canPublishAudio = isTeacher || isActiveReciter;
  const livekit = useLivekitConnection({
    sessionId: id ?? "",
    canPublish: canPublishAudio,
  });
  const elapsedLabel = formatElapsed(elapsedMs);
  const micState: "publishing" | "muted" | "listener" = canPublishAudio
    ? livekit.isMicEnabled
      ? "publishing"
      : "muted"
    : "listener";

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

  /** Teacher: when a plan gets the mic (in_progress), jump the mushaf to that turn and sync ayah for the room. */
  const sessionPlansRef = useRef(sessionPlans);
  sessionPlansRef.current = sessionPlans;
  const goToAyahForMicRef = useRef(interaction.goToAyah);
  goToAyahForMicRef.current = interaction.goToAyah;
  const setCurrentAyahForMicRef = useRef(sessionState.setCurrentAyah);
  setCurrentAyahForMicRef.current = sessionState.setCurrentAyah;
  const activeMicNavKey = useMemo(() => {
    const active = sessionPlans.find((p) => p.plan_status === "in_progress");
    return active ? `${active.id}:${active.surah}:${active.ayah_start}` : null;
  }, [sessionPlans]);
  useEffect(() => {
    if (!isTeacher || !sessionReady || anotherTab || !activeMicNavKey) return;
    const active = sessionPlansRef.current.find((p) => p.plan_status === "in_progress");
    if (!active) return;
    goToAyahForMicRef.current(active.surah, active.ayah_start);
    setCurrentAyahForMicRef.current(active.surah, active.ayah_start);
  }, [isTeacher, sessionReady, anotherTab, activeMicNavKey]);

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

  const planEndGradePlan = useMemo(
    () => (planEndGradePlanId ? sessionPlans.find((x) => x.id === planEndGradePlanId) ?? null : null),
    [planEndGradePlanId, sessionPlans],
  );

  const planEndGradeParticipant = useMemo((): SessionParticipant | null => {
    const plan = planEndGradePlan;
    if (!plan?.student_id) return null;
    const part = sessionState.state.participants.find((x) => x.userId === plan.student_id);
    if (part) return part;
    return {
      userId: plan.student_id,
      name: plan.student_name ?? "—",
      role: "student",
      isMuted: true,
      joinedAt: "",
    };
  }, [planEndGradePlan, sessionState.state.participants]);

  /** Student-only: show a fixed notice when this user's plan row is paused or skipped by the teacher. */
  const studentPlanNoticeKind = useMemo((): StudentPlanNoticeKind | null => {
    if (sessionState.isTeacher || !user?.id) return null;
    const mine = sessionPlans.filter((p) => p.student_id === user.id);
    if (mine.some((p) => p.plan_status === "paused")) return "paused";
    if (mine.some((p) => p.plan_status === "skipped")) return "skipped";
    return null;
  }, [sessionState.isTeacher, user?.id, sessionPlans]);

  /** Teacher: compact “who is reciting” control; opens participant drawer (same as in-drawer NOW card). */
  const teacherReciterPeek = useMemo((): TeacherReciterPeek | null => {
    if (!isTeacher || !sessionDetail?.teacher_id) return null;
    const tid = sessionDetail.teacher_id;
    const plan = sessionPlans.find((p) => p.plan_status === "in_progress") ?? null;
    if (plan?.student_id) {
      const part = sessionState.state.participants.find((p) => p.userId === plan.student_id);
      const name = part?.name ?? plan.student_name ?? "—";
      return { kind: "plan", plan, studentName: name };
    }
    const rid = sessionState.state.activeReciterId;
    if (rid && rid !== tid) {
      const part = sessionState.state.participants.find((p) => p.userId === rid);
      if (part) return { kind: "mic", studentName: part.name };
    }
    return null;
  }, [
    isTeacher,
    sessionDetail?.teacher_id,
    sessionPlans,
    sessionState.state.activeReciterId,
    sessionState.state.participants,
  ]);

  useEffect(() => {
    if (!planEndGradeDialogOpen || !planEndGradePlanId) return;
    const p = sessionPlans.find((x) => x.id === planEndGradePlanId);
    if (!p || (p.plan_status !== "in_progress" && p.plan_status !== "paused")) {
      setPlanEndGradeDialogOpen(false);
      setPlanEndGradePlanId(null);
    }
  }, [planEndGradeDialogOpen, planEndGradePlanId, sessionPlans]);

  const offlineSessionStudents = useMemo(() => {
    const att = sessionDetail?.attendance;
    if (!att?.length || !sessionDetail?.teacher_id) return [];
    const onlineIds = new Set(sessionState.state.participants.map((p) => p.userId));
    const planStudentIds = new Set(
      sessionPlans.map((r) => r.student_id).filter((id): id is string => Boolean(id)),
    );
    const tid = sessionDetail.teacher_id;
    const out: { student_id: string; student_name: string }[] = [];
    for (const row of att) {
      if (!row.student_id || row.student_id === tid) continue;
      if (onlineIds.has(row.student_id)) continue;
      if (planStudentIds.has(row.student_id)) continue;
      out.push({ student_id: row.student_id, student_name: row.student_name });
    }
    return out;
  }, [sessionDetail?.attendance, sessionDetail?.teacher_id, sessionState.state.participants, sessionPlans]);

  type EnsureRecitationInput = {
    student_id: string;
    room_id: string;
    session_id: string;
    surah: number;
    ayah_start: number;
    ayah_end: number;
    riwaya: Riwaya;
  };

  const ensureRecitationMutation = useApiMutation<
    { data: RecitationPublic },
    EnsureRecitationInput
  >({
    mutationFn: async (input) => {
      const { data } = await api.request<RecitationPublic>({
        method: "post",
        url: "recitations",
        data: input,
      });
      return { data };
    },
    onSuccess: ({ data }) => {
      queryClient.setQueryData<RecitationPublic[]>(
        recitationKeys.list({ session: id }),
        (prev = []) => [data, ...prev],
      );
    },
    onError: () => {
      setAnnounce(t("annotation.creationFailed"));
    },
  });

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
        const { data } = await ensureRecitationMutation.mutateAsync({
          student_id: activeReciterParticipant.userId,
          room_id: sessionDetail.room_id,
          session_id: id!,
          surah,
          ayah_start,
          ayah_end,
          riwaya,
        });
        recitationFetchEpochRef.current++;
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
    if (!currentRecitationId) return;
    void loadAnnotations(currentRecitationId);
  }, [currentRecitationId, loadAnnotations]);

  /**
   * Recitations for this session, used to derive the current active recitation
   * (the active reciter's latest in_progress or most-recent row).
   *
   * WebSocket events that change recitation rows (`plan_added`,
   * `plan_status_changed`, `plan_reordered`) currently mutate the mirrored
   * `sessionPlans` state; Prompt 11 will move those writes to query cache.
   */
  const sessionRecitationsForActiveQuery = useQuery({
    queryKey: recitationKeys.list({ session: id }),
    queryFn: async ({ signal }) => {
      const { data } = await api.get<Paginated<RecitationPublic>>("recitations", {
        signal,
        params: { session_id: id, limit: 50 },
      });
      return data.items;
    },
    enabled: !!id && !!activeReciterParticipant?.userId,
  });

  useEffect(() => {
    if (!activeReciterParticipant?.userId) {
      setCurrentRecitation(null);
      return;
    }
    const items = sessionRecitationsForActiveQuery.data ?? [];
    const forActiveStudent = items.filter(
      (r) => r.student_id === activeReciterParticipant.userId,
    );
    const forSessionAndStudent = forActiveStudent.filter((r) => r.session_id === id);
    forSessionAndStudent.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
    const inProg = forSessionAndStudent.find((r) => r.plan_status === "in_progress");
    setCurrentRecitation(inProg?.id ?? forSessionAndStudent[0]?.id ?? null);
  }, [sessionRecitationsForActiveQuery.data, activeReciterParticipant?.userId, id]);

  useEffect(() => {
    if (!activeReciterParticipant?.userId || !isTeacher) return;
    const items = sessionRecitationsForActiveQuery.data ?? [];
    const forActiveStudent = items.filter(
      (r) => r.student_id === activeReciterParticipant.userId,
    );
    const forSessionAndStudent = forActiveStudent.filter((r) => r.session_id === id);
    if (forSessionAndStudent.length === 0 && forActiveStudent.length > 0) {
      setAnnounce(t("annotation.noRecitation"));
    }
  }, [
    sessionRecitationsForActiveQuery.data,
    activeReciterParticipant?.userId,
    id,
    isTeacher,
    t,
  ]);

  useEffect(() => {
    setAnnotationTarget(null);
  }, [activeReciterParticipant?.userId]);

  const handleLeave = useCallback(() => {
    setLeaveOpen(true);
  }, []);

  const disconnectWebrtc = useCallback(() => {
    void livekit.setMicEnabled(false);
  }, [livekit.setMicEnabled]);

  const confirmLeave = useCallback(() => {
    disconnectWebrtc();
    sessionState.disconnect();
    setLeaveOpen(false);
    navigate(`/sessions/${id}`, { replace: true });
  }, [disconnectWebrtc, sessionState, navigate, id]);

  const endSessionMutation = useApiMutation<unknown, void>({
    mutationFn: () => api.put(`sessions/${id}`, { status: "completed" }),
    invalidates: [
      sessionKeys.calendars(),
      sessionKeys.upcoming(),
      sessionKeys.live(user?.id ?? null),
      sessionKeys.detail(id ?? ""),
    ],
    onSuccess: () => {
      disconnectWebrtc();
      sessionState.disconnect();
      setEndSessionOpen(false);
      navigate(`/sessions/${id}`, {
        replace: true,
        state: { sessionEndedMessage: t("liveSession.sessionEndedMessage") },
      });
    },
    onError: (message) => setEndError(message),
  });

  const endingSession = endSessionMutation.isPending;

  const confirmEndSession = useCallback(() => {
    if (!id) return;
    setEndError(null);
    endSessionMutation.mutate();
  }, [id, endSessionMutation]);

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

  if (loading) return <LiveSessionLoading />;

  if (loadError || !sessionDetail || !room || !user || !token) {
    return <LiveSessionLoadError message={loadError} onBack={() => navigate(`/sessions/${id}`)} />;
  }

  if (anotherTab) return <LiveSessionAnotherTab />;

  return (
    <div
      className="relative flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden bg-white"
      dir={i18n.language?.startsWith("ar") ? "rtl" : "ltr"}
    >
      <LiveSessionToastsAndOverlays
        announce={announce}
        audioPlaybackBlocked={livekit.audioPlaybackBlocked}
        onEnableAudio={() => void livekit.startAudio()}
        browserSupported={browserSupported}
        reconnectedToast={!!reconnectedToast}
        gradeToast={gradeToast}
        onDismissGradeToast={() => setGradeToast(null)}
      />

      {studentPlanNoticeKind ? <StudentPlanPauseSkipNotice kind={studentPlanNoticeKind} /> : null}

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
            statusSlot={
              <SessionStatusCorner
                wsStatus={sessionState.wsStatus}
                livekitStatus={livekit.status}
                elapsedLabel={elapsedLabel}
                micState={micState}
              />
            }
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
            {isTeacher && teacherReciterPeek ? (
              <div className="pointer-events-auto absolute start-2 top-2 z-10 max-w-[min(20rem,calc(100%-1rem))] md:max-w-[min(22rem,calc(100%-11rem))]">
                <TeacherActiveReciterPeek
                  peek={teacherReciterPeek}
                  locale={loc}
                  drawerOpen={drawerOpen}
                  onOpenDrawer={() => setDrawerOpen(true)}
                />
              </div>
            ) : null}
            <div className="pointer-events-auto absolute top-2 z-10 hidden end-2 md:block">
              <SessionStatusCorner
                wsStatus={sessionState.wsStatus}
                livekitStatus={livekit.status}
                elapsedLabel={elapsedLabel}
                micState={micState}
              />
            </div>
          </div>

          <LiveSessionMobileBottomBar
            isTeacher={isTeacher}
            isActiveReciter={isActiveReciter}
            canPublishAudio={canPublishAudio}
            livekitConnected={livekit.status === "connected"}
            livekitStatus={livekit.status}
            isMicEnabled={livekit.isMicEnabled}
            annotationMode={annotationMode}
            onToggleMic={() => void livekit.setMicEnabled(!livekit.isMicEnabled)}
            onToggleAnnotation={isTeacher ? () => setAnnotationMode((m) => !m) : undefined}
            onOpenParticipants={() => setDrawerOpen(true)}
            onOpenMore={() => setMobileOverflowOpen(true)}
            onLeave={handleLeave}
            onEndSession={() => setEndSessionOpen(true)}
          />

          <LiveSessionDesktopActionBar
            isTeacher={isTeacher}
            isActiveReciter={isActiveReciter}
            canPublishAudio={canPublishAudio}
            livekitConnected={livekit.status === "connected"}
            livekitStatus={livekit.status}
            isMicEnabled={livekit.isMicEnabled}
            annotationMode={annotationMode}
            autoFollow={autoFollow}
            page={page}
            surahLabel={navCornerLabels.surahLabel}
            juzN={navCornerLabels.juzN}
            onToggleMic={() => void livekit.setMicEnabled(!livekit.isMicEnabled)}
            onToggleAnnotation={isTeacher ? () => setAnnotationMode((m) => !m) : undefined}
            onAutoFollowToggle={handleAutoFollowToggle}
            onOpenParticipants={() => setDrawerOpen(true)}
            onOpenNavigator={() => setNavigatorOpen(true)}
            onOpenInfo={() => window.alert(t("common.comingSoon"))}
            onOpenChat={() => window.alert(t("common.comingSoon"))}
            onLeave={handleLeave}
            onEndSession={() => setEndSessionOpen(true)}
          />
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
        elapsedLabel={elapsedLabel}
        isTeacher={isTeacher}
        autoFollow={autoFollow}
        onAutoFollowToggle={handleAutoFollowToggle}
      />

      <ParticipantDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        participants={sessionState.state.participants}
        teacherId={sessionDetail.teacher_id}
        isTeacher={sessionState.isTeacher}
        offlineStudents={offlineSessionStudents}
        sessionId={id}
        plans={sessionPlans}
        onPlansChange={(next) => {
          queryClient.setQueryData<RecitationPublic[]>(
            recitationKeys.list({ session: id }),
            next,
          );
        }}
        onStartPlan={planOps.start}
        onPausePlan={planOps.pause}
        onSkipPlan={planOps.skip}
        onReopenPlan={planOps.reopen}
        onAdHocStart={(studentId) => setAdHocStudentId(studentId)}
        onEndGradeForPlan={(planId) => {
          if (!sessionPlans.some((p) => p.id === planId)) return;
          setPlanEndGradePlanId(planId);
          setPlanEndGradeDialogOpen(true);
          setDrawerOpen(false);
        }}
        onPlanTransitionError={(msg) => setAnnounce(msg)}
      />

      {sessionState.isTeacher && id && sessionDetail?.room_id && room ? (
        <AdHocStartModal
          open={adHocStudentId != null}
          onClose={() => setAdHocStudentId(null)}
          studentId={adHocStudentId}
          sessionId={id}
          roomId={sessionDetail.room_id}
          riwaya={room.riwaya}
          onSuccess={(rec) => {
            queryClient.setQueryData<RecitationPublic[]>(
              recitationKeys.list({ session: id }),
              (prev = []) => {
              if (prev.some((p) => p.id === rec.id)) {
                return prev.map((p) => (p.id === rec.id ? rec : p));
              }
              return [rec, ...prev];
              },
            );
            recitationFetchEpochRef.current++;
          }}
          onErrorMessage={(msg) => setAnnounce(msg)}
        />
      ) : null}

      {sessionState.isTeacher && id && sessionDetail ? (
        <Dialog
          open={planEndGradeDialogOpen}
          onOpenChange={(next) => {
            if (!next) {
              setPlanEndGradeDialogOpen(false);
              setPlanEndGradePlanId(null);
            }
          }}
        >
          {planEndGradePlan && planEndGradeParticipant ? (
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
                key={`plan-end-grade-${planEndGradePlan.id}`}
                hideTitle
                className="border-0 bg-transparent px-4 pb-4 pt-2"
                activeReciter={planEndGradeParticipant}
                currentAyah={{ surah: planEndGradePlan.surah, ayah: planEndGradePlan.ayah_start }}
                highlightRange={{
                  surah: planEndGradePlan.surah,
                  ayahStart: planEndGradePlan.ayah_start,
                  ayahEnd: planEndGradePlan.ayah_end,
                }}
                sessionId={id}
                roomId={sessionDetail.room_id}
                riwaya={riwaya}
                locale={loc}
                gradingMode="completePlan"
                planToComplete={planEndGradePlan}
                onPlanCompleted={(rec) => {
                  queryClient.setQueryData<RecitationPublic[]>(
                    recitationKeys.list({ session: id }),
                    (prev = []) => prev.map((p) => (p.id === rec.id ? rec : p)),
                  );
                  setPlanEndGradeDialogOpen(false);
                  setPlanEndGradePlanId(null);
                  recitationFetchEpochRef.current++;
                }}
                onGradeSubmitted={(studentId, grade, notes) => {
                  sessionState.sendGradeNotification(studentId, grade, notes);
                }}
              />
            </DialogContent>
          ) : null}
        </Dialog>
      ) : null}

      <LiveSessionConfirmModals
        leaveOpen={leaveOpen}
        onLeaveCancel={() => setLeaveOpen(false)}
        onLeaveConfirm={confirmLeave}
        endSessionOpen={endSessionOpen}
        endError={endError}
        endingSession={endingSession}
        onEndSessionCancel={() => setEndSessionOpen(false)}
        onEndSessionConfirm={() => void confirmEndSession()}
        navBlockOpen={blocker.state === "blocked"}
        onNavStay={() => blocker.reset?.()}
        onNavLeave={() => {
          disconnectWebrtc();
          sessionState.disconnect();
          blocker.proceed?.();
        }}
      />

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
