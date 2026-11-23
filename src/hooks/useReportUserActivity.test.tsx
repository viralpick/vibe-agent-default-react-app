import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { USER_ACTIVITY_THROTTLE_MS, useReportUserActivity } from "./useReportUserActivity";

const fakeParent = { postMessage: vi.fn() };

function input(type: string) {
  window.dispatchEvent(new Event(type));
}

describe("useReportUserActivity", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(window, "parent", "get").mockReturnValue(fakeParent as unknown as Window);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    fakeParent.postMessage.mockReset();
  });

  it("앱 안 입력을 호스트에 알린다", () => {
    renderHook(() => useReportUserActivity());
    input("pointerdown");
    expect(fakeParent.postMessage).toHaveBeenCalledWith({ type: "USER_ACTIVITY" }, "*");
  });

  it("몰린 입력은 간격마다 한 번만 보낸다", () => {
    renderHook(() => useReportUserActivity());
    input("keydown");
    input("keydown");
    input("wheel");
    expect(fakeParent.postMessage).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(USER_ACTIVITY_THROTTLE_MS);
    input("touchstart");
    expect(fakeParent.postMessage).toHaveBeenCalledTimes(2);
  });

  it("마우스 이동은 입력으로 보내지 않는다", () => {
    renderHook(() => useReportUserActivity());
    input("pointermove");
    input("visibilitychange");
    expect(fakeParent.postMessage).not.toHaveBeenCalled();
  });

  it("iframe 밖에서 단독으로 열면 보내지 않는다", () => {
    vi.spyOn(window, "parent", "get").mockReturnValue(window);
    renderHook(() => useReportUserActivity());
    input("pointerdown");
    expect(fakeParent.postMessage).not.toHaveBeenCalled();
  });

  it("언마운트하면 더 보내지 않는다", () => {
    const { unmount } = renderHook(() => useReportUserActivity());
    unmount();
    input("pointerdown");
    expect(fakeParent.postMessage).not.toHaveBeenCalled();
  });
});
