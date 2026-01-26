import { useState } from "react";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
  type TipPosition,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Info, HelpCircle } from "lucide-react";
import { OptionButton } from "./ui-shared";

const tipPositions: TipPosition[] = [
  "top-left",
  "top-center",
  "top-right",
  "bottom-left",
  "bottom-center",
  "bottom-right",
  "left-center",
  "right-center",
];
const sizes = ["sm", "md", "lg"] as const;

export function TooltipPage() {
  const [tipPosition, setTipPosition] = useState<TipPosition>("top-center");
  const [size, setSize] = useState<(typeof sizes)[number]>("md");
  const [showTip, setShowTip] = useState(true);

  return (
    <div className="space-y-40">
      <section>
        <h2 className="text-h3 font-semibold mb-16">Tooltip Playground</h2>
        <div className="p-24 bg-gray-50 rounded-medium">
          <div className="space-y-16 mb-24">
            <div className="flex items-start gap-12">
              <span className="text-t3 font-medium text-text-secondary w-100 mt-8">Position</span>
              <div className="flex flex-wrap gap-8 max-w-500">
                {tipPositions.map((p) => (
                  <OptionButton
                    key={p}
                    label={p}
                    selected={tipPosition === p}
                    onClick={() => setTipPosition(p)}
                  />
                ))}
              </div>
            </div>
            <div className="flex items-center gap-12">
              <span className="text-t3 font-medium text-text-secondary w-100">Size</span>
              <div className="flex gap-8">
                {sizes.map((s) => (
                  <OptionButton
                    key={s}
                    label={s}
                    selected={size === s}
                    onClick={() => setSize(s)}
                  />
                ))}
              </div>
            </div>
            <div className="flex items-center gap-12">
              <span className="text-t3 font-medium text-text-secondary w-100">Tip (Arrow)</span>
              <div className="flex gap-8">
                <OptionButton
                  label="Show"
                  selected={showTip === true}
                  onClick={() => setShowTip(true)}
                />
                <OptionButton
                  label="Hide"
                  selected={showTip === false}
                  onClick={() => setShowTip(false)}
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center p-80 bg-white rounded-small border border-gray-200 min-h-300">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="lg">Hover me</Button>
                </TooltipTrigger>
                <TooltipContent tip={showTip} size={size} tipPosition={tipPosition}>
                  {size === "lg" ? (
                    <div className="space-y-4">
                      <p className="font-semibold text-t3">Tooltip headline</p>
                      <p className="text-t4 text-text-secondary whitespace-pre-line">
                        Tooltips display informative text when{"\n"}
                        users hover over, focus on, or tap an{"\n"}
                        element
                      </p>
                    </div>
                  ) : (
                    <p className="text-t4">Tooltip text</p>
                  )}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-h3 font-semibold mb-16">Tooltip - Size Variations</h2>
        <div className="p-24 bg-gray-50 rounded-medium">
          <div className="flex items-center justify-center gap-32 py-48">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button buttonStyle="secondary" size="sm">Small</Button>
              </TooltipTrigger>
              <TooltipContent size="sm" tip>Small Tooltip</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button buttonStyle="secondary" size="sm">Medium</Button>
              </TooltipTrigger>
              <TooltipContent size="md" tip>Medium Tooltip</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button buttonStyle="secondary" size="sm">Large (Headline)</Button>
              </TooltipTrigger>
              <TooltipContent size="lg" tip>
                <div className="space-y-4">
                  <p className="font-semibold">Headline</p>
                  <p className="text-text-secondary">Informative text description</p>
                </div>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-h3 font-semibold mb-16">Tooltip - Icons & Inline</h2>
        <div className="p-24 bg-gray-50 rounded-medium">
          <div className="flex items-center justify-center gap-24 mb-32">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button buttonStyle="ghost" buttonType="icon" size="sm">
                  <Info className="size-16" />
                </Button>
              </TooltipTrigger>
              <TooltipContent tip tipPosition="top-center">Information</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button buttonStyle="ghost" buttonType="icon" size="sm">
                  <HelpCircle className="size-16" />
                </Button>
              </TooltipTrigger>
              <TooltipContent tip tipPosition="top-center">Help</TooltipContent>
            </Tooltip>
          </div>

          <p className="text-body-m text-text-secondary text-center">
            This is some text with an inline{" "}
            <Tooltip>
              <TooltipTrigger className="underline decoration-dotted cursor-help font-medium text-primary">
                tooltip
              </TooltipTrigger>
              <TooltipContent tip tipPosition="top-center">
                Detailed info here
              </TooltipContent>
            </Tooltip>{" "}
            that provides context.
          </p>
        </div>
      </section>
    </div>
  );
}
