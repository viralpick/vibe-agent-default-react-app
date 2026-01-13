import React from "react";

import { cn } from "@/lib/commerce-sdk";
import { StarIcon, TrendingDownIcon, TrendingUpIcon } from "lucide-react";

export type CommentCardProps = {
  status?: "neutral" | "good" | "bad";
  comment: string;
};

/**
 *
 * @param status - The status of the comment
 * @param comment - The comment to display
 * @returns
 */
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
