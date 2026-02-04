import * as React from "react";
import * as RadioPrimitive from "@radix-ui/react-radio-group";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/commerce-sdk";

const radioVariants = cva(
  "inline-flex items-center justify-center shrink-0 rounded-full border transition-all cursor-pointer",
  {
    variants: {
      size: {
        sm: "h-16 w-16",
        md: "h-20 w-20",
      },
      checked: {
        unchecked: "",
        checked: "",
      },
    },
    compoundVariants: [
      // Unchecked state
      {
        checked: "unchecked",
        className:
          "border-border-200 bg-background-0 hover:border-border-200-hover focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-1 data-disabled:cursor-not-allowed data-disabled:border-border-100 data-disabled:bg-background-100",
      },
      // Checked state
      {
        checked: "checked",
        className:
          "border-border-200 bg-background-0 hover:border-border-200-hover focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-1 data-disabled:cursor-not-allowed data-disabled:border-border-100 data-disabled:bg-background-100",
      },
    ],
    defaultVariants: {
      size: "sm",
      checked: "unchecked",
    },
  }
);

const radioIndicatorVariants = cva(
  "flex items-center justify-center rounded-full transition-all",
  {
    variants: {
      size: {
        sm: "h-8 w-8",
        md: "h-10 w-10",
      },
    },
    compoundVariants: [
      {
        size: "sm",
        className: "bg-background-inverted data-disabled:bg-gray-400",
      },
      {
        size: "md",
        className: "bg-background-inverted data-disabled:bg-gray-400",
      },
    ],
    defaultVariants: {
      size: "sm",
    },
  }
);

/**
 * RadioGroup 컴포넌트의 Props 인터페이스
 * 
 * RadioGroup은 여러 라디오 버튼을 그룹화하여 단일 선택 입력을 제공하는 컴포넌트입니다.
 * 그룹 내에서 한 번에 하나의 옵션만 선택할 수 있으며, 제어 모드와 비제어 모드를 모두 지원합니다.
 * 
 * @property {string} [className] - 추가 CSS 클래스명. 기본 스타일을 확장하거나 재정의할 때 사용합니다.
 * 
 * @property {string} [defaultValue] - 초기 선택된 라디오 버튼의 값 (비제어 모드).
 *   컴포넌트가 자체적으로 상태를 관리하며, 초기값만 설정합니다.
 * 
 * @property {string} [value] - 현재 선택된 라디오 버튼의 값 (제어 모드).
 *   이 prop을 사용하면 부모 컴포넌트에서 선택 상태를 완전히 제어합니다.
 * 
 * @property {(value: string) => void} [onValueChange] - 선택 값이 변경될 때 호출되는 콜백 함수.
 *   새로 선택된 라디오 버튼의 value를 인자로 받습니다.
 * 
 * @property {boolean} [disabled] - 그룹 전체의 비활성화 여부.
 *   true로 설정하면 그룹 내 모든 라디오 버튼이 비활성화되어 상호작용할 수 없습니다.
 * 
 * @property {string} [name] - 폼 제출 시 사용되는 필드 이름.
 *   HTML form과 함께 사용할 때 필요합니다.
 * 
 * @example
 * ```tsx
 * // 비제어 모드 - 컴포넌트가 자체적으로 상태 관리
 * <RadioGroup defaultValue="option1" name="choice">
 *   <div className="flex items-center space-x-2">
 *     <RadioGroupItem value="option1" id="r1" />
 *     <label htmlFor="r1">옵션 1</label>
 *   </div>
 *   <div className="flex items-center space-x-2">
 *     <RadioGroupItem value="option2" id="r2" />
 *     <label htmlFor="r2">옵션 2</label>
 *   </div>
 * </RadioGroup>
 * 
 * // 제어 모드 - 부모 컴포넌트에서 상태 관리
 * const [selectedValue, setSelectedValue] = useState("option1");
 * <RadioGroup value={selectedValue} onValueChange={setSelectedValue}>
 *   <div className="flex items-center space-x-2">
 *     <RadioGroupItem value="option1" id="r1" />
 *     <label htmlFor="r1">옵션 1</label>
 *   </div>
 *   <div className="flex items-center space-x-2">
 *     <RadioGroupItem value="option2" id="r2" />
 *     <label htmlFor="r2">옵션 2</label>
 *   </div>
 * </RadioGroup>
 * 
 * // 비활성화된 그룹
 * <RadioGroup defaultValue="option1" disabled>
 *   <RadioGroupItem value="option1" />
 *   <RadioGroupItem value="option2" />
 * </RadioGroup>
 * ```
 */
