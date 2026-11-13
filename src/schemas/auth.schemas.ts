import { z } from 'zod';
import { PostMessageType } from '../types/auth.types';

/**
 * 타임스탬프 검증 스키마
 * - 숫자여야 함
 * - 양수여야 함
 * - 현재 시간으로부터 ±5초 이내
 */
const timestampSchema = z
  .number()
  .positive('Timestamp must be positive')
  .refine(
    (timestamp) => {
      const now = Date.now();
      const diff = Math.abs(now - timestamp);
      return diff <= 5000; // 5초 이내
    },
    { message: 'Timestamp is too old or in the future' }
  );

/**
 * Nonce 검증 스키마
 * - 문자열이어야 함
 * - 최소 10자 이상
 * - 영숫자 및 특수문자 허용
 */
const nonceSchema = z
  .string()
  .min(10, 'Nonce must be at least 10 characters')
  .regex(/^[a-zA-Z0-9-_]+$/, 'Nonce must be alphanumeric with - or _');

/**
 * 토큰 검증 스키마
 * - 문자열이어야 함
 * - 최소 20자 이상
 */
const tokenSchema = z
  .string()
  .min(20, 'Token must be at least 20 characters');

/**
 * 인증 토큰 메시지 스키마
 */
export const authTokenPayloadSchema = z.object({
  type: z.literal(PostMessageType.AUTH_TOKEN),
  token: tokenSchema,
  timestamp: timestampSchema,
  nonce: nonceSchema,
  locale: z.enum(["ko", "en"]).optional(),
});

/**
 * 토큰 요청 메시지 스키마
 */
export const requestTokenPayloadSchema = z.object({
  type: z.enum([PostMessageType.REQUEST_TOKEN, PostMessageType.REFRESH_TOKEN]),
  timestamp: timestampSchema,
  nonce: nonceSchema,
});

/**
 * 에러 메시지 스키마
 */
export const authErrorPayloadSchema = z.object({
  type: z.literal(PostMessageType.AUTH_ERROR),
  error: z.string().max(100, 'Error message too long'),
  timestamp: timestampSchema,
});

/**
 * 앱 안 경로 스키마 — `/` 로 시작하고 `//`(다른 호스트로 읽힘)·역슬래시·제어문자를 받지 않는다.
 */
export const hostRoutePathSchema = z
  .string()
  .max(2048, 'Path too long')
  .regex(/^\/(?!\/)/, 'Path must start with a single /')
  .refine(
    (path) => {
      if (path.includes('\\')) return false;
      for (let i = 0; i < path.length; i += 1) {
        const code = path.charCodeAt(i);
        if (code < 0x20 || code === 0x7f) return false;
      }
      return true;
    },
    { message: 'Path must not contain backslashes or control characters' }
  );

/**
 * 호스트 → 샌드박스 경로 이동 메시지 스키마
 */
export const navigatePayloadSchema = z.object({
  type: z.literal(PostMessageType.NAVIGATE),
  path: hostRoutePathSchema,
});

/**
 * 경로 이동 메시지 검증
 */
export function validateNavigatePayload(data: unknown) {
  return navigatePayloadSchema.safeParse(data);
}

/**
 * PostMessage 페이로드 통합 스키마
 */
export const postMessagePayloadSchema = z.discriminatedUnion('type', [
  authTokenPayloadSchema,
  authErrorPayloadSchema,
]);

/**
 * 메시지 타입 검증
 */
export function validateAuthTokenPayload(data: unknown) {
  return authTokenPayloadSchema.safeParse(data);
}

/**
 * 에러 페이로드 검증
 */
export function validateAuthErrorPayload(data: unknown) {
  return authErrorPayloadSchema.safeParse(data);
}

/**
 * 전체 페이로드 검증
 */
export function validatePostMessagePayload(data: unknown) {
  return postMessagePayloadSchema.safeParse(data);
}
