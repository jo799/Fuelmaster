import { useEffect, useRef, useState } from "react";
import type { Pump, Tank } from "../types";
import { getAccessToken } from "./api";

// If VITE_WS_URL isn't explicitly set, derive it from the page's own
// protocol rather than hardcoding ws://. A page served over https:// can't
// open a plain ws:// socket at all (browsers block it as mixed content), so
// this avoids an easy-to-forget manual override at deploy time \u2014 wss:// is
// used automatically whenever the app itself is served securely.
function defaultWsUrl(): string {
  if (typeof window === "undefined") return "ws://localhost:4001";
  const isSecure = window.location.protocol === "https:";
  return `${isSecure ? "wss" : "ws"}://${window.location.hostname}:4001`;
}

const WS_URL = import.meta.env.VITE_WS_URL ?? defaultWsUrl();

export type ConnectionStatus = "connecting" | "connected" | "disconnected";

/**
 * Subscribes to /ws/dashboard for live pump AND tank telemetry pushed by the
 * edge service (FCC + ATG drivers) via the backend gateway. Both channels
 * are multiplexed over one socket, so this single hook covers both rather
 * than opening a second connection per page. Reconnects automatically with
 * backoff. `enabled` lets callers wait until an access token exists.
 */
export function usePumpTelemetry(enabled: boolean) {
  const [pumps, setPumps] = useState<Pump[] | null>(null);
  const [tanks, setTanks] = useState<Tank[] | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const socketRef = useRef<WebSocket | null>(null);
  const retryRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    function connect() {
      const token = getAccessToken();
      if (!token) {
        timerRef.current = setTimeout(connect, 500);
        return;
      }

      setStatus("connecting");
      const socket = new WebSocket(`${WS_URL}/ws/dashboard?token=${encodeURIComponent(token)}`);
      socketRef.current = socket;

      socket.onopen = () => {
        if (cancelled) return;
        retryRef.current = 0;
        setStatus("connected");
      };

      socket.onmessage = (event) => {
        if (cancelled) return;
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === "pumps") setPumps(msg.pumps);
          if (msg.type === "tanks") setTanks(msg.tanks);
        } catch {
          /* ignore malformed frame */
        }
      };

      socket.onclose = () => {
        if (cancelled) return;
        setStatus("disconnected");
        const delay = Math.min(10_000, 500 * 2 ** retryRef.current);
        retryRef.current += 1;
        timerRef.current = setTimeout(connect, delay);
      };

      socket.onerror = () => {
        socket.close();
      };
    }

    connect();

    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
      socketRef.current?.close();
    };
  }, [enabled]);

  return { pumps, tanks, status };
}