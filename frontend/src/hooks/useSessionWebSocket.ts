// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Hamza Ghandouri

import { useCallback, useEffect, useRef, useState } from "react";
import { getSessionWebSocketUrl } from "../lib/wsUrl";
import type { ErrorAnnotation } from "../types";

export interface ParticipantInfo {
  user_id: string;
  name: string;
  role: string;
  is_muted: boolean;
  joined_at: string;
}

export interface RoomStateMessage {
  type: "room-state";
  participants: ParticipantInfo[];
  active_reciter_id: string | null;
  current_ayah: { surah: number; ayah: number } | null;
  /** Teacher-led mushaf page; absent or null means clients default to 1 until set. */
  current_page?: number | null;
  session_id: string;
  room_id: string;
}

export interface UseSessionWebSocketOptions {
  sessionId: string;
  token: string;
  enabled?: boolean;
  onRoomState?: (state: RoomStateMessage) => void;
  onUserJoined?: (user: ParticipantInfo) => void;
  onUserLeft?: (userId: string) => void;
  onReciterChanged?: (userId: string | null) => void;
  onMuteChanged?: (userId: string, muted: boolean) => void;
  onCurrentAyah?: (surah: number, ayah: number) => void;
  onAyahCleared?: () => void;
  onCurrentPage?: (page: number) => void;
  onOffer?: (sdp: string, from: string) => void;
  onIceCandidate?: (candidate: string, from: string) => void;
  onSessionEnded?: () => void;
  /** Student: private grade push from teacher */
  onGradeNotification?: (grade: string, notes?: string) => void;
  /** An annotation was added (by the teacher, on any recitation in this session). */
  onAnnotationAdded?: (annotation: ErrorAnnotation) => void;
  /** An annotation was removed (by the teacher). */
  onAnnotationRemoved?: (annotationId: string) => void;
  onError?: (message: string) => void;
  /** Server closed this socket because the same user joined elsewhere — do not reconnect. */
  onAnotherTab?: () => void;
  /** Join rejected (e.g. room full) — do not reconnect. */
  onJoinRejected?: (message: string) => void;
  /** WebSocket recovered after reconnecting (for toast). */
  onReconnected?: () => void;
}

export type SessionWsStatus = "connecting" | "connected" | "reconnecting" | "disconnected" | "error";

export interface UseSessionWebSocketReturn {
  status: SessionWsStatus;
  sendMute: (muted: boolean) => void;
  sendSetReciter: (userId: string) => void;
  sendClearReciter: () => void;
  sendCurrentAyah: (surah: number, ayah: number) => void;
  sendClearAyah: () => void;
  sendCurrentPage: (page: number) => void;
  sendAnswer: (sdp: string) => void;
  sendIceCandidate: (candidate: string) => void;
  sendPing: () => void;
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
  disconnect: () => void;
}

const BACKOFF_MS = [1000, 2000, 4000, 8000, 16000, 30000];

