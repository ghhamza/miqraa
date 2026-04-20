import { useCallback, useEffect, useRef, useState } from "react";
import {
  ConnectionState,
  RemoteParticipant,
  RemoteTrack,
  RemoteTrackPublication,
  Room,
  RoomEvent,
  Track,
} from "livekit-client";
import { api } from "@/lib/api";

export type LivekitConnectionStatus =
  | "idle"
  | "requesting_token"
  | "connecting"
  | "connected"
  | "disconnected"
  | "error";

export interface UseLivekitConnectionOptions {
  sessionId: string;
  canPublish?: boolean;
  autoConnect?: boolean;
}

export interface UseLivekitConnectionResult {
  status: LivekitConnectionStatus;
  error: string | null;
  room: Room | null;
  hasRemoteAudio: boolean;
  audioPlaybackBlocked: boolean;
  startAudio: () => Promise<void>;
  isMicEnabled: boolean;
  setMicEnabled: (enabled: boolean) => Promise<void>;
  reconnect: () => Promise<void>;
}

interface TokenResponse {
  token: string;
  ws_url: string;
  room: string;
  identity: string;
}

export function useLivekitConnection(
  options: UseLivekitConnectionOptions,
): UseLivekitConnectionResult {
  const { sessionId, canPublish = false, autoConnect = true } = options;

  const [status, setStatus] = useState<LivekitConnectionStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [hasRemoteAudio, setHasRemoteAudio] = useState(false);
  const [audioPlaybackBlocked, setAudioPlaybackBlocked] = useState(false);
  const [isMicEnabled, setIsMicEnabled] = useState(false);

  // The one and only live Room instance. Null when disconnected or between attempts.
  const roomRef = useRef<Room | null>(null);
  const attachedAudioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());

  // Generation counter. Every fresh connect attempt captures this value; any
  // async step that resumes with a stale generation must bail out.
  // Incrementing this is how "cancel in flight" is signalled.
  const generationRef = useRef(0);

  // Trigger used by `reconnect()` to force a fresh attempt. Incrementing it
  // re-runs the connect effect. Separate from generationRef because
  // generationRef is bumped from cleanup too (not just manual reconnect).
  const [reconnectTrigger, setReconnectTrigger] = useState(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // We keep a ref mirror of canPublish so the connect effect doesn't need it
  // in its deps - avoids full reconnect when canPublish flips mid-session.
  // Permission updates flow server-side via the backend reciter-turn hook;
  // we just need to enable/disable the mic locally in response.
  const canPublishRef = useRef(canPublish);
  const prevCanPublishRef = useRef(canPublish);
  useEffect(() => {
    canPublishRef.current = canPublish;
  }, [canPublish]);

  /**
   * Tear down the current Room if any. Safe to call any number of times.
   * This is NOT awaited during StrictMode cleanup - React 18/19 doesn't
   * support async cleanup - but the generation bump ensures any stale
   * async step that resumes afterwards will abort.
   */
  const teardownCurrentRoom = useCallback(async () => {
    for (const [, audioEl] of attachedAudioElementsRef.current) {
      if (audioEl.parentElement) {
        audioEl.parentElement.removeChild(audioEl);
      }
    }
    attachedAudioElementsRef.current.clear();

    const r = roomRef.current;
    if (!r) return;
    roomRef.current = null;
    try {
      await r.disconnect(true);
    } catch {
      // ignore
    }
  }, []);

  // The connect effect. Runs on mount, on sessionId change, on reconnect.
  useEffect(() => {
    if (!autoConnect || !sessionId) {
      return;
    }

    // Bump generation. Any previously in-flight connect attempt will see
    // its captured generation !== this one and bail out.
    generationRef.current += 1;
    const myGen = generationRef.current;

    // AbortController for the token fetch specifically - lets us cancel
    // the HTTP request immediately on cleanup rather than waiting for it
    // to resolve just so the resolution handler can notice it's stale.
    const tokenAbort = new AbortController();

    const run = async () => {
      try {
        setStatus("requesting_token");
        setError(null);

        const { data } = await api.post<TokenResponse>(
          "/livekit/token",
          { session_id: sessionId },
          { signal: tokenAbort.signal },
        );

        // Stale attempt? Bail.
        if (generationRef.current !== myGen) return;

        setStatus("connecting");

        const room = new Room({
          adaptiveStream: true,
          dynacast: true,
          audioCaptureDefaults: {
            autoGainControl: true,
            echoCancellation: true,
            noiseSuppression: true,
          },
        });

        // Wire event handlers BEFORE awaiting connect, so we don't miss
        // any early events (e.g. Connected fires before our await resolves
        // in some SDK versions).
        room.on(
          RoomEvent.TrackSubscribed,
          (track: RemoteTrack, pub: RemoteTrackPublication, _p: RemoteParticipant) => {
            if (pub.kind === Track.Kind.Audio) {
              const trackSid = track.sid;
              if (!trackSid) return;
              const existing = attachedAudioElementsRef.current.get(trackSid);
              if (existing?.parentElement) {
                existing.parentElement.removeChild(existing);
              }

              const audioEl = track.attach() as HTMLAudioElement;
              document.body.appendChild(audioEl);
              attachedAudioElementsRef.current.set(trackSid, audioEl);
              setHasRemoteAudio(true);
            }
          },
        );

        room.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack, pub: RemoteTrackPublication) => {
          const audioEl = attachedAudioElementsRef.current.get(pub.trackSid);
          if (audioEl) {
            track.detach(audioEl);
            if (audioEl.parentElement) {
              audioEl.parentElement.removeChild(audioEl);
            }
            attachedAudioElementsRef.current.delete(pub.trackSid);
          }

          const audioStillThere = Array.from(room.remoteParticipants.values()).some(
            (participant) =>
              Array.from(participant.trackPublications.values()).some(
                (pub) => pub.kind === Track.Kind.Audio && pub.isSubscribed,
              ),
          );
          setHasRemoteAudio(audioStillThere);
        });

        room.on(RoomEvent.AudioPlaybackStatusChanged, () => {
          setAudioPlaybackBlocked(!room.canPlaybackAudio);
        });

        room.on(RoomEvent.ConnectionStateChanged, (state: ConnectionState) => {
          // Ignore events from stale rooms.
          if (generationRef.current !== myGen) return;
          if (state === ConnectionState.Connected) {
            setStatus("connected");
          } else if (state === ConnectionState.Disconnected) {
            setStatus("disconnected");
          }
        });

        room.on(RoomEvent.Disconnected, () => {
          if (generationRef.current !== myGen) return;
          setStatus("disconnected");
        });

        room.on(RoomEvent.LocalTrackPublished, () => {
          if (generationRef.current !== myGen) return;
          setIsMicEnabled(room.localParticipant.isMicrophoneEnabled);
        });

        room.on(RoomEvent.LocalTrackUnpublished, () => {
          if (generationRef.current !== myGen) return;
          setIsMicEnabled(room.localParticipant.isMicrophoneEnabled);
        });

        room.on(RoomEvent.ParticipantPermissionsChanged, (_prev, participant) => {
          if (generationRef.current !== myGen) return;

          // Only act on our own permission changes.
          if (participant.identity !== room.localParticipant.identity) return;

          const perm = room.localParticipant.permissions;
          const nowCanPublish = perm?.canPublish === true;

          if (nowCanPublish && !room.localParticipant.isMicrophoneEnabled) {
            // Enable mic now that LiveKit has accepted our new publish permission.
            room.localParticipant
              .setMicrophoneEnabled(true)
              .then(() => {
                if (generationRef.current === myGen) {
                  setIsMicEnabled(true);
                }
              })
              .catch((err) => console.warn("auto-enable mic after permission grant failed:", err));
          } else if (!nowCanPublish && room.localParticipant.isMicrophoneEnabled) {
            // Teacher revoked publish rights - disable mic and unpublish.
            room.localParticipant
              .setMicrophoneEnabled(false)
              .then(() => {
                if (generationRef.current === myGen) {
                  setIsMicEnabled(false);
                }
              })
              .catch((err) => console.warn("auto-disable mic after permission revoke failed:", err));
          }
        });

        // Connect. If a stale attempt reaches this point AND the room has
        // already been torn down by a newer attempt, `room.connect` will
        // throw - which is caught below and swallowed because we only
        // surface errors for the *current* generation.
        await room.connect(data.ws_url, data.token);

        // Double-check after connect: if a newer attempt has taken over,
        // clean up this now-stale room and bail.
        if (generationRef.current !== myGen) {
          try {
            await room.disconnect(true);
          } catch {
            // ignore
          }
          return;
        }

        // We are now the live room. Claim the ref.
        roomRef.current = room;
        setStatus("connected");
        setAudioPlaybackBlocked(!room.canPlaybackAudio);
        setIsMicEnabled(room.localParticipant.isMicrophoneEnabled);

        // Auto-enable mic for publishers. Read from ref so a flip of
        // canPublish between connect start and now is respected.
        if (canPublishRef.current) {
          try {
            await room.localParticipant.setMicrophoneEnabled(true);
            if (generationRef.current === myGen) {
              setIsMicEnabled(true);
            }
          } catch (micErr) {
            console.warn("Failed to auto-enable mic:", micErr);
          }
        }
      } catch (connectErr) {
        // Only surface errors for the CURRENT attempt. Stale attempts that
        // fail because the room was torn down are expected and silent.
        if (generationRef.current !== myGen) return;
        if (tokenAbort.signal.aborted) return;

        console.error("LiveKit connection failed:", connectErr);
        setError(connectErr instanceof Error ? connectErr.message : String(connectErr));
        setStatus("error");
      }
    };

    void run();

    return () => {
      // Cleanup: bump generation to invalidate any in-flight attempt, abort
      // the token fetch, and tear down the live room (if any) without
      // blocking React. Because React can't await cleanup, we rely on the
      // generation check in the in-flight attempt to prevent it from
      // claiming the (now null) roomRef.
      generationRef.current += 1;
      tokenAbort.abort();
      void teardownCurrentRoom();
    };
    // sessionId and autoConnect drive full reconnects.
    // reconnectTrigger lets the reconnect() API force a fresh attempt.
    // canPublish is NOT in deps (see canPublishRef above).
  }, [sessionId, autoConnect, reconnectTrigger, teardownCurrentRoom]);

  // Sync mic state with canPublish changes mid-session. The backend already
  // updates LiveKit permissions server-side; we just reflect locally.
  useEffect(() => {
    if (status !== "connected" || !roomRef.current) return;
    const room = roomRef.current;
    const wasCanPublish = prevCanPublishRef.current;
    prevCanPublishRef.current = canPublish;

    // Only auto-enable when permission transitions false -> true.
    // Do not force-enable if user manually muted while still permitted.
    if (!wasCanPublish && canPublish && !isMicEnabled) {
      room.localParticipant
        .setMicrophoneEnabled(true)
        .then(() => setIsMicEnabled(true))
        .catch((err) => console.warn("setMicrophoneEnabled(true) failed:", err));
    } else if (wasCanPublish && !canPublish && isMicEnabled) {
      room.localParticipant
        .setMicrophoneEnabled(false)
        .then(() => setIsMicEnabled(false))
        .catch((err) => console.warn("setMicrophoneEnabled(false) failed:", err));
    }
  }, [canPublish, status, isMicEnabled]);

  // Clear remote audio and mic state when status transitions away from connected.
  useEffect(() => {
    if (status !== "connected") {
      setHasRemoteAudio(false);
      setAudioPlaybackBlocked(false);
      setIsMicEnabled(false);
    }
  }, [status]);

  // Auto-retry connection after transient signal failures.
  useEffect(() => {
    if (!autoConnect || !sessionId) return;
    if (status !== "error" && status !== "disconnected") return;
    if (reconnectTimerRef.current) return;

    reconnectTimerRef.current = window.setTimeout(() => {
      reconnectTimerRef.current = null;
      setReconnectTrigger((n) => n + 1);
    }, 1200);

    return () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };
  }, [status, autoConnect, sessionId]);

  const reconnect = useCallback(async () => {
    // Increment trigger to re-run the connect effect. Its cleanup will
    // tear down the current room first.
    setReconnectTrigger((n) => n + 1);
  }, []);

  const startAudio = useCallback(async () => {
    const r = roomRef.current;
    if (!r) {
      // If user explicitly taps and we don't currently have a room, force a reconnect attempt.
      setReconnectTrigger((n) => n + 1);
      return;
    }
    try {
      await r.startAudio();
      setAudioPlaybackBlocked(!r.canPlaybackAudio);
    } catch (startErr) {
      console.warn("startAudio failed:", startErr);
    }
  }, []);

  const setMicEnabled = useCallback(async (enabled: boolean) => {
    const r = roomRef.current;
    if (!r) return;
    try {
      await r.localParticipant.setMicrophoneEnabled(enabled);
      setIsMicEnabled(enabled);
    } catch (micErr) {
      console.warn("setMicrophoneEnabled failed:", micErr);
    }
  }, []);

  return {
    status,
    error,
    room: roomRef.current,
    hasRemoteAudio,
    audioPlaybackBlocked,
    startAudio,
    isMicEnabled,
    setMicEnabled,
    reconnect,
  };
}
