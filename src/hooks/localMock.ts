// 로컬 프리뷰 더미 모드 (AOS-9093).
//
// 로컬에서 `VITE_AOS_PREVIEW=mock npm run dev` 로 띄우면 함수 · 액션 호출을 서버로 보내지 않는다.
//  - 함수: `.cos/mocks/<함수 id>.json` 의 `result` 행으로 답한다. 파일은 로컬 에이전트가 함수 정보로 지어낸 더미 데이터다.
//    파일이 없으면 빈 결과로 답하고 콘솔에 알린다.
//  - 액션: 실행하지 않은 성공을 돌려준다.
//
// 켜는 조건은 dev 서버 + 명시적인 환경변수 둘 다다. 샌드박스 웹 프리뷰도 `npm run dev` 로 뜨므로 스크립트 이름이나
// 파일이 있는지로 고르면 웹 프리뷰가 더미로 바뀐다. 게시 빌드에서는 DEV 가 거짓이라 꺼진다.
//
// 훅(src/hooks)에 두는 이유: 이 폴더는 템플릿이 덮어쓰는 곳이라 예전에 만든 앱에도 들어간다. src/api 는 앱 파일이다.
// 더미 파일은 import 하지 않고 실행 중에 dev 서버에서 읽기만 한다 — import 하면 번들에 들어간다.

export const MOCK_DIR = ".cos/mocks";
export const LOCAL_MOCK_NOTICE_ID = "aos-local-mock-notice";
const NOTICE_TEXT = "로컬 더미 데이터예요. 서버를 부르지 않아 실제 값과 다르고, 액션은 실행되지 않아요.";

export function isLocalMockMode(
  env: { DEV?: boolean; VITE_AOS_PREVIEW?: string } = import.meta.env,
): boolean {
  return !!env.DEV && env.VITE_AOS_PREVIEW === "mock";
}

export type LoadMockFile = (functionId: string) => Promise<unknown | null>;

/** dev 서버에서 `.cos/mocks/<함수 id>.json` 을 읽는다. 없으면 null. */
export const loadMockFile: LoadMockFile = async (functionId) => {
  const response = await fetch(
    `${import.meta.env.BASE_URL}${MOCK_DIR}/${encodeURIComponent(functionId)}.json`,
    { cache: "no-store" },
  );
  // 없는 파일에도 dev 서버는 index.html 을 200 으로 돌려준다 (SPA fallback). JSON 일 때만 더미 파일로 본다.
  if (!response.ok || !response.headers.get("content-type")?.includes("json")) return null;
  try {
    return await response.json();
  } catch {
    return null;
  }
};

const warnedMissing = new Set<string>();

/** 함수의 더미 행. 파일이 없거나 모양이 틀리면 빈 배열을 돌려주고 한 번만 알린다. */
export async function mockFunctionRows(
  functionId: string,
  load: LoadMockFile = loadMockFile,
): Promise<unknown[]> {
  showLocalMockNotice();
  const file = await load(functionId);
  const rows = (file as { result?: unknown } | null)?.result;
  if (Array.isArray(rows)) return rows;
  if (!warnedMissing.has(functionId)) {
    warnedMissing.add(functionId);
    console.warn(
      `[mock] ${MOCK_DIR}/${functionId}.json 이 없어 빈 결과로 답합니다. ` +
        `{"result": [ ... ]} 모양으로 더미 행을 만들어 두세요.`,
    );
  }
  return [];
}

/** 액션 호출에 돌려줄 실행 결과 — 실행하지 않은 성공. */
export function mockActionRun(actionId: string): {
  status: string;
  actionId: string;
  mock: true;
  message: string;
} {
  showLocalMockNotice();
  return {
    status: "SUCCEEDED",
    actionId,
    mock: true,
    message: "로컬 더미 모드라 액션을 실행하지 않았어요.",
  };
}

/** 더미 데이터로 그린 화면임을 화면 아래에 알린다. 한 번만 붙인다. */
export function showLocalMockNotice() {
  if (typeof document === "undefined" || document.getElementById(LOCAL_MOCK_NOTICE_ID)) return;
  const notice = document.createElement("div");
  notice.id = LOCAL_MOCK_NOTICE_ID;
  notice.setAttribute("role", "status");
  notice.textContent = NOTICE_TEXT;
  Object.assign(notice.style, {
    position: "fixed",
    left: "50%",
    bottom: "12px",
    transform: "translateX(-50%)",
    zIndex: "2147483000",
    maxWidth: "calc(100vw - 32px)",
    padding: "6px 12px",
    borderRadius: "999px",
    background: "rgba(30, 64, 175, 0.92)",
    color: "#eff6ff",
    font: "500 12px/1.4 system-ui, sans-serif",
    pointerEvents: "none",
  });
  document.body.appendChild(notice);
}

/** 테스트에서 알림 상태를 비운다 */
export function resetLocalMockState() {
  warnedMissing.clear();
  if (typeof document !== "undefined") document.getElementById(LOCAL_MOCK_NOTICE_ID)?.remove();
}