interface RadioGroupProps
  extends React.ComponentPropsWithoutRef<typeof RadioPrimitive.Root> {
  className?: string;
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
  name?: string;
}

/**
 * RadioGroup - 여러 라디오 버튼을 그룹화하는 컴포넌트
 * 
 * RadioGroup은 단일 선택 입력을 위한 라디오 버튼 그룹을 생성합니다.
 * 그룹 내에서 한 번에 하나의 옵션만 선택할 수 있으며, 키보드 탐색(화살표 키)을 지원합니다.
 * 
 * **주요 기능:**
 * - 제어 모드와 비제어 모드 지원
 * - 키보드 탐색 (Tab, 화살표 키)
 * - 접근성 지원 (ARIA 속성 자동 적용)
 * - 폼 통합 지원
 * 
 * **접근성:**
 * - Tab 키로 그룹에 포커스 이동
 * - 화살표 키로 그룹 내 옵션 간 이동
 * - Space 키로 옵션 선택
 * - 스크린 리더 지원
 * 
 * @param {RadioGroupProps} props - RadioGroup 컴포넌트의 props
 * @param {React.Ref} ref - 전달된 ref 객체
 * @returns {React.ReactElement} RadioGroup 컴포넌트
 * 
 * @example
 * ```tsx
 * // 기본 사용법
 * <RadioGroup defaultValue="comfortable">
 *   <div className="flex items-center space-x-2">
 *     <RadioGroupItem value="default" id="r1" />
 *     <label htmlFor="r1">기본</label>
 *   </div>
 *   <div className="flex items-center space-x-2">
 *     <RadioGroupItem value="comfortable" id="r2" />
 *     <label htmlFor="r2">편안함</label>
 *   </div>
 *   <div className="flex items-center space-x-2">
 *     <RadioGroupItem value="compact" id="r3" />
 *     <label htmlFor="r3">컴팩트</label>
 *   </div>
 * </RadioGroup>
 * ```
 */
const RadioGroup = React.forwardRef<
  React.ElementRef<typeof RadioPrimitive.Root>,
  RadioGroupProps
>(({ className, ...props }, ref) => {
  return (
    <RadioPrimitive.Root
      className={cn("grid gap-2", className)}
      {...props}
      ref={ref}
    />
  );
});
RadioGroup.displayName = RadioPrimitive.Root.displayName;

/**
 * RadioGroupItem 컴포넌트의 Props 인터페이스
 * 
 * RadioGroupItem은 RadioGroup 내에서 사용되는 개별 라디오 버튼입니다.
 * 
 * @property {"sm" | "md"} [size="sm"] - 라디오 버튼의 크기 변형
 *   - `"sm"`: 16x16px (기본값) - 작은 크기, 밀집된 레이아웃에 적합
 *   - `"md"`: 20x20px - 중간 크기, 일반적인 폼에 적합
 * 
 * @property {string} value - 라디오 버튼의 값 (필수).
 *   RadioGroup의 선택 상태를 식별하는 고유한 값입니다.
 * 
 * @property {boolean} [disabled] - 개별 라디오 버튼의 비활성화 여부.
 *   true로 설정하면 이 라디오 버튼만 비활성화됩니다.
 * 
 * @property {string} [className] - 추가 CSS 클래스명.
 * 
 * @property {string} [id] - HTML id 속성. label 요소와 연결할 때 사용합니다.
 * 
 * @example
 * ```tsx
 * // 기본 크기 (sm)
 * <RadioGroupItem value="option1" />
 * 
 * // 중간 크기 (md)
 * <RadioGroupItem value="option2" size="md" />
 * 
 * // 비활성화된 라디오 버튼
 * <RadioGroupItem value="option3" disabled />
 * 
 * // label과 함께 사용
 * <div className="flex items-center space-x-2">
 *   <RadioGroupItem value="option1" id="opt1" />
 *   <label htmlFor="opt1">옵션 1</label>
 * </div>
 * 
 * // 커스텀 스타일 적용
 * <RadioGroupItem 
 *   value="option4" 
 *   size="md"
 *   className="border-blue-500"
 * />
 * ```
 */
