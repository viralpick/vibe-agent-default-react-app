import * as React from "react";
import * as CollapsiblePrimitive from "@radix-ui/react-collapsible";
import { cva, type VariantProps } from "class-variance-authority";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/commerce-sdk";

// ============================================================================
// Accordion Context
// ============================================================================

type AccordionType = "single" | "multiple";
type AccordionSize = "md" | "lg";

interface AccordionContextValue {
  type: AccordionType;
  size: AccordionSize;
  openItems: string[];
  toggleItem: (value: string) => void;
}

const AccordionContext = React.createContext<AccordionContextValue | null>(
  null
);

function useAccordionContext() {
  const context = React.useContext(AccordionContext);
  if (!context) {
    throw new Error("Accordion components must be used within an Accordion");
  }
  return context;
}

// ============================================================================
// AccordionItem Context
// ============================================================================

interface AccordionItemContextValue {
  value: string;
  disabled: boolean;
  isOpen: boolean;
  hasLeadIcon: boolean;
  setHasLeadIcon: (value: boolean) => void;
}

const AccordionItemContext =
  React.createContext<AccordionItemContextValue | null>(null);

function useAccordionItemContext() {
  const context = React.useContext(AccordionItemContext);
  if (!context) {
    throw new Error(
      "AccordionItem components must be used within an AccordionItem"
    );
  }
  return context;
}

// ============================================================================
// Accordion Variants (CVA)
// ============================================================================

const accordionItemVariants = cva(
  "bg-background-0 border border-border-100 rounded-large overflow-hidden transition-all",
  {
    variants: {
      size: {
        lg: "",
        md: "",
      },
      disabled: {
        true: "opacity-50 cursor-not-allowed",
        false: "",
      },
    },
    defaultVariants: {
      size: "lg",
      disabled: false,
    },
  }
);

const accordionTriggerVariants = cva(
  "flex w-full items-center justify-between text-left",
  {
    variants: {
      size: {
        lg: "p-16",
        md: "p-12",
      },
      disabled: {
        true: "cursor-not-allowed",
        false: "cursor-pointer hover:bg-background-0-hover",
      },
    },
    defaultVariants: {
      size: "lg",
      disabled: false,
    },
  }
);

const accordionContentVariants = cva(
  "overflow-hidden transition-all data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down",
  {
    variants: {
      size: {
        lg: "",
        md: "",
      },
    },
    defaultVariants: {
      size: "lg",
    },
  }
);

// ============================================================================
// Accordion Root
// ============================================================================

/**
 * Accordion 컴포넌트 Props
 *
 * @property {"single" | "multiple"} type - 아코디언 타입
 *   - `"single"`: 한 번에 하나의 아이템만 열림 (기본값)
 *   - `"multiple"`: 여러 아이템을 동시에 열 수 있음
 *
 * @property {"md" | "lg"} size - 아코디언 크기
 *   - `"lg"`: 큰 크기 (padding: 16px, 기본값)
 *   - `"md"`: 중간 크기 (padding: 12px)
 *
 * @property {string | string[]} defaultValue - 초기에 열릴 아이템 (비제어 컴포넌트)
 * @property {string | string[]} value - 현재 열린 아이템 (제어 컴포넌트)
 * @property {function} onValueChange - 열린 아이템이 변경될 때 호출되는 콜백
 *
 * @example
 * ```tsx
 * // 단일 선택 아코디언 (비제어)
 * <Accordion type="single" defaultValue="item-1">
 *   <AccordionItem value="item-1">
 *     <AccordionTrigger title="제목 1" />
 *     <AccordionContent>내용 1</AccordionContent>
 *   </AccordionItem>
 *   <AccordionItem value="item-2">
 *     <AccordionTrigger title="제목 2" description="설명" />
 *     <AccordionContent>내용 2</AccordionContent>
 *   </AccordionItem>
 * </Accordion>
 *
 * // 다중 선택 아코디언 (제어)
 * const [openItems, setOpenItems] = useState(["item-1"]);
 * <Accordion type="multiple" value={openItems} onValueChange={setOpenItems}>
 *   <AccordionItem value="item-1">
 *     <AccordionTrigger leadIcon={<Icon />} title="제목 1" />
 *     <AccordionContent>내용 1</AccordionContent>
 *   </AccordionItem>
 * </Accordion>
 * ```
 */
