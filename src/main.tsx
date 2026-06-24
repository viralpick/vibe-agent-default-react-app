import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { usePostMessageFileContent } from "./hooks/usePostMessageFileContent.ts";
import { usePostMessageAuth } from "./hooks/usePostMessageAuth.ts";
import { useUrlToken } from "./hooks/useUrlToken.ts";
import { useEnableEditMode } from "./hooks/useEnableEditMode.ts";

function AppWithHooks() {
  useEnableEditMode();
  usePostMessageFileContent();
  usePostMessageAuth(); // locale 동기화 AUTH_TOKEN 에서 합니다
  useUrlToken();

  return <App />;
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppWithHooks />
  </React.StrictMode>,
);
