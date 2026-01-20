import React from "react";

type EditTextMetaData = {
  elementId: string | null;
  currentText: string;
  filePath: string | null;
  lineNumber: string | null;
  position: { x: number; y: number };
  /** The prop name being edited (e.g., "title", "description") */
  propName: string | null;
};


const isE2BSandbox = () => {
  if (typeof window === "undefined") return false;
  return window.location.hostname.endsWith(".e2b.app");
};

// Hover 스타일을 CSS로 주입 (Tailwind JIT 문제 해결)
const EDIT_MODE_STYLE_ID = "edit-mode-styles";
const injectEditModeStyles = () => {
  if (document.getElementById(EDIT_MODE_STYLE_ID)) return;

  const style = document.createElement("style");
  style.id = EDIT_MODE_STYLE_ID;
  style.textContent = `
    [data-editable="true"] {
      cursor: pointer;
    }
    [data-editable="true"]:hover {
      background-color: rgba(0, 178, 70, 0.2); 
    }
  `;
  document.head.appendChild(style);
};

export const useEnableEditMode = () => {
  const isE2B = isE2BSandbox();

  React.useEffect(() => {
    if (!isE2B) return;
    injectEditModeStyles();
  }, [isE2B]);

  // 편집 모드에서 클릭 처리
  React.useEffect(() => {
    if (!isE2B) return;

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;

      if (target.hasAttribute("data-editable")) {
        e.stopPropagation();
        e.preventDefault();

        // Extract prop name from data-prop attribute
        const propName = target.getAttribute("data-prop");
        
        // Fallback: use data-prop as element-id if data-element-id is not set
        const elementId =
          target.getAttribute("data-element-id") || propName || null;
        
        // Default file path to src/App.tsx if not specified
        const filePath =
          target.getAttribute("data-file-path") || "src/App.tsx";

        const metadata: EditTextMetaData = {
          elementId,
          currentText: target.textContent ?? "",
          filePath,
          lineNumber: target.getAttribute("data-line-number"),
          position: { x: e.clientX, y: e.clientY },
          propName,
        };

        window.parent.postMessage(
          {
            type: "EDIT_REQUEST",
            payload: metadata,
          },
          "*"
        );
      }
    };

    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [isE2B]);

  // 파일 업데이트 응답 리스너
  React.useEffect(() => {
    if (!isE2B) return;

    const handleEditResponse = (e: MessageEvent) => {
      if (e.data.type === "FILE_UPDATED") {
        // HMR replacement automatically
      }
    };

    window.addEventListener("message", handleEditResponse);
    return () => window.removeEventListener("message", handleEditResponse);
  }, [isE2B]);
};
