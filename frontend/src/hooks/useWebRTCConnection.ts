// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Hamza Ghandouri

import { useCallback, useEffect, useRef, useState } from "react";

const DEFAULT_ICE: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];

export type NetworkQuality = "good" | "fair" | "poor";

export interface UseWebRtcConnectionOptions {
  enabled: boolean;
  sendAnswer: (sdp: string) => void;
  sendIceCandidate: (candidate: string) => void;
  /** Teacher or active reciter: request microphone for upstream audio. */
  publishAudio: boolean;
  iceServers?: RTCIceServer[];
}

export interface UseWebRtcConnectionReturn {
  networkQuality: NetworkQuality | null;
  micDenied: boolean;
  browserSupported: boolean;
  handleRemoteOffer: (sdp: string) => Promise<void>;
  handleRemoteIce: (candidate: string) => Promise<void>;
  disconnect: () => void;
}

export function useWebRTCConnection(options: UseWebRtcConnectionOptions): UseWebRtcConnectionReturn {
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const [networkQuality, setNetworkQuality] = useState<NetworkQuality | null>(null);
  const [micDenied, setMicDenied] = useState(false);
  const [browserSupported] = useState(
    typeof globalThis !== "undefined" && typeof RTCPeerConnection !== "undefined",
  );

  const optsRef = useRef(options);
  optsRef.current = options;

  const teardownPeer = useCallback(() => {
    const pc = pcRef.current;
    if (pc) {
      pc.onconnectionstatechange = null;
      pc.onicecandidate = null;
      pc.ontrack = null;
      pc.close();
      pcRef.current = null;
    }
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    setNetworkQuality(null);
  }, []);

  const handleRemoteOffer = useCallback(
    async (sdp: string) => {
      if (!browserSupported) return;
      teardownPeer();
      const iceServers = optsRef.current.iceServers ?? DEFAULT_ICE;
      const pc = new RTCPeerConnection({ iceServers });
      pcRef.current = pc;

      pc.onicecandidate = (e) => {
        const c = e.candidate;
        if (c) {
          const payload = JSON.stringify(c.toJSON());
          optsRef.current.sendIceCandidate(payload);
        }
      };

      pc.onconnectionstatechange = () => {
        const st = pc.connectionState;
        if (st === "failed" || st === "disconnected") {
          teardownPeer();
        }
      };

      pc.ontrack = (e) => {
        const el = new Audio();
        el.srcObject = e.streams[0] ?? null;
        void el.play().catch(() => {});
      };

      const publish = optsRef.current.publishAudio;
      if (publish) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true },
            video: false,
          });
          localStreamRef.current = stream;
          stream.getTracks().forEach((track) => pc.addTrack(track, stream));
        } catch {
          setMicDenied(true);
        }
      }

      await pc.setRemoteDescription({ type: "offer", sdp });
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      const out = pc.localDescription?.sdp;
      if (out) optsRef.current.sendAnswer(out);
    },
    [browserSupported, teardownPeer],
  );

  const handleRemoteIce = useCallback(async (candidate: string) => {
    const pc = pcRef.current;
    if (!pc) return;
    try {
      const init = JSON.parse(candidate) as RTCIceCandidateInit;
      await pc.addIceCandidate(init);
    } catch {
      // ignore malformed ICE
    }
  }, []);

  useEffect(() => {
    if (!options.enabled || !browserSupported) return;
    const id = window.setInterval(async () => {
      const pc = pcRef.current;
      if (!pc || pc.connectionState !== "connected") {
        setNetworkQuality(null);
        return;
      }
      const stats = await pc.getStats();
      let packetLossPct = 0;
      let roundTripTimeMs = 0;
      stats.forEach((report) => {
        if (report.type === "inbound-rtp" && "kind" in report && report.kind === "audio") {
          const r = report as unknown as { packetsLost?: number; packetsReceived?: number };
          const lost = r.packetsLost ?? 0;
          const recv = r.packetsReceived ?? 0;
          const tot = lost + recv;
          if (tot > 0) packetLossPct = (lost / tot) * 100;
        }
        if (report.type === "candidate-pair" && "state" in report && report.state === "succeeded") {
          const r = report as unknown as { currentRoundTripTime?: number };
          if (r.currentRoundTripTime != null) roundTripTimeMs = r.currentRoundTripTime * 1000;
        }
      });
      if (packetLossPct < 2 && roundTripTimeMs < 150) setNetworkQuality("good");
      else if (packetLossPct < 5 && roundTripTimeMs < 300) setNetworkQuality("fair");
      else setNetworkQuality("poor");
    }, 3000);
    return () => clearInterval(id);
  }, [options.enabled, browserSupported]);

  useEffect(() => {
    if (!options.enabled) teardownPeer();
  }, [options.enabled, teardownPeer]);

  return {
    networkQuality,
    micDenied,
    browserSupported,
    handleRemoteOffer,
    handleRemoteIce,
    disconnect: teardownPeer,
  };
}
