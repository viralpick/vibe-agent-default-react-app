import { StrictMode } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// READY 를 보냈는지는 모듈 상태라 테스트마다 모듈을 새로 읽는다
async function load() {
  vi.resetModules();
  return import("./useHostRoute");
}

type Hook = Awaited<ReturnType<typeof load>>;

const fakeParent = { postMessage: vi.fn() };

function embed() {
  vi.spyOn(window, "parent", "get").mockReturnValue(fakeParent as unknown as Window);
}

function sent() {
  return fakeParent.postMessage.mock.calls.map(([message]) => message as Record<string, unknown>);
}

function fromHost(data: unknown, source: unknown = fakeParent) {
  act(() => {
    window.dispatchEvent(new MessageEvent("message", { data, source: source as Window }));
  });
}

function Shell({ hook }: { hook: Hook }) {
  hook.useHostRoute();
  const navigate = useNavigate();
  const location = useLocation();
  const goBack = hook.useHostBack();
  return (
    <>
      <output data-testid="path">{location.pathname + location.search}</output>
      <button onClick={() => navigate("/orders?tab=log")}>orders</button>
      <button onClick={goBack}>back</button>
      <Routes>
        <Route path="/" element={<p>home</p>} />
        <Route path="/orders" element={<p>orders-page</p>} />
      </Routes>
    </>
  );
}

function renderApp(hook: Hook, { initial = "/", strict = false } = {}) {
  const tree = (
    <MemoryRouter initialEntries={[initial]}>
      <Shell hook={hook} />
    </MemoryRouter>
  );
  return render(strict ? <StrictMode>{tree}</StrictMode> : tree);
}

beforeEach(() => {
  fakeParent.postMessage.mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
  window.history.replaceState(null, "", "/");
});

describe("호스트 주소 연동", () => {
  it("라우터가 준비되면 READY 를 한 번 보낸다 (StrictMode 에서도)", async () => {
    embed();
    const hook = await load();
    renderApp(hook, { initial: "/orders?tab=log", strict: true });
    expect(sent()).toEqual([{ type: "READY", v: 1, path: "/orders?tab=log" }]);
  });

  it("앱 안 이동 한 번에 ROUTE_CHANGE 를 한 번 보낸다", async () => {
    embed();
    const hook = await load();
    renderApp(hook, { strict: true });
    fakeParent.postMessage.mockClear();

    fireEvent.click(screen.getByText("orders"));
    expect(sent()).toEqual([{ type: "ROUTE_CHANGE", path: "/orders?tab=log" }]);

    // 같은 경로로 다시 옮겨도 사용자 이동이면 알린다
    fireEvent.click(screen.getByText("orders"));
    expect(sent()).toHaveLength(2);
  });

  it("NAVIGATE 는 replace 로 반영하고 ROUTE_CHANGE 를 돌려보내지 않는다", async () => {
    embed();
    const hook = await load();
    renderApp(hook, { strict: true });
    fakeParent.postMessage.mockClear();

    fromHost({ type: "NAVIGATE", path: "/orders?tab=log" });
    expect(screen.getByTestId("path").textContent).toBe("/orders?tab=log");
    expect(screen.getByText("orders-page")).toBeInTheDocument();
    expect(sent()).toEqual([]);

    // 그 뒤의 사용자 이동은 다시 알린다
    fireEvent.click(screen.getByText("orders"));
    expect(sent()).toEqual([{ type: "ROUTE_CHANGE", path: "/orders?tab=log" }]);
  });

  it("부모 창이 아닌 곳에서 온 메시지와 앱 밖 경로는 무시한다", async () => {
    embed();
    const hook = await load();
    renderApp(hook);

    fromHost({ type: "NAVIGATE", path: "/orders" }, window);
    fromHost({ type: "NAVIGATE", path: "//evil.example" });
    fromHost({ type: "NAVIGATE", path: "/\\evil.example" });
    fromHost({ type: "NAVIGATE", path: "https://evil.example/" });
    fromHost({ type: "ROUTE_CHANGE", path: "/orders" });
    expect(screen.getByTestId("path").textContent).toBe("/");
  });

  it("뒤로 버튼은 BACK 을 보내고 라우터 이력을 건드리지 않는다", async () => {
    embed();
    const hook = await load();
    renderApp(hook);
    fireEvent.click(screen.getByText("orders"));
    fakeParent.postMessage.mockClear();

    fireEvent.click(screen.getByText("back"));
    expect(sent()).toEqual([{ type: "BACK" }]);
    expect(screen.getByTestId("path").textContent).toBe("/orders?tab=log");
  });

  it("호스트 없이 단독으로 띄우면 아무것도 보내지 않고 앱 안 이동과 뒤로 가기가 된다", async () => {
    const postMessage = vi.spyOn(window, "postMessage");
    const hook = await load();
    renderApp(hook);

    fireEvent.click(screen.getByText("orders"));
    expect(screen.getByText("orders-page")).toBeInTheDocument();
    fireEvent.click(screen.getByText("back"));
    expect(screen.getByText("home")).toBeInTheDocument();
    expect(postMessage).not.toHaveBeenCalled();
  });
});

describe("시작 경로", () => {
  it("iframe 주소의 ?path= 를 쓴다", async () => {
    const hook = await load();
    window.history.replaceState(null, "", "/index.html?path=%2Forders%3Ftab%3Dlog");
    expect(hook.initialPathFromUrl()).toBe("/orders?tab=log");
  });

  it("없거나 앱 안 경로가 아니면 / 로 시작한다", async () => {
    const hook = await load();
    window.history.replaceState(null, "", "/index.html");
    expect(hook.initialPathFromUrl()).toBe("/");
    window.history.replaceState(null, "", "/index.html?path=%2F%2Fevil.example");
    expect(hook.initialPathFromUrl()).toBe("/");
  });
});
