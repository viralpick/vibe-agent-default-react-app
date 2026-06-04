import React from "react";
import { domToPng } from "modern-screenshot";

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
const EDIT_MODE_INTERACTIVE_STYLE_ID = "edit-mode-interactive-styles";

const injectEditModeStyles = () => {
  if (document.getElementById(EDIT_MODE_STYLE_ID)) return;

  const style = document.createElement("style");
  style.id = EDIT_MODE_STYLE_ID;
  style.textContent = `
    /* EDIT 모드 선택: 아웃라인만. (하위호환: 기존 "true" 값도 동일 처리) */
    [data-aos-selected="edit"],
    [data-aos-selected="true"] {
      outline: 2px solid rgba(37, 99, 235, 0.9);
      outline-offset: 2px;
    }
    /* INSPECT 모드 선택: 아웃라인 + 연한 파란 배경 오버레이. 자식의 흰 배경 위에도
       보이도록 box-shadow inset 으로 덧칠한다(레이아웃에 영향 없음). */
    [data-aos-selected="inspect"] {
      outline: 2px solid rgba(37, 99, 235, 0.9);
      outline-offset: 2px;
      background-color: rgba(37, 99, 235, 0.06);
      box-shadow: inset 0 0 0 9999px rgba(37, 99, 235, 0.06);
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

const injectInteractiveStyles = () => {
  if (document.getElementById(EDIT_MODE_INTERACTIVE_STYLE_ID)) return;

  const style = document.createElement("style");
  style.id = EDIT_MODE_INTERACTIVE_STYLE_ID;
  style.textContent = `
    [data-aos-id] {
      cursor: pointer;
    }
    [data-aos-id]:hover {
      outline: 2px dashed rgba(120, 120, 120, 0.8);
      outline-offset: 2px;
    }
  `;
  document.head.appendChild(style);
};

const removeInteractiveStyles = () => {
  const style = document.getElementById(EDIT_MODE_INTERACTIVE_STYLE_ID);
  if (style) document.head.removeChild(style);
};

const DIFF_OUTLINE_ATTR = "data-aos-diff";

// in-flight fetch/XHR 개수를 추적해 캡처 직전 "network idle" 을 감지한다.
// 호스트가 CAPTURE_SCREENSHOT 을 보낸 직후엔 보통 React 가 막 마운트되어
// 데이터 페칭 중 → 그대로 캡처하면 로딩 스피너만 찍힌다. 이 카운터가 일정
// 시간 0 으로 유지되면 "안정 상태" 로 보고 캡처를 시작한다.
let inFlightRequests = 0;
let networkInstrumented = false;

const installNetworkInstrumentation = () => {
  if (networkInstrumented || typeof window === "undefined") return;
  networkInstrumented = true;

  const originalFetch = window.fetch;
  window.fetch = function patchedFetch(...args: Parameters<typeof fetch>) {
    inFlightRequests += 1;
    return originalFetch.apply(this, args).finally(() => {
      inFlightRequests = Math.max(0, inFlightRequests - 1);
    });
  };

  const OriginalXHR = window.XMLHttpRequest;
  // XHR 은 send 시점에 +1, loadend(success/error/abort 통합)에 -1.
  // open 에서 +1 하면 send 안 부른 인스턴스로 카운터가 새는 케이스가 있다.
  class PatchedXHR extends OriginalXHR {
    private __tracked = false;
    send(...args: Parameters<XMLHttpRequest["send"]>) {
      if (!this.__tracked) {
        this.__tracked = true;
        inFlightRequests += 1;
        const release = () => {
          inFlightRequests = Math.max(0, inFlightRequests - 1);
          this.removeEventListener("loadend", release);
        };
        this.addEventListener("loadend", release);
      }
      return super.send(...args);
    }
  }
  window.XMLHttpRequest = PatchedXHR as unknown as typeof XMLHttpRequest;
};

/**
 * network idle 을 기다린다. in-flight 가 idleMs 동안 0 으로 유지되면 resolve.
 * maxWaitMs 안에 idle 을 못 보면 강제 resolve (보안용 timeout).
 */
const waitForNetworkIdle = (
  idleMs: number = 800,
  maxWaitMs: number = 10000
): Promise<void> => {
  return new Promise((resolve) => {
    const start = Date.now();
    let idleSince: number | null = inFlightRequests === 0 ? start : null;
    const tick = () => {
      if (inFlightRequests === 0) {
        if (idleSince === null) idleSince = Date.now();
        if (Date.now() - idleSince >= idleMs) {
          resolve();
          return;
        }
      } else {
        idleSince = null;
      }
      if (Date.now() - start >= maxWaitMs) {
        resolve();
        return;
      }
      setTimeout(tick, 100);
    };
    tick();
  });
};

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
  // 호스트가 TOGGLE_EDIT_MODE { enabled } 로 제어하는 컴포넌트 선택 모드.
  // 기본값 false — Edit 버튼을 명시적으로 눌러야만 컴포넌트 선택 활성.
  // 호스트는 iframe load 시 현재 store 값(기본 false)을 그대로 보낸다.
  const isEditEnabledRef = React.useRef<boolean>(false);
  // 단건 선택 모드(SOURCE). true 면 클릭 시 다른 선택을 모두 해제하고 1개만
  // 하이라이트한다(토글 아님). EDIT(다중 선택)는 false. 호스트가 TOGGLE_EDIT_MODE
  // { singleSelect } 로 제어한다.
  const isSingleSelectRef = React.useRef<boolean>(false);

  React.useEffect(() => {
    if (!isE2B) return;
    injectEditModeStyles();
    // 네트워크 idle 감지를 위해 fetch/XHR 패치 (idempotent, 1회만 설치).
    // 캡처 시점에 React 가 데이터 페칭 중이면 로딩 상태가 캡처되므로 idle 대기 필요.
    installNetworkInstrumentation();
    return () => {
      const style = document.getElementById(EDIT_MODE_STYLE_ID);
      if (style) document.head.removeChild(style);
      removeInteractiveStyles();
    };
  }, [isE2B]);

  // 컴포넌트 단위 선택 클릭 처리
  React.useEffect(() => {
    if (!isE2B) return;

    const handleClick = (e: MouseEvent) => {
      if (isDiffModeRef.current) return;
      if (!isEditEnabledRef.current) return;

      const target = e.target as HTMLElement;
      const componentEl = target.closest("[data-aos-id]") as HTMLElement | null;
      if (!componentEl) return;

      e.stopPropagation();
      e.preventDefault();

      const id = componentEl.getAttribute("data-aos-id");
      if (!id) return;
      const displayName =
        componentEl.getAttribute("data-aos-name") || toPascalCase(id);
      // 이 컴포넌트가 데이터를 가져오는 OntologyFunction id 콤마목록 (없으면 null).
      // host(Source 모드)는 이 값으로 컴포넌트를 inspect 한다.
      const functions = componentEl.getAttribute("data-aos-functions");

      if (isSingleSelectRef.current) {
        // INSPECT 단건 선택: 다른 선택을 모두 해제하고 클릭한 1개만 하이라이트.
        // 같은 컴포넌트를 다시 클릭해도 토글로 꺼지지 않게 항상 set(host inspect
        // 패널의 단건 대상과 outline 을 일치시킨다). 값 "inspect" = 아웃라인 + 배경.
        document
          .querySelectorAll("[data-aos-selected]")
          .forEach((el) => {
            if (el !== componentEl) el.removeAttribute("data-aos-selected");
          });
        componentEl.setAttribute("data-aos-selected", "inspect");
      } else {
        // EDIT 다중 선택: 토글. 값 "edit" = 아웃라인만.
        const isSelected = componentEl.hasAttribute("data-aos-selected");
        if (isSelected) {
          componentEl.removeAttribute("data-aos-selected");
        } else {
          componentEl.setAttribute("data-aos-selected", "edit");
        }
      }

      window.parent.postMessage(
        {
          type: "COMPONENT_TOGGLE",
          payload: { id, displayName, functions },
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
      // 값(edit/inspect/true) 무관하게 모든 선택 표시를 제거한다.
      document
        .querySelectorAll("[data-aos-selected]")
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

    // 현재 화면을 PNG(dataURL) 로 캡처하고 [data-aos-id] 요소들의 좌표를 함께
    // 수집해 호스트로 돌려준다. 호스트가 before/after 이미지를 직접 확보하는
    // "스크린샷 API". 캡처 직전 선택/diff outline 은 결과 이미지에 섞이지 않도록 제거.
    const handleCapture = async (requestId: string) => {
      clearAllSelected();
      clearAllDiff();
      try {
        // 데이터 페칭 + 차트 렌더가 끝날 때까지 대기. idle 못 보면 10초 후 강제 진행.
        await waitForNetworkIdle();
        const root = document.body;
        const image = await domToPng(root, {
          backgroundColor: "#ffffff",
          // device pixel ratio 2배까지만 — 메모리/전송 크기 균형
          scale: Math.min(window.devicePixelRatio || 1, 2),
        });
        const components = Array.from(
          document.querySelectorAll<HTMLElement>("[data-aos-id]")
        ).map((el) => {
          const r = el.getBoundingClientRect();
          return {
            id: el.getAttribute("data-aos-id") ?? "",
            name:
              el.getAttribute("data-aos-name") ||
              toPascalCase(el.getAttribute("data-aos-id") ?? ""),
            x: Math.round(r.left + window.scrollX),
            y: Math.round(r.top + window.scrollY),
            w: Math.round(r.width),
            h: Math.round(r.height),
          };
        });
        window.parent.postMessage(
          {
            type: "SCREENSHOT_RESULT",
            payload: {
              requestId,
              image,
              width: Math.round(document.documentElement.scrollWidth),
              height: Math.round(document.documentElement.scrollHeight),
              components,
            },
          },
          "*"
        );
      } catch (error) {
        console.error("[useEnableEditMode] capture failed:", error);
        window.parent.postMessage(
          {
            type: "SCREENSHOT_RESULT",
            payload: { requestId, error: String(error) },
          },
          "*"
        );
      }
    };

    const handleMessage = (e: MessageEvent) => {
      const data = e.data;
      if (!data || typeof data !== "object" || !data.type) return;

      switch (data.type) {
        case "TOGGLE_EDIT_MODE": {
          const enabled = Boolean(data.payload?.enabled);
          // INSPECT(단건 inspect)면 single-select, EDIT(다중)면 false.
          const nextSingleSelect = Boolean(data.payload?.singleSelect);
          // 모드(EDIT↔INSPECT)가 바뀌면 두 모드의 선택 스타일이 다르므로
          // 기존 선택 표시를 모두 초기화한다.
          const modeChanged = nextSingleSelect !== isSingleSelectRef.current;
          isSingleSelectRef.current = nextSingleSelect;
          isEditEnabledRef.current = enabled;
          if (enabled) {
            injectInteractiveStyles();
            if (modeChanged) clearAllSelected();
          } else {
            removeInteractiveStyles();
            clearAllSelected();
          }
          break;
        }
        case "CLEAR_SELECTION":
          clearAllSelected();
          break;
        case "COMPONENT_TOGGLE": {
          // 호스트(배지 ×)에서 보낸 토글 — EDIT 다중 선택 전용. 클릭 송신과 대칭으로
          // data-aos-selected 를 반전해 선택 outline 을 host 상태와 동기화한다.
          const id = data.payload?.id;
          if (typeof id !== "string") break;
          const el = document.querySelector(
            `[data-aos-id="${id}"]`
          ) as HTMLElement | null;
          if (!el) break;
          const isSelected = el.hasAttribute("data-aos-selected");
          if (isSelected) {
            el.removeAttribute("data-aos-selected");
          } else {
            el.setAttribute("data-aos-selected", "edit");
          }
          break;
        }
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
        case "CAPTURE_SCREENSHOT": {
          const requestId = data.payload?.requestId;
          if (typeof requestId === "string") handleCapture(requestId);
          break;
        }
        default:
          break;
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [isE2B]);
};
