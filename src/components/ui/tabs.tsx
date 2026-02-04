/**
 * @component Tabs
 * @description Tab-based content switcher. Built on Radix UI Tabs.
 * Composed of Tabs, TabsList, TabsTrigger, TabsContent.
 *
 * @useCase Section navigation, view switching, settings panels
 */
import * as React from "react";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/commerce-sdk";

/**
 * Tabs Variants (CVA)
 */
const tabsListVariants = cva("inline-flex items-center", {
  variants: {
    variant: {
      segmented: "gap-0.5 p-1 bg-background-100 rounded-large",
      fill: "gap-0.5 p-1",
      line: "gap-0.5 p-1",
    },
    size: {
      sm: "",
      md: "",
    },
  },
  defaultVariants: {
    variant: "segmented",
    size: "md",
  },
});

const tabsTriggerVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-brand disabled:pointer-events-none disabled:opacity-50 text-label-2",
  {
    variants: {
      variant: {
        segmented:
          "rounded-medium data-[state=active]:bg-background-0 data-[state=active]:shadow-sm",
        fill: "rounded-medium data-[state=active]:bg-background-100",
        line: "border-b-2 border-transparent data-[state=active]:border-border-900",
      },
      size: {
        sm: "h-8 px-2 py-0.5",
        md: "h-8 px-3 py-1",
        lg: "h-10 px-3 py-2",
      },
    },
    defaultVariants: {
      variant: "segmented",
      size: "md",
    },
  }
);

/**
 * Tabs Context
 */
interface TabsContextValue {
  value: string;
  onValueChange: (value: string) => void;
  variant: "segmented" | "fill" | "line";
  size: "sm" | "md";
}

const TabsContext = React.createContext<TabsContextValue | null>(null);

function useTabsContext() {
  const context = React.useContext(TabsContext);
  if (!context) {
    throw new Error("Tabs 컴포넌트는 Tabs 컴포넌트 내부에서 사용되어야 합니다");
  }
  return context;
}

/**
 * Tabs Root Component Props
 *
 * @property {string} value - 현재 활성화된 탭의 값 (제어 컴포넌트)
 * @property {string} defaultValue - 초기 활성화된 탭의 값 (비제어 컴포넌트)
 * @property {function} onValueChange - 탭 변경 콜백
 * @property {"segmented" | "fill" | "line"} variant - 탭 스타일 변형
 * @property {"sm" | "md"} size - 크기
 */
export interface TabsProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  variant?: "segmented" | "fill" | "line";
  size?: "sm" | "md";
}

/**
 * 콘텐츠를 여러 탭으로 나누어 표시하는 탭 컴포넌트
 *
 * 사용자가 탭을 클릭하여 서로 다른 콘텐츠를 전환할 수 있습니다.
 *
 * **Variants:**
 * - `segmented`: 배경이 있는 세그먼트 스타일 (기본값)
 * - `fill`: 하단 테두리가 있고 활성 탭에 배경이 있는 스타일
 * - `line`: 하단 테두리만 있는 심플한 스타일
 *
 * @example
 * ```tsx
 * <Tabs defaultValue="tab1" variant="segmented">
 *   <TabsList>
 *     <TabsTrigger value="tab1">Tab 1</TabsTrigger>
 *     <TabsTrigger value="tab2">Tab 2</TabsTrigger>
 *   </TabsList>
 *   <TabsContent value="tab1">Content 1</TabsContent>
 *   <TabsContent value="tab2">Content 2</TabsContent>
 * </Tabs>
 * ```
 */
export const Tabs = React.forwardRef<HTMLDivElement, TabsProps>(
  (
    {
      value: controlledValue,
      defaultValue,
      onValueChange: onValueChangeProp,
      variant = "segmented",
      size = "md",
      className,
      children,
      ...props
    },
    ref
  ) => {
    const [uncontrolledValue, setUncontrolledValue] = React.useState(
      defaultValue ?? ""
    );

    const isControlled = controlledValue !== undefined;
    const value = isControlled ? controlledValue : uncontrolledValue;

    const onValueChange = React.useCallback(
      (newValue: string) => {
        if (!isControlled) {
          setUncontrolledValue(newValue);
        }
        onValueChangeProp?.(newValue);
      },
      [isControlled, onValueChangeProp]
    );

    const contextValue = React.useMemo(
      () => ({ value, onValueChange, variant, size }),
      [value, onValueChange, variant, size]
    );

    return (
      <TabsContext.Provider value={contextValue}>
        <div ref={ref} className={cn("w-full", className)} {...props}>
          {children}
        </div>
      </TabsContext.Provider>
    );
  }
);

Tabs.displayName = "Tabs";

/**
 * TabsList Component Props
 *
 * @property {React.ReactNode} children - 탭 트리거들
 */
export interface TabsListProps extends React.HTMLAttributes<HTMLDivElement> {}

/**
 * 탭 트리거들을 감싸는 컨테이너 컴포넌트
 *
 * 탭들을 가로로 나열하고 스타일을 적용합니다.
 */
export const TabsList = React.forwardRef<HTMLDivElement, TabsListProps>(
  ({ className, children, ...props }, ref) => {
    const { variant, size } = useTabsContext();

    return (
      <div
        ref={ref}
        role="tablist"
        className={cn(tabsListVariants({ variant, size }), className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);

TabsList.displayName = "TabsList";

/**
 * TabsTrigger Component Props
 *
 * @property {string} value - 탭의 고유 값
 * @property {React.ReactNode} children - 탭 레이블
 */
export interface TabsTriggerProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
}

/**
 * 개별 탭 버튼 컴포넌트
 *
 * 클릭 시 해당 탭의 콘텐츠를 표시합니다.
 */
export const TabsTrigger = React.forwardRef<
  HTMLButtonElement,
  TabsTriggerProps
>(({ value: tabValue, className, children, ...props }, ref) => {
  const { value, onValueChange, variant, size } = useTabsContext();
  const isActive = value === tabValue;

  return (
    <button
      ref={ref}
      role="tab"
      type="button"
      aria-selected={isActive}
      data-state={isActive ? "active" : "inactive"}
      onClick={() => onValueChange(tabValue)}
      className={cn(tabsTriggerVariants({ variant, size }), className)}
      {...props}
    >
      {children}
    </button>
  );
});

TabsTrigger.displayName = "TabsTrigger";

/**
 * TabsContent Component Props
 *
 * @property {string} value - 이 콘텐츠와 연결된 탭의 값
 * @property {React.ReactNode} children - 탭 콘텐츠
 */
export interface TabsContentProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
}

/**
 * 탭 콘텐츠 컴포넌트
 *
 * 연결된 탭이 활성화되면 표시됩니다.
 */
export const TabsContent = React.forwardRef<HTMLDivElement, TabsContentProps>(
  ({ value: tabValue, className, children, ...props }, ref) => {
    const { value } = useTabsContext();
    const isActive = value === tabValue;

    if (!isActive) return null;

    return (
      <div
        ref={ref}
        role="tabpanel"
        data-state={isActive ? "active" : "inactive"}
        className={cn("mt-2", className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);

TabsContent.displayName = "TabsContent";
