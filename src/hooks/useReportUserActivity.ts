import { useEffect } from "react";
import { PostMessageType } from "../types/auth.types";

/** 호스트는 입력이 있을 때만 로그인 세션을 갱신한다. 마우스 이동·탭 전환은 자리를 비워도 일어나 넣지 않는다 (AOS-8725) */
const USER_INPUT_EVENTS = ["pointerdown", "keydown", "wheel", "touchstart"] as const;
export const USER_ACTIVITY_THROTTLE_MS = 1_000;

/** 앱 안 사용자 입력을 호스트에 알린다. iframe 안 입력은 호스트 창에 보이지 않는다 */
export function useReportUserActivity(): void {
  useEffect(() => {
    let lastSentAt = Number.NEGATIVE_INFINITY;
    const report = (): void => {
      const now = Date.now();
      if (now - lastSentAt < USER_ACTIVITY_THROTTLE_MS) return;
      lastSentAt = now;
      window.parent.postMessage({ type: PostMessageType.USER_ACTIVITY }, "*");
    };
    for (const type of USER_INPUT_EVENTS) {
      window.addEventListener(type, report, { capture: true, passive: true });
    }
    return () => {
      for (const type of USER_INPUT_EVENTS) {
        window.removeEventListener(type, report, { capture: true });
      }
    };
  }, []);
}
