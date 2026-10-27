import { act, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// 샘플을 내려줬는지는 모듈 상태라 테스트마다 모듈을 새로 읽는다
async function load() {
  vi.resetModules();
  const mocks = await import("../api/unbound-mocks");
  const notice = await import("./useUnboundSampleNotice");
  function Probe() {
    notice.useUnboundSampleNotice();
    return <div data-aos-id="sales" data-aos-functions="aos-unbound:function:sales" />;
  }
  return { mocks, notice, Probe };
}

const SHAPES = { functions: { "aos-unbound:function:sales": { columns: [{ name: "total", type: "number" }] } } };

beforeEach(() => {
  document.head.innerHTML = "";
  document.body.innerHTML = "";
});

describe("잇기 전 함수의 샘플 표시", () => {
  it("샘플을 내려주기 전에는 아무것도 띄우지 않는다", async () => {
    const { notice, Probe } = await load();
    render(<Probe />);
    expect(document.getElementById(notice.UNBOUND_SAMPLE_NOTICE_ID)).toBeNull();
  });

  it("함수 샘플을 내려주면 안내와 위젯 테두리 스타일을 붙인다", async () => {
    const { mocks, notice, Probe } = await load();
    render(<Probe />);

    await act(async () => {
      await mocks.unboundAdapter(SHAPES)({ url: "/ontology-functions/aos-unbound:function:sales/run" } as never);
    });

    expect(document.getElementById(notice.UNBOUND_SAMPLE_NOTICE_ID)?.textContent).toContain("샘플 데이터");
    const css = document.getElementById(notice.UNBOUND_SAMPLE_STYLE_ID)?.textContent ?? "";
    expect(css).toContain('[data-aos-functions*="aos-unbound:function:"]');
  });

  it("이미 샘플을 내려준 뒤에 마운트돼도 표시한다", async () => {
    const { mocks, notice, Probe } = await load();
    await mocks.unboundAdapter(SHAPES)({ url: "/ontology-functions/aos-unbound:function:sales/run" } as never);
    render(<Probe />);
    expect(document.getElementById(notice.UNBOUND_SAMPLE_NOTICE_ID)).not.toBeNull();
  });

  it("액션 응답만으로는 표시하지 않는다", async () => {
    const { mocks, notice, Probe } = await load();
    render(<Probe />);
    await act(async () => {
      await mocks.unboundAdapter(SHAPES)({ url: "/ontology-actions/aos-unbound:action:approve/execute" } as never);
    });
    expect(document.getElementById(notice.UNBOUND_SAMPLE_NOTICE_ID)).toBeNull();
  });
});