export interface AccordionProps extends React.HTMLAttributes<HTMLDivElement> {
  type?: AccordionType;
  size?: AccordionSize;
  defaultValue?: string | string[];
  value?: string | string[];
  onValueChange?: (value: string | string[]) => void;
}

/**
 * 접고 펼칠 수 있는 콘텐츠를 그룹으로 관리하는 Accordion 컴포넌트
 *
 * 단일 선택 모드와 다중 선택 모드를 지원
 *
 * **하위 컴포넌트:**
 * - `AccordionItem`: 개별 아코디언 아이템
 * - `AccordionTrigger`: 클릭하여 열고 닫는 트리거 영역
 * - `AccordionContent`: 접히고 펼쳐지는 콘텐츠 영역
 */
function Accordion({
  type = "single",
  size = "lg",
  defaultValue,
  value: controlledValue,
  onValueChange,
  className,
  children,
  ...props
}: AccordionProps) {
  const [uncontrolledValue, setUncontrolledValue] = React.useState<string[]>(
    () => {
      if (defaultValue) {
        return Array.isArray(defaultValue) ? defaultValue : [defaultValue];
      }
      return [];
    }
  );

  const isControlled = controlledValue !== undefined;
  const openItems = React.useMemo(() => {
    if (isControlled) {
      return Array.isArray(controlledValue)
        ? controlledValue
        : [controlledValue];
    }
    return uncontrolledValue;
  }, [isControlled, controlledValue, uncontrolledValue]);

  const toggleItem = React.useCallback(
    (itemValue: string) => {
      let newValue: string[];

      if (type === "single") {
        newValue = openItems.includes(itemValue) ? [] : [itemValue];
      } else {
        newValue = openItems.includes(itemValue)
          ? openItems.filter((v) => v !== itemValue)
          : [...openItems, itemValue];
      }

      if (!isControlled) {
        setUncontrolledValue(newValue);
      }

      onValueChange?.(type === "single" ? newValue[0] ?? "" : newValue);
    },
    [type, openItems, isControlled, onValueChange]
  );

  const contextValue = React.useMemo(
    () => ({ type, size, openItems, toggleItem }),
    [type, size, openItems, toggleItem]
  );

  return (
    <AccordionContext.Provider value={contextValue}>
      <div
        data-slot="accordion"
        className={cn("flex flex-col gap-8", className)}
        {...props}
      >
        {children}
      </div>
    </AccordionContext.Provider>
  );
}

// ============================================================================
// AccordionItem
// ============================================================================

/**
 * AccordionItem 컴포넌트 Props
 *
 * @property {string} value - 아이템의 고유 식별자 (필수)
 * @property {boolean} disabled - 비활성화 여부
 */
export interface AccordionItemProps
  extends React.HTMLAttributes<HTMLDivElement>,
    Omit<VariantProps<typeof accordionItemVariants>, "size"> {
  value: string;
  disabled?: boolean;
}

/**
 * Accordion의 개별 아이템 컴포넌트
 *
 * 각 아이템은 고유한 value를 가지며, 이를 통해 열림/닫힘 상태가 관리됩니다.
 */
function AccordionItem({
  value,
  disabled = false,
  className,
  children,
  ...props
}: AccordionItemProps) {
  const { size, openItems, toggleItem } = useAccordionContext();
  const isOpen = openItems.includes(value);
  const [hasLeadIcon, setHasLeadIcon] = React.useState(false);

  const itemContextValue = React.useMemo(
    () => ({ value, disabled, isOpen, hasLeadIcon, setHasLeadIcon }),
    [value, disabled, isOpen, hasLeadIcon]
  );

  return (
    <AccordionItemContext.Provider value={itemContextValue}>
      <CollapsiblePrimitive.Root
        open={isOpen}
        onOpenChange={() => !disabled && toggleItem(value)}
        disabled={disabled}
      >
        <div
          data-slot="accordion-item"
          data-state={isOpen ? "open" : "closed"}
          className={cn(accordionItemVariants({ size, disabled }), className)}
          {...props}
        >
          {children}
        </div>
      </CollapsiblePrimitive.Root>
    </AccordionItemContext.Provider>
  );
}

// ============================================================================
// AccordionTrigger
// ============================================================================

