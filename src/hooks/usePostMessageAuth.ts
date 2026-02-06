import { useCallback, useEffect, useState } from "react";
import { validateAuthTokenPayload } from "../schemas/auth.schemas";
import {
  AuthStatus,
  PostMessageType,
  type AuthState,
  type AuthTokenPayload,
} from "../types/auth.types";
import {
  clearSensitiveData,
  DEFAULT_SECURITY_CONFIG,
  generateNonce,
  nonceStore,
  rateLimiter,
  sanitizeError,
  validateOrigin,
} from "../utils/security.utils";
import { useLocale } from "../contexts/LocaleContext";

function createTokenCache() {
  let cachedToken: string | null = null;
  let cacheTimer: number | null = null;

  return {
    get: () => cachedToken,
    set: (token: string, durationMs: number) => {
      cachedToken = token;

      // 기존 타이머 제거
      if (cacheTimer !== null) {
        clearTimeout(cacheTimer);
      }

      // 만료 타이머 설정
      cacheTimer = setTimeout(() => {
        cachedToken = null;
        cacheTimer = null;
      }, durationMs) as unknown as number;
    },
    clear: () => {
      cachedToken = null;
      if (cacheTimer !== null) {
        clearTimeout(cacheTimer);
        cacheTimer = null;
      }
    },
  };
}

/**
 * 전역 토큰 캐시 및 요청 대기열 (싱글톤 패턴)
 * 모든 훅 인스턴스가 이 상태를 공유합니다.
 */
const globalTokenCache = createTokenCache();
const globalPendingRequests = new Map<string, (token: string) => void>();

/**
 * PostMessage 기반 인증 훅
 */
export function usePostMessageAuth() {
  const { setLocale } = useLocale();
  const [authState, setAuthState] = useState<AuthState>({
    status: AuthStatus.IDLE,
  });

  /**
   * 호스트에 토큰 요청
   */
  const requestToken = useCallback((isRefresh = false): Promise<string> => {
    return new Promise((resolve, reject) => {
      const nonce = generateNonce();

      // Rate limiting 체크
      if (!rateLimiter.check("token-request")) {
        const error = "Too many token requests. Please try again later.";
        setAuthState({ status: AuthStatus.FAILED, error });
        reject(new Error(error));
        return;
      }

      // 요청 저장 (응답 대기)
      globalPendingRequests.set(nonce, resolve);

      // 타임아웃 설정 (5초)
      setTimeout(() => {
        if (globalPendingRequests.has(nonce)) {
          globalPendingRequests.delete(nonce);
          const error = "Token request timeout";
          setAuthState({ status: AuthStatus.FAILED, error });
          reject(new Error(error));
        }
      }, 5000);

      // 호스트에 메시지 전송
      const messageType = isRefresh
        ? PostMessageType.REFRESH_TOKEN
        : PostMessageType.REQUEST_TOKEN;

      const message = {
        type: messageType,
        timestamp: Date.now(),
        nonce,
      };

      // 부모 window에 메시지 전송
      if (window.parent && window.parent !== window) {
        window.parent.postMessage(message, "*"); // origin은 응답에서 검증
        setAuthState({ status: AuthStatus.REQUESTING });
      } else {
        const error = "Not running in iframe";
        setAuthState({ status: AuthStatus.FAILED, error });
        reject(new Error(error));
      }
    });
  }, []);

  /**
   * 토큰 가져오기 (캐시 또는 요청)
   */
  const getToken = useCallback(async (): Promise<string> => {
    const cached = globalTokenCache.get();
    if (cached) {
      return cached;
    }

    // 캐시에 없으면 요청
    return requestToken();
  }, [requestToken]);

  /**
   * 토큰 갱신
   */
  const refreshToken = useCallback(async (): Promise<string> => {
    globalTokenCache.clear();
    return requestToken(true);
  }, [requestToken]);

  /**
   * PostMessage 이벤트 핸들러
   */
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // 1. Origin 검증
      if (!validateOrigin(event.origin)) {
        console.warn("[Security] Invalid origin:", event.origin);
        return;
      }

      // 2. Rate limiting
      if (!rateLimiter.check(event.origin)) {
        console.warn("[Security] Rate limit exceeded:", event.origin);
        return;
      }

      // 3. 메시지 데이터 타입 확인
      const data = event.data;
      if (!data || typeof data !== "object") {
        return;
      }

      // 4. 메시지 타입별 처리
      if (data.type === PostMessageType.AUTH_TOKEN) {
        // Zod 스키마 검증
        const validationResult = validateAuthTokenPayload(data);

        if (!validationResult.success) {
          console.error(
            "[Security] Invalid token payload:",
            validationResult.error
          );
          setAuthState({
            status: AuthStatus.FAILED,
            error: "Invalid token format",
          });
          return;
        }

        const payload = validationResult.data as AuthTokenPayload;

        // 5. Nonce 검증 (재사용 방지)
        if (!nonceStore.validate(payload.nonce)) {
          console.debug(
            "[Security] Nonce already used (likely React StrictMode):",
            payload.nonce
          );
          return;
        }

        // 6. 토큰 캐시에 저장
        globalTokenCache.set(
          payload.token,
          DEFAULT_SECURITY_CONFIG.tokenCacheDurationMs
        );

        // 6.1 Locale 설정
        if (payload.locale) {
          console.log("[usePostMessageAuth] Locale updated:", payload.locale);
          setLocale(payload.locale);
        }

        // 7. 대기 중인 요청 해결
        const resolver = globalPendingRequests.get(payload.nonce);
        if (resolver) {
          resolver(payload.token);
          globalPendingRequests.delete(payload.nonce);
        }

        // 8. 상태 업데이트
        setAuthState({
          status: AuthStatus.AUTHENTICATED,
          lastValidated: new Date(),
        });

        // 9. 민감 정보 정리
        setTimeout(() => {
          clearSensitiveData(payload);
        }, 0);
      } else if (data.type === PostMessageType.AUTH_ERROR) {
        // 에러 처리
        const error = sanitizeError(data.error);
        setAuthState({ status: AuthStatus.FAILED, error });

        // 대기 중인 모든 요청 거부
        globalPendingRequests.forEach((reject) => {
          reject("");
        });
        globalPendingRequests.clear();
      }
    };

    window.addEventListener("message", handleMessage);

    return () => {
      window.removeEventListener("message", handleMessage);
      // 컴포넌트 언마운트 시 캐시를 지우지 않음 (다른 컴포넌트와 공유 위해)
      // globalTokenCache.clear();
    };
  }, [setLocale]);

  return {
    authState,
    getToken,
    refreshToken,
  };
}
