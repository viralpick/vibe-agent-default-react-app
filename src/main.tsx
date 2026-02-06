import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { usePostMessageFileContent } from "./hooks/usePostMessageFileContent.ts";
import { useEnableEditMode } from "./hooks/useEnableEditMode.ts";
import { useLocaleSync } from "./hooks/useLocaleSync.ts";
import { LocaleProvider } from "./contexts/LocaleContext.tsx";

function AppWithHooks() {
  useEnableEditMode();
  usePostMessageFileContent();
  useLocaleSync();

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
  </React.StrictMode>
);
