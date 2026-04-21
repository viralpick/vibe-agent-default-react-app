# Synapse Component Verification Guide

> 이 문서는 `@enhans/synapse` 전체 컴포넌트의 렌더링 + 기능 테스트 방법을 설명합니다.
> synapse 버전 업데이트 시 이 전수조사를 다시 돌려서 DESIGN.md(에이전트 프롬프트)의 정확성을 보장합니다.

## 파일 구조

```
src/App.synapse-test.tsx  # 70개 섹션 전수 테스트 파일
SYNAPSE_VERIFICATION.md   # 이 문서
```

## 전수조사 실행 방법

### 1. 테스트 파일 적용

```bash
cp src/App.synapse-test.tsx src/App.tsx
npx vite --port 3001
```

### 2. 필수 의존성 확인

```bash
# echarts 6+ 필요 (synapse/charts가 ECharts 기반)
npm ls echarts  # ^6.0.0 이상이어야 함
npm install echarts@^6.0.0  # 없으면 설치

# Vite 캐시 클리어 (echarts 설치 후 필수)
rm -rf node_modules/.vite && npx vite --port 3001
```

### 3. `index.css` 차트 색상 변수 확인

Tailwind v4의 `@theme` 토큰은 런타임에 CSS 커스텀 프로퍼티로 노출되지 않아 ECharts가 읽지 못합니다. `:root`에 직접 선언이 필요합니다:

```css
:root {
    --chart-1: #e2622d;
    --chart-2: #2a9d8f;
    --chart-3: #3d5a80;
    --chart-4: #e9c46a;
    --chart-5: #f4a261;
}
```

---

## 검증 범위 (70개 섹션)

### A. Basic Components (1-13)
| # | 컴포넌트 | 렌더링 | 기능 테스트 |
|---|---------|--------|-----------|
| 1 | Button | 9가지 variant 표시 | 클릭 → 카운트 증가 |
| 2 | Badge | 7가지 theme 표시 | (표시 전용) |
| 3 | Checkbox | md/sm/indeterminate | 클릭 → checked 토글 |
| 4 | RadioGroup | A/B 옵션 | 선택 → value 변경 |
| 5 | Switch | brand/small/disabled | 토글 → checked 변경 |
| 6 | Spinner | default/sm/xs | (표시 전용) |
| 7 | Skeleton | 3가지 형태 | (표시 전용) |
| 8 | Separator | horizontal | (표시 전용) |
| 9 | Progress | Bar/Circle | (표시 전용) |
| 10 | Dot | 4가지 size/color | (표시 전용) |
| 11 | Label | normal/required | (표시 전용) |
| 12 | Slider | 0-100 범위 | 드래그 → value 변경 |
| 13 | Stepper | +/- 버튼 | 클릭 → value 증감 |

### B. Layout Components (14-20)
| # | 컴포넌트 | 렌더링 | 기능 테스트 |
|---|---------|--------|-----------|
| 14 | Card | Header/Content/Footer/Action | (표시 전용) |
| 15 | Tabs | segmented variant | 탭 전환 → 콘텐츠 변경 |
| 16 | Accordion | single/collapsible | 클릭 → 펼침/접힘 |
| 17 | Table | Header/Body/Row/Cell | (표시 전용) |
| 18 | Breadcrumb | icon/href/isLast | (표시 전용) |
| 19 | Sheet | side="right" | 열기 → 타이틀 확인 → 닫기 |
| 20 | Separator | vertical | (표시 전용) |

### C. Overlay Components (21-24)
| # | 컴포넌트 | 렌더링 | 기능 테스트 |
|---|---------|--------|-----------|
| 21 | Dialog | Header/Footer/Close | 열기 → 타이틀 확인 → 닫기 |
| 22 | Tooltip | side="top" | 호버 → 텍스트 표시 |
| 23 | Popover | 기본 | 열기 → 콘텐츠 표시 |
| 24 | ConfirmDialog | title/description | 열기 → 확인 버튼 동작 |

