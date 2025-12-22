import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { usePostMessageFileContent } from "./hooks/usePostMessageFileContent.ts";

export function Root() {
  usePostMessageFileContent();

  return <App />;
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
