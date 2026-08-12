import { useEffect } from "react";

// 부모(앱빌더 캔버스)로 보내는 콘솔 로그 메시지 타입.
// 호스트의 PREVIEW_STATUS_MESSAGE_TYPE 과 문자열이 일치해야 한다.
const PREVIEW_LOG = "PREVIEW_LOG";

type LogLevel = "log" | "warn" | "error" | "info" | "debug";

const MIRRORED_LEVELS: LogLevel[] = ["log", "warn", "error", "info", "debug"];

// 건당 상한. 부모가 "이 로그 고치기"로 프롬프트에 실어보낼 수 있으므로 제한한다.
// 스택이 긴 에러의 전문은 usePreviewErrorReporter 가 별도로(10k) 보내므로,
// 여기서는 목록에 표시할 만큼만 남기면 된다.
const MAX_MESSAGE_LENGTH = 2_000;

// 레이트 리밋. 렌더 루프에 빠진 앱이 초당 수천 건을 찍으면 postMessage 직렬화가
// 프리뷰 자체를 느리게 만든다. dev.log 자기참조 루프(AOS-3962)와 같은 종류의
// 사고를 postMessage 경로에서 반복하지 않기 위한 상한이다.
//
// 상한을 **부모가 아니라 여기(iframe 안)** 에 두는 이유: 수신 UI 가 없는 경로
// (레거시 앱빌더 화면)에서도 주입은 그대로 일어난다. 부모에서 거르면 아무도 듣지
// 않는 메시지를 만드는 비용이 그대로 남는다.
const RATE_LIMIT_WINDOW_MS = 1_000;
const MAX_LOGS_PER_WINDOW = 50;

const truncate = (message: string): string =>
  message.length > MAX_MESSAGE_LENGTH
    ? `${message.slice(0, MAX_MESSAGE_LENGTH)}\n// ... truncated ...`
    : message;

/** 순환 참조를 만나면 문자열로 대체하는 JSON replacer. */
const createCircularSafeReplacer = (): ((
  key: string,
  value: unknown,
) => unknown) => {
  const seen = new WeakSet<object>();
  return (_key: string, value: unknown): unknown => {
    if (typeof value !== "object" || value === null) return value;
    if (seen.has(value as object)) return "[Circular]";
    seen.add(value as object);
    return value;
  };
};

/**
 * console 인자 하나를 사람이 읽을 문자열로 만든다.
 *
 * 구조화 전송(타입 보존) 대신 평문으로 내려보낸다 — 부모는 이 값을 목록에
 * 표시하거나 그대로 프롬프트에 싣는 두 가지 용도로만 쓰므로, 객체 트리를
 * 펼쳐 보여줄 필요가 없다. 직렬화 실패가 로그를 통째로 잃게 만들지 않도록
 * 모든 분기에 폴백을 둔다.
 */
const formatArg = (arg: unknown): string => {
  if (typeof arg === "string") return arg;
  if (arg === null) return "null";
  if (arg === undefined) return "undefined";
  if (arg instanceof Error) {
    return arg.stack ? `${arg.name}: ${arg.message}\n${arg.stack}` : String(arg);
  }
  if (typeof arg === "function") {
    return `[Function: ${arg.name || "anonymous"}]`;
  }
  // symbol / bigint 는 JSON.stringify 가 던지거나 누락시킨다.
  if (typeof arg === "symbol" || typeof arg === "bigint") return String(arg);
  if (typeof arg !== "object") return String(arg);

  try {
    return JSON.stringify(arg, createCircularSafeReplacer(), 2) ?? String(arg);
  } catch {
    // toString 마저 던지는 객체(Object.create(null) 등)가 있어 한 겹 더 감싼다.
    try {
      return String(arg);
    } catch {
      return "[Unserializable]";
    }
  }
};

// 모듈 레벨 설치 가드. StrictMode 는 개발에서 effect 를 두 번 실행하고, HMR 은
// 이 모듈을 재평가한다. 매번 다시 감싸면 console 이 중첩 래핑되어 같은 로그가
// 2배, 4배로 전송된다. 한 번 설치하면 페이지 수명 동안 유지한다(원복하지 않음)
// — usePreviewErrorReporter 가 hot 리스너를 해제하지 않는 것과 같은 이유다.
let isInstalled = false;

