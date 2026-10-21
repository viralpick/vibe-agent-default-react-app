import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from "axios";
import shapes from "./unbound-mocks.json";

// 다른 환경에서 가져온 앱의 잇기 전 호출 (agent-app tool/app_builder/unbound_mocks.py).
//
// 가져온 앱의 상수는 이 환경의 함수 · 액션에 잇기 전까지 자리표시(`aos-unbound:function:<key>`)를 담는다.
// 그 id 로 서버를 부르면 실패해 화면이 비거나, 행을 가정한 컴포넌트가 깨진다. 그래서 자리표시 호출은
// 서버로 보내지 않고 여기서 답한다 — 함수는 가져올 때 서버가 남긴 열 이름 · 타입대로 가짜 행을,
// 액션은 실행하지 않은 성공을. 값은 매번 여기서 지어낸다 (원래 환경의 데이터는 어디에도 없다).
//
// 이을 대상을 고르면 상수가 실제 id 로 바뀌어 이 경로를 더 타지 않는다. 자리표시가 남은 앱은 게시하지 않는다.

export const UNBOUND_PREFIX = "aos-unbound:";

type ColumnType = "number" | "date" | "boolean" | "string";

interface MockShapes {
  functions?: Record<string, { columns?: { name: string; type: string }[] }>;
  actions?: string[];
}

const SAMPLE_ROWS = 6;

export function isUnboundRequest(url: string | undefined): boolean {
  return !!url && decodeURIComponent(url).includes(UNBOUND_PREFIX);
}

/** `/ontology-functions/aos-unbound:function:sales/run` → `aos-unbound:function:sales` */
export function placeholderOf(url: string): string | null {
  const match = decodeURIComponent(url).match(/aos-unbound:(?:function|action):\w+/);
  return match ? match[0] : null;
}

export function sampleRows(
  columns: { name: string; type: string }[],
  count: number = SAMPLE_ROWS,
  today: Date = new Date(),
): Record<string, unknown>[] {
  return Array.from({ length: count }, (_, row) =>
    Object.fromEntries(
      columns.map((column, index) => [column.name, sampleValue(column, row, index, count, today)]),
    ),
  );
}

function sampleValue(
  column: { name: string; type: string },
  row: number,
  index: number,
  count: number,
  today: Date,
): unknown {
  switch (column.type as ColumnType) {
    case "number":
      // 행마다 다르고 컬럼마다 자릿수가 다른 값 — 차트 · 합계가 그럴듯하게 그려지도록
      return Math.round((row + 1) * 1000 * (index + 1) * (1 + ((row * 7 + index * 3) % 5) / 10));
    case "date": {
      const day = new Date(today);
      day.setDate(day.getDate() - (count - 1 - row));
      return day.toISOString().slice(0, 10);
    }
    case "boolean":
      return row % 2 === 0;
    default:
      return `샘플 ${column.name} ${row + 1}`;
  }
}

/** 자리표시 호출에 답하는 axios adapter — 요청은 서버로 나가지 않는다. */
export function unboundAdapter(source: MockShapes = shapes as MockShapes): AxiosAdapter {
  return async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
    const placeholder = placeholderOf(config.url ?? "") ?? "";
    const isAction = placeholder.startsWith(`${UNBOUND_PREFIX}action:`);
    const columns = source.functions?.[placeholder]?.columns ?? [];
    const data = isAction
      ? { status: "SUCCEEDED", unbound: true, message: "아직 이 환경의 액션에 잇지 않아 실행하지 않았어요." }
      : { result: columns.length ? sampleRows(columns) : [], unbound: true };
    return {
      data: { meta: { code: "Success", message: "unbound sample" }, data },
      status: 200,
      statusText: "OK",
      headers: {},
      config,
    };
  };
}
