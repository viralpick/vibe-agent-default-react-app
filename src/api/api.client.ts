import axios, { type InternalAxiosRequestConfig } from "axios";
import { usePostMessageAuth } from "../hooks/usePostMessageAuth";

const getBaseURL = (): string => {
  // dev:local 실행 시 사용
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }

  // iframe 부모 프레임의 호스트 기반으로 결정
  const parentOrigin =
    window.location.ancestorOrigins && window.location.ancestorOrigins[0]
      ? new URL(window.location.ancestorOrigins[0]).hostname
      : window.location.hostname;

  if (parentOrigin.includes("localhost") || parentOrigin.includes("dev")) {
    return import.meta.env.VITE_API_BASE_URL_DEV;
  }

  return import.meta.env.VITE_API_BASE_URL_PROD;
};

export const API_BASE_URL = getBaseURL();

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
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

apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
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
