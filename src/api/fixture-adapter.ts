import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from "axios";

// 로컬 프리뷰 fixture 모드 (AOS-8520).
//
// 로컬에서 `VITE_AOS_PREVIEW=fixture npm run dev` 로 띄우면 함수 호출을 서버로 보내지 않고 저장해 둔 응답으로 답한다.
// 액션은 실행하지 않은 성공을 돌려준다. 파일은 개인 로그인 MCP 의 `app_fixture_url` 이 앱과 같은 실행 경로로 받아 준
// 것이다 (형식과 경로 규칙: agent-app `tool/app_builder/local_fixture.py`).
//
// 같은 함수를 기간만 바꿔 부르는 화면(이번 30일 · 직전 30일)이 있어 (함수, 파라미터)마다 따로 저장한다.
// - `.cos/fixtures/<함수 id>/<파라미터 키>.json` — 그 파라미터의 응답. 먼저 찾는다.
// - `.cos/fixtures/<함수 id>.json` — 그 함수에서 마지막으로 받은 응답. 오늘 날짜로 기간을 정하는 화면처럼 저장하지 않은
//   파라미터로 부르면 이것으로 답하고 콘솔에 알린다.
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

type LoadFixture = (path: string) => Promise<FunctionFixture | null>;

/** dev 서버에서 fixture 파일(`.cos/fixtures/` 아래 상대 경로)을 읽는다. 없으면 null. */
export const loadFixture: LoadFixture = async (path) => {
  const response = await fetch(`${import.meta.env.BASE_URL}${FIXTURE_DIR}/${path}`, {
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
    const parameters = parametersOf(config.data);
    const exactPath = `${encodeURIComponent(functionId)}/${await parameterKey(parameters)}.json`;
    const fixture = usable(await load(exactPath)) ?? usable(await load(`${encodeURIComponent(functionId)}.json`));
    if (!fixture) {
      throw new Error(
        `로컬 프리뷰 fixture 가 없습니다: ${FIXTURE_DIR}/${exactPath} — ` +
          `app_fixture_url(function_id="${functionId}", parameters=${JSON.stringify(parameters)}) 로 받아 주세요.`,
      );
    }
    warnIfParametersDiffer(functionId, fixture, parameters);
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

function usable(fixture: FunctionFixture | null): FunctionFixture | null {
  return fixture && Array.isArray(fixture.result) ? fixture : null;
}

function warnIfParametersDiffer(functionId: string, fixture: FunctionFixture, requested: Record<string, unknown>) {
  const saved = canonical(fixture.parameters ?? {});
  const asked = canonical(requested);
  const key = `${functionId}:${asked}`;
  if (saved === asked || warnedMismatch.has(key)) return;
  warnedMismatch.add(key);
  console.warn(
    `[fixture] ${functionId} 는 저장하지 않은 파라미터라 마지막으로 받은 응답으로 답합니다. 저장 ${saved} · 요청 ${asked}. ` +
      "이 파라미터로 보려면 app_fixture_url 로 받으세요.",
  );
}

/**
 * 파라미터의 키 — 키를 정렬한 JSON(공백 없음)의 sha256 앞 16자리. agent-app `local_fixture.parameter_key` 와 같은
 * 규칙이고, 같은 예시로 같은 값이 나오는지 양쪽 테스트가 확인한다.
 */
export async function parameterKey(parameters: Record<string, unknown>): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical(parameters)));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 16);
}

function canonical(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value as Record<string, unknown>)
        .sort()
        .map((key) => [key, sortKeys((value as Record<string, unknown>)[key])]),
    );
  }
  return value;
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

function pathOf(url: string | undefined): string {
  return (url ?? "").split("?")[0];
}
