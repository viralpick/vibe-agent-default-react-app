import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { usePostMessageFileContent } from "./hooks/usePostMessageFileContent.ts";
import { DesignSystemPage } from "./pages/design-system.tsx";

export function Root() {
  usePostMessageFileContent();

  return <DesignSystemPage />;
  return <App />;
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
