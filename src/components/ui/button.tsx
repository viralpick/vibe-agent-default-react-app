import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/commerce-sdk";

const buttonVariants = cva(
  "inline-flex items-center justify-center font-medium whitespace-nowrap shrink-0 transition-all cursor-pointer disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
  {
    variants: {
      buttonStyle: {
        primary: "",
        secondary: "border",
        tertiary: "",
        ghost: "bg-transparent",
      },
      size: {
        lg: "",
        md: "",
        sm: "",
        xs: "",
      },
      target: {
        default: "",
        destructive: "",
        brand: "",
      },
      buttonType: {
        default: "rounded-medium",
        icon: "rounded-medium",
      },
    },
    compoundVariants: [
      // ============================================
      // Default target
      // ============================================
      // Default + Primary
      {
        target: "default",
        buttonStyle: "primary",
        className:
          "bg-button-primary text-text-inverted [&_svg]:text-icon-inverted hover:bg-button-primary-hover disabled:bg-button-primary-disabled disabled:text-text-inverted-disabled disabled:[&_svg]:text-icon-inverted-disabled focus-visible:ring-gray-900",
      },
      // Default + Secondary
      {
        target: "default",
        buttonStyle: "secondary",
        className:
          "bg-button-secondary border-border-200 text-text-primary [&_svg]:text-icon-secondary hover:bg-button-secondary-hover hover:border-border-200-hover disabled:bg-button-secondary-disabled disabled:text-text-primary-disabled disabled:[&_svg]:text-icon-secondary-disabled disabled:border-gray-200 focus-visible:ring-gray-900",
      },
      // Default + Tertiary
      {
        target: "default",
        buttonStyle: "tertiary",
        className:
          "bg-button-tertiary text-text-primary [&_svg]:text-icon-secondary hover:bg-button-tertiary-hover disabled:bg-button-tertiary-disabled disabled:text-text-primary-disabled disabled:[&_svg]:text-icon-secondary-disabled focus-visible:ring-gray-900",
      },
      // Default + Ghost
      {
        target: "default",
        buttonStyle: "ghost",
        className:
          "bg-button-ghost text-text-primary [&_svg]:text-icon-secondary enabled:hover:bg-button-ghost-hover disabled:bg-button-ghost-disabled disabled:text-text-primary-disabled disabled:[&_svg]:text-icon-secondary-disabled focus-visible:ring-gray-900",
      },

      // ============================================
      // Destructive target
      // ============================================
      // Destructive + Primary
      {
        target: "destructive",
        buttonStyle: "primary",
        className:
          "bg-button-destructive text-text-inverted [&_svg]:text-icon-inverted hover:bg-button-destructive-hover disabled:bg-button-destructive-disabled disabled:text-text-inverted-disabled disabled:[&_svg]:text-icon-inverted-disabled focus-visible:ring-red-500",
      },
      // Destructive + Secondary
      {
        target: "destructive",
        buttonStyle: "secondary",
        className:
          "bg-button-secondary border-border-error text-text-error [&_svg]:text-icon-error hover:bg-button-secondary-hover hover:border-border-error-hover disabled:bg-button-secondary-disabled disabled:text-red-200 disabled:[&_svg]:text-red-200 disabled:border-red-200 focus-visible:ring-red-500",
      },
      // Destructive + Tertiary
      {
        target: "destructive",
        buttonStyle: "tertiary",
        className:
          "bg-red-50 text-text-error [&_svg]:text-icon-error hover:bg-red-100 disabled:bg-red-50 disabled:text-red-200 disabled:[&_svg]:text-red-200 focus-visible:ring-red-500",
      },
      // Destructive + Ghost
      {
        target: "destructive",
        buttonStyle: "ghost",
        className:
          "bg-button-ghost text-text-error [&_svg]:text-icon-error enabled:hover:bg-red-50 disabled:bg-button-ghost-disabled disabled:text-red-200 disabled:[&_svg]:text-red-200 focus-visible:ring-red-500",
      },

      // ============================================
      // Brand target
      // ============================================
      // Brand + Primary
      {
        target: "brand",
        buttonStyle: "primary",
        className:
          "bg-button-brand text-text-inverted [&_svg]:text-icon-inverted hover:bg-button-brand-hover disabled:bg-button-brand-disabled disabled:text-text-inverted-disabled disabled:[&_svg]:text-icon-inverted-disabled focus-visible:ring-blue-500",
      },
      // Brand + Secondary
      {
        target: "brand",
        buttonStyle: "secondary",
        className:
          "bg-button-secondary border-border-brand text-text-brand [&_svg]:text-icon-brand hover:bg-button-secondary-hover hover:border-border-brand-hover disabled:bg-button-secondary-disabled disabled:text-blue-200 disabled:[&_svg]:text-blue-200 disabled:border-blue-200 focus-visible:ring-blue-500",
      },
      // Brand + Tertiary
      {
        target: "brand",
        buttonStyle: "tertiary",
        className:
          "bg-blue-50 text-text-brand [&_svg]:text-icon-brand hover:bg-blue-100 disabled:bg-blue-50 disabled:text-blue-200 disabled:[&_svg]:text-blue-200 focus-visible:ring-blue-500",
      },
      // Brand + Ghost
      {
        target: "brand",
        buttonStyle: "ghost",
        className:
          "bg-button-ghost text-text-brand [&_svg]:text-icon-brand enabled:hover:bg-blue-50 disabled:bg-button-ghost-disabled disabled:text-blue-200 disabled:[&_svg]:text-blue-200 focus-visible:ring-blue-500",
      },

      // ============================================
      // Size variants for default type (text buttons)
      // ============================================
      {
        buttonType: "default",
        size: "lg",
        className: "h-48 px-16 py-12 gap-8 text-label-1 [&_svg]:size-20",
      },
      {
        buttonType: "default",
        size: "md",
        className: "h-40 px-12 py-10 gap-6 text-label-2 [&_svg]:size-20",
      },
      {
        buttonType: "default",
        size: "sm",
        className: "h-32 px-8 py-6 gap-4 text-label-3 [&_svg]:size-16",
      },
      {
        buttonType: "default",
        size: "xs",
        className: "h-24 px-4 py-4 gap-4 text-label-4 [&_svg]:size-16",
      },

      // ============================================
      // Size variants for icon type (icon-only buttons)
      // ============================================
      {
        buttonType: "icon",
        size: "lg",
        className: "size-48 [&_svg]:!size-20",
      },
      {
        buttonType: "icon",
        size: "md",
        className: "size-40 [&_svg]:!size-20",
      },
      {
        buttonType: "icon",
        size: "sm",
        className: "size-32 [&_svg]:!size-16",
      },
      {
        buttonType: "icon",
        size: "xs",
        className: "size-24 [&_svg]:!size-16",
      },
    ],
    defaultVariants: {
      buttonStyle: "primary",
      size: "md",
      target: "default",
      buttonType: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  leadIcon?: React.ReactNode;
  tailIcon?: React.ReactNode;
  badge?: React.ReactNode;
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      buttonStyle,
      size,
      target,
      buttonType = "default",
      leadIcon,
      tailIcon,
      badge,
      asChild = false,
      children,
      ...props
    },
    ref
  ) => {
    const Comp = asChild ? Slot : "button";

    // Icon-only button
    if (buttonType === "icon") {
      return (
        <Comp
          data-slot="button"
          className={cn(
            buttonVariants({ buttonStyle, size, target, buttonType }),
            className
          )}
          ref={ref}
          {...props}
        >
          {children}
        </Comp>
      );
    }

    // Default button with text
    return (
      <Comp
        data-slot="button"
        className={cn(
          buttonVariants({ buttonStyle, size, target, buttonType }),
          className
        )}
        ref={ref}
        {...props}
      >
        {leadIcon && <span className="shrink-0">{leadIcon}</span>}
        {children}
        {badge && <span className="shrink-0">{badge}</span>}
        {tailIcon && <span className="shrink-0">{tailIcon}</span>}
      </Comp>
    );
  }
);

Button.displayName = "Button";

export { Button, buttonVariants };
