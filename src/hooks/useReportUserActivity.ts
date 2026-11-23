import { useEffect } from "react";
import { PostMessageType } from "../types/auth.types";

/**
 * 앱 안 사용자 입력을 호스트에 알린다. (AOS-8725)
 *
 * 호스트는 사용자 입력이 있을 때만 로그인 세션을 갱신한다. iframe 안 입력은 호스트 창의 이벤트로 가지 않아,
 * 앱만 쓰는 사용자는 토큰 수명(15분)이 지나면 세션이 끊겼다.
 * 마우스 이동·탭 전환은 보내지 않는다 — 자리를 비운 사이에도 일어나 유휴 만료를 지운다.
 * 토큰 재요청(REFRESH_TOKEN)은 401 마다 자동으로 나가므로 입력으로 쓰지 않는다.
 */
export const USER_INPUT_EVENTS = ["pointerdown", "keydown", "wheel", "touchstart"] as const;

/** 입력이 몰릴 때(타이핑·스크롤) 이 간격에 한 번만 보낸다 */
export const USER_ACTIVITY_THROTTLE_MS = 1_000;

const isEmbedded = (): boolean => {
  try {
    return window.parent !== window;
  } catch {
    return true;
  }
};

export function useReportUserActivity(): void {
  useEffect(() => {
    if (!isEmbedded()) return;
    let lastSentAt = Number.NEGATIVE_INFINITY;

    const report = (): void => {
      const now = Date.now();
      if (now - lastSentAt < USER_ACTIVITY_THROTTLE_MS) return;
      lastSentAt = now;
      // 호스트 origin 은 환경마다 달라 다른 템플릿 메시지처럼 "*" 로 보낸다. 내용은 type 뿐이다
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
