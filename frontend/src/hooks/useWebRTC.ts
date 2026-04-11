// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useRef, useState, useCallback } from "react";
import type { SignalMessage, Participant } from "../types";

const ICE_SERVERS = [{ urls: "stun:stun.l.google.com:19302" }];
/** Backend expects a UUID for `target`; use this until SFU routing is implemented */
const SIGNALING_SERVER_TARGET = "00000000-0000-0000-0000-000000000000";

export function useWebRTC(roomId: string, userId: string) {
  const wsRef = useRef<WebSocket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const [participants] = useState<Participant[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(true);

  const connect = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        sampleRate: 48000,
        channelCount: 1,
      },
      video: false,
    });
    localStreamRef.current = stream;

    stream.getAudioTracks().forEach((t) => {
      t.enabled = false;
    });

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pcRef.current = pc;

    stream.getTracks().forEach((track) => pc.addTrack(track, stream));

    const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${wsProtocol}//${window.location.host}/ws/signaling/${roomId}`);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      ws.send(JSON.stringify({ type: "join", user_id: userId, room_id: roomId }));
    };

    ws.onmessage = (event) => {
      const signal: SignalMessage = JSON.parse(event.data);
      handleSignal(signal, pc, ws);
    };

    ws.onclose = () => setIsConnected(false);

    pc.onicecandidate = (event) => {
      if (event.candidate && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: "ice-candidate",
          candidate: JSON.stringify(event.candidate),
          target: SIGNALING_SERVER_TARGET,
        }));
      }
    };

    pc.ontrack = (event) => {
      const audio = new Audio();
      audio.srcObject = event.streams[0];
      void audio.play();
    };
  }, [roomId, userId]);

  const toggleMute = useCallback(() => {
    const stream = localStreamRef.current;
    if (stream) {
      const track = stream.getAudioTracks()[0];
      track.enabled = !track.enabled;
      setIsMuted(!track.enabled);
    }
  }, []);

  const disconnect = useCallback(() => {
    wsRef.current?.close();
    pcRef.current?.close();
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    setIsConnected(false);
  }, []);

  return { connect, disconnect, toggleMute, participants, isConnected, isMuted };
}

function handleSignal(_signal: SignalMessage, _pc: RTCPeerConnection, _ws: WebSocket) {
  // TODO: Handle offer/answer/ICE exchange with SFU
}
