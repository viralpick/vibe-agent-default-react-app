import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from "axios";

// 로컬 프리뷰 fixture 모드 (AOS-8520).
//
// 로컬에서 `VITE_AOS_PREVIEW=fixture npm run dev` 로 띄우면 함수 호출을 서버로 보내지 않고 저장해 둔 응답
// `.cos/fixtures/<함수 id>.json` 으로 답한다. 액션은 실행하지 않은 성공을 돌려준다. 파일은 개인 로그인 MCP 의
// `app_fixture_url` 이 앱과 같은 실행 경로로 받아 준 것이다 (형식: agent-app `tool/app_builder/local_fixture.py`).
//
// 켜는 조건은 dev 서버 + 명시적인 환경변수 둘 다다. 샌드박스 웹 프리뷰도 `npm run dev` 로 뜨므로 스크립트 이름이나
// 파일이 있는지로 고르면 웹 프리뷰가 fixture 로 바뀐다. 게시 빌드에서는 DEV 가 거짓이라 꺼진다.
//
// fixture 는 실제 조회 결과다. import 하면 번들에 들어가므로 실행 중에 dev 서버에서 읽기만 한다.

export const FIXTURE_DIR = ".cos/fixtures";

export function isFixtureMode(env: { DEV?: boolean; VITE_AOS_PREVIEW?: string } = import.meta.env): boolean {
  return !!env.DEV && env.VITE_AOS_PREVIEW === "fixture";
}

const FUNCTION_RUN = /\/ontology-functions\/([^/]+)\/run$/;
const ACTION_CALL = /\/ontology-actions\//;

/** fixture 모드가 대신 답하는 호출 — 함수 실행과 액션 실행 · 조회. */
export function isFixtureRequest(url: string | undefined): boolean {
  const path = pathOf(url);
  return FUNCTION_RUN.test(path) || ACTION_CALL.test(path);
}

export interface FunctionFixture {
  functionId: string;
  parameters?: Record<string, unknown>;
  savedAt?: string;
  rowCount?: number;
  truncated?: boolean;
  result: unknown[];
}

type LoadFixture = (functionId: string) => Promise<FunctionFixture | null>;

/** dev 서버에서 fixture 파일을 읽는다. 없으면 null. */
export const loadFixture: LoadFixture = async (functionId) => {
  const response = await fetch(`${import.meta.env.BASE_URL}${FIXTURE_DIR}/${encodeURIComponent(functionId)}.json`, {
    cache: "no-store",
  });
  // 없는 파일에도 dev 서버는 index.html 을 200 으로 돌려준다 (SPA fallback). JSON 일 때만 fixture 로 본다.
  if (!response.ok || !response.headers.get("content-type")?.includes("json")) return null;
  try {
    return (await response.json()) as FunctionFixture;
  } catch {
    return null;
  }
};

const warnedMismatch = new Set<string>();

/** fixture 로 답하는 axios adapter — 요청은 서버로 나가지 않는다. */
export function fixtureAdapter(load: LoadFixture = loadFixture): AxiosAdapter {
  return async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
    const match = pathOf(config.url).match(FUNCTION_RUN);
    if (!match) {
      return ok(config, {
        status: "SUCCEEDED",
        fixture: true,
        message: "로컬 프리뷰(fixture 모드)라 액션을 실행하지 않았어요.",
      });
    }
    const functionId = decodeURIComponent(match[1]);
    const fixture = await load(functionId);
    if (!fixture || !Array.isArray(fixture.result)) {
      throw new Error(
        `로컬 프리뷰 fixture 가 없습니다: ${FIXTURE_DIR}/${functionId}.json — ` +
          `app_fixture_url(function_id="${functionId}") 로 받아 주세요.`,
      );
    }
    warnIfParametersDiffer(functionId, fixture, parametersOf(config.data));
    return ok(config, { result: fixture.result, fixture: true });
  };
}

function ok(config: InternalAxiosRequestConfig, data: unknown): AxiosResponse {
  return {
    data: { meta: { code: "Success", message: "fixture" }, data },
    status: 200,
    statusText: "OK",
    headers: {},
    config,
  };
}

function warnIfParametersDiffer(functionId: string, fixture: FunctionFixture, requested: Record<string, unknown>) {
  const saved = stable(fixture.parameters ?? {});
  const asked = stable(requested);
  const key = `${functionId}:${asked}`;
  if (saved === asked || warnedMismatch.has(key)) return;
  warnedMismatch.add(key);
  console.warn(
    `[fixture] ${functionId} 는 다른 파라미터로 저장한 응답입니다. 저장 ${saved} · 요청 ${asked}. ` +
      "같은 파라미터로 보려면 app_fixture_url 로 다시 받으세요.",
  );
}

function parametersOf(data: unknown): Record<string, unknown> {
  const body = typeof data === "string" ? safeParse(data) : data;
  const parameters = (body as { parameters?: unknown } | null)?.parameters;
  return parameters && typeof parameters === "object" ? (parameters as Record<string, unknown>) : {};
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function stable(value: Record<string, unknown>): string {
  return JSON.stringify(Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b))));
}

function pathOf(url: string | undefined): string {
  return (url ?? "").split("?")[0];
}
