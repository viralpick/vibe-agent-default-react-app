import React from "react";

const isE2BSandbox = () => {
  if (typeof window === "undefined") return false;
  const result = window.location.hostname.endsWith(".e2b.app");
  console.log("[useEnableEditMode] isE2BSandbox check:", {
    hostname: window.location.hostname,
    isE2B: result,
  });
  return result;
};

// PascalCase 라벨 fallback: data-aos-name 이 없을 때 kebab id 를 변환.
// "sales-chart" → "SalesChart"
const toPascalCase = (kebab: string): string =>
  kebab
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");

// 컴포넌트 선택 / Diff 표시용 스타일.
// - hover: 회색 점선 (선택 가능 표시)
// - data-aos-selected: 파란 실선 (선택됨)
// - data-aos-diff: 변경 종류별 outline (Diff 모드, after iframe 전용)
const EDIT_MODE_STYLE_ID = "edit-mode-styles";
const injectEditModeStyles = () => {
  if (document.getElementById(EDIT_MODE_STYLE_ID)) return;

  const style = document.createElement("style");
  style.id = EDIT_MODE_STYLE_ID;
  style.textContent = `
    [data-aos-id] {
      cursor: pointer;
    }
    [data-aos-id]:hover {
      outline: 2px dashed rgba(120, 120, 120, 0.8);
      outline-offset: 2px;
    }
    [data-aos-selected="true"] {
      outline: 2px solid rgba(37, 99, 235, 0.9);
      outline-offset: 2px;
    }
    [data-aos-diff="modified"] {
      outline: 2px dashed rgba(234, 179, 8, 0.95);
      outline-offset: 2px;
    }
    [data-aos-diff="added"] {
      outline: 2px solid rgba(34, 197, 94, 0.95);
      outline-offset: 2px;
    }
  `;
  document.head.appendChild(style);
};

const DIFF_OUTLINE_ATTR = "data-aos-diff";

/**
 * 미리보기에서 data-aos-id 가 박힌 컴포넌트를 클릭으로 선택하게 한다.
 *
 * 이 기능이 켜진 sandbox 에서는 기존 텍스트(EDIT_REQUEST) / 쿼리(QUERY_CLICK)
 * 인라인 편집을 전면 중단한다 — 호스트가 "미리보기 클릭 = 컴포넌트 선택"
 * 이라는 단일 인터랙션을 기대하기 때문이다.
 *
 * 통신:
 * - emit  COMPONENT_TOGGLE { id, displayName }  (부모로)
 * - recv  CLEAR_SELECTION                        (선택 해제)
 * - recv  SHOW_DIFF { modified, added }          (diff outline, 클릭 비활성)
 * - recv  HIDE_DIFF                              (diff outline 제거, 클릭 복귀)
 */
export const useEnableEditMode = () => {
  const isE2B = isE2BSandbox();
  const isDiffModeRef = React.useRef<boolean>(false);

  React.useEffect(() => {
    if (!isE2B) return;
    injectEditModeStyles();
    return () => {
      const style = document.getElementById(EDIT_MODE_STYLE_ID);
      if (style) document.head.removeChild(style);
    };
  }, [isE2B]);

  // 컴포넌트 단위 선택 클릭 처리
  React.useEffect(() => {
    if (!isE2B) return;

    const handleClick = (e: MouseEvent) => {
      if (isDiffModeRef.current) return;

      const target = e.target as HTMLElement;
      const componentEl = target.closest("[data-aos-id]") as HTMLElement | null;
      if (!componentEl) return;

      e.stopPropagation();
      e.preventDefault();

      const id = componentEl.getAttribute("data-aos-id");
      if (!id) return;
      const displayName =
        componentEl.getAttribute("data-aos-name") || toPascalCase(id);

      // 시각 효과 토글
      const isSelected =
        componentEl.getAttribute("data-aos-selected") === "true";
      if (isSelected) {
        componentEl.removeAttribute("data-aos-selected");
      } else {
        componentEl.setAttribute("data-aos-selected", "true");
      }

      window.parent.postMessage(
        {
          type: "COMPONENT_TOGGLE",
          payload: { id, displayName },
        },
        "*"
      );
    };

    // capture phase 로 등록해 sandbox 내부 onClick 보다 먼저 가로챈다.
    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [isE2B]);

  // 호스트로부터의 메시지 처리: 선택 해제 / Diff outline
  React.useEffect(() => {
    if (!isE2B) return;

    const clearAllSelected = () => {
      document
        .querySelectorAll('[data-aos-selected="true"]')
        .forEach((el) => el.removeAttribute("data-aos-selected"));
    };

    const clearAllDiff = () => {
      document
        .querySelectorAll(`[${DIFF_OUTLINE_ATTR}]`)
        .forEach((el) => el.removeAttribute(DIFF_OUTLINE_ATTR));
    };

    const applyDiff = (modified: string[], added: string[]) => {
      clearAllDiff();
      const mark = (ids: string[], kind: "modified" | "added") => {
        ids.forEach((id) => {
          const el = document.querySelector(`[data-aos-id="${id}"]`);
          if (el) el.setAttribute(DIFF_OUTLINE_ATTR, kind);
        });
      };
      // after iframe 기준: modified(노랑) + added(초록)만 표시.
      // removed 는 after 에 존재하지 않아 호스트가 before 이미지에 그린다.
      mark(modified, "modified");
      mark(added, "added");
    };

    const handleMessage = (e: MessageEvent) => {
      const data = e.data;
      if (!data || typeof data !== "object" || !data.type) return;

      switch (data.type) {
        case "CLEAR_SELECTION":
          clearAllSelected();
          break;
        case "SHOW_DIFF": {
          isDiffModeRef.current = true;
          clearAllSelected();
          const { modified = [], added = [] } = data.payload ?? {};
          applyDiff(modified, added);
          break;
        }
        case "HIDE_DIFF":
          isDiffModeRef.current = false;
          clearAllDiff();
          break;
        default:
          break;
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [isE2B]);
};
