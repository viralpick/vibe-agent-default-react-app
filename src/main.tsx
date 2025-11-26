import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom";
import "./index.css";
import App from "./App.tsx";
import { TestPage } from "./pages/TestPage";

export function KeyboardShortcutHandler() {
  const navigate = useNavigate();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // iframe 환경에서만 동작하도록 체크
      if (window.parent === window) {
        return;
      }

      // Ctrl+Shift+9 (Mac: Cmd+Shift+9): 테스트 페이지로 이동
      const isCtrlOrCmd = event.ctrlKey || event.metaKey;
      const isCtrlShift9 = isCtrlOrCmd && event.shiftKey && event.key === "9";

      if (isCtrlShift9) {
        event.preventDefault();
        navigate("/test");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [navigate]);

  return null;
}

export function RouterContent() {
  return (
    <>
      <KeyboardShortcutHandler />
      <Routes>
        <Route path="/test" element={<TestPage />} />
        <Route path="*" element={<App />} />
      </Routes>
    </>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <RouterContent />
    </BrowserRouter>
  </StrictMode>
);
