import { useEffect } from "react";
import { PostMessageType } from "../types/auth.types";

const HEARTBEAT_INTERVAL_MS = 1000;

/**
 * 부모 윈도우에 1초마다 heartbeat 메시지를 전송하는 훅.
 * iframe 내부에서만 동작하며, 컴포넌트 언마운트 시 자동으로 정리됩니다.
 */
export function useHeartbeat() {
  useEffect(() => {
    // iframe이 아닌 경우 heartbeat를 보내지 않음
    if (!window.parent || window.parent === window) {
      return;
    }

    const interval = setInterval(() => {
      window.parent.postMessage(
        {
          type: PostMessageType.HEARTBEAT,
          timestamp: Date.now(),
        },
        "*",
      );
      console.log("can you feel my heartbeat?");
    }, HEARTBEAT_INTERVAL_MS);

    return () => clearInterval(interval);
  }, []);
}
