// 위젯 만들기 — 앱 화면에서 영역을 골라 호스트(AgentOS)로 보낸다 (AOS-5814).
//
// 커서 아래 요소를 하이라이트하고, Alt+↑ / Alt+↓ 로 감싼 영역을 넓히거나 좁힌다. 차트 하나만이 아니라
// 카드·섹션처럼 큰 묶음도 고를 수 있게 하기 위함이다. 고를 수 있는 단위는 `data-aos-k` 가 붙은 DOM
// (host 엘리먼트 + data-aos-id 엘리먼트) — vite 플러그인(aos-locator)이 dev·build 양쪽에 넣는다.
//
// 이 모듈은 "어느 영역인가" 만 보낸다. 그 영역에 어떤 차트가 있고 위젯이 될 수 있는지는 호스트가
// 배포 매니페스트(aos-manifest.json)의 visualizations[].anchors 와 키를 맞춰 판단한다.
//
// 통신 (호스트 ↔ iframe):
// - recv TOGGLE_WIDGET_PICK { enabled }   → enabled 면 WIDGET_PICK_READY 로 지원 여부를 알린다
// - recv WIDGET_PICK_LEVEL  { delta }     → 호스트가 대신 전달한 Alt+↑/↓ (iframe 에 포커스가 없을 때)
// - recv WIDGET_PICK_STATUS { tone, text } → 라벨 옆에 호스트 판정(만들 수 있음 / 사유)을 표시
// - emit WIDGET_PICK_HOVER  { key, keys, label, depth }
// - emit WIDGET_PICK        { key, keys, label, depth }  (클릭 확정)
// - emit WIDGET_PICK_CANCEL {}                          (Esc)

const KEY_ATTR = "data-aos-k";
const OVERLAY_ID = "aos-widget-pick-overlay";

type PickPayload = { key: string; keys: string[]; label: string; depth: number };

const post = (type: string, payload: object = {}) => window.parent.postMessage({ type, payload }, "*");

const toPascalCase = (kebab: string): string =>
  kebab
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");

/** 사람이 알아볼 이름 — 선언된 이름 → 영역 안 첫 제목 → 태그 */
const labelOf = (el: HTMLElement): string => {
  const declared = el.getAttribute("data-aos-name") ?? el.getAttribute("data-aos-id");
  if (declared) return el.hasAttribute("data-aos-name") ? declared : toPascalCase(declared);
  const heading = el.querySelector("h1, h2, h3, h4, h5, h6, [role='heading']");
  const text = heading?.textContent?.trim();
  if (text) return text.length > 24 ? `${text.slice(0, 24)}…` : text;
  return el.tagName.toLowerCase();
};

const keyedAncestor = (el: HTMLElement): HTMLElement | null =>
  el.parentElement?.closest<HTMLElement>(`[${KEY_ATTR}]`) ?? null;

const sameBox = (a: HTMLElement, b: HTMLElement): boolean => {
  const ra = a.getBoundingClientRect();
  const rb = b.getBoundingClientRect();
  return (
    Math.abs(ra.left - rb.left) < 1 &&
    Math.abs(ra.top - rb.top) < 1 &&
    Math.abs(ra.width - rb.width) < 1 &&
    Math.abs(ra.height - rb.height) < 1
  );
};

/**
 * 커서 아래 가장 안쪽 요소에서 depth 단계 바깥 영역. 크기가 같은 래퍼는 한 단계로 치지 않는다 —
 * 같은 상자가 다시 하이라이트되면 넓혔는지 알 수 없다.
 */
const levels = (base: HTMLElement): HTMLElement[] => {
  const chain = [base];
  for (let el = keyedAncestor(base); el && el !== document.body; el = keyedAncestor(el)) {
    if (!sameBox(el, chain[chain.length - 1])) chain.push(el);
    else chain[chain.length - 1] = el; // 같은 상자면 바깥 것을 대표로 둔다
  }
  return chain;
};

const payloadOf = (el: HTMLElement, depth: number): PickPayload => {
  const keys = new Set<string>();
  const own = el.getAttribute(KEY_ATTR);
  if (own) keys.add(own);
  el.querySelectorAll(`[${KEY_ATTR}]`).forEach((child) => {
    const key = child.getAttribute(KEY_ATTR);
    if (key) keys.add(key);
  });
  return { key: own ?? "", keys: [...keys], label: labelOf(el), depth };
};

const ensureOverlay = (): { box: HTMLDivElement; label: HTMLSpanElement; status: HTMLSpanElement } => {
  let box = document.getElementById(OVERLAY_ID) as HTMLDivElement | null;
  if (!box) {
    box = document.createElement("div");
    box.id = OVERLAY_ID;
    box.style.cssText =
      "position:fixed;pointer-events:none;z-index:2147483647;border:2px solid rgba(37,99,235,.95);" +
      "background:rgba(37,99,235,.08);border-radius:4px;transition:all 80ms ease-out;display:none;";
    const chip = document.createElement("div");
    chip.style.cssText =
      "position:absolute;left:-2px;top:-26px;display:flex;gap:6px;align-items:center;white-space:nowrap;" +
      "font:500 12px/18px system-ui,sans-serif;color:#fff;background:rgba(37,99,235,.95);padding:2px 8px;border-radius:4px;";
    const label = document.createElement("span");
    label.dataset.role = "label";
    const status = document.createElement("span");
    status.dataset.role = "status";
    status.style.cssText = "opacity:.9;";
    const hint = document.createElement("span");
    hint.textContent = "Alt+↑ 넓히기 · Alt+↓ 좁히기";
    hint.style.cssText = "opacity:.7;";
    chip.append(label, status, hint);
    box.appendChild(chip);
    document.body.appendChild(box);
  }
  return {
    box,
    label: box.querySelector('[data-role="label"]') as HTMLSpanElement,
    status: box.querySelector('[data-role="status"]') as HTMLSpanElement,
  };
};

