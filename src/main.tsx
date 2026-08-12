import React from "react";
import { createRoot } from "react-dom/client";
// CSS 를 index.html 의 `<link>` 대신 여기서 import 한다. 그래야 각 CSS 파일이
// Vite 모듈 그래프의 노드가 되어 변경 시 css-update 가 브라우저로 나간다.
// 특히 theme.css 는 앱빌더가 모드별로 교체하는 파일이므로 반드시 노드여야 한다 —
// `<link>` + CSS `@import` 조합에서는 `[no modules matched]` 로 무시됐다. (AOS-3962)
// 순서: theme(Tailwind 엔트리 + synapse 토큰) → index(폰트/기본 레이어).
import "./theme.css";
import "./index.css";
import App from "./App.tsx";
import { usePostMessageFileContent } from "./hooks/usePostMessageFileContent.ts";
import { usePostMessageAuth } from "./hooks/usePostMessageAuth.ts";
import { useUrlToken } from "./hooks/useUrlToken.ts";
import { useEnableEditMode } from "./hooks/useEnableEditMode.ts";
import { usePreviewErrorReporter } from "./hooks/usePreviewErrorReporter.ts";
import { usePreviewConsoleMirror } from "./hooks/usePreviewConsoleMirror.ts";

function AppWithHooks() {
  useEnableEditMode();
  usePostMessageFileContent();
  usePostMessageAuth(); // locale 동기화 AUTH_TOKEN 에서 합니다
  useUrlToken();
  usePreviewErrorReporter();
  usePreviewConsoleMirror();

  return <App />;
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppWithHooks />
  </React.StrictMode>,
);