interface RadioGroupItemProps
  extends React.ComponentPropsWithoutRef<typeof RadioPrimitive.Item>,
    Omit<VariantProps<typeof radioVariants>, "checked"> {
  size?: "sm" | "md";
}

/**
 * RadioGroupItem - 개별 라디오 버튼 컴포넌트
 * 
 * RadioGroup 내에서 사용되는 개별 라디오 버튼입니다.
 * 원형 버튼으로 렌더링되며, 선택 시 내부에 채워진 원이 표시됩니다.
 * 
 * **시각적 상태:**
 * - 기본: 테두리만 있는 빈 원
 * - 선택됨: 내부에 채워진 작은 원이 표시
 * - 호버: 테두리 색상 변경
 * - 포커스: 포커스 링 표시
 * - 비활성화: 회색으로 표시되며 상호작용 불가
 * 
 * **크기 변형:**
 * - sm (기본값): 16x16px 컨테이너, 8x8px 인디케이터
 * - md: 20x20px 컨테이너, 10x10px 인디케이터
 * 
 * **사용 시 주의사항:**
 * - 반드시 RadioGroup 내부에서 사용해야 합니다
 * - 각 RadioGroupItem은 고유한 value를 가져야 합니다
 * - label 요소와 함께 사용하여 접근성을 향상시키세요
 * 
 * @param {RadioGroupItemProps} props - RadioGroupItem 컴포넌트의 props
 * @param {React.Ref} ref - 전달된 ref 객체
 * @returns {React.ReactElement} RadioGroupItem 컴포넌트
 * 
 * @example
 * ```tsx
 * // RadioGroup과 함께 사용
 * <RadioGroup defaultValue="option1">
 *   <RadioGroupItem value="option1" />
 *   <RadioGroupItem value="option2" size="md" />
 *   <RadioGroupItem value="option3" disabled />
 * </RadioGroup>
 * 
 * // 완전한 예제 (label 포함)
 * <RadioGroup defaultValue="card">
 *   <div className="flex items-center space-x-2">
 *     <RadioGroupItem value="card" id="card" size="md" />
 *     <label htmlFor="card" className="cursor-pointer">
 *       신용카드
 *     </label>
 *   </div>
 *   <div className="flex items-center space-x-2">
 *     <RadioGroupItem value="paypal" id="paypal" size="md" />
 *     <label htmlFor="paypal" className="cursor-pointer">
 *       PayPal
 *     </label>
 *   </div>
 * </RadioGroup>
 * ```
 */
const RadioGroupItem = React.forwardRef<
  React.ElementRef<typeof RadioPrimitive.Item>,
  RadioGroupItemProps
>(({ className, size = "sm", ...props }, ref) => {
  return (
    <RadioPrimitive.Item
      ref={ref}
      className={cn(radioVariants({ size }), className)}
      {...props}
    >
      <RadioPrimitive.Indicator className={cn(radioIndicatorVariants({ size }))} />
    </RadioPrimitive.Item>
  );
});
RadioGroupItem.displayName = RadioPrimitive.Item.displayName;

export { RadioGroup, RadioGroupItem, radioVariants, radioIndicatorVariants };
