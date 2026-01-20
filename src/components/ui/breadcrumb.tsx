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
        chevron: "[&>svg]:size-16",
        slash: "text-label-2 font-medium",
      },
    },
    defaultVariants: {
      type: "chevron",
    },
  }
);

// Breadcrumb Container Props
export interface BreadcrumbProps extends React.HTMLAttributes<HTMLElement> {
  divider?: DividerType;
}

// Breadcrumb Item Props
export interface BreadcrumbItemProps
  extends React.HTMLAttributes<HTMLElement>,
    VariantProps<typeof breadcrumbItemVariants> {
  icon?: React.ReactNode;
  href?: string;
  isLast?: boolean;
}

// Breadcrumb Divider Props
export interface BreadcrumbDividerProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof breadcrumbDividerVariants> {}

// Breadcrumb Container Component
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

// Breadcrumb Item Component
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
      {icon && <span className="shrink-0 [&>svg]:size-16">{icon}</span>}
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

// Breadcrumb Divider Component
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
