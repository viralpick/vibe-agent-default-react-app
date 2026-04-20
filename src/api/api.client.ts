import axios, { type InternalAxiosRequestConfig } from "axios";
import { usePostMessageAuth } from "../hooks/usePostMessageAuth";

const LOCAL_API = "http://localhost:8080";

const getFallbackURL = (): string => {
  const parentOrigin = document.referrer
    ? new URL(document.referrer).hostname
    : window.location.hostname;

  if (parentOrigin.includes("localhost") || parentOrigin.includes("dev")) {
    return import.meta.env.VITE_API_BASE_URL_DEV;
  }

  return import.meta.env.VITE_API_BASE_URL_PROD;
};

const pingLocal = async (): Promise<boolean> => {
  try {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 1000);
    await fetch(`${LOCAL_API}`, {
      method: "HEAD",
      signal: controller.signal,
    });
    return true;
  } catch {
    return false;
  }
};

/**
 * Async base URL resolution.
 * localhost:8080 ping → 성공하면 로컬, 실패하면 환경별 remote URL 사용.
 */
const baseURLReady: Promise<string> = pingLocal().then((alive) => {
  const url = alive ? LOCAL_API : getFallbackURL();
  console.log(`[API] Base URL resolved: ${url}`);
  return url;
});

export const apiClient = axios.create({
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
});

/** Resolved after ping completes — use for direct URL construction */
export let API_BASE_URL = getFallbackURL();
baseURLReady.then((url) => {
  API_BASE_URL = url;
  apiClient.defaults.baseURL = url;
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

apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    // baseURL이 아직 resolve 안 됐으면 대기
    if (!config.baseURL) {
      config.baseURL = await baseURLReady;
    }

    try {
      // URL token이 있으면 우선 사용
      if (staticToken) {
        config.headers.Authorization = `Bearer ${staticToken}`;
      } else if (getTokenFn) {
        // 없으면 PostMessage auth 사용
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
        // refresh token
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