function parseServerMessage(raw: string): Record<string, unknown> | null {
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function useSessionWebSocket(options: UseSessionWebSocketOptions): UseSessionWebSocketReturn {
  const { sessionId, token, enabled = true } = options;

  const [status, setStatus] = useState<SessionWsStatus>("disconnected");
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttempt = useRef(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const intentionalClose = useRef(false);
  const mounted = useRef(true);
  const prevStatus = useRef<SessionWsStatus | null>(null);

  const optsRef = useRef(options);
  optsRef.current = options;

  const clearReconnect = useCallback(() => {
    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current);
      reconnectTimer.current = null;
    }
  }, []);

  const clearPing = useCallback(() => {
    if (pingTimer.current) {
      clearInterval(pingTimer.current);
      pingTimer.current = null;
    }
  }, []);

  const sendRaw = useCallback((obj: object) => {
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(obj));
    }
  }, []);

  const sendMute = useCallback((muted: boolean) => {
    sendRaw({ type: "mute", muted });
  }, [sendRaw]);

  const sendSetReciter = useCallback(
    (userId: string) => {
      sendRaw({ type: "set-reciter", user_id: userId });
    },
    [sendRaw],
  );

  const sendClearReciter = useCallback(() => {
    sendRaw({ type: "clear-reciter" });
  }, [sendRaw]);

  const sendCurrentAyah = useCallback(
    (surah: number, ayah: number) => {
      sendRaw({ type: "current-ayah", surah, ayah });
    },
    [sendRaw],
  );

  const sendClearAyah = useCallback(() => {
    sendRaw({ type: "clear-ayah" });
  }, [sendRaw]);

  const sendCurrentPage = useCallback(
    (page: number) => {
      sendRaw({ type: "current-page", page });
    },
    [sendRaw],
  );

  const sendAnswer = useCallback(
    (sdp: string) => {
      sendRaw({ type: "answer", sdp, target: null });
    },
    [sendRaw],
  );

  const sendIceCandidate = useCallback(
    (candidate: string) => {
      sendRaw({ type: "ice-candidate", candidate, target: null });
    },
    [sendRaw],
  );

  const sendPing = useCallback(() => {
    sendRaw({ type: "ping" });
  }, [sendRaw]);

  const sendGradeNotification = useCallback(
    (studentId: string, grade: string, notes?: string) => {
      sendRaw({ type: "grade-notification", student_id: studentId, grade, notes: notes ?? null });
    },
    [sendRaw],
  );

  const sendCreateAnnotation: UseSessionWebSocketReturn["sendCreateAnnotation"] = useCallback(
    (payload) => {
      const ws = wsRef.current;
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            type: "create-annotation",
            ...payload,
          }),
        );
      }
    },
    [],
  );

  const sendRemoveAnnotation: UseSessionWebSocketReturn["sendRemoveAnnotation"] = useCallback(
    (annotationId) => {
      const ws = wsRef.current;
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            type: "remove-annotation",
            annotation_id: annotationId,
          }),
        );
      }
    },
    [],
  );

  const disconnect = useCallback(() => {
    intentionalClose.current = true;
    clearReconnect();
    clearPing();
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setStatus("disconnected");
  }, [clearPing, clearReconnect]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    const prev = prevStatus.current;
    if (prev === "reconnecting" && status === "connected") {
      optsRef.current.onReconnected?.();
    }
    prevStatus.current = status;
  }, [status]);

  useEffect(() => {
    if (!enabled || !sessionId || !token) {
      intentionalClose.current = true;
      clearReconnect();
      clearPing();
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      setStatus("disconnected");
      return;
    }

    intentionalClose.current = false;

    const connect = () => {
      if (!mounted.current) return;
      clearReconnect();
      setStatus((s) => (s === "reconnecting" ? "reconnecting" : "connecting"));

      const url = getSessionWebSocketUrl(sessionId, token);
      let ws: WebSocket;
      try {
        ws = new WebSocket(url);
      } catch {
        if (mounted.current) setStatus("error");
        return;
      }
      wsRef.current = ws;

      ws.onopen = () => {
        if (!mounted.current) return;
        reconnectAttempt.current = 0;
        setStatus("connected");
        clearPing();
        pingTimer.current = setInterval(() => {
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: "ping" }));
          }
        }, 30_000);
      };

      ws.onmessage = (ev) => {
        const msg = parseServerMessage(String(ev.data));
        if (!msg || typeof msg.type !== "string") return;
        const o = optsRef.current;
        switch (msg.type) {
          case "room-state":
            o.onRoomState?.(msg as unknown as RoomStateMessage);
            break;
          case "user-joined": {
            const user = msg.user as ParticipantInfo | undefined;
            if (user) o.onUserJoined?.(user);
            break;
          }
          case "user-left": {
            const uid = msg.user_id as string | undefined;
            if (uid) o.onUserLeft?.(uid);
            break;
          }
          case "reciter-changed": {
            const uid = msg.user_id as string | null | undefined;
            o.onReciterChanged?.(uid ?? null);
            break;
          }
          case "mute-changed": {
            const uid = msg.user_id as string | undefined;
            const muted = msg.muted as boolean | undefined;
            if (uid !== undefined && typeof muted === "boolean") o.onMuteChanged?.(uid, muted);
            break;
          }
          case "current-ayah": {
            const surah = msg.surah as number | undefined;
            const ayah = msg.ayah as number | undefined;
            if (surah !== undefined && ayah !== undefined) o.onCurrentAyah?.(surah, ayah);
            break;
          }
          case "ayah-cleared":
            o.onAyahCleared?.();
            break;
          case "current-page": {
            const pg = msg.page as number | undefined;
            if (pg !== undefined && Number.isFinite(pg)) o.onCurrentPage?.(Math.floor(pg));
            break;
          }
          case "offer": {
            const sdp = msg.sdp as string | undefined;
            const from = String(msg.from ?? "");
            if (sdp) o.onOffer?.(sdp, from);
            break;
          }
          case "ice-candidate": {
            const cand = msg.candidate as string | undefined;
            const from = String(msg.from ?? "");
            if (cand) o.onIceCandidate?.(cand, from);
            break;
          }
          case "session-ended": {
            intentionalClose.current = true;
            clearPing();
            if (wsRef.current) {
              wsRef.current.close();
              wsRef.current = null;
            }
            setStatus("disconnected");
            o.onSessionEnded?.();
            break;
          }
          case "grade-notification": {
            const grade = msg.grade as string | undefined;
            const notes = msg.notes as string | null | undefined;
            if (grade) o.onGradeNotification?.(grade, notes ?? undefined);
            break;
          }
          case "annotation-added": {
            const annotation = msg.annotation as ErrorAnnotation | undefined;
            if (annotation && o.onAnnotationAdded) {
              o.onAnnotationAdded(annotation);
            }
            break;
          }
          case "annotation-removed": {
            const annotationId = msg.annotation_id as string | undefined;
            if (annotationId && o.onAnnotationRemoved) {
              o.onAnnotationRemoved(annotationId);
            }
            break;
          }
          case "error": {
            const m = msg.message as string | undefined;
            if (!m) break;
            if (m === "Connected from another tab") {
              intentionalClose.current = true;
              clearPing();
              if (wsRef.current) {
                wsRef.current.close();
                wsRef.current = null;
              }
              setStatus("disconnected");
              o.onAnotherTab?.();
              o.onError?.(m);
              break;
            }
            if (m === "Room is full") {
              intentionalClose.current = true;
              clearPing();
              if (wsRef.current) {
                wsRef.current.close();
                wsRef.current = null;
              }
              setStatus("error");
              o.onJoinRejected?.(m);
              o.onError?.(m);
              break;
            }
            o.onError?.(m);
            break;
          }
          default:
            break;
        }
      };

      ws.onerror = () => {
        if (mounted.current) setStatus("error");
      };

      ws.onclose = () => {
        clearPing();
        wsRef.current = null;
        if (!mounted.current) return;
        if (intentionalClose.current) {
          setStatus("disconnected");
          return;
        }
        setStatus("reconnecting");
        const attempt = reconnectAttempt.current;
        const delay = BACKOFF_MS[Math.min(attempt, BACKOFF_MS.length - 1)];
        reconnectAttempt.current = attempt + 1;
        reconnectTimer.current = setTimeout(() => {
          connect();
        }, delay);
      };
    };

    connect();

    return () => {
      intentionalClose.current = true;
      clearReconnect();
      clearPing();
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (mounted.current) setStatus("disconnected");
    };
  }, [enabled, sessionId, token, clearPing, clearReconnect]);

  return {
    status,
    sendMute,
    sendSetReciter,
    sendClearReciter,
    sendCurrentAyah,
    sendClearAyah,
    sendCurrentPage,
    sendAnswer,
    sendIceCandidate,
    sendPing,
    sendGradeNotification,
    sendCreateAnnotation,
    sendRemoveAnnotation,
    disconnect,
  };
}
