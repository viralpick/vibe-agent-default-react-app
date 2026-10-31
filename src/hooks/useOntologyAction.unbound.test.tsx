import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useOntologyAction } from "./useOntologyAction";

describe("useOntologyAction — 실제 api client", () => {
  it("잇기 전 자리표시 액션은 서버로 나가지 않고 샘플 응답으로 success 다", async () => {
    const hook = renderHook(() => useOntologyAction({ id: "aos-unbound:action:approve" }, { tenantId: "7" }));

    const run = await act(() => hook.result.current.execute({ order: 1 }));

    expect(run).toMatchObject({ status: "SUCCEEDED", unbound: true });
    expect(hook.result.current.status).toBe("success");
  });
});
