import axios, { type InternalAxiosRequestConfig } from "axios";
import { usePostMessageAuth } from "../hooks/usePostMessageAuth";

type ConsoleEnv = "local" | "dev" | "stg" | "prod";

/**
 * 프리뷰가 호출할 환경을 부모(콘솔) 프레임 host 로 판별한다.
 * baseURL 선택과 토큰 쿠키 선택이 **같은 신호**를 쓰도록 한 곳에서 계산한다 —
 * 둘이 어긋나면 한 환경의 엔드포인트를 다른 환경 토큰으로 호출하게 된다.
 */
const resolveConsoleEnv = (): ConsoleEnv => {
  const host =
    window.location.ancestorOrigins && window.location.ancestorOrigins[0]
      ? new URL(window.location.ancestorOrigins[0]).hostname
      : window.location.hostname;

  if (host.includes("localhost")) return "local";
  if (host.includes("dev")) return "dev";
  if (host.includes("stg")) return "stg";
  return "prod";
};

const getBaseURL = (): string => {
  // dev:local 실행 시 사용
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }

  // iframe 부모 프레임의 호스트 기반으로 결정
  switch (resolveConsoleEnv()) {
    case "local":
    case "dev":
      return import.meta.env.VITE_API_BASE_URL_DEV;
    case "stg":
      return import.meta.env.VITE_API_BASE_URL_STG;
    default:
      return import.meta.env.VITE_API_BASE_URL_PROD;
  }
};

export const API_BASE_URL = getBaseURL();

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  // ontology action execute 등 서버 처리(파일 분석·LLM)가 수십 초 걸리는 요청이
  // 기본 30초에서 "timeout of 30000ms exceeded" 로 끊기던 문제를 해결.
  // 실측상 20~40초 소요되므로 여유를 둔 2분으로 상향. 개별 호출에서 override 가능.
  timeout: 120000,
  headers: {
    "Content-Type": "application/json",
  },
});

type GetTokenFn = () => Promise<string>;

let getTokenFn: GetTokenFn | null = null;
let staticToken: string | null = null;

export function setTokenProvider(fn: GetTokenFn) {
  getTokenFn = fn;
}

/**
 * URL query parameter에서 가져온 정적 토큰 설정
 * 이 토큰이 설정되면 PostMessage 인증보다 우선 사용됨
 */
export function setStaticToken(token: string | null) {
  staticToken = token;
  if (token) {
    console.log("[API] Static token set from URL");
  }
}

/**
 * 콘솔이 환경별 prefix 로 심는 액세스 토큰 쿠키 이름.
 * 콘솔 `env.prefix` 규약과 동일하다 (ACCESS_TOKEN_KEY = `${prefix}_access_token`):
 * prod=cos, dev=cos_dev, stg=cos_stg, local=cos_local.
 */
const ACCESS_TOKEN_COOKIE_BY_ENV: Record<ConsoleEnv, string> = {
  local: "cos_local_access_token",
  dev: "cos_dev_access_token",
  stg: "cos_stg_access_token",
  prod: "cos_access_token",
};

/**
 * same-origin 프리뷰(OpenSandbox 프록시)에서 콘솔이 심어둔 non-httpOnly 액세스 토큰
 * 쿠키(`<prefix>_access_token`, 예: cos_dev_access_token)를 직접 읽는다.
 *
 * 프리뷰가 콘솔과 same-origin 이 된 뒤(AOS-2798)로는 postMessage 핸드셰이크 없이도
 * 토큰을 얻을 수 있어, 핸드셰이크 타이밍 레이스(응답 5s 타임아웃 → Bearer 누락 → API 401)를
 * 우회한다. 쿠키는 콘솔 세션의 원본이라 콘솔이 갱신하면 즉시 최신값이 읽힌다.
 *
 * **환경에 맞는 쿠키를 정확한 이름으로 집는다.** 상위 도메인(`.enhans.ai`)으로 공유된
 * 다른 환경의 토큰(예: prod 의 `cos_access_token` 이 os-dev 에도 보이는 경우)을
 * `endsWith("_access_token")` 로 먼저 집으면 realm 불일치로 app-api 가 401 "Invalid Token"
 * 을 돌려준다. baseURL 과 같은 `resolveConsoleEnv()` 신호로 호출 대상 환경의 쿠키를 쓴다.
 *
 * cross-origin 프리뷰에서는 이 쿠키가 프리뷰 도메인에 존재하지 않아 null 을 반환하고,
 * 호출부가 기존 postMessage 경로로 폴백한다 — cross-origin 동작은 그대로 유지된다.
 */
function getTokenFromCookie(): string | null {
  if (typeof document === "undefined") return null;
  const rows = document.cookie.split("; ");
  const readValue = (row: string | undefined): string | null => {
    if (!row) return null;
    const value = row.slice(row.indexOf("=") + 1);
    return value || null;
  };

  // 호출 대상 환경에 맞는 정확한 쿠키를 우선 사용한다.
  const expected = ACCESS_TOKEN_COOKIE_BY_ENV[resolveConsoleEnv()];
  const exact = readValue(rows.find((r) => r.split("=")[0] === expected));
  if (exact) return exact;

  // 폴백: 환경 쿠키가 없으면(단일 쿠키 등) 기존처럼 첫 _access_token 을 쓴다.
  return readValue(rows.find((r) => r.split("=")[0].endsWith("_access_token")));
}

apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    try {
      // 우선순위: URL token → same-origin 쿠키 → postMessage(cross-origin 폴백)
      const cookieToken = getTokenFromCookie();
      if (staticToken) {
        config.headers.Authorization = `Bearer ${staticToken}`;
      } else if (cookieToken) {
        // same-origin 프리뷰: 콘솔 쿠키를 직접 사용 (핸드셰이크 불필요)
        config.headers.Authorization = `Bearer ${cookieToken}`;
      } else if (getTokenFn) {
        // cross-origin 프리뷰: PostMessage auth 로 폴백
        const token = await getTokenFn();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
      }
    } catch (error) {
      console.error("[API] Failed to get token:", error);
    }

    return config;
  },
  (error: unknown) => {
    return Promise.reject(error);
  },
);

// 401 error retry
apiClient.interceptors.response.use(
  (response: any) => {
    return response;
  },
  async (error: any) => {
    const originalRequest = error.config;

    // 401 Unauthorized error retry
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        // same-origin: 콘솔이 갱신한 쿠키를 다시 읽어 재시도 (핸드셰이크 불필요)
        const cookieToken = getTokenFromCookie();
        if (cookieToken) {
          originalRequest.headers.Authorization = `Bearer ${cookieToken}`;
          return apiClient(originalRequest);
        }

        // cross-origin: postMessage 로 refresh
        if (getTokenFn) {
          console.log("[API] Token expired, refreshing...");
          const newToken = await getTokenFn();

          // new token retry
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return apiClient(originalRequest);
        }
      } catch (refreshError) {
        console.error("[API] Token refresh failed:", refreshError);
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  },
);

export function useApiClient() {
  const { getToken } = usePostMessageAuth();

  // token provider
  if (!getTokenFn) {
    setTokenProvider(getToken);
  }

  return apiClient;
}
