import React from "react";
import { hasServedSample, onSampleServed, UNBOUND_PREFIX } from "../api/unbound-mocks";

// 가져온 앱이 잇기 전 함수로 그린 화면을 샘플이라고 표시한다.
//
// 잇기 전 함수 호출은 unbound-mocks 가 지어낸 행으로 답하므로, 표시가 없으면 사용자는 그 숫자를
// 진짜 데이터로 읽는다. 샘플을 한 번이라도 내려주면
//  - 그 함수를 쓰는 위젯(빌드가 붙인 data-aos-functions 에 자리표시가 든 요소)에 점선 테두리를 두르고
//  - 화면 아래에 안내를 띄운다.
// 함수를 이으면 상수가 실제 id 로 바뀌어 위젯 표시는 사라진다. 자리표시가 남은 앱은 게시하지 않으므로
// 이 표시는 미리보기에만 나온다.

export const UNBOUND_SAMPLE_STYLE_ID = "aos-unbound-sample-styles";
export const UNBOUND_SAMPLE_NOTICE_ID = "aos-unbound-sample-notice";
const NOTICE_TEXT = "샘플 데이터예요. 이 환경의 함수에 이으면 실제 값으로 바뀌어요.";

function showSampleNotice() {
  if (!document.getElementById(UNBOUND_SAMPLE_STYLE_ID)) {
    const style = document.createElement("style");
    style.id = UNBOUND_SAMPLE_STYLE_ID;
    // :where 로 우선순위를 0 으로 둔다 — 편집 모드의 선택 테두리가 이 표시를 이기게.
    style.textContent = `
      :where([data-aos-functions*="${UNBOUND_PREFIX}function:"]) {
        outline: 2px dashed rgba(217, 119, 6, 0.85);
        outline-offset: 2px;
      }
      #${UNBOUND_SAMPLE_NOTICE_ID} {
        position: fixed;
        left: 50%;
        bottom: 12px;
        transform: translateX(-50%);
        z-index: 2147483000;
        max-width: calc(100vw - 32px);
        padding: 6px 12px;
        border-radius: 999px;
        background: rgba(120, 53, 15, 0.92);
        color: #fff7ed;
        font: 500 12px/1.4 system-ui, sans-serif;
        pointer-events: none;
      }
    `;
    document.head.appendChild(style);
  }
  if (!document.getElementById(UNBOUND_SAMPLE_NOTICE_ID)) {
    const notice = document.createElement("div");
    notice.id = UNBOUND_SAMPLE_NOTICE_ID;
    notice.setAttribute("role", "status");
    notice.textContent = NOTICE_TEXT;
    document.body.appendChild(notice);
  }
}

export function useUnboundSampleNotice() {
  React.useEffect(() => {
    if (hasServedSample()) showSampleNotice();
    return onSampleServed(showSampleNotice);
  }, []);
}
