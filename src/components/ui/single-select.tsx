"use client";

/**
 * @fileoverview Single-select dropdown component with search functionality.
 *
 * @module ui/single-select
 */

import React from "react";
import { ChevronDown, Check } from "lucide-react";

import { cn } from "@/lib/commerce-sdk";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

/**
 * Option item for SingleSelect
 */
type Option = {
  label: string;
  value: string;
  className?: string;
};

/**
 * @component SingleSelect
 * @description A searchable single-select dropdown built on Command and Popover.
 * Supports controlled/uncontrolled modes, virtualized scrolling for large lists,
 * and optional "None" selection.
 *
 * @dataStructure
 * - options: Option[] - Array of selectable options (required)
 *   - label: string - Display text
 *   - value: string - Option value
 *   - className?: string - Custom styling
 * - value?: string | null - Selected value (controlled mode)
 * - defaultValue?: string - Initial value (uncontrolled mode)
 * - onChange?: (value: string | null) => void - Selection change handler
 * - showNoneItem?: boolean - Show "None" option to clear selection
 * - showSearch?: boolean - Enable search input (default: true)
 * - placeholder?: string - Placeholder text
 * - searchPlaceholder?: string - Search input placeholder
 * - emptyLabel?: string - Text when no results found
 * - disabled?: boolean - Disable the select
 * - readOnly?: boolean - Make read-only
 *
 * @designTokens
 * - Uses min-w-48 for minimum width
 * - Uses text-xs for option text
 * - Uses size-4 for icons
 *
 * @useCase
 * - Filter dropdowns
 * - Form field selections
 * - Category/status selectors
 * - Any single-choice selection with search
 *
 * @example
 * ```tsx
 * <SingleSelect
 *   options={[
 *     { label: "Option 1", value: "1" },
 *     { label: "Option 2", value: "2" },
 *   ]}
 *   value={selected}
 *   onChange={setSelected}
 *   placeholder="Select an option"
 *   showSearch
 * />
 * ```
 */
function SingleSelect({
  options,
  value,
  defaultValue,
  onChange,
  onClose,
  readOnly,
  disabled,
  showNoneItem,
  noneLabel = "None",
  placeholder = "Select",
  searchPlaceholder = "Search",
  emptyLabel = "No results",
  className,
  iconClassName,
  showSearch = true,
  ...props
}: Omit<React.ComponentProps<"button">, "value" | "onChange"> & {
  options: Option[];
  value?: string | null;
  defaultValue?: string;
  onChange?: (value: string | null) => void;
  onClose?: (value: string) => void;
  readOnly?: boolean;
  disabled?: boolean;
  showNoneItem?: boolean;
  noneLabel?: string;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyLabel?: string;
  iconClassName?: string;
  showSearch?: boolean;
}): React.JSX.Element {
  const isControlled = value !== undefined;
  const [internalValue, setInternalValue] = React.useState<string>(
    defaultValue || ""
  );
  const selectedValue = isControlled ? value! : internalValue;
  const [isOpen, setIsOpen] = React.useState(false);
  const [visibleCount, setVisibleCount] = React.useState(200);
  const listRef = React.useRef<HTMLDivElement>(null);

  const handleSelect = (val: string | null) => {
    if (!isControlled) {
      setInternalValue(val || "");
    }
    onChange?.(val);
    setIsOpen(false);
  };

  const selectedLabel = React.useMemo(() => {
    return options.find((o) => o.value === selectedValue)?.label || placeholder;
  }, [selectedValue, options, placeholder]);

  const pagedOptions = React.useMemo(
    () => options.slice(0, visibleCount),
    [options, visibleCount]
  );

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollTop + clientHeight >= scrollHeight - 10) {
      setVisibleCount((prev) => Math.min(prev + 200, options.length));
    }
  };

  return (
    <Popover
      open={isOpen}
      onOpenChange={(open) => {
        if (readOnly || disabled) return;
        setIsOpen(open);
        if (!open) onClose?.(selectedValue);
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            if (readOnly || disabled) return;
            setIsOpen((prev) => !prev);
            setVisibleCount(200);
          }}
          className={cn("min-w-48", className)}
          disabled={readOnly || disabled}
          {...props}
        >
          <span
            className={cn(
              "overflow-hidden text-ellipsis",
              !selectedValue ? "text-muted-foreground" : "text-primary"
            )}
          >
            {selectedLabel}
          </span>
          <ChevronDown
            className={cn("ml-auto size-4 opacity-50", iconClassName)}
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        forceMount
        align="start"
        className="w-(--radix-popper-anchor-width) p-0"
        onEscapeKeyDown={() => setIsOpen(false)}
      >
        <Command>
          {showSearch && (
            <CommandInput
              placeholder={searchPlaceholder}
              className="text-xs"
              disabled={disabled}
            />
          )}
          <CommandEmpty>{emptyLabel}</CommandEmpty>
          <CommandList
            ref={listRef}
            className="max-h-[300px] overflow-y-auto relative"
            onScroll={handleScroll}
          >
            <CommandGroup>
              {showNoneItem && (
                <CommandItem
                  value="none"
                  onSelect={() => handleSelect(null)}
                  className="cursor-pointer text-xs [&_svg]:size-3 pr-2.5"
                >
                  {noneLabel}
                  <div className="ml-auto flex items-center justify-center self-start pt-0.5">
                    <Check
                      className={cn(
                        "ml-auto",
                        !selectedValue ? "opacity-100" : "opacity-0"
                      )}
                    />
                  </div>
                </CommandItem>
              )}
              {pagedOptions.map((option) => (
                <CommandItem
                  key={option.value}
                  onSelect={() => handleSelect(option.value)}
                  className={cn(
                    "cursor-pointer text-xs [&_svg]:size-3 pr-2.5",
                    option.className
                  )}
                >
                  {option.label}
                  <div className="ml-auto flex items-center justify-center self-start pt-0.5">
                    <Check
                      className={cn(
                        "ml-auto",
                        selectedValue === option.value
                          ? "opacity-100"
                          : "opacity-0"
                      )}
                    />
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export { SingleSelect };
