import React from "react";

type EditTextMetaData = {
  elementId: string | null;
  currentText: string;
  filePath: string | null;
  lineNumber: string | null;
};

// Hover 스타일을 CSS로 주입 (Tailwind JIT 문제 해결)
const EDIT_MODE_STYLE_ID = "edit-mode-styles";
const injectEditModeStyles = () => {
  if (document.getElementById(EDIT_MODE_STYLE_ID)) return;

  const style = document.createElement("style");
  style.id = EDIT_MODE_STYLE_ID;
  style.textContent = `
    [data-editable][data-edit-mode-active="true"] {
      cursor: pointer;
    }
    [data-editable][data-edit-mode-active="true"]:hover {
      background-color: rgb(186 230 253); /* sky-200 */
      opacity: 0.5;
    }
  `;
  document.head.appendChild(style);
};

export const useEnableEditMode = () => {
  const [isEditMode, setIsEditMode] = React.useState(false);
  // 클릭 이벤트 핸들러에서 최신 isEditMode 값을 참조하기 위한 ref
  const isEditModeRef = React.useRef(false);

  // isEditMode 상태가 변경될 때마다 ref 업데이트
  React.useEffect(() => {
    isEditModeRef.current = isEditMode;
  }, [isEditMode]);

  // 편집 모드 토글 리스너
  React.useEffect(() => {
    injectEditModeStyles();

    const handleToggleEditMode = (e: MessageEvent) => {
      if (e.data.type === "TOGGLE_EDIT_MODE") {
        const enabled = e.data.payload.enabled;
        setIsEditMode(enabled);

        // enabled 값(payload에서 받은 값)을 직접 사용
        document.querySelectorAll("[data-editable]").forEach((element) => {
          const htmlElement = element as HTMLElement;
          if (enabled) {
            htmlElement.dataset.editModeActive = "true";
          } else {
            delete htmlElement.dataset.editModeActive;
          }
        });
      }
    };

    window.addEventListener("message", handleToggleEditMode);
    return () => window.removeEventListener("message", handleToggleEditMode);
  }, []);

  // 편집 모드에서 클릭 처리
  React.useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      // 편집 모드가 아니면 무시
      if (!isEditModeRef.current) return;

      const target = e.target as HTMLElement;

      if (target.hasAttribute("data-editable")) {
        e.stopPropagation();
        e.preventDefault();

        const metadata: EditTextMetaData = {
          elementId: target.getAttribute("data-element-id"),
          currentText: target.textContent,
          filePath: target.getAttribute("data-file-path"),
          lineNumber: target.getAttribute("data-line-number"),
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
  }, []);

  // 파일 업데이트 응답 리스너
  React.useEffect(() => {
    const handleEditResponse = (e: MessageEvent) => {
      if (e.data.type === "FILE_UPDATED") {
        // HMR replacement automatically
      }
    };

    window.addEventListener("message", handleEditResponse);
    return () => window.removeEventListener("message", handleEditResponse);
  }, []);
};
