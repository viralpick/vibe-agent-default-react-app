import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { cva, type VariantProps } from "class-variance-authority";
import { Check, Minus } from "lucide-react";
import { cn } from "@/lib/commerce-sdk";

const checkboxVariants = cva(
  "inline-flex items-center justify-center shrink-0 rounded-small border transition-all cursor-pointer",
  {
    variants: {
      size: {
        sm: "h-16 w-16",
        md: "h-20 w-20",
      },
      checked: {
        unchecked: "",
        checked: "",
        indeterminate: "",
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
          "border-transparent bg-background-inverted hover:bg-background-inverted-hover focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-1 data-disabled:cursor-not-allowed data-disabled:bg-gray-400",
      },
      // Indeterminate state
      {
        checked: "indeterminate",
        className:
          "border-transparent bg-background-inverted hover:bg-background-inverted-hover focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-1 data-disabled:cursor-not-allowed data-disabled:bg-gray-400",
      },
    ],
    defaultVariants: {
      size: "sm",
      checked: "unchecked",
    },
  }
);

/**
 * Checkbox 컴포넌트 Props
 *
 * @property {boolean | "indeterminate"} checked - 체크박스의 선택 상태
 *   - `false`: 미선택 상태 (빈 체크박스)
 *   - `true`: 선택 상태 (체크 아이콘 표시)
 *   - `"indeterminate"`: 불확정 상태 (마이너스 아이콘 표시)
 *
 * @property {function} onCheckedChange - 체크박스 상태가 변경될 때 호출되는 콜백
 *   - `checked` 상태를 외부에서 관리할 때, 이 콜백으로 다음 상태를 전달받습니다
 *   - indeterminate 모드: `false` → `true` → `"indeterminate"` → `false` 순환
 *   - 일반 모드: `false` ↔ `true` 토글
 *
 * @property {"sm" | "md"} size - 체크박스 크기
 *   - `"sm"`: 16px (기본값)
 *   - `"md"`: 20px
 *
 * @property {boolean} disabled - 비활성화 여부
 *
 * @example
 * ```tsx
 * // 일반 체크박스 (선택/미선택 토글)
 * const [checked, setChecked] = useState(false);
 * <Checkbox checked={checked} onCheckedChange={setChecked} />
 *
 * // 불확정 상태를 포함한 체크박스 (3가지 상태 순환)
 * const [checked, setChecked] = useState<boolean | "indeterminate">("indeterminate");
 * <Checkbox checked={checked} onCheckedChange={setChecked} />
 *
 * // 비활성화된 체크박스
 * <Checkbox checked={true} disabled />
 * ```
 */
export interface CheckboxProps
  extends Omit<
      React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>,
      "checked"
    >,
    Omit<VariantProps<typeof checkboxVariants>, "checked"> {
  checked?: boolean | "indeterminate";
  onCheckedChange?: (checked: boolean | "indeterminate") => void;
}

/**
 * 선택, 미선택, 불확정 상태를 지원하는 Checkbox 컴포넌트
 *
 * **상태 전환 동작:**
 * - 일반 모드: 미선택(`false`)과 선택(`true`) 간 토글
 * - 불확정 모드: 미선택 → 선택 → 불확정 순환
 *
 * **참고:** `checked` prop은 `false | true | "indeterminate"` 값을 받습니다.
 * 불확정 상태를 사용할 때는 `onCheckedChange`를 통해 상태를 외부에서 관리해야 합니다.
 */
const Checkbox = React.forwardRef<
  React.ComponentRef<typeof CheckboxPrimitive.Root>,
  CheckboxProps
>(({ className, size, checked, disabled, onCheckedChange, ...props }, ref) => {
  const checkedState =
    checked === "indeterminate"
      ? "indeterminate"
      : checked
        ? "checked"
        : "unchecked";

  const iconSize = size === "md" ? 16 : 12;

  const handleCheckedChange = (newChecked: boolean | "indeterminate") => {
    if (onCheckedChange) {
      // indeterminate 모드일 때: unchecked -> checked -> indeterminate
      if (checked === "indeterminate") {
        onCheckedChange(false);
      } else if (checked === false) {
        onCheckedChange(true);
      } else if (checked === true) {
        onCheckedChange("indeterminate");
      } else {
        // 일반 모드: unchecked <-> checked
        onCheckedChange(newChecked);
      }
    }
  };

  return (
    <CheckboxPrimitive.Root
      ref={ref}
      checked={checked}
      disabled={disabled}
      data-disabled={disabled ? "" : undefined}
      className={cn(checkboxVariants({ size, checked: checkedState }), className)}
      onCheckedChange={handleCheckedChange}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="flex items-center justify-center text-icon-inverted data-disabled:text-gray-100">
        {checked === "indeterminate" ? (
          <Minus size={iconSize} strokeWidth={1.5} />
        ) : (
          <Check size={iconSize} strokeWidth={1.5} />
        )}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
});

Checkbox.displayName = "Checkbox";

export { Checkbox, checkboxVariants };
