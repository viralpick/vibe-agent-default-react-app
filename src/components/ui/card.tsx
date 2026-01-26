import * as React from "react";
import { cn } from "@/lib/commerce-sdk";

/**
 * Card Component
 *
 * 콘텐츠를 그룹화하는 카드 컨테이너입니다.
 */
export const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-large border border-border-100 bg-background-0 shadow-sm",
      className
    )}
    {...props}
  />
));
Card.displayName = "Card";

/**
 * CardHeader Component
 *
 * 카드의 헤더 영역입니다.
 */
export const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-6 p-24", className)}
    {...props}
  />
));
CardHeader.displayName = "CardHeader";

/**
 * CardTitle Component
 *
 * 카드의 제목입니다.
 */
export const CardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn("text-title-3 font-semibold text-text-primary", className)}
    {...props}
  />
));
CardTitle.displayName = "CardTitle";

/**
 * CardContent Component
 *
 * 카드의 본문 콘텐츠 영역입니다.
 */
export const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-24 pt-0", className)} {...props} />
));
CardContent.displayName = "CardContent";
