import { describe, expect, it } from "vitest";
import { apiClient } from "./api.client";
import { isUnboundRequest, placeholderOf, sampleRows, unboundAdapter } from "./unbound-mocks";

const SHAPES = {
  functions: {
    "aos-unbound:function:daily": {
      columns: [
        { name: "day", type: "date" },
        { name: "orders", type: "number" },
        { name: "brand", type: "string" },
      ],
    },
  },
  actions: ["aos-unbound:action:approve"],
};

describe("가져온 앱의 잇기 전 호출", () => {
  it("자리표시 경로만 가로챈다", () => {
    expect(isUnboundRequest("/ontology-functions/aos-unbound:function:daily/run")).toBe(true);
    expect(isUnboundRequest("/ontology-functions/aos-unbound%3Afunction%3Adaily/run")).toBe(true);
    expect(isUnboundRequest("/ontology-functions/019e49aa-0000-7000-8000-00000000000a/run")).toBe(false);
    expect(placeholderOf("/ontology-actions/aos-unbound:action:approve/execute")).toBe(
      "aos-unbound:action:approve",
    );
  });

  it("함수는 남겨 둔 열 이름 · 타입대로 행을 지어낸다", async () => {
    const response = await unboundAdapter(SHAPES)({
      url: "/ontology-functions/aos-unbound:function:daily/run",
    } as never);

    const rows = response.data.data.result as Record<string, unknown>[];
    expect(rows).toHaveLength(6);
    expect(Object.keys(rows[0])).toEqual(["day", "orders", "brand"]);
    expect(rows[0].day).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(typeof rows[0].orders).toBe("number");
    expect(rows[1].brand).toBe("샘플 brand 2");
  });

  it("모양을 모르는 함수는 빈 배열, 액션은 실행하지 않은 성공이다", async () => {
    const adapter = unboundAdapter(SHAPES);
    const unknown = await adapter({ url: "/ontology-functions/aos-unbound:function:x/run" } as never);
    const action = await adapter({ url: "/ontology-actions/aos-unbound:action:approve/execute" } as never);

    expect(unknown.data.data.result).toEqual([]);
    expect(action.status).toBe(200);
    expect(action.data.data.unbound).toBe(true);
  });

  it("날짜는 오늘로 끝나는 연속된 날이다", () => {
    const rows = sampleRows([{ name: "day", type: "date" }], 3, new Date("2026-10-21T12:00:00Z"));
    expect(rows.map((r) => r.day)).toEqual(["2026-10-19", "2026-10-20", "2026-10-21"]);
  });

  it("api client 는 자리표시 호출을 서버로 보내지 않는다", async () => {
    const response = await apiClient.post("/ontology-functions/aos-unbound:function:any/run", {});
    expect(response.data.data.unbound).toBe(true);
  });
});
