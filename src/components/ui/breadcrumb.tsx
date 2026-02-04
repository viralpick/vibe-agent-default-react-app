import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/commerce-sdk";
import { ChevronRight } from "lucide-react";

// Context for sharing divider type across components
type DividerType = "chevron" | "slash";

interface BreadcrumbContextValue {
  divider: DividerType;
}

const BreadcrumbContext = React.createContext<BreadcrumbContextValue>({
  divider: "chevron",
});

// Breadcrumb Item Variants
const breadcrumbItemVariants = cva(
  "inline-flex items-center gap-8 text-label-2 font-medium transition-colors",
  {
    variants: {
      isLast: {
        true: "text-text-primary cursor-default",
        false: "text-text-secondary hover:text-text-primary cursor-pointer",
      },
    },
    defaultVariants: {
      isLast: false,
    },
  }
);

// Breadcrumb Divider Variants
const breadcrumbDividerVariants = cva(
  "inline-flex items-center justify-center text-text-secondary shrink-0",
  {
    variants: {
      type: {
        chevron: "[&>svg]:size-4",
        slash: "text-label-2 font-medium",
      },
    },
    defaultVariants: {
      type: "chevron",
    },
  }
);

/**
 * Breadcrumb 컴포넌트 Props
 *
 * @property {"chevron" | "slash"} divider - 구분자 타입
 *   - `"chevron"`: ChevronRight 아이콘 (기본값)
 *   - `"slash"`: "/" 문자
 *
 * @example
 * ```tsx
 * // 기본 Breadcrumb (chevron 구분자)
 * <Breadcrumb>
 *   <BreadcrumbItem href="/">Home</BreadcrumbItem>
 *   <BreadcrumbItem href="/products">Products</BreadcrumbItem>
 *   <BreadcrumbItem>Detail</BreadcrumbItem>
 * </Breadcrumb>
 *
 * // 슬래시 구분자 사용
 * <Breadcrumb divider="slash">
 *   <BreadcrumbItem icon={<HomeIcon />} href="/">Home</BreadcrumbItem>
 *   <BreadcrumbItem>Current</BreadcrumbItem>
 * </Breadcrumb>
 *
 * // 클릭 이벤트 처리
 * <Breadcrumb>
 *   <BreadcrumbItem onClick={() => navigate('/')}>Home</BreadcrumbItem>
 *   <BreadcrumbItem>Current</BreadcrumbItem>
 * </Breadcrumb>
 * ```
 */
export interface BreadcrumbProps extends React.HTMLAttributes<HTMLElement> {
  divider?: DividerType;
}

/**
 * BreadcrumbItem 컴포넌트 Props
 *
 * @property {ReactNode} icon - 텍스트 앞에 표시되는 아이콘
 * @property {string} href - 링크 URL (제공시 <a> 태그로 렌더링)
 * @property {boolean} isLast - 마지막 아이템 여부 (자동 설정됨)
 */
export interface BreadcrumbItemProps
  extends React.HTMLAttributes<HTMLElement>,
    VariantProps<typeof breadcrumbItemVariants> {
  icon?: React.ReactNode;
  href?: string;
  isLast?: boolean;
}

/**
 * BreadcrumbDivider 컴포넌트 Props
 *
 * 일반적으로 직접 사용하지 않고 Breadcrumb이 자동으로 추가합니다.
 */
export interface BreadcrumbDividerProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof breadcrumbDividerVariants> {}

/**
 * 페이지 계층 구조를 표시하는 Breadcrumb 컴포넌트
 *
 * 사용자의 현재 위치를 보여주고 상위 페이지로 쉽게 이동할 수 있게 합니다.
 * 마지막 아이템은 자동으로 비활성 상태로 표시되며, 구분자는 자동으로 추가됩니다.
 *
 * **하위 컴포넌트:**
 * - `BreadcrumbItem`: 개별 breadcrumb 아이템
 * - `BreadcrumbDivider`: 아이템 간 구분자 (자동 추가)
 */
function Breadcrumb({
  className,
  divider = "chevron",
  children,
  ...props
}: BreadcrumbProps) {
  const childArray = React.Children.toArray(children);
  const itemCount = childArray.length;

  return (
    <BreadcrumbContext.Provider value={{ divider }}>
      <nav
        data-slot="breadcrumb"
        aria-label="Breadcrumb"
        className={cn("inline-flex items-center", className)}
        {...props}
      >
        <ol className="inline-flex items-center gap-8">
          {childArray.map((child, index) => {
            const isLast = index === itemCount - 1;

            return (
              <li key={index} className="inline-flex items-center gap-8">
                {React.isValidElement<BreadcrumbItemProps>(child)
                  ? React.cloneElement(child, { isLast })
                  : child}
                {!isLast && <BreadcrumbDivider />}
              </li>
            );
          })}
        </ol>
      </nav>
    </BreadcrumbContext.Provider>
  );
}

/**
 * Breadcrumb의 개별 아이템 컴포넌트
 *
 * href 제공 시 링크로, onClick 제공 시 버튼으로,
 * 마지막 아이템이거나 둘 다 없으면 span으로 렌더링됩니다.
 */
function BreadcrumbItem({
  className,
  icon,
  href,
  isLast = false,
  onClick,
  children,
  ...props
}: BreadcrumbItemProps) {
  const commonProps = {
    "data-slot": "breadcrumb-item",
    className: cn(breadcrumbItemVariants({ isLast }), className),
    ...props,
  };

  const content = (
    <>
      {icon && <span className="shrink-0 [&>svg]:size-4">{icon}</span>}
      <span>{children}</span>
    </>
  );

  // Render as link if href is provided and not the last item
  if (href && !isLast) {
    return (
      <a href={href} {...commonProps}>
        {content}
      </a>
    );
  }

  // Render as button if onClick is provided and not the last item
  if (onClick && !isLast) {
    return (
      <button type="button" onClick={onClick} {...commonProps}>
        {content}
      </button>
    );
  }

  // Render as span for the last item or when no interaction is needed
  return <span {...commonProps}>{content}</span>;
}

/**
 * Breadcrumb 아이템 간 구분자 컴포넌트
 *
 * Breadcrumb 컴포넌트가 자동으로 추가하므로 직접 사용할 필요가 없습니다.
 */
function BreadcrumbDivider({ className, ...props }: BreadcrumbDividerProps) {
  const { divider } = React.useContext(BreadcrumbContext);

  return (
    <span
      data-slot="breadcrumb-divider"
      aria-hidden="true"
      className={cn(breadcrumbDividerVariants({ type: divider }), className)}
      {...props}
    >
      {divider === "chevron" ? <ChevronRight /> : "/"}
    </span>
  );
}

export { Breadcrumb, BreadcrumbItem, BreadcrumbDivider };
