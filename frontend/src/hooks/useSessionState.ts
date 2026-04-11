// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Hamza Ghandouri

import { useCallback, useMemo, useState } from "react";
import type { ErrorAnnotation } from "../types";
import type { ParticipantInfo, RoomStateMessage } from "./useSessionWebSocket";
import { useSessionWebSocket } from "./useSessionWebSocket";

export interface SessionParticipant {
  userId: string;
  name: string;
  role: "teacher" | "student";
  isMuted: boolean;
  joinedAt: string;
}

export interface SessionState {
  participants: SessionParticipant[];
  activeReciterId: string | null;
  currentAyah: { surah: number; ayah: number } | null;
  /** Teacher-led mushaf page; null until teacher sets or room-state omits it. */
  currentPage: number | null;
  sessionId: string;
  roomId: string;
}

const emptyState = (sessionId: string, roomId: string): SessionState => ({
  participants: [],
  activeReciterId: null,
  currentAyah: null,
  currentPage: null,
  sessionId,
  roomId,
});

function mapParticipant(p: RoomStateMessage["participants"][0]): SessionParticipant {
  return {
    userId: p.user_id,
    name: p.name,
    role: p.role === "teacher" ? "teacher" : "student",
    isMuted: p.is_muted,
    joinedAt: p.joined_at,
  };
}

export interface UseSessionStateOptions {
  sessionId: string;
  token: string;
  myUserId: string;
  /** Room teacher — used until `room-state` lists participants. */
  teacherId: string;
  enabled: boolean;
  onSessionEnded?: () => void;
  onGradeNotification?: (grade: string, notes?: string) => void;
  onAnnotationAdded?: (annotation: ErrorAnnotation) => void;
  onAnnotationRemoved?: (annotationId: string) => void;
  onOffer?: (sdp: string, from: string) => void;
  onIceCandidate?: (candidate: string, from: string) => void;
  onAnotherTab?: () => void;
  onJoinRejected?: (message: string) => void;
  onReconnected?: () => void;
  /** After state merge — for a11y announcements */
  onParticipantJoined?: (user: ParticipantInfo) => void;
  onParticipantLeft?: (userId: string, name: string | undefined) => void;
}

export interface UseSessionStateReturn {
  state: SessionState;
  wsStatus: import("./useSessionWebSocket").SessionWsStatus;
  myRole: "teacher" | "student";
  isTeacher: boolean;
  isActiveReciter: boolean;
  isMuted: boolean;
  setReciter: (userId: string) => void;
  clearReciter: () => void;
  toggleMute: () => void;
  setCurrentAyah: (surah: number, ayah: number) => void;
  clearCurrentAyah: () => void;
  /** Teacher only: broadcast mushaf page so students follow. */
  setCurrentPage: (page: number) => void;
  /** Teacher only: notify a student of a grade (forwarded by server). */
  sendGradeNotification: (studentId: string, grade: string, notes?: string) => void;
  sendCreateAnnotation: (payload: {
    recitation_id: string;
    surah: number;
    ayah: number;
    word_position: number | null;
    error_severity: string;
    error_category: string;
    teacher_comment: string | null;
    annotation_kind: string;
  }) => void;
  sendRemoveAnnotation: (annotationId: string) => void;
  sendAnswer: (sdp: string) => void;
  sendIceCandidate: (candidate: string) => void;
  disconnect: () => void;
}