### D. Data Entry Components (25-36)
| # | 컴포넌트 | 렌더링 | 기능 테스트 |
|---|---------|--------|-----------|
| 25 | Input | md/sm/disabled/leadIcon | 타이핑 → value 반영 |
| 26 | Textarea | placeholder | 타이핑 → value 반영 |
| 27 | Select | DropdownOption[] | 선택 → onValueChange 호출 |
| 28 | MultiSelect | 복수 선택 | 두 번째 항목 추가 → values 변경 |
| 29 | Combobox | 검색+선택 | 열기 → 항목 선택 → values 변경 |
| 30 | Autocomplete | 자동완성 | 열기 → 항목 선택 → value 변경 |
| 31 | CascadingSelect | 다단계 | 첫 번째 선택 → 두 번째 활성화 |
| 32 | Calendar | single mode | 날짜 클릭 → selected 변경 |
| 33 | Command | 검색/그룹 | (표시 전용) |
| 34 | DatePicker single | composition | **달력 열기 → 날짜 선택 → 필드+state 반영** |
| 35 | DatePicker range | composition+presets | **프리셋 클릭 → 필드+state 즉시 반영** |
| 36 | FormField+FormSection | label/error/columns | (표시 전용) |

### E. Data Display Components (37-44)
| # | 컴포넌트 | 렌더링 | 기능 테스트 |
|---|---------|--------|-----------|
| 37 | DataTable | Body/Pagination | (표시 전용) |
| 38 | Notification | success/error, expanded/compact | (표시 전용) |
| 39 | Alert | default/destructive | (표시 전용) |
| 40 | Chip | md/sm/pill/removable | (표시 전용) |
| 41 | Pagination | Numbers/Direction | next 클릭 → page 변경 |
| 42 | Avatar | image/fallback | (표시 전용) |
| 43 | PivotTable | **비활성** (데이터 형식 확인 필요) | — |
| 44 | Toast | **v0.10+ 전용** (0.9.3 미제공) | — |

### F. Layout & Utility Components (45-53)
| # | 컴포넌트 | 렌더링 | 기능 테스트 |
|---|---------|--------|-----------|
| 45 | EmptyState | icon/title/description | (표시 전용) |
| 46 | WidgetGrid | columns=3, gap="md" | (표시 전용) |
| 47 | CollapsibleSection | defaultOpen | 클릭 → 접힘/펼침 |
| 48 | LoadingOverlay | loading + text | 토글 → 오버레이 표시/숨김 |
| 49 | ApiActionButton | label/loading/success | 클릭 → 실행→처리 중...→완료!→실행 |
| 50 | ResizablePanel | horizontal, 50/50 | 핸들 드래그 → 패널 크기 변경 |
| 51 | SortableList | 3개 항목 | 드래그 → 순서 변경 |
| 52 | DynamicTabs | addable/closable | + 버튼 → 탭 추가 |
| 53 | ConditionalRenderer | 3가지 규칙 | value=75 → "보통" Badge 표시 |

### G. Advanced UI (54-57)
| # | 컴포넌트 | 렌더링 | 기능 테스트 |
|---|---------|--------|-----------|
| 54 | ThemeSwitcher | 3가지 옵션 | 다크 클릭 → value 변경 |
| 55 | HierarchicalFilter | TreeNode + count | 체크박스 → selectedIds 변경 |
| 56 | FilterPreset | 프리셋 버튼 | 클릭 → activePresetId 변경 |
| 57 | WhatIfPanel | slider/number 파라미터 | 초기값 표시 확인 |

### H. Synapse Charts (58-70)
| # | 컴포넌트 | 렌더링 | 확인 사항 |
|---|---------|--------|---------|
| 58 | KpiCard | value/change/sparkline | changeType="increase"/"decrease" 동작 |
| 59 | BarChart | Card 래핑 + colors | 바 데이터 표시 |
| 60 | LineChart | smooth + colors | 라인 데이터 표시 |
| 61 | PieChart | donut + innerRadius | 파이 슬라이스 표시 |
| 62 | AreaChart | gradient | 영역 채움 표시 |
| 63 | ScatterChart | sizeField | 버블 크기 변화 |
| 64 | HeatmapChart | x/yCategories | 색상 매핑 |
| 65 | TreemapChart | 계층 구조 | 영역 비율 |
| 66 | GaugeChart | value=72, label | 게이지 바늘 위치 |
| 67 | WaterfallChart | increase/decrease/total | 색상 구분 (녹/적/청) |
| 68 | FunnelChart | showConversionRate | 전환율 % 표시 |
| 69 | SparklineChart | line/bar 타입 | 미니 차트 표시 |
| 70 | ChartContainer | loading/empty 상태 | **title prop 없음** (Card로 래핑) |

