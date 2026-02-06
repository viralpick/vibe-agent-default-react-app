/**
 * PostMessage 기반 인증 시스템 타입 정의
 */

/**
 * PostMessage 메시지 타입
 */
export enum PostMessageType {
  /** 호스트 FE -> 샌드박스: 인증 토큰 전달 */
  AUTH_TOKEN = "AUTH_TOKEN",
  /** 샌드박스 -> 호스트 FE: 토큰 요청 */
  REQUEST_TOKEN = "REQUEST_TOKEN",
  /** 샌드박스 -> 호스트 FE: 토큰 갱신 요청 */
  REFRESH_TOKEN = "REFRESH_TOKEN",
  /** 호스트 FE -> 샌드박스: 에러 응답 */
  AUTH_ERROR = "AUTH_ERROR",
  /** 호스트 FE -> 샌드박스: 파일 내용 요청 */
  REQUEST_FILE_CONTENT = "REQUEST_FILE_CONTENT",
  /** 샌드박스 -> 호스트 FE: 파일 내용 응답 */
  FILE_CONTENT = "FILE_CONTENT",
  /** 샌드박스 -> 호스트 FE: 파일 내용 에러 응답 */
  FILE_CONTENT_ERROR = "FILE_CONTENT_ERROR",
  /** 샌드박스 -> 호스트 FE: 쿼리 클릭 이벤트 */
  QUERY_CLICK = "QUERY_CLICK",
}

/**
 * 인증 토큰 메시지 페이로드
 */
export interface AuthTokenPayload {
  type: PostMessageType.AUTH_TOKEN;
  /** 액세스 토큰 */
  token: string;
  /** Unix timestamp (밀리초) */
  timestamp: number;
  /** 재사용 방지를 위한 고유 식별자 */
  nonce: string;
  /** 언어 설정 (optional) */
  locale?: "ko" | "en";
}

/**
 * 토큰 요청 메시지 페이로드
 */
export interface RequestTokenPayload {
  type: PostMessageType.REQUEST_TOKEN | PostMessageType.REFRESH_TOKEN;
  /** Unix timestamp (밀리초) */
  timestamp: number;
  /** 재사용 방지를 위한 고유 식별자 */
  nonce: string;
}

/**
 * 에러 메시지 페이로드
 */
export interface AuthErrorPayload {
  type: PostMessageType.AUTH_ERROR;
  /** 에러 메시지 (최소 정보만 포함) */
  error: string;
  /** Unix timestamp (밀리초) */
  timestamp: number;
}

/**
 * 파일 내용 요청 메시지 페이로드
 */
export interface RequestFileContentPayload {
  type: PostMessageType.REQUEST_FILE_CONTENT;
  /** 요청할 파일 경로 (예: 'src/App.tsx') */
  filePath: string;
  /** Unix timestamp (밀리초) */
  timestamp: number;
  /** 재사용 방지를 위한 고유 식별자 */
  nonce: string;
}

/**
 * 파일 내용 응답 메시지 페이로드
 */
export interface FileContentPayload {
  type: PostMessageType.FILE_CONTENT;
  /** 파일 경로 */
  filePath: string;
  /** 파일 내용 */
  content: string;
  /** Unix timestamp (밀리초) */
  timestamp: number;
  /** 요청의 nonce와 일치 */
  nonce: string;
}

/**
 * 파일 내용 에러 메시지 페이로드
 */
export interface FileContentErrorPayload {
  type: PostMessageType.FILE_CONTENT_ERROR;
  /** 파일 경로 */
  filePath: string;
  /** 에러 메시지 */
  error: string;
  /** Unix timestamp (밀리초) */
  timestamp: number;
  /** 요청의 nonce와 일치 */
  nonce: string;
}

/**
 * PostMessage 유니온 타입
 */
export type PostMessagePayload =
  | AuthTokenPayload
  | RequestTokenPayload
  | AuthErrorPayload
  | RequestFileContentPayload
  | FileContentPayload
  | FileContentErrorPayload;

/**
 * 인증 상태
 */
export enum AuthStatus {
  /** 초기화되지 않음 */
  IDLE = "IDLE",
  /** 토큰 요청 중 */
  REQUESTING = "REQUESTING",
  /** 인증됨 */
  AUTHENTICATED = "AUTHENTICATED",
  /** 인증 실패 */
  FAILED = "FAILED",
}

/**
 * 인증 상태 정보
 */
export interface AuthState {
  status: AuthStatus;
  /** 마지막 검증 시간 */
  lastValidated?: Date;
  /** 에러 메시지 (있을 경우) */
  error?: string;
}

/**
 * Rate Limiting 정보
 */
export interface RateLimitInfo {
  /** 요청 횟수 */
  count: number;
  /** 첫 요청 시간 */
  firstRequestTime: number;
}

/**
 * 보안 설정
 */
export interface SecurityConfig {
  /** 허용된 origin 목록 */
  allowedOrigins: string[];
  /** 타임스탬프 유효 시간 (밀리초) */
  timestampValidityMs: number;
  /** 토큰 캐시 시간 (밀리초) */
  tokenCacheDurationMs: number;
  /** Rate limit - 시간 윈도우 (밀리초) */
  rateLimitWindowMs: number;
  /** Rate limit - 최대 요청 수 */
  rateLimitMaxRequests: number;
}
