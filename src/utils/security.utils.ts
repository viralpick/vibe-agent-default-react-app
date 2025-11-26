import type { RateLimitInfo, SecurityConfig } from '../types/auth.types';

/**
 * 기본 보안 설정
 */
export const DEFAULT_SECURITY_CONFIG: SecurityConfig = {
  allowedOrigins: (import.meta.env.VITE_ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin: string) => origin.trim())
    .filter(Boolean),
  timestampValidityMs: 5000, // 5초
  tokenCacheDurationMs: 10000, // 10초
  rateLimitWindowMs: 60000, // 1분
  rateLimitMaxRequests: 30, // 분당 30회
};

/**
 * Origin 화이트리스트 검증
 * @param origin 검증할 origin
 * @param allowedOrigins 허용된 origin 목록
 * @returns 검증 결과
 */
export function validateOrigin(
  origin: string,
  allowedOrigins: string[] = DEFAULT_SECURITY_CONFIG.allowedOrigins
): boolean {
  return allowedOrigins.includes(origin);
}

/**
 * 타임스탬프 유효성 검증
 * @param timestamp Unix timestamp (밀리초)
 * @param validityMs 유효 시간 (밀리초)
 * @returns 검증 결과
 */
export function validateTimestamp(
  timestamp: number,
  validityMs: number = DEFAULT_SECURITY_CONFIG.timestampValidityMs
): boolean {
  const now = Date.now();
  const diff = Math.abs(now - timestamp);
  return diff <= validityMs;
}

/**
 * Nonce 생성
 * @returns 고유한 nonce 문자열
 */
export function generateNonce(): string {
  const timestamp = Date.now().toString(36);
  const randomStr = Math.random().toString(36).substring(2, 15);
  const randomStr2 = Math.random().toString(36).substring(2, 15);
  return `${timestamp}-${randomStr}${randomStr2}`;
}

/**
 * Nonce 저장소 (메모리 기반, 재사용 방지)
 */
class NonceStore {
  private usedNonces = new Set<string>();
  private readonly maxSize = 1000; // 최대 1000개까지 저장

  /**
   * Nonce 검증 및 저장
   * @param nonce 검증할 nonce
   * @returns 유효한 새로운 nonce면 true
   */
  validate(nonce: string): boolean {
    if (this.usedNonces.has(nonce)) {
      return false; // 이미 사용된 nonce
    }

    // 저장소 크기 제한
    if (this.usedNonces.size >= this.maxSize) {
      // 가장 오래된 항목 제거 (Set은 삽입 순서 유지)
      const iterator = this.usedNonces.values();
      const firstNonce = iterator.next().value;
      if (firstNonce) {
        this.usedNonces.delete(firstNonce);
      }
    }

    this.usedNonces.add(nonce);
    return true;
  }

  /**
   * 특정 nonce 제거
   */
  remove(nonce: string): void {
    this.usedNonces.delete(nonce);
  }

  /**
   * 전체 초기화
   */
  clear(): void {
    this.usedNonces.clear();
  }
}

/**
 * 전역 Nonce 저장소
 */
export const nonceStore = new NonceStore();

/**
 * Rate Limiting 저장소
 */
class RateLimiter {
  private requests = new Map<string, RateLimitInfo>();

  /**
   * 요청 허용 여부 확인 및 기록
   * @param key 식별자 (예: origin)
   * @param windowMs 시간 윈도우 (밀리초)
   * @param maxRequests 최대 요청 수
   * @returns 요청 허용 여부
   */
  check(
    key: string,
    windowMs: number = DEFAULT_SECURITY_CONFIG.rateLimitWindowMs,
    maxRequests: number = DEFAULT_SECURITY_CONFIG.rateLimitMaxRequests
  ): boolean {
    const now = Date.now();
    const info = this.requests.get(key);

    if (!info) {
      // 첫 요청
      this.requests.set(key, { count: 1, firstRequestTime: now });
      return true;
    }

    const timeSinceFirst = now - info.firstRequestTime;

    if (timeSinceFirst > windowMs) {
      // 윈도우 만료, 리셋
      this.requests.set(key, { count: 1, firstRequestTime: now });
      return true;
    }

    if (info.count >= maxRequests) {
      // Rate limit 초과
      return false;
    }

    // 카운트 증가
    info.count += 1;
    return true;
  }

  /**
   * 특정 키 초기화
   */
  reset(key: string): void {
    this.requests.delete(key);
  }

  /**
   * 전체 초기화
   */
  clear(): void {
    this.requests.clear();
  }
}

/**
 * 전역 Rate Limiter
 */
export const rateLimiter = new RateLimiter();

/**
 * 민감 정보 메모리 정리
 * @param obj 정리할 객체
 */
export function clearSensitiveData(obj: Record<string, any>): void {
  Object.keys(obj).forEach((key) => {
    if (typeof obj[key] === 'string') {
      // 문자열을 0으로 덮어쓰기 (완전한 보안은 아니지만 추가 방어)
      obj[key] = '';
    }
    delete obj[key];
  });
}

/**
 * 에러 메시지 최소화 (보안 정보 노출 방지)
 * @param error 원본 에러
 * @returns 안전한 에러 메시지
 */
export function sanitizeError(error: unknown): string {
  // 프로덕션에서는 구체적인 에러 반환하지 않음
  if (import.meta.env.PROD) {
    return 'Authentication failed';
  }

  // 개발 환경에서만 상세 정보
  if (error instanceof Error) {
    return error.message;
  }

  return 'Unknown error';
}
