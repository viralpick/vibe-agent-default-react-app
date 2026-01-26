import * as React from "react";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { cva, type VariantProps } from "class-variance-authority";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/commerce-sdk";

// ============================================================================
// Dropdown Trigger Variants
// ============================================================================

const dropdownTriggerVariants = cva(
  "inline-flex items-center justify-between gap-8 border rounded-medium transition-all cursor-pointer select-none outline-none",
  {
    variants: {
      size: {
        sm: "h-32 px-8 py-6 text-label-2",
        md: "h-40 px-12 py-10 text-label-2",
      },
      variant: {
        default:
          "bg-background-0 border-border-200 hover:border-border-200-hover focus:ring-2 focus:ring-border-brand",
        inline:
          "bg-transparent border-transparent hover:bg-background-50 focus:ring-2 focus:ring-border-brand",
      },
      disabled: {
        true: "opacity-50 cursor-not-allowed pointer-events-none",
        false: "",
      },
    },
    defaultVariants: {
      size: "md",
      variant: "default",
      disabled: false,
    },
  }
);

// ============================================================================
// Dropdown Item Variants
// ============================================================================

const dropdownItemVariants = cva(
  "flex items-center gap-8 p-8 cursor-pointer transition-colors outline-none select-none rounded-small",
  {
    variants: {
      state: {
        default: "text-text-primary",
        selected: "bg-slate-100",
        disabled: "text-text-disabled cursor-not-allowed opacity-50",
      },
    },
    defaultVariants: {
      state: "default",
    },
  }
);

// ============================================================================
// Types
// ============================================================================

export interface DropdownOption {
  value: string;
  label: string;
  disabled?: boolean;
  leadIcon?: React.ReactNode;
  caption?: string;
}

export interface SelectProps
  extends VariantProps<typeof dropdownTriggerVariants> {
  /** 선택 옵션 목록 */
  options: DropdownOption[];
  /** 현재 선택된 값 */
  value?: string;
  /** 값 변경 콜백 */
  onValueChange?: (value: string) => void;
  /** 플레이스홀더 텍스트 */
  placeholder?: string;
  /** 라벨 텍스트 */
  label?: string;
  /** 비활성화 여부 */
  disabled?: boolean;
  /** 추가 클래스 */
  className?: string;
  /** 트리거 정렬 방향 */
  side?: "left" | "right";
}

// ============================================================================
// Select Component (단일 선택)
// ============================================================================

/**
 * Select 컴포넌트
 *
 * 단일 값을 선택할 수 있는 드롭다운 선택기입니다.
 * `@radix-ui/react-dropdown-menu` 기반으로 구현되었습니다.
 *
 * @property {DropdownOption[]} options - 선택 가능한 옵션 목록
 * @property {string} value - 현재 선택된 값
 * @property {function} onValueChange - 값 변경 시 호출되는 콜백
 * @property {string} placeholder - 값이 선택되지 않았을 때 표시되는 텍스트
 * @property {string} label - 드롭다운 상단에 표시되는 라벨
 * @property {"sm" | "md"} size - 트리거 크기
 * @property {"default" | "inline"} variant - 트리거 스타일
 * @property {"left" | "right"} side - 드롭다운 메뉴 정렬 방향
 * @property {boolean} disabled - 비활성화 여부
 *
 * @example
 * ```tsx
 * const [value, setValue] = useState("");
 *
 * <Select
 *   options={[
 *     { value: "1", label: "옵션 1" },
 *     { value: "2", label: "옵션 2" },
 *   ]}
 *   value={value}
 *   onValueChange={setValue}
 *   placeholder="선택하세요"
 * />
 * ```
 */
export function Select({
  options,
  value,
  onValueChange,
  placeholder = "Select",
  label,
  size,
  variant,
  side = "left",
  disabled = false,
  className,
}: SelectProps) {
  const selectedOption = options.find((opt) => opt.value === value);

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {label && (
        <span className="text-label-2 text-text-secondary">{label}</span>
      )}
      <DropdownMenuPrimitive.Root>
        <DropdownMenuPrimitive.Trigger
          disabled={disabled}
          className={cn(
            dropdownTriggerVariants({ size, variant, disabled }),
            "min-w-120"
          )}
        >
          <span className={cn(!selectedOption && "text-text-tertiary")}>
            {selectedOption?.label || placeholder}
          </span>
          <ChevronDown className="size-16 text-icon-secondary shrink-0" />
        </DropdownMenuPrimitive.Trigger>

        <DropdownMenuPrimitive.Portal>
          <DropdownMenuPrimitive.Content
            align={side === "left" ? "start" : "end"}
            sideOffset={4}
            className="z-50 min-w-[320px] bg-background-0 border border-border-100 rounded-medium shadow-lg p-4 animate-in fade-in-0 zoom-in-95"
          >
            {options.map((option) => (
              <DropdownMenuPrimitive.Item
                key={option.value}
                disabled={option.disabled}
                onSelect={() => onValueChange?.(option.value)}
                className={cn(
                  dropdownItemVariants({
                    state: option.disabled
                      ? "disabled"
                      : value === option.value
                        ? "selected"
                        : "default",
                  }),
                  "hover:bg-background-100 focus:bg-background-100"
                )}
              >
                {option.leadIcon && (
                  <span className="size-16 shrink-0 text-icon-secondary">
                    {option.leadIcon}
                  </span>
                )}
                <div className="flex flex-col flex-1 min-w-0">
                  <span className="text-label-2 truncate">{option.label}</span>
                  {option.caption && (
                    <span className="text-caption-1 text-text-secondary">
                      {option.caption}
                    </span>
                  )}
                </div>
                {value === option.value && (
                  <Check className="size-16 shrink-0 text-icon-primary" />
                )}
              </DropdownMenuPrimitive.Item>
            ))}
          </DropdownMenuPrimitive.Content>
        </DropdownMenuPrimitive.Portal>
      </DropdownMenuPrimitive.Root>
    </div>
  );
}

