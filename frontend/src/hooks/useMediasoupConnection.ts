// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Hamza Ghandouri

import { useCallback, useEffect, useRef, useState } from "react";
import { Device } from "mediasoup-client";
import type {
  Consumer,
  Producer,
  Transport,
  TransportOptions,
} from "mediasoup-client/types";

import type { SessionWsStatus } from "./useSessionWebSocket";

export type MediasoupConnectionStatus =
  | "idle"
  | "loading-device"
  | "creating-transports"
  | "ready"
  | "error";

export interface UseMediasoupConnectionOptions {
  enabled: boolean;
  wsStatus: SessionWsStatus;
  /** Teacher or active reciter — auto-publish when true (unless manually muted). */
  shouldPublish: boolean;
  /** Skip consuming our own announced producers (defensive). */
  myUserId: string;
  sendMsGetRtpCapabilities: () => void;
  sendMsCreateTransport: (direction: "send" | "recv") => void;
  sendMsConnectTransport: (transportId: string, dtlsParameters: unknown) => void;
  sendMsProduce: (transportId: string, kind: "audio", rtpParameters: unknown) => void;
  sendMsConsume: (transportId: string, producerId: string, rtpCapabilities: unknown) => void;
  sendMsResumeConsumer: (consumerId: string) => void;
  sendMsCloseProducer: (producerId: string) => void;
}

export interface UseMediasoupConnectionReturn {
  status: MediasoupConnectionStatus;
  error: string | null;
  device: Device | null;
  sendTransport: Transport | null;
  recvTransport: Transport | null;
  isPublishing: boolean;
  consumerCount: number;
  publishAudio: () => Promise<void>;
  stopPublishing: () => Promise<void>;
  handleRtpCapabilities: (caps: unknown) => void;
  handleTransportCreated: (params: {
    id: string;
    iceParameters: unknown;
    iceCandidates: unknown;
    dtlsParameters: unknown;
  }) => void;
  handleTransportConnected: (transportId: string) => void;
  handleProduced: (producerId: string) => void;
  handleConsumed: (info: {
    id: string;
    producerId: string;
    kind: string;
    rtpParameters: unknown;
  }) => void;
  handleConsumerResumed: (consumerId: string) => void;
  handleNewProducer: (info: { producerId: string; userId: string; kind: string }) => void;
  handleProducerClosed: (producerId: string) => void;
  /** Toggle local mic mute; auto-publish effect respects this so manual mute sticks. */
  toggleManualMute: () => void;
  disconnect: () => void;
}

