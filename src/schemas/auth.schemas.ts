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