const TONE_COLOR = { ok: "rgba(37,99,235,.95)", warn: "rgba(217,119,6,.95)" } as const;

const setTone = (tone: keyof typeof TONE_COLOR, text: string) => {
  const { box, status } = ensureOverlay();
  status.textContent = text ? `· ${text}` : "";
  box.style.borderColor = TONE_COLOR[tone];
  (box.firstElementChild as HTMLElement).style.background = TONE_COLOR[tone];
};

const removeOverlay = () => document.getElementById(OVERLAY_ID)?.remove();

/**
 * 위젯 고르기 리스너를 설치한다. 한 번만 부르면 되고, 호스트가 TOGGLE_WIDGET_PICK 으로 켜고 끈다.
 * 꺼져 있을 때는 아무 이벤트도 가로채지 않는다.
 */
export const installWidgetPick = (): (() => void) => {
  let enabled = false;
  let base: HTMLElement | null = null;
  let depth = 0;
  let current: HTMLElement | null = null;
  let lastSentKey = "";

  const render = () => {
    if (!current) return;
    const { box, label } = ensureOverlay();
    const r = current.getBoundingClientRect();
    box.style.display = "block";
    box.style.left = `${r.left}px`;
    box.style.top = `${r.top}px`;
    box.style.width = `${r.width}px`;
    box.style.height = `${r.height}px`;
    // 화면 맨 위 요소면 라벨을 상자 안쪽으로 내린다 (밖에 두면 잘린다)
    (box.firstElementChild as HTMLElement).style.top = r.top < 28 ? "2px" : "-26px";
    label.textContent = labelOf(current);
  };

  const select = (nextBase: HTMLElement | null, nextDepth: number) => {
    if (!nextBase) return;
    const chain = levels(nextBase);
    depth = Math.max(0, Math.min(nextDepth, chain.length - 1));
    base = nextBase;
    const next = chain[depth];
    if (next !== current) {
      current = next;
      setTone("ok", ""); // 판정은 호스트가 새 영역 기준으로 다시 보낸다
    }
    render();
    const payload = payloadOf(current, depth);
    const signature = `${payload.key}:${depth}`;
    if (signature !== lastSentKey) {
      lastSentKey = signature;
      post("WIDGET_PICK_HOVER", payload);
    }
  };

  const onMove = (e: MouseEvent) => {
    if (!enabled) return;
    const target = (e.target as HTMLElement | null)?.closest<HTMLElement>(`[${KEY_ATTR}]`) ?? null;
    if (!target || target === base) return;
    select(target, 0); // 다른 요소로 옮기면 가장 안쪽부터 다시
  };

  const onClick = (e: MouseEvent) => {
    if (!enabled || !current) return;
    e.preventDefault();
    e.stopPropagation();
    post("WIDGET_PICK", payloadOf(current, depth));
  };

  const shift = (delta: number) => {
    if (base) select(base, depth + delta);
  };

  const onKey = (e: KeyboardEvent) => {
    if (!enabled) return;
    if (e.key === "Escape") {
      post("WIDGET_PICK_CANCEL");
      return;
    }
    if (!e.altKey || (e.key !== "ArrowUp" && e.key !== "ArrowDown")) return;
    e.preventDefault();
    shift(e.key === "ArrowUp" ? 1 : -1);
  };

  const onViewport = () => {
    if (enabled) render();
  };

  const setEnabled = (next: boolean) => {
    enabled = next;
    base = null;
    current = null;
    depth = 0;
    lastSentKey = "";
    removeOverlay();
    document.documentElement.style.cursor = next ? "crosshair" : "";
  };

  const onMessage = (e: MessageEvent) => {
    const data = e.data;
    if (!data || typeof data !== "object") return;
    switch (data.type) {
      case "TOGGLE_WIDGET_PICK":
        setEnabled(Boolean(data.payload?.enabled));
        if (enabled) post("WIDGET_PICK_READY");
        break;
      case "WIDGET_PICK_LEVEL":
        if (enabled) shift(data.payload?.delta === -1 ? -1 : 1);
        break;
      case "WIDGET_PICK_STATUS":
        if (!enabled || !current) break;
        setTone(data.payload?.tone === "warn" ? "warn" : "ok", typeof data.payload?.text === "string" ? data.payload.text : "");
        break;
      default:
        break;
    }
  };

  // capture — 앱 자체 onClick 보다 먼저 가로챈다 (useEnableEditMode 와 같은 이유)
  document.addEventListener("mousemove", onMove, true);
  document.addEventListener("click", onClick, true);
  document.addEventListener("keydown", onKey, true);
  window.addEventListener("scroll", onViewport, true);
  window.addEventListener("resize", onViewport);
  window.addEventListener("message", onMessage);
  return () => {
    document.removeEventListener("mousemove", onMove, true);
    document.removeEventListener("click", onClick, true);
    document.removeEventListener("keydown", onKey, true);
    window.removeEventListener("scroll", onViewport, true);
    window.removeEventListener("resize", onViewport);
    window.removeEventListener("message", onMessage);
    setEnabled(false);
  };
};
