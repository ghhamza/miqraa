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

  const roomRef = useRef<Room | null>(null);
  const mountedRef = useRef(true);

  const safeSetStatus = useCallback((s: LivekitConnectionStatus) => {
    if (mountedRef.current) {
      setStatus(s);
    }
  }, []);

  const connect = useCallback(async () => {
    if (roomRef.current || !sessionId) {
      return;
    }

    try {
      safeSetStatus("requesting_token");
      setError(null);

      const { data } = await api.post<TokenResponse>("/livekit/token", {
        session_id: sessionId,
      });

      if (!mountedRef.current) return;

      safeSetStatus("connecting");
      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
        audioCaptureDefaults: {
          autoGainControl: true,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      roomRef.current = room;

      room.on(
        RoomEvent.TrackSubscribed,
        (_track: RemoteTrack, pub: RemoteTrackPublication, _participant: RemoteParticipant) => {
          if (pub.kind === Track.Kind.Audio) {
            setHasRemoteAudio(true);
          }
        },
      );

      room.on(RoomEvent.TrackUnsubscribed, () => {
        const audioStillThere = Array.from(room.remoteParticipants.values()).some((participant) =>
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
        if (state === ConnectionState.Connected) {
          safeSetStatus("connected");
        } else if (state === ConnectionState.Disconnected) {
          safeSetStatus("disconnected");
        }
      });

      room.on(RoomEvent.Disconnected, () => {
        safeSetStatus("disconnected");
      });

      room.on(RoomEvent.LocalTrackPublished, () => {
        if (roomRef.current) {
          setIsMicEnabled(roomRef.current.localParticipant.isMicrophoneEnabled);
        }
      });

      room.on(RoomEvent.LocalTrackUnpublished, () => {
        if (roomRef.current) {
          setIsMicEnabled(roomRef.current.localParticipant.isMicrophoneEnabled);
        }
      });

      await room.connect(data.ws_url, data.token);

      if (!mountedRef.current) {
        await room.disconnect();
        roomRef.current = null;
        return;
      }

      safeSetStatus("connected");
      setAudioPlaybackBlocked(!room.canPlaybackAudio);
      setIsMicEnabled(room.localParticipant.isMicrophoneEnabled);

      if (canPublish) {
        try {
          await room.localParticipant.setMicrophoneEnabled(true);
          setIsMicEnabled(true);
        } catch (connectErr) {
          console.warn("Failed to auto-enable mic:", connectErr);
        }
      }
    } catch (connectErr) {
      console.error("LiveKit connection failed:", connectErr);
      if (mountedRef.current) {
        setError(connectErr instanceof Error ? connectErr.message : String(connectErr));
        safeSetStatus("error");
      }
      if (roomRef.current) {
        try {
          await roomRef.current.disconnect();
        } catch {
          // ignore
        }
        roomRef.current = null;
      }
    }
  }, [sessionId, canPublish, safeSetStatus]);

  const disconnect = useCallback(async () => {
    if (roomRef.current) {
      try {
        await roomRef.current.disconnect();
      } catch (disconnectErr) {
        console.warn("Error during LiveKit disconnect:", disconnectErr);
      }
      roomRef.current = null;
    }
    setHasRemoteAudio(false);
    setIsMicEnabled(false);
    setAudioPlaybackBlocked(false);
    safeSetStatus("disconnected");
  }, [safeSetStatus]);

  const reconnect = useCallback(async () => {
    await disconnect();
    await connect();
  }, [connect, disconnect]);

  const startAudio = useCallback(async () => {
    if (!roomRef.current) return;
    try {
      await roomRef.current.startAudio();
      setAudioPlaybackBlocked(!roomRef.current.canPlaybackAudio);
    } catch (startErr) {
      console.warn("startAudio failed:", startErr);
    }
  }, []);

  const setMicEnabled = useCallback(async (enabled: boolean) => {
    if (!roomRef.current) return;
    try {
      await roomRef.current.localParticipant.setMicrophoneEnabled(enabled);
      setIsMicEnabled(enabled);
    } catch (micErr) {
      console.warn("setMicrophoneEnabled failed:", micErr);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    if (autoConnect) {
      void connect();
    }
    return () => {
      mountedRef.current = false;
      void disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, autoConnect]);

  useEffect(() => {
    if (status !== "connected" || !roomRef.current) return;
    if (canPublish && !isMicEnabled) {
      void setMicEnabled(true);
    } else if (!canPublish && isMicEnabled) {
      void setMicEnabled(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canPublish, status]);

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