// ============================================================================
// MultiSelect Component (복수 선택)
// ============================================================================

export interface MultiSelectProps
  extends VariantProps<typeof dropdownTriggerVariants> {
  /** 선택 옵션 목록 */
  options: DropdownOption[];
  /** 현재 선택된 값들 */
  values?: string[];
  /** 값 변경 콜백 */
  onValuesChange?: (values: string[]) => void;
  /** 플레이스홀더 텍스트 */
  placeholder?: string;
  /** 라벨 텍스트 */
  label?: string;
  /** 비활성화 여부 */
  disabled?: boolean;
  /** 추가 클래스 */
  className?: string;
  /** 트리거 정렬 방향 */
  side?: "left" | "right";
}

/**
 * MultiSelect 컴포넌트
 *
 * 여러 값을 선택할 수 있는 드롭다운 선택기입니다.
 * 각 옵션에 체크박스가 표시되며, 선택된 항목 수가 트리거에 표시됩니다.
 *
 * @property {DropdownOption[]} options - 선택 가능한 옵션 목록
 * @property {string[]} values - 현재 선택된 값 배열
 * @property {function} onValuesChange - 값 변경 시 호출되는 콜백
 * @property {string} placeholder - 값이 선택되지 않았을 때 표시되는 텍스트
 * @property {string} label - 드롭다운 상단에 표시되는 라벨
 * @property {"sm" | "md"} size - 트리거 크기
 * @property {"default" | "inline"} variant - 트리거 스타일
 * @property {"left" | "right"} side - 드롭다운 메뉴 정렬 방향
 * @property {boolean} disabled - 비활성화 여부
 *
 * @example
 * ```tsx
 * const [values, setValues] = useState<string[]>([]);
 *
 * <MultiSelect
 *   options={[
 *     { value: "1", label: "옵션 1" },
 *     { value: "2", label: "옵션 2" },
 *   ]}
 *   values={values}
 *   onValuesChange={setValues}
 *   placeholder="선택하세요"
 * />
 * ```
 */
export function MultiSelect({
  options,
  values = [],
  onValuesChange,
  placeholder = "Select",
  label,
  size,
  variant,
  side = "left",
  disabled = false,
  className,
}: MultiSelectProps) {
  const selectedCount = values.length;

  const handleToggle = (optionValue: string) => {
    if (values.includes(optionValue)) {
      onValuesChange?.(values.filter((v) => v !== optionValue));
    } else {
      onValuesChange?.([...values, optionValue]);
    }
  };

  const displayText =
    selectedCount === 0
      ? placeholder
      : selectedCount === 1
        ? options.find((o) => o.value === values[0])?.label
        : `${selectedCount}개 선택됨`;

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {label && (
        <span className="text-label-2 text-text-secondary">{label}</span>
      )}
      <DropdownMenuPrimitive.Root>
        <DropdownMenuPrimitive.Trigger
          disabled={disabled}
          className={cn(
            dropdownTriggerVariants({ size, variant, disabled }),
            "min-w-120"
          )}
        >
          <span className={cn(selectedCount === 0 && "text-text-tertiary")}>
            {displayText}
          </span>
          <ChevronDown className="size-16 text-icon-secondary shrink-0" />
        </DropdownMenuPrimitive.Trigger>

        <DropdownMenuPrimitive.Portal>
          <DropdownMenuPrimitive.Content
            align={side === "left" ? "start" : "end"}
            sideOffset={4}
            className="z-50 min-w-[320px] bg-background-0 border border-border-100 rounded-medium shadow-lg p-4 animate-in fade-in-0 zoom-in-95"
          >
            {options.map((option) => {
              const isSelected = values.includes(option.value);
              return (
                <DropdownMenuPrimitive.CheckboxItem
                  key={option.value}
                  disabled={option.disabled}
                  checked={isSelected}
                  onCheckedChange={() => handleToggle(option.value)}
                  onSelect={(e) => e.preventDefault()} // 메뉴가 닫히지 않도록
                  className={cn(
                    dropdownItemVariants({
                      state: option.disabled ? "disabled" : "default",
                    }),
                    "hover:bg-background-50 focus:bg-background-50"
                  )}
                >
                  <div
                    className={cn(
                      "size-16 shrink-0 rounded-small border flex items-center justify-center transition-colors",
                      isSelected
                        ? "bg-background-inverted border-transparent"
                        : "border-border-200 bg-background-0"
                    )}
                  >
                    {isSelected && <Check className="size-12 text-icon-inverted" />}
                  </div>
                  {option.leadIcon && (
                    <span className="size-16 shrink-0 text-icon-secondary">
                      {option.leadIcon}
                    </span>
                  )}
                  <div className="flex flex-col flex-1 min-w-0">
                    <span className="text-label-2 truncate">{option.label}</span>
                    {option.caption && (
                      <span className="text-caption-1 text-text-secondary">
                        {option.caption}
                      </span>
                    )}
                  </div>
                </DropdownMenuPrimitive.CheckboxItem>
              );
            })}
          </DropdownMenuPrimitive.Content>
        </DropdownMenuPrimitive.Portal>
      </DropdownMenuPrimitive.Root>
    </div>
  );
}

// ============================================================================
// Exports
// ============================================================================

export { dropdownTriggerVariants, dropdownItemVariants };
