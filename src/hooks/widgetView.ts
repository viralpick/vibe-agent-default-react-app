// 홈 위젯 표시 모드 — 배포 앱을 `?aos-widget=<data-aos-k>` 로 열면 그 영역만 보여 준다 (AOS-5815 PoC).
//
// 홈은 홈이 다시 그릴 수 없는 영역(차트 여러 개 · 가공된 데이터 · 차트 없는 카드)을 앱 화면 그대로 띄운다
// (IFRAME 위젯). 앱 번들은 그대로 두고, 고른 요소만 보이게 해 위젯 칸 크기에 맞춘다.
//
// - 호스트는 iframe 을 데스크톱 폭으로 연다 — 앱이 뷰어에서와 같은 레이아웃으로 그려진다. 그 상태에서 고른 요소의
//   크기를 재고, 그 크기 그대로 왼쪽 위에 고정한 뒤 크기를 부모에 알린다. 호스트가 위젯 칸에 맞게 축소해 그린다.
//   (요소를 위젯 폭으로 늘이면 앱이 좁은 화면 레이아웃으로 바뀌고 글자가 위젯에 비해 너무 크다.)
// - 나머지는 visibility 로 숨긴다. display 를 끄면 React 트리·데이터 조회가 그대로 돌지 못하는 앱이 생긴다.
// - 요소가 늦게 나타날 수 있어(데이터 로딩 뒤 렌더) 잠시 기다린다. 끝내 없으면 앱이 바뀐 것이다 —
//   부모에 알려 홈이 "영역이 바뀌었어요" 를 그리게 한다.
//
// 통신: emit WIDGET_VIEW_STATUS { key, found, width, height }

const PARAM = "aos-widget";
const STYLE_ID = "aos-widget-view-style";
const TARGET_ATTR = "data-aos-widget-target";
const WAIT_MS = 10_000;
const SETTLE_MS = 600;

const post = (payload: object) => window.parent.postMessage({ type: "WIDGET_VIEW_STATUS", payload }, "*");

const isolate = (el: HTMLElement, width: number, height: number) => {
  el.setAttribute(TARGET_ATTR, "");
  el.style.setProperty("--aos-widget-w", `${width}px`);
  el.style.setProperty("--aos-widget-h", `${height}px`);
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    html, body { overflow: hidden !important; }
    body { visibility: hidden !important; }
    [${TARGET_ATTR}] {
      visibility: visible !important;
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      width: var(--aos-widget-w) !important;
      height: var(--aos-widget-h) !important;
      max-width: none !important;
      margin: 0 !important;
      overflow: auto !important;
      z-index: 2147483646 !important;
      box-sizing: border-box !important;
    }
    [${TARGET_ATTR}] * { visibility: visible !important; }
  `;
  document.head.appendChild(style);
};

/** `?aos-widget=` 이 붙어 열렸으면 그 영역만 보이게 한다. 아니면 아무것도 하지 않는다 */
export const installWidgetView = (): (() => void) => {
  const key = new URLSearchParams(window.location.search).get(PARAM);
  if (!key || !/^k[0-9a-z]+$/.test(key)) return () => {};

  const selector = `[data-aos-k="${key}"]`;
  let done = false;
  const finish = (el: HTMLElement | null) => {
    if (done) return;
    done = true;
    observer.disconnect();
    clearTimeout(timer);
    if (!el) {
      post({ key, found: false });
      return;
    }
    // 차트가 그려질 시간을 조금 준 뒤 잰다 — 데이터가 막 도착한 직후면 높이가 아직 작다
    window.setTimeout(() => {
      const rect = el.getBoundingClientRect();
      const width = Math.max(1, Math.ceil(rect.width));
      const height = Math.max(1, Math.ceil(rect.height));
      isolate(el, width, height);
      post({ key, found: true, width, height });
    }, SETTLE_MS);
  };
  const observer = new MutationObserver(() => {
    const el = document.querySelector<HTMLElement>(selector);
    if (el) finish(el);
  });
  observer.observe(document.body, { childList: true, subtree: true });
  const timer = setTimeout(() => finish(document.querySelector<HTMLElement>(selector)), WAIT_MS);

  const initial = document.querySelector<HTMLElement>(selector);
  if (initial) finish(initial);

  return () => {
    observer.disconnect();
    clearTimeout(timer);
  };
};
