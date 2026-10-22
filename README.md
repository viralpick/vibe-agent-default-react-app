# vibe-agent-default-react-app

앱빌더가 만드는 앱의 시작 템플릿입니다. 샌드박스 이미지(`agentos-view-gen`)가 이 레포의 `main` 을 clone 해
`npm install` 까지 마친 상태로 구워지고, 에이전트와 사용자는 그 위에서 앱 코드를 씁니다.

## 앱 코드를 쓰는 자리

| 경로 | 용도 |
|---|---|
| `src/App.tsx`, `src/modules/*` | 앱 코드. 에이전트와 IDE 가 쓰고 고친다 |
| `src/hooks`, `src/lib`, `src/api`, `src/utils` … | 템플릿이 제공하는 코드. 앱이 import 해서 쓰고, 고치지 않는다 |
| `vite-plugins/` | 빌드 때 앱 소스를 분석하는 플러그인 (요소 위치·데이터 흐름·차트·가공 레시피) |

파일별 접근 단계(편집 · 잠금 · 열람 금지)의 기준은 백엔드 `tool/app_builder/app_sources.py` 에 있습니다.

## 스크립트

| 명령 | 하는 일 |
|---|---|
| `npm run dev` | 3000 포트로 dev 서버 |
| `npm run verify` | oxlint + 프로덕션 빌드 (에이전트가 작업 끝에 돌린다) |
| `npm test` | `vite-plugins` 단위 테스트 |

## 의존성을 바꿀 때

- 에이전트는 `package.json` 에 있는 패키지만 쓰도록 안내받습니다. 여기 넣는 패키지는 곧 앱이 쓸 수 있는 선택지입니다.
- 샌드박스 설치는 plain `npm install` 과 `--legacy-peer-deps` 두 경로가 있어 둘 다에서 설치·빌드를 확인합니다 (#79).
- 머지 후 백엔드의 `sandbox-template-docker-hub.yaml` 을 실행해야 이미지에 반영됩니다. 그 전까지 새 샌드박스는 이 레포의 소스와 이전 이미지의 `node_modules` 를 함께 씁니다.