export function useSessionState(options: UseSessionStateOptions): UseSessionStateReturn {
  const {
    sessionId,
    token,
    myUserId,
    teacherId,
    enabled,
    onSessionEnded,
    onGradeNotification,
    onAnnotationAdded,
    onAnnotationRemoved,
    onOffer,
    onIceCandidate,
    onAnotherTab,
    onJoinRejected,
    onReconnected,
    onParticipantJoined,
    onParticipantLeft,
  } = options;

  const [state, setState] = useState<SessionState>(() => emptyState(sessionId, ""));

  const applyRoomState = useCallback(
    (msg: RoomStateMessage) => {
      setState({
        participants: msg.participants.map(mapParticipant),
        activeReciterId: msg.active_reciter_id,
        currentAyah: msg.current_ayah,
        currentPage: msg.current_page ?? null,
        sessionId: msg.session_id,
        roomId: msg.room_id,
      });
    },
    [],
  );

  const ws = useSessionWebSocket({
    sessionId,
    token,
    enabled,
    onRoomState: applyRoomState,
    onUserJoined: (user) => {
      setState((prev) => {
        const next = [
          ...prev.participants.filter((x) => x.userId !== user.user_id),
          mapParticipant(user),
        ];
        next.sort((a, b) => a.joinedAt.localeCompare(b.joinedAt));
        return { ...prev, participants: next };
      });
      onParticipantJoined?.(user);
    },
    onUserLeft: (userId) => {
      setState((prev) => {
        const left = prev.participants.find((p) => p.userId === userId);
        onParticipantLeft?.(userId, left?.name);
        return {
          ...prev,
          participants: prev.participants.filter((p) => p.userId !== userId),
          activeReciterId: prev.activeReciterId === userId ? null : prev.activeReciterId,
        };
      });
    },
    onReciterChanged: (userId) => {
      setState((prev) => ({ ...prev, activeReciterId: userId }));
    },
    onMuteChanged: (userId, muted) => {
      setState((prev) => ({
        ...prev,
        participants: prev.participants.map((p) =>
          p.userId === userId ? { ...p, isMuted: muted } : p,
        ),
      }));
    },
    onCurrentAyah: (surah, ayah) => {
      setState((prev) => ({ ...prev, currentAyah: { surah, ayah } }));
    },
    onAyahCleared: () => {
      setState((prev) => ({ ...prev, currentAyah: null }));
    },
    onCurrentPage: (page) => {
      setState((prev) => ({ ...prev, currentPage: page }));
    },
    onSessionEnded,
    onGradeNotification,
    onAnnotationAdded,
    onAnnotationRemoved,
    onOffer,
    onIceCandidate,
    onAnotherTab,
    onJoinRejected,
    onReconnected,
  });

  const me = state.participants.find((p) => p.userId === myUserId);
  const myRole: "teacher" | "student" =
    me?.role ?? (myUserId === teacherId ? "teacher" : "student");
  const isTeacher = myRole === "teacher";
  const isActiveReciter = state.activeReciterId === myUserId;
  const isMuted = me?.isMuted ?? true;

  const setReciter = useCallback(
    (userId: string) => {
      ws.sendSetReciter(userId);
    },
    [ws],
  );

  const clearReciter = useCallback(() => {
    ws.sendClearReciter();
  }, [ws]);

  const toggleMute = useCallback(() => {
    ws.sendMute(!isMuted);
  }, [ws, isMuted]);

  const setCurrentAyah = useCallback(
    (surah: number, ayah: number) => {
      ws.sendCurrentAyah(surah, ayah);
    },
    [ws],
  );

  const clearCurrentAyah = useCallback(() => {
    ws.sendClearAyah();
  }, [ws]);

  const setCurrentPage = useCallback(
    (page: number) => {
      ws.sendCurrentPage(page);
    },
    [ws],
  );

  const sendGradeNotification = useCallback(
    (studentId: string, grade: string, notes?: string) => {
      ws.sendGradeNotification(studentId, grade, notes);
    },
    [ws],
  );

  const sendCreateAnnotation = useCallback(
    (payload: Parameters<UseSessionStateReturn["sendCreateAnnotation"]>[0]) => {
      ws.sendCreateAnnotation(payload);
    },
    [ws],
  );

  const sendRemoveAnnotation = useCallback(
    (annotationId: string) => {
      ws.sendRemoveAnnotation(annotationId);
    },
    [ws],
  );

  const derived = useMemo(
    () => ({
      state,
      wsStatus: ws.status,
      myRole,
      isTeacher,
      isActiveReciter,
      isMuted,
      setReciter,
      clearReciter,
      toggleMute,
      setCurrentAyah,
      clearCurrentAyah,
      setCurrentPage,
      sendGradeNotification,
      sendCreateAnnotation,
      sendRemoveAnnotation,
      sendAnswer: ws.sendAnswer,
      sendIceCandidate: ws.sendIceCandidate,
      disconnect: ws.disconnect,
    }),
    [
      state,
      ws.status,
      myRole,
      isTeacher,
      isActiveReciter,
      isMuted,
      setReciter,
      clearReciter,
      toggleMute,
      setCurrentAyah,
      clearCurrentAyah,
      setCurrentPage,
      sendGradeNotification,
      sendCreateAnnotation,
      sendRemoveAnnotation,
      ws.sendAnswer,
      ws.sendIceCandidate,
      ws.disconnect,
    ],
  );

  return derived;
}
