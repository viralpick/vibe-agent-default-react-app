/**
 * @component Card
 * @description Container for grouped content with header, content, and footer sections.
 * Composed of Card, CardHeader, CardTitle, CardDescription, CardAction, CardContent, CardFooter.
 *
 * @designTokens rounded-xlarge (12px), py-6, px-6, gap-6
 * @useCase Dashboard widgets, content sections, form containers, data displays
 */
import * as React from "react";

import { cn } from "@/lib/commerce-sdk";

type CardProps = React.ComponentProps<"div"> & {
  queryId?: string;
  queryContent?: string;
};

function Card({ className, queryId, queryContent, ...props }: CardProps) {
  return (
    <div
      data-slot="card"
      data-query-id={queryId}
      data-query-content={queryContent}
      className={cn(
        "bg-card text-card-foreground flex flex-col gap-1.5 py-6 rounded-xlarge border shadow-sm",
        className
      )}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-2 px-6 has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-6 pb-3",
        className
      )}
      {...props}
    />
  );
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn("leading-none font-semibold", className)}
      {...props}
    />
  );
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-muted-foreground text-label-l", className)}
      {...props}
    />
  );
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn(
        "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
        className
      )}
      {...props}
    />
  );
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("px-1.5", className)}
      {...props}
    />
  );
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn("flex items-center px-1.5 [.border-t]:pt-1.5", className)}
      {...props}
    />
  );
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
};