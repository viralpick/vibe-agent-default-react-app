import { useEffect, useRef } from "react";
import { PostMessageType } from "../types/auth.types";

const HEARTBEAT_INTERVAL_MS = 1000;

/**
 * 부모 윈도우에 1초마다 heartbeat 메시지를 전송하는 훅.
 *
 * - iframe 내부에서만 동작하며, 컴포넌트 언마운트 시 자동으로 정리됩니다.
 * - 개발 환경에서는 Vite HMR WebSocket 연결이 끊기면 heartbeat를 중단하고,
 *   재연결되면 자동으로 재개합니다.
 */
export function useHeartbeat() {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // iframe이 아닌 경우 heartbeat를 보내지 않음
    if (!window.parent || window.parent === window) {
      return;
    }

    const startHeartbeat = () => {
      if (intervalRef.current !== null) return; // 이미 실행 중이면 무시

      intervalRef.current = setInterval(() => {
        window.parent.postMessage(
          {
            type: PostMessageType.HEARTBEAT,
            timestamp: Date.now(),
          },
          "*",
        );
      }, HEARTBEAT_INTERVAL_MS);
    };

    const stopHeartbeat = () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };

    // 즉시 heartbeat 시작
    startHeartbeat();

    // 개발 환경: Vite HMR WebSocket 연결 상태에 따라 heartbeat 제어
    if (import.meta.hot) {
      import.meta.hot.on("vite:ws:disconnect", () => {
        console.warn("[useHeartbeat] Vite HMR disconnected — heartbeat 중단");
        stopHeartbeat();
      });

      import.meta.hot.on("vite:ws:connect", () => {
        console.info("[useHeartbeat] Vite HMR reconnected — heartbeat 재개");
        startHeartbeat();
      });
    }

    return () => {
      stopHeartbeat();
    };
  }, []);
}
