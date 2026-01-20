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

export interface AccordionProps extends React.HTMLAttributes<HTMLDivElement> {
  type?: AccordionType;
  size?: AccordionSize;
  defaultValue?: string | string[];
  value?: string | string[];
  onValueChange?: (value: string | string[]) => void;
}

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

export interface AccordionItemProps
  extends React.HTMLAttributes<HTMLDivElement>,
    Omit<VariantProps<typeof accordionItemVariants>, "size"> {
  value: string;
  disabled?: boolean;
}

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

export interface AccordionTriggerProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "disabled"> {
  leadIcon?: React.ReactNode;
  title: string;
  description?: string;
  icon?: React.ReactNode;
}

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
                  size === "lg" ? "[&>svg]:size-20" : "[&>svg]:size-16"
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
                size === "lg" ? "size-20" : "size-16",
                isOpen && "rotate-180"
              )}
            />
          </div>
          {/* 두 번째 줄: description */}
          {description && (
            <div
              className={cn(
                "flex items-center gap-4 text-body-s text-text-secondary",
                leadIcon && (size === "lg" ? "pl-28" : "pl-24")
              )}
            >
              {icon && (
                <span className="shrink-0 [&>svg]:size-12">{icon}</span>
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

export interface AccordionContentProps
  extends React.HTMLAttributes<HTMLDivElement>,
    Omit<VariantProps<typeof accordionContentVariants>, "size"> {}

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