/**
 * 프리뷰 iframe 안의 `console.*` 출력을 부모 창으로 미러링한다.
 *
 * **왜 필요한가** — 런타임 에러가 나면 프리뷰가 빈 화면이 되는데, 사용자는 그게
 * 로딩 중인지 깨진 건지 알 수 없다. `usePreviewErrorReporter` 가 잡는 것은
 * window.error / unhandledrejection / vite:error 뿐이라 "무슨 일이 있었는지"의
 * 맥락(그 직전에 찍힌 로그, 라이브러리 경고, 직접 호출한 console.error)이 빠진다.
 * 그 맥락을 호스트 UI 로 끌어와야 사용자가 개발자도구를 열지 않아도 된다.
 *
 * **에러 상태와는 채널이 다르다.** PREVIEW_ERROR 는 우측하단 상태 칩("깨졌는가")을
 * 움직이는 신호라 노이즈를 걸러야 하고, 이쪽(PREVIEW_LOG)은 정보 패널에 쌓는
 * 목록이라 거르지 않는다. 둘을 한 채널로 합치면 평범한 console.log 가 "프리뷰가
 * 깨졌다"로 표시된다.
 *
 * 부모가 origin/source 를 검증하므로 여기서는 `parent.postMessage(_, "*")` 로 보낸다.
 * sandbox 는 부모 origin 을 모른다(호스트가 dev/stage/prod 별로 다름).
 */
export const usePreviewConsoleMirror = (): void => {
  useEffect(() => {
    if (typeof window === "undefined" || window.parent === window) return;
    if (isInstalled) return;
    isInstalled = true;

    let windowStartedAt = Date.now();
    let sentInWindow = 0;
    let droppedInWindow = 0;
    let sequence = 0;

    const post = (
      level: LogLevel,
      message: string,
      droppedCount?: number,
    ): void => {
      sequence += 1;
      window.parent.postMessage(
        {
          type: PREVIEW_LOG,
          level,
          message,
          timestamp: Date.now(),
          // 부모가 목록 key 와 "고치기" 대상 식별에 쓴다. 같은 밀리초에 여러 건이
          // 찍히므로 timestamp 만으로는 충돌한다.
          id: `${Date.now()}-${sequence}`,
          ...(droppedCount ? { droppedCount } : {}),
        },
        "*",
      );
    };

    /** 레이트 리밋 통과 여부. 창이 바뀌면 누락 요약을 먼저 흘려보낸다. */
    const canSend = (): boolean => {
      const now = Date.now();
      if (now - windowStartedAt >= RATE_LIMIT_WINDOW_MS) {
        const dropped = droppedInWindow;
        windowStartedAt = now;
        sentInWindow = 0;
        droppedInWindow = 0;
        if (dropped > 0) {
          // 조용히 버리면 사용자는 목록이 완전하다고 믿는다. 몇 건이 빠졌는지는
          // 알려야 한다.
          post("warn", `로그 ${dropped}건이 생략되었습니다 (초당 상한 초과)`, dropped);
        }
      }
      if (sentInWindow >= MAX_LOGS_PER_WINDOW) {
        droppedInWindow += 1;
        return false;
      }
      sentInWindow += 1;
      return true;
    };

    for (const level of MIRRORED_LEVELS) {
      const original = console[level].bind(console) as (
        ...args: unknown[]
      ) => void;

      console[level] = (...args: unknown[]): void => {
        // 원본을 **먼저** 호출한다. 미러링이 실패하더라도 iframe 자체 devtools
        // 에서는 로그가 정상으로 보여야 한다.
        original(...args);

        try {
          if (!canSend()) return;
          const message = truncate(args.map(formatArg).join(" "));
          if (!message) return;
          post(level, message);
        } catch {
          // 여기서 console 을 부르면 자기 자신을 다시 타고 들어간다. 조용히 버린다.
        }
      };
    }

    // 정리 함수를 두지 않는다 (위 isInstalled 주석 참조). 원복하면 StrictMode 의
    // 두 번째 마운트에서 다시 설치되고, 그 사이 다른 코드가 console 을 감쌌다면
    // 그 래퍼까지 걷어낸다.
  }, []);
};