---

## 검증 체크리스트

### 렌더링 검증
- [ ] 70개 섹션 모두 화면에 렌더링되는가?
- [ ] 콘솔 에러가 없는가? (아래 무시 가능 에러 제외)
- [ ] 차트(58-70) canvas에 데이터가 표시되는가?

### 기능 검증 (제어 모드 컴포넌트)
- [ ] **초기값 표시**: StateDisplay 값과 컴포넌트 표시값이 일치하는가?
- [ ] **인터랙션**: 클릭/선택 후 StateDisplay가 업데이트되는가?
- [ ] **DatePicker range**: 초기값이 필드에 `yyyy/mm/dd` 형식으로 표시되는가?
- [ ] **DatePicker range**: 프리셋 클릭 시 필드+StateDisplay가 즉시 반영되는가?

### 무시 가능한 콘솔 에러
1. `collapsible` boolean attribute — Radix UI 내부 이슈
2. `isLast` DOM attribute — Breadcrumb 내부 이슈
3. `[ECharts] resize should not be called during main process` — 타이밍 경고
4. `Uncaught (in promise)` — 네트워크 관련
5. `ERR_CONNECTION_CLOSED` — 네트워크 리소스

---

## 주요 발견 사항 (2026-04-21)

### 수정된 이슈

1. **DatePicker 제어 모드 prop**
   - **잘못된 prop**: `selectedRange`/`onRangeSelect`, `selectedDate`/`onDateSelect` — 내부 context용
   - **올바른 prop**: `rangeValue`/`onRangeValueChange` (range), `value`/`onValueChange` (single)
   - 잘못된 prop 사용 시: 초기값 미표시, 콜백 미호출

2. **ChartContainer title/description**
   - `ChartContainer`는 title/description prop이 없음 (렌더링 안 됨)
   - 차트 제목은 `<Card>` + `<CardHeader>` + `<CardTitle>`로 래핑

3. **ECharts 의존성**
   - synapse 0.9.3의 peerDep은 `echarts ^5.5`이지만, 실제로는 `echarts ^6.0.0` 필요
   - echarts 5에서는 축만 렌더링되고 시리즈(바/라인/파이) 안 보임

4. **Chart CSS 변수**
   - `--chart-1` ~ `--chart-5`가 Tailwind v4 `@theme`에만 있어 런타임 미노출
   - `:root`에 직접 선언 필요 (ECharts가 `getComputedStyle`로 읽기 때문)

5. **Toast/Toaster**
   - synapse 0.9.3에서 미제공 (0.10.0+에서 추가)

### 미검증 항목
- **PivotTable**: 데이터 형식(`PivotResult`) 구조 확인 필요 — 잘못된 형식 시 크래시
- **Maps**: 별도 의존성(카카오맵) 필요 — 이 테스트에서 제외
- **Uploader**: `UploadStrategy` 구현체 필요 — 이 테스트에서 제외

---

## DESIGN.md 연동

이 전수조사 결과는 아래 파일에 반영됩니다:

```
hubone-backend/application/agent-app/agent/app_builder/design_content.md
```

전수조사에서 발견된 이슈는 반드시 `design_content.md`에 반영하여 에이전트가 올바른 코드를 생성하도록 합니다.

---

## 버전 이력

| 날짜 | synapse 버전 | 테스트 항목 | 결과 |
|------|-------------|-----------|------|
| 2026-04-10 | 0.9.3 | 29개 UI (렌더링만) | PASS |
| 2026-04-21 | 0.9.3 | 70개 (렌더링 + 기능) | PASS (DatePicker prop 수정 후) |
