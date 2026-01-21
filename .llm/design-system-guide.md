## Design System Development Instruction

- 컴포넌트 개발하기 전에 해당 컴포넌트에 대한 이미지를 input으로 줄게. 이미지로 판단이 안 되는 부분은 planning 때 HITL 할 것.

## Npm publish
- 모든 컴포넌트는 npm 배포가 필요하다. 
- esm과 cjs 에서 모두 사용 가능해야 함
- type definition을 반드시 포함할 것
- changesets 를 도입하여 배포 버전 관리를 한다.
- tree-shaking 을 하여 사용하지 않는 컴포넌트를 번들에서 제외하도록 구성한다.

## Components
- 모든 컴포넌트는 cva 를 사용한 variant 시스템과 compound component 패턴을 적용한다.
- 모든 컴포넌트는 compoundVariants 로 theme 을 구성한다. (ref: badge.tsx)
- 모든 컴포넌트는 한국어 JSDoc 을 상세하게 작성한다. (ref: checkbox.tsx)

## Playgrounds
- 컴포넌트를 개발한 이후에는 design-system.tsx 를 참고하여 컴포넌트 playground를 구성한다.