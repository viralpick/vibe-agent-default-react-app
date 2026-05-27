import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { usePostMessageFileContent } from "./hooks/usePostMessageFileContent.ts";
import { usePostMessageAuth } from "./hooks/usePostMessageAuth.ts";
import { useUrlToken } from "./hooks/useUrlToken.ts";
import { LocaleProvider } from "./contexts/LocaleContext.tsx";
import { useEnableEditMode } from "./hooks/useEnableEditMode.ts";

function AppWithHooks() {
  useEnableEditMode();
  usePostMessageFileContent();
  usePostMessageAuth(); // locale 동기화 AUTH_TOKEN 에서 합니다
  useUrlToken();

  return <App />;
}

export function Root() {
  return (
    <LocaleProvider>
      <AppWithHooks />
    </LocaleProvider>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