/**
 * AccordionTrigger 컴포넌트 Props
 *
 * @property {ReactNode} leadIcon - 제목 앞에 표시되는 아이콘 (선택)
 * @property {string} title - 아코디언 제목 (필수)
 * @property {string} description - 제목 아래에 표시되는 설명 (선택)
 * @property {ReactNode} icon - 설명 앞에 표시되는 작은 아이콘 (선택)
 */
export interface AccordionTriggerProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "disabled"> {
  leadIcon?: React.ReactNode;
  title: string;
  description?: string;
  icon?: React.ReactNode;
}

/**
 * 아코디언을 열고 닫는 트리거 버튼 컴포넌트
 *
 * 제목과 선택적으로 설명, 아이콘을 표시하며,
 * 오른쪽에 자동으로 ChevronDown 아이콘이 추가됩니다.
 */
function AccordionTrigger({
  leadIcon,
  title,
  description,
  icon,
  className,
  ...props
}: AccordionTriggerProps) {
  const { size } = useAccordionContext();
  const { disabled, isOpen, setHasLeadIcon } = useAccordionItemContext();

  React.useLayoutEffect(() => {
    setHasLeadIcon(!!leadIcon);
  }, [leadIcon, setHasLeadIcon]);

  return (
    <CollapsiblePrimitive.Trigger asChild>
      <button
        data-slot="accordion-trigger"
        type="button"
        className={cn(accordionTriggerVariants({ size, disabled }), className)}
        disabled={disabled}
        {...props}
      >
        <div className="flex flex-col flex-1 min-w-0 gap-2">
          <div className="flex items-center gap-8">
            {leadIcon && (
              <span
                className={cn(
                  "shrink-0 text-icon-primary",
                  size === "lg" ? "[&>svg]:size-5" : "[&>svg]:size-4"
                )}
              >
                {leadIcon}
              </span>
            )}
            <span className="flex-1 text-t2 font-medium text-text-primary truncate">
              {title}
            </span>
            <ChevronDown
              className={cn(
                "shrink-0 text-icon-secondary transition-transform duration-200",
                size === "lg" ? "size-5" : "size-4",
                isOpen && "rotate-180"
              )}
            />
          </div>
          {/* 두 번째 줄: description */}
          {description && (
            <div
              className={cn(
                "flex items-center gap-4 text-body-s text-text-secondary",
                leadIcon && (size === "lg" ? "pl-7" : "pl-6")
              )}
            >
              {icon && (
                <span className="shrink-0 [&>svg]:size-3">{icon}</span>
              )}
              <span className="truncate">{description}</span>
            </div>
          )}
        </div>
      </button>
    </CollapsiblePrimitive.Trigger>
  );
}

// ============================================================================
// AccordionContent
// ============================================================================

/**
 * AccordionContent 컴포넌트 Props
 *
 * 추가 속성 없이 기본 HTMLDivElement 속성을 지원합니다.
 */
export interface AccordionContentProps
  extends React.HTMLAttributes<HTMLDivElement>,
    Omit<VariantProps<typeof accordionContentVariants>, "size"> {}

/**
 * 아코디언이 열렸을 때 표시되는 콘텐츠 영역 컴포넌트
 *
 * leadIcon 존재 여부에 따라 자동으로 padding이 조정되어
 * 트리거와 콘텐츠가 시각적으로 정렬됩니다.
 */
function AccordionContent({
  className,
  children,
  ...props
}: AccordionContentProps) {
  const { size } = useAccordionContext();
  const { hasLeadIcon } = useAccordionItemContext();

  // leadIcon이 있으면: padding + icon + gap
  // lg: 16 + 20 + 8 = 44px, md: 12 + 16 + 8 = 36px
  // leadIcon이 없으면: 기본 padding만
  const contentPadding = hasLeadIcon
    ? size === "lg"
      ? "p-16 pl-[44px] pt-12"
      : "p-12 pl-[36px]"
    : size === "lg"
      ? "p-16 pt-12"
      : "p-12";

  return (
    <CollapsiblePrimitive.Content
      data-slot="accordion-content"
      className={cn(accordionContentVariants({ size }), className)}
      {...props}
    >
      <div className={cn(contentPadding, "border-t border-border-100")}>
        {children}
      </div>
    </CollapsiblePrimitive.Content>
  );
}

// ============================================================================
// Exports
// ============================================================================

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent };
