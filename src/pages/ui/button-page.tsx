import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Circle, ChevronRight } from "lucide-react";
import { OptionButton } from "./ui-shared";

const buttonSizes = ["lg", "md", "sm", "xs"] as const;
const buttonStyles = ["primary", "secondary", "tertiary", "ghost"] as const;
const buttonTargets = ["default", "destructive", "brand"] as const;
const buttonTypes = ["default", "icon"] as const;
const buttonIconOptions = ["none", "lead", "tail", "both"] as const;

export function ButtonPage() {
  const [btnSize, setBtnSize] = useState<(typeof buttonSizes)[number]>("lg");
  const [btnStyle, setBtnStyle] = useState<(typeof buttonStyles)[number]>("primary");
  const [btnTarget, setBtnTarget] = useState<(typeof buttonTargets)[number]>("default");
  const [btnType, setBtnType] = useState<(typeof buttonTypes)[number]>("default");
  const [btnIcon, setBtnIcon] = useState<(typeof buttonIconOptions)[number]>("both");
  const [btnDisabled, setBtnDisabled] = useState(false);
  const [btnShowBadge, setBtnShowBadge] = useState(false);

  return (
    <div className="space-y-40">
      <section>
        <h2 className="text-h3 font-semibold mb-16">Button Playground</h2>
        <div className="p-24 bg-gray-50 rounded-medium">
          <div className="space-y-16 mb-24">
            <div className="flex items-center gap-12">
              <span className="text-t3 font-medium text-text-secondary w-100">Type</span>
              <div className="flex gap-8">
                {buttonTypes.map((type) => (
                  <OptionButton
                    key={type}
                    label={type}
                    selected={btnType === type}
                    onClick={() => setBtnType(type)}
                  />
                ))}
              </div>
            </div>
            <div className="flex items-center gap-12">
              <span className="text-t3 font-medium text-text-secondary w-100">Style</span>
              <div className="flex gap-8">
                {buttonStyles.map((style) => (
                  <OptionButton
                    key={style}
                    label={style}
                    selected={btnStyle === style}
                    onClick={() => setBtnStyle(style)}
                  />
                ))}
              </div>
            </div>
            <div className="flex items-center gap-12">
              <span className="text-t3 font-medium text-text-secondary w-100">Size</span>
              <div className="flex gap-8">
                {buttonSizes.map((size) => (
                  <OptionButton
                    key={size}
                    label={size}
                    selected={btnSize === size}
                    onClick={() => setBtnSize(size)}
                  />
                ))}
              </div>
            </div>
            <div className="flex items-center gap-12">
              <span className="text-t3 font-medium text-text-secondary w-100">Target</span>
              <div className="flex gap-8">
                {buttonTargets.map((target) => (
                  <OptionButton
                    key={target}
                    label={target}
                    selected={btnTarget === target}
                    onClick={() => setBtnTarget(target)}
                  />
                ))}
              </div>
            </div>
            {btnType === "default" && (
              <div className="flex items-center gap-12">
                <span className="text-t3 font-medium text-text-secondary w-100">Icon</span>
                <div className="flex gap-8">
                  {buttonIconOptions.map((option) => (
                    <OptionButton
                      key={option}
                      label={option}
                      selected={btnIcon === option}
                      onClick={() => setBtnIcon(option)}
                    />
                  ))}
                </div>
              </div>
            )}
            {btnType === "default" && (
              <div className="flex items-center gap-12">
                <span className="text-t3 font-medium text-text-secondary w-100">Badge</span>
                <div className="flex gap-8">
                  <OptionButton label="Show" selected={btnShowBadge} onClick={() => setBtnShowBadge(true)} />
                  <OptionButton label="Hide" selected={!btnShowBadge} onClick={() => setBtnShowBadge(false)} />
                </div>
              </div>
            )}
            <div className="flex items-center gap-12">
              <span className="text-t3 font-medium text-text-secondary w-100">Disabled</span>
              <div className="flex gap-8">
                <OptionButton label="Yes" selected={btnDisabled} onClick={() => setBtnDisabled(true)} />
                <OptionButton label="No" selected={!btnDisabled} onClick={() => setBtnDisabled(false)} />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center p-32 bg-white rounded-small border border-gray-200">
            {btnType === "icon" ? (
              <Button buttonType="icon" buttonStyle={btnStyle} size={btnSize} target={btnTarget} disabled={btnDisabled}>
                <Circle />
              </Button>
            ) : (
              <Button
                buttonType="default"
                buttonStyle={btnStyle}
                size={btnSize}
                target={btnTarget}
                disabled={btnDisabled}
                leadIcon={(btnIcon === "lead" || btnIcon === "both") ? <Circle /> : undefined}
                tailIcon={(btnIcon === "tail" || btnIcon === "both") ? <ChevronRight /> : undefined}
                badge={btnShowBadge ? (
                  <Badge size="sm" shape="rounded" badgeStyle="filled" theme="red">3</Badge>
                ) : undefined}
              >
                Button
              </Button>
            )}
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-h3 font-semibold mb-16">Button - All Variants</h2>
        <div className="space-y-32">
          {buttonTargets.map((target) => (
            <div key={target} className="mb-32">
              <h3 className="text-t2 font-semibold mb-12 capitalize">{target}</h3>
              <div className="grid grid-cols-4 gap-16">
                {buttonStyles.map((style) => (
                  <div key={style} className="space-y-8">
                    <span className="text-label-2 text-text-secondary capitalize">{style}</span>
                    <div className="flex flex-col gap-8">
                      {buttonSizes.map((size) => (
                        <div key={size} className="flex gap-4 items-center">
                          <Button buttonStyle={style} size={size} target={target} leadIcon={<Circle />} tailIcon={<ChevronRight />}>
                            Button
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div className="mb-32">
            <h3 className="text-t2 font-semibold mb-12">Icon Only</h3>
            <div className="grid grid-cols-3 gap-16">
              {buttonTargets.map((target) => (
                <div key={target} className="space-y-8">
                  <span className="text-label-2 text-text-secondary capitalize">{target}</span>
                  <div className="flex flex-wrap gap-8">
                    {buttonStyles.map((style) =>
                      buttonSizes.map((size) => (
                        <Button key={`${style}-${size}`} buttonType="icon" buttonStyle={style} size={size} target={target}>
                          <Circle />
                        </Button>
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mb-32">
            <h3 className="text-t2 font-semibold mb-12">Disabled States</h3>
            <div className="flex flex-wrap gap-8">
              {buttonTargets.map((target) =>
                buttonStyles.map((style) => (
                  <Button key={`${target}-${style}`} buttonStyle={style} size="md" target={target} disabled leadIcon={<Circle />}>
                    Button
                  </Button>
                ))
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