export function useMediasoupConnection(
  options: UseMediasoupConnectionOptions,
): UseMediasoupConnectionReturn {
  const {
    enabled,
    wsStatus,
    shouldPublish,
    myUserId,
    sendMsGetRtpCapabilities,
    sendMsCreateTransport,
    sendMsConnectTransport,
    sendMsProduce,
    sendMsConsume,
    sendMsResumeConsumer,
    sendMsCloseProducer,
  } = options;

  const [status, setStatus] = useState<MediasoupConnectionStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [manuallyMuted, setManuallyMuted] = useState(false);
  const [consumerCount, setConsumerCount] = useState(0);

  const deviceRef = useRef<Device | null>(null);
  const sendTransportRef = useRef<Transport | null>(null);
  const recvTransportRef = useRef<Transport | null>(null);

  const stepRef = useRef<
    "idle" | "awaiting-caps" | "awaiting-send-transport" | "awaiting-recv-transport" | "ready"
  >("idle");

  const pendingConnectRef = useRef<
    Map<string, { callback: () => void; errback: (err: Error) => void }>
  >(new Map());

  const producersRef = useRef<Map<string, Producer>>(new Map());
  const consumersRef = useRef<
    Map<string, { consumer: Consumer; stream: MediaStream; audioEl: HTMLAudioElement }>
  >(new Map());
  const consumingProducersRef = useRef<Set<string>>(new Set());
  const pendingProduceRef = useRef<{
    callback: (data: { id: string }) => void;
    errback: (err: Error) => void;
  } | null>(null);

  const clearLocalMedia = useCallback(() => {
    for (const [pid, producer] of producersRef.current) {
      try {
        producer.close();
        sendMsCloseProducer(pid);
      } catch {
        /* ignore */
      }
    }
    producersRef.current.clear();
    setIsPublishing(false);
    pendingProduceRef.current = null;

    for (const cid of Array.from(consumersRef.current.keys())) {
      const entry = consumersRef.current.get(cid);
      if (!entry) continue;
      try {
        entry.audioEl.pause();
        entry.audioEl.srcObject = null;
        entry.audioEl.remove();
        entry.consumer.close();
      } catch {
        /* ignore */
      }
      consumersRef.current.delete(cid);
      consumingProducersRef.current.delete(entry.consumer.producerId);
    }
    setConsumerCount(0);
  }, [sendMsCloseProducer]);

  const cleanupConsumer = useCallback((consumerId: string) => {
    const entry = consumersRef.current.get(consumerId);
    if (!entry) return;
    try {
      entry.audioEl.pause();
      entry.audioEl.srcObject = null;
      entry.audioEl.remove();
      entry.consumer.close();
    } catch (e) {
      console.warn("[mediasoup] cleanupConsumer error:", e);
    }
    consumersRef.current.delete(consumerId);
    consumingProducersRef.current.delete(entry.consumer.producerId);
    setConsumerCount((n) => Math.max(0, n - 1));
  }, []);

  const teardown = useCallback(() => {
    setManuallyMuted(false);
    clearLocalMedia();
    sendTransportRef.current?.close();
    recvTransportRef.current?.close();
    sendTransportRef.current = null;
    recvTransportRef.current = null;
    deviceRef.current = null;
    pendingConnectRef.current.clear();
    stepRef.current = "idle";
    setStatus("idle");
    setError(null);
  }, [clearLocalMedia]);

  useEffect(() => {
    if (!enabled) {
      teardown();
    }
  }, [enabled, teardown]);

  useEffect(() => {
    if (!enabled) return;
    if (wsStatus !== "connected") return;
    if (stepRef.current !== "idle") return;
    stepRef.current = "awaiting-caps";
    setStatus("loading-device");
    sendMsGetRtpCapabilities();
  }, [enabled, wsStatus, sendMsGetRtpCapabilities]);

  useEffect(() => {
    if (wsStatus === "disconnected" || wsStatus === "error" || wsStatus === "reconnecting") {
      setManuallyMuted(false);
      clearLocalMedia();
      sendTransportRef.current?.close();
      recvTransportRef.current?.close();
      sendTransportRef.current = null;
      recvTransportRef.current = null;
      deviceRef.current = null;
      pendingConnectRef.current.clear();
      stepRef.current = "idle";
      setStatus("idle");
      setError(null);
    }
  }, [wsStatus, clearLocalMedia]);

  useEffect(() => {
    if (!shouldPublish) {
      setManuallyMuted(false);
    }
  }, [shouldPublish]);

  const handleRtpCapabilities = useCallback(
    (caps: unknown) => {
      if (stepRef.current !== "awaiting-caps") return;
      void (async () => {
        try {
          const device = new Device();
          await device.load({ routerRtpCapabilities: caps as never });
          deviceRef.current = device;
          stepRef.current = "awaiting-send-transport";
          setStatus("creating-transports");
          sendMsCreateTransport("send");
        } catch (e) {
          setError(`load device: ${(e as Error).message}`);
          setStatus("error");
          stepRef.current = "idle";
        }
      })();
    },
    [sendMsCreateTransport],
  );

  const handleTransportCreated = useCallback(
    (params: {
      id: string;
      iceParameters: unknown;
      iceCandidates: unknown;
      dtlsParameters: unknown;
    }) => {
      const device = deviceRef.current;
      if (!device) return;

      const transportOptions: TransportOptions = {
        id: params.id,
        iceParameters: params.iceParameters as never,
        iceCandidates: params.iceCandidates as never,
        dtlsParameters: params.dtlsParameters as never,
      };

      try {
        let transport: Transport;
        if (stepRef.current === "awaiting-send-transport") {
          transport = device.createSendTransport(transportOptions);
          sendTransportRef.current = transport;

          transport.on("produce", ({ kind, rtpParameters }, callback, errback) => {
            if (kind !== "audio") {
              errback(new Error(`unsupported kind: ${kind}`));
              return;
            }
            pendingProduceRef.current = { callback, errback };
            sendMsProduce(transport.id, "audio", rtpParameters);
          });
        } else if (stepRef.current === "awaiting-recv-transport") {
          transport = device.createRecvTransport(transportOptions);
          recvTransportRef.current = transport;
        } else {
          return;
        }

        transport.on("connect", ({ dtlsParameters }, callback, errback) => {
          pendingConnectRef.current.set(transport.id, { callback, errback });
          sendMsConnectTransport(transport.id, dtlsParameters);
        });

        transport.on("connectionstatechange", (state) => {
          console.log(`[mediasoup] ${transport.direction} transport state: ${state}`);
          if (state === "failed" || state === "disconnected") {
            setError(`${transport.direction} transport: ${state}`);
            setStatus("error");
          }
        });

        if (stepRef.current === "awaiting-send-transport") {
          stepRef.current = "awaiting-recv-transport";
          sendMsCreateTransport("recv");
        } else if (stepRef.current === "awaiting-recv-transport") {
          stepRef.current = "ready";
          setStatus("ready");
        }
      } catch (e) {
        setError(`create transport: ${(e as Error).message}`);
        setStatus("error");
        stepRef.current = "idle";
      }
    },
    [sendMsCreateTransport, sendMsConnectTransport, sendMsProduce],
  );

  const handleTransportConnected = useCallback((transportId: string) => {
    const pending = pendingConnectRef.current.get(transportId);
    if (!pending) return;
    pending.callback();
    pendingConnectRef.current.delete(transportId);
  }, []);

  const handleProduced = useCallback((producerId: string) => {
    const pending = pendingProduceRef.current;
    if (!pending) {
      console.warn("[mediasoup] handleProduced with no pending produce request");
      return;
    }
    pending.callback({ id: producerId });
    pendingProduceRef.current = null;
  }, []);

  const stopPublishing = useCallback(async () => {
    for (const [id, producer] of producersRef.current) {
      try {
        producer.close();
        sendMsCloseProducer(id);
      } catch (e) {
        console.warn("[mediasoup] close producer error:", e);
      }
    }
    producersRef.current.clear();
    setIsPublishing(false);
    pendingProduceRef.current = null;
  }, [sendMsCloseProducer]);

  const publishAudio = useCallback(async () => {
    const transport = sendTransportRef.current;
    if (!transport) {
      setError("send transport not ready");
      return;
    }
    if (producersRef.current.size > 0) {
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: 48000,
          channelCount: 1,
        },
      });
      const track = stream.getAudioTracks()[0];
      if (!track) {
        setError("no audio track from getUserMedia");
        return;
      }

      const producer = await transport.produce({
        track,
        codecOptions: {
          opusStereo: false,
          opusDtx: true,
          opusFec: true,
        },
      });

      producersRef.current.set(producer.id, producer);
      setIsPublishing(true);

      producer.on("trackended", () => {
        console.log("[mediasoup] producer track ended");
        void stopPublishing();
      });

      producer.on("transportclose", () => {
        producersRef.current.delete(producer.id);
        setIsPublishing(false);
      });
    } catch (e) {
      const msg = (e as Error).message;
      setError(`publishAudio: ${msg}`);
      console.error("[mediasoup] publishAudio error:", e);
    }
  }, [stopPublishing]);

  const handleNewProducer = useCallback(
    (info: { producerId: string; userId: string; kind: string }) => {
      const device = deviceRef.current;
      const recvTransport = recvTransportRef.current;
      if (!device || !recvTransport) {
        console.warn("[mediasoup] handleNewProducer: device or recv transport not ready");
        return;
      }
      if (myUserId && info.userId === myUserId) {
        return;
      }
      if (consumingProducersRef.current.has(info.producerId)) return;
      consumingProducersRef.current.add(info.producerId);

      sendMsConsume(recvTransport.id, info.producerId, device.rtpCapabilities);
    },
    [sendMsConsume, myUserId],
  );

  const handleConsumed = useCallback(
    async (info: {
      id: string;
      producerId: string;
      kind: string;
      rtpParameters: unknown;
    }) => {
      const recvTransport = recvTransportRef.current;
      if (!recvTransport) {
        console.warn("[mediasoup] handleConsumed: recv transport not ready");
        return;
      }
      try {
        const consumer = await recvTransport.consume({
          id: info.id,
          producerId: info.producerId,
          kind: info.kind as "audio" | "video",
          rtpParameters: info.rtpParameters as never,
        });

        const stream = new MediaStream([consumer.track]);
        const audioEl = document.createElement("audio");
        audioEl.autoplay = true;
        audioEl.srcObject = stream;
        audioEl.style.display = "none";
        document.body.appendChild(audioEl);

        void audioEl.play().catch((e) => {
          console.warn("[mediasoup] audioEl.play() rejected (autoplay policy?):", e);
        });

        consumersRef.current.set(consumer.id, { consumer, stream, audioEl });
        setConsumerCount((n) => n + 1);

        consumer.on("trackended", () => {
          console.log("[mediasoup] consumer track ended:", consumer.id);
        });

        consumer.on("transportclose", () => {
          cleanupConsumer(consumer.id);
        });

        sendMsResumeConsumer(consumer.id);
      } catch (e) {
        console.error("[mediasoup] handleConsumed error:", e);
        consumingProducersRef.current.delete(info.producerId);
      }
    },
    [sendMsResumeConsumer, cleanupConsumer],
  );

  const handleConsumerResumed = useCallback((consumerId: string) => {
    console.log("[mediasoup] consumer resumed on server:", consumerId);
  }, []);

  const handleProducerClosed = useCallback(
    (producerId: string) => {
      const toRemove: string[] = [];
      for (const [consumerId, entry] of consumersRef.current) {
        if (entry.consumer.producerId === producerId) {
          toRemove.push(consumerId);
        }
      }
      for (const id of toRemove) {
        cleanupConsumer(id);
      }
    },
    [cleanupConsumer],
  );

  const toggleManualMute = useCallback(() => {
    setManuallyMuted((prev) => !prev);
  }, []);

  useEffect(() => {
    if (status !== "ready") return;
    if (shouldPublish && !manuallyMuted && !isPublishing) {
      void publishAudio();
    } else if ((!shouldPublish || manuallyMuted) && isPublishing) {
      void stopPublishing();
    }
  }, [shouldPublish, manuallyMuted, status, isPublishing, publishAudio, stopPublishing]);

  const disconnect = useCallback(() => {
    teardown();
  }, [teardown]);

  useEffect(() => {
    return () => {
      for (const producer of producersRef.current.values()) {
        try {
          producer.close();
        } catch {
          /* ignore */
        }
      }
      producersRef.current.clear();
      for (const consumerId of Array.from(consumersRef.current.keys())) {
        const entry = consumersRef.current.get(consumerId);
        if (!entry) continue;
        try {
          entry.audioEl.pause();
          entry.audioEl.srcObject = null;
          entry.audioEl.remove();
          entry.consumer.close();
        } catch {
          /* ignore */
        }
        consumersRef.current.delete(consumerId);
      }
      consumingProducersRef.current.clear();
      pendingProduceRef.current = null;

      sendTransportRef.current?.close();
      recvTransportRef.current?.close();
      sendTransportRef.current = null;
      recvTransportRef.current = null;
      deviceRef.current = null;
      pendingConnectRef.current.clear();
      stepRef.current = "idle";
    };
  }, []);

  const result: UseMediasoupConnectionReturn = {
    status,
    error,
    device: deviceRef.current,
    sendTransport: sendTransportRef.current,
    recvTransport: recvTransportRef.current,
    isPublishing,
    consumerCount,
    publishAudio,
    stopPublishing,
    handleRtpCapabilities,
    handleTransportCreated,
    handleTransportConnected,
    handleProduced,
    handleConsumed,
    handleConsumerResumed,
    handleNewProducer,
    handleProducerClosed,
    toggleManualMute,
    disconnect,
  };
  return result;
}
