import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { usePostMessageFileContent } from "./hooks/usePostMessageFileContent.ts";
import { useEnableEditMode } from "./hooks/useEnableEditMode.ts";
import { usePostMessageAuth } from "./hooks/usePostMessageAuth.ts";
import { useUrlToken } from "./hooks/useUrlToken.ts";
import { LocaleProvider } from "./contexts/LocaleContext.tsx";
import { useHeartbeat } from "./hooks/useHeartbeat.ts";
import { setStaticToken } from "./api/api.client.ts";

function AppWithHooks() {
  useHeartbeat();
  useEnableEditMode();
  usePostMessageFileContent();
  usePostMessageAuth(); // AUTH_TOKEN에서 locale 동기화

  // URL query parameter에서 token 추출 및 설정
  const { token, hasToken } = useUrlToken();
  React.useEffect(() => {
    if (hasToken && token) {
      setStaticToken(token);
    }
  }, [hasToken, token]);

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
