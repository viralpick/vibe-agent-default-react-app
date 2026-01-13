import React from "react";

import { cn } from "@/lib/commerce-sdk";
import { StarIcon, TrendingDownIcon, TrendingUpIcon } from "lucide-react";

/**
 * @component CommentCard
 * @description Displays a status-based comment/feedback message with visual indicators.
 * Used for AI-generated insights, performance summaries, or status messages.
 *
 * @dataStructure
 * - status: "neutral" | "good" | "bad" - Visual status indicator (optional, defaults to neutral styling)
 *   - "neutral": Star icon with gradient background
 *   - "good": TrendingUp icon with green background
 *   - "bad": TrendingDown icon with red background
 * - comment: string - The message text to display (required)
 *
 * @designTokens
 * - Uses bg-green-100 for good status
 * - Uses bg-red-100 for bad status
 * - Uses gradient (from-[#f8f1fb] to-[#f1f6fb]) for neutral status
 * - Uses rounded-lg for card border radius
 *
 * @useCase
 * - AI analysis result summaries
 * - Performance feedback messages
 * - Status notifications with sentiment
 * - KPI commentary cards
 *
 * @example
 * ```tsx
 * <CommentCard status="good" comment="Sales increased by 15% this month!" />
 * <CommentCard status="bad" comment="Customer churn rate needs attention" />
 * <CommentCard status="neutral" comment="Performance is within expected range" />
 * ```
 */
export type CommentCardProps = {
  status?: "neutral" | "good" | "bad";
  comment: string;
};

export default function CommentCard({
  status,
  comment,
}: CommentCardProps): React.JSX.Element {
  return (
    <div
      className={cn(
        "w-full flex px-[25px] py-[15px] items-center justify-center font-semibold gap-2.5 border border-state-200 rounded-lg leading-6",
        status === "neutral" && "bg-linear-to-b from-[#f8f1fb] to-[#f1f6fb]",
        status === "good" && "bg-green-100",
        status === "bad" && "bg-red-100"
      )}
    >
      <span
        className={cn(
          "flex items-center justify-center rounded-full size-9 bg-white",
          status === "neutral" && "text-[#252629]",
          status === "good" && "text-brand-600",
          status === "bad" && "text-danger-500"
        )}
      >
        {status === "neutral" && <StarIcon className="size-[18px]" />}
        {status === "good" && <TrendingUpIcon />}
        {status === "bad" && <TrendingDownIcon />}
      </span>
      {comment}
    </div>
  );
}
