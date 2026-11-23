import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { USER_ACTIVITY_THROTTLE_MS, useReportUserActivity } from "./useReportUserActivity";

const fakeParent = { postMessage: vi.fn() };
const input = (type: string) => window.dispatchEvent(new Event(type));

describe("useReportUserActivity", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(window, "parent", "get").mockReturnValue(fakeParent as unknown as Window);
    renderHook(() => useReportUserActivity());
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    fakeParent.postMessage.mockReset();
  });

  it("앱 안 입력을 호스트에 알린다", () => {
    input("pointerdown");
    expect(fakeParent.postMessage).toHaveBeenCalledWith({ type: "USER_ACTIVITY" }, "*");
  });

  it("몰린 입력은 간격마다 한 번만 보낸다", () => {
    input("keydown");
    input("wheel");
    expect(fakeParent.postMessage).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(USER_ACTIVITY_THROTTLE_MS);
    input("touchstart");
    expect(fakeParent.postMessage).toHaveBeenCalledTimes(2);
  });
});
