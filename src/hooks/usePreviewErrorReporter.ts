import { useEffect } from "react";

// 부모(앱빌더 캔버스)로 보내는 프리뷰 상태 메시지 타입.
// 호스트의 POST_MESSAGE_TYPE 과 문자열이 일치해야 한다.
const PREVIEW_ERROR = "PREVIEW_ERROR";
const PREVIEW_HMR = "PREVIEW_HMR";

// HMR 신호. 부모는 이걸로 "진행 중"과 "깨짐"을 구분한다.
// - updated:     부분 갱신 성공 → 부모가 직전 에러 상태를 자동 해제한다
// - full-reload: 부분 갱신 실패로 전체 리로드 → 화면이 잠깐 비는 구간
// - down / up:   HMR WebSocket 단절/복구 (프록시 뒤에서 종종 끊긴다)
type HmrSignal = "updated" | "full-reload" | "down" | "up";

// 정상 동작 중에도 뜨는 잡음. 에러로 올리면 부모가 "깨짐"으로 오판한다.
const IGNORED_PATTERNS: RegExp[] = [
  // 브라우저/라이브러리 노이즈
  /ResizeObserver loop (limit exceeded|completed with undelivered notifications)/,
  /Failed to (read|set) the '(local|session)Storage' property from 'Window'/,
  // iframe sandbox 특성상 자주 나오고 앱 동작과 무관
  /Blocked a frame with origin/,
  // Vite 의 정상 라이프사이클 로그
  /\[vite\] (connected|connecting|hot updated|css hot updated|hmr update|page reload)/,
];

const isIgnored = (message: string): boolean =>
  IGNORED_PATTERNS.some((pattern) => pattern.test(message));

// 부모가 에러 페이로드를 크레딧 소모 프롬프트로 그대로 실어보내므로 상한을 둔다.
const MAX_MESSAGE_LENGTH = 10_000;

const truncate = (message: string): string =>
  message.length > MAX_MESSAGE_LENGTH
    ? `${message.slice(0, MAX_MESSAGE_LENGTH)}\n// ... truncated ...\n`
    : message;

/**
 * 프리뷰 iframe 안에서 발생한 에러와 HMR 상태를 부모 창으로 넘긴다.
 *
 * **왜 필요한가** — `vite.config.ts` 에서 `server.hmr.overlay: false` 로 Vite 기본
 * 전체화면 에러 오버레이를 껐다. 그 대신 이 훅이 같은 정보를 부모에게 넘겨,
 * 호스트가 프리뷰 우측하단 상태 칩으로 표시하고 "다시 고치기"를 한 번에 보낼 수
 * 있게 한다. 오버레이를 그대로 두면 iframe 안 전체화면 빨간 화면과 호스트 UI 가
 * 이중으로 겹치고, 사용자는 "기다리면 되는 건지 망가진 건지" 알 수 없다. (AOS-3962)
 *
 * 부모가 origin/source 를 검증하므로 여기서는 `parent.postMessage(_, "*")` 로 보낸다.
 * sandbox 는 부모 origin 을 모른다(호스트가 dev/stage/prod 별로 다름).
 */
export const usePreviewErrorReporter = (): void => {
  useEffect(() => {
    if (typeof window === "undefined" || window.parent === window) return;

    const sendError = (message: string, stack?: string): void => {
      if (!message || isIgnored(message)) return;
      window.parent.postMessage(
        {
          type: PREVIEW_ERROR,
          message: truncate(stack ? `${message}\n${stack}` : message),
          // 부모가 "내가 고치라고 보낸 그 에러"와 "그 뒤 새로 난 에러"를 구분하는 키.
          // 메시지 문자열만으로는 같은 에러의 재발을 해소된 것으로 오판한다.
          revision: Date.now(),
          currentPath: window.location.pathname + window.location.search,
        },
        "*",
      );
    };

    const sendHmr = (signal: HmrSignal): void => {
      window.parent.postMessage({ type: PREVIEW_HMR, signal }, "*");
    };

    const handleError = (event: ErrorEvent): void => {
      sendError(event.message, event.error?.stack);
    };

    const handleRejection = (event: PromiseRejectionEvent): void => {
      const reason = event.reason;
      if (reason instanceof Error) {
        sendError(reason.message, reason.stack);
        return;
      }
      sendError(typeof reason === "string" ? reason : String(reason));
    };

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleRejection);

    // Vite HMR 라이프사이클. overlay 를 껐어도 이 이벤트들은 그대로 발생한다.
    const hot = import.meta.hot;
    if (hot) {
      hot.on("vite:error", (payload: { err?: { message?: string; frame?: string } }) => {
        const err = payload?.err;
        if (!err?.message) return;
        sendError(err.message, err.frame);
      });
      hot.on("vite:afterUpdate", () => sendHmr("updated"));
      // 수정 턴에 부분 갱신(js-update)이 아니라 전체 리로드로 떨어지는지를
      // 프로덕션에서 실측하기 위한 신호다. AOS-3962 §5 판정에 직접 쓰인다.
      hot.on("vite:beforeFullReload", () => sendHmr("full-reload"));
      hot.on("vite:ws:disconnect", () => sendHmr("down"));
      hot.on("vite:ws:connect", () => sendHmr("up"));
    }

    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleRejection);
      // import.meta.hot 리스너는 모듈 단위로 관리되고 off API 가 콜백 참조를
      // 요구한다. 이 훅은 앱 루트에서 1회만 마운트되므로 해제하지 않는다.
    };
  }, []);
};
