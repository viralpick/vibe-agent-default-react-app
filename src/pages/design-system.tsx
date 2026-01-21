import { useState } from "react";
import { Dot } from "@/components/ui/dot";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import {
  Breadcrumb,
  BreadcrumbItem,
} from "@/components/ui/breadcrumb";
import { Settings, Info, Folder, Circle, ChevronRight, Search, Mail } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const themes = [
  "gray",
  "slate",
  "blue",
  "green",
  "yellow",
  "red",
  "purple",
] as const;

const sizes = ["lg", "sm"] as const;
const shapes = ["rounded", "pill"] as const;
const badgeStyles = ["light", "filled"] as const;
const iconOptions = ["none", "left", "right", "both"] as const;

function CircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function OptionButton({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-12 py-6 rounded-small text-label-m transition-all ${
        selected
          ? "bg-blue-500 text-gray-0"
          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
      }`}
    >
      {label}
    </button>
  );
}

const accordionSizes = ["lg", "md"] as const;
const accordionTypes = ["single", "multiple"] as const;
const dividerTypes = ["chevron", "slash"] as const;

// Button constants
const buttonSizes = ["lg", "md", "sm", "xs"] as const;
const buttonStyles = ["primary", "secondary", "tertiary", "ghost"] as const;
const buttonTargets = ["default", "destructive", "brand"] as const;
const buttonTypes = ["default", "icon"] as const;
const buttonIconOptions = ["none", "lead", "tail", "both"] as const;

// Checkbox constants
const checkboxSizes = ["sm", "md"] as const;
const checkboxStates = ["unchecked", "checked", "indeterminate"] as const;

// Input constants
const inputSizes = ["sm", "md"] as const;
const inputIconOptions = ["none", "lead", "tail", "both"] as const;

export function DesignSystemPage() {
  // Breadcrumb Playground state
  const [breadcrumbDivider, setBreadcrumbDivider] =
    useState<(typeof dividerTypes)[number]>("chevron");
  const [showBreadcrumbIcon, setShowBreadcrumbIcon] = useState(true);

  // Accordion Playground state
  const [accordionSize, setAccordionSize] =
    useState<(typeof accordionSizes)[number]>("lg");
  const [accordionType, setAccordionType] =
    useState<(typeof accordionTypes)[number]>("single");
  const [showLeadIcon, setShowLeadIcon] = useState(true);
  const [showDescription, setShowDescription] = useState(true);
  const [showDescIcon, setShowDescIcon] = useState(true);

  // Badge Playground state
  const [selectedSize, setSelectedSize] =
    useState<(typeof sizes)[number]>("lg");
  const [selectedShape, setSelectedShape] =
    useState<(typeof shapes)[number]>("pill");
  const [selectedStyle, setSelectedStyle] =
    useState<(typeof badgeStyles)[number]>("light");
  const [selectedTheme, setSelectedTheme] =
    useState<(typeof themes)[number]>("blue");
  const [selectedOutline, setSelectedOutline] = useState(false);
  const [selectedActive, setSelectedActive] = useState(true);
  const [selectedIcon, setSelectedIcon] =
    useState<(typeof iconOptions)[number]>("none");

  // Button Playground state
  const [btnSize, setBtnSize] =
    useState<(typeof buttonSizes)[number]>("lg");
  const [btnStyle, setBtnStyle] =
    useState<(typeof buttonStyles)[number]>("primary");
  const [btnTarget, setBtnTarget] =
    useState<(typeof buttonTargets)[number]>("default");
  const [btnType, setBtnType] =
    useState<(typeof buttonTypes)[number]>("default");
  const [btnIcon, setBtnIcon] =
    useState<(typeof buttonIconOptions)[number]>("both");
  const [btnDisabled, setBtnDisabled] = useState(false);
  const [btnShowBadge, setBtnShowBadge] = useState(false);

  // Checkbox Playground state
  const [checkboxSize, setCheckboxSize] =
    useState<(typeof checkboxSizes)[number]>("sm");
  const [checkboxChecked, setCheckboxChecked] = useState<
    boolean | "indeterminate"
  >(false);
  const [checkboxDisabled, setCheckboxDisabled] = useState(false);

  // Input Playground state
  const [inputSize, setInputSize] =
    useState<(typeof inputSizes)[number]>("md");
  const [inputIcon, setInputIcon] =
    useState<(typeof inputIconOptions)[number]>("both");
  const [inputShowBadge, setInputShowBadge] = useState(true);
  const [inputValue, setInputValue] = useState("");
  const [inputDisabled, setInputDisabled] = useState(false);

  // Textarea Playground state
  const [textareaDisabled, setTextareaDisabled] = useState(false);
  const [textareaShowActions, setTextareaShowActions] = useState(true);
  const [textareaShowPrimaryBtn, setTextareaShowPrimaryBtn] = useState(true);
  const [textareaShowSecondaryBtn, setTextareaShowSecondaryBtn] = useState(true);
  const [textareaShowControl, setTextareaShowControl] = useState(true);

  return (
    <main className="w-full min-h-screen p-24">
      {/* Button Playground */}
      <section className="mb-40">
        <h2 className="text-h3 font-semibold mb-16">Button Playground</h2>
        <div className="p-24 bg-gray-50 rounded-medium">
          {/* Controls */}
          <div className="space-y-16 mb-24">
            {/* Type */}
            <div className="flex items-center gap-12">
              <span className="text-t3 font-medium text-text-secondary w-100">
                Type
              </span>
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

            {/* Style */}
            <div className="flex items-center gap-12">
              <span className="text-t3 font-medium text-text-secondary w-100">
                Style
              </span>
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

            {/* Size */}
            <div className="flex items-center gap-12">
              <span className="text-t3 font-medium text-text-secondary w-100">
                Size
              </span>
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

            {/* Target */}
            <div className="flex items-center gap-12">
              <span className="text-t3 font-medium text-text-secondary w-100">
                Target
              </span>
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

            {/* Icon */}
            {btnType === "default" && (
              <div className="flex items-center gap-12">
                <span className="text-t3 font-medium text-text-secondary w-100">
                  Icon
                </span>
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

            {/* Badge */}
            {btnType === "default" && (
              <div className="flex items-center gap-12">
                <span className="text-t3 font-medium text-text-secondary w-100">
                  Badge
                </span>
                <div className="flex gap-8">
                  <OptionButton
                    label="Show"
                    selected={btnShowBadge}
                    onClick={() => setBtnShowBadge(true)}
                  />
                  <OptionButton
                    label="Hide"
                    selected={!btnShowBadge}
                    onClick={() => setBtnShowBadge(false)}
                  />
                </div>
              </div>
            )}

            {/* Disabled */}
            <div className="flex items-center gap-12">
              <span className="text-t3 font-medium text-text-secondary w-100">
                Disabled
              </span>
              <div className="flex gap-8">
                <OptionButton
                  label="Yes"
                  selected={btnDisabled}
                  onClick={() => setBtnDisabled(true)}
                />
                <OptionButton
                  label="No"
                  selected={!btnDisabled}
                  onClick={() => setBtnDisabled(false)}
                />
              </div>
            </div>
          </div>

          {/* Preview */}
          <div className="flex items-center justify-center p-32 bg-white rounded-small border border-gray-200">
            {btnType === "icon" ? (
              <Button
                buttonType="icon"
                buttonStyle={btnStyle}
                size={btnSize}
                target={btnTarget}
                disabled={btnDisabled}
              >
                <Circle />
              </Button>
            ) : (
              <Button
                buttonType="default"
                buttonStyle={btnStyle}
                size={btnSize}
                target={btnTarget}
                disabled={btnDisabled}
                leadIcon={
                  btnIcon === "lead" || btnIcon === "both" ? (
                    <Circle />
                  ) : undefined
                }
                tailIcon={
                  btnIcon === "tail" || btnIcon === "both" ? (
                    <ChevronRight />
                  ) : undefined
                }
                badge={
                  btnShowBadge ? (
                    <Badge size="sm" shape="rounded" badgeStyle="filled" theme="red">
                      3
                    </Badge>
                  ) : undefined
                }
              >
                Button
              </Button>
            )}
          </div>
        </div>
      </section>

      {/* Button - All Variants Matrix */}
      <section className="mb-40">
        <h2 className="text-h3 font-semibold mb-16">Button - All Variants</h2>

        {/* Default Target */}
        <div className="mb-32">
          <h3 className="text-t2 font-semibold mb-12">Default</h3>
          <div className="grid grid-cols-4 gap-16">
            {buttonStyles.map((style) => (
              <div key={style} className="space-y-8">
                <span className="text-label-2 text-text-secondary capitalize">
                  {style}
                </span>
                <div className="flex flex-col gap-8">
                  {buttonSizes.map((size) => (
                    <div key={size} className="flex gap-4 items-center">
                      <Button
                        buttonStyle={style}
                        size={size}
                        target="default"
                        leadIcon={<Circle />}
                        tailIcon={<ChevronRight />}
                      >
                        Button
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Destructive Target */}
        <div className="mb-32">
          <h3 className="text-t2 font-semibold mb-12">Destructive</h3>
          <div className="grid grid-cols-4 gap-16">
            {buttonStyles.map((style) => (
              <div key={style} className="space-y-8">
                <span className="text-label-2 text-text-secondary capitalize">
                  {style}
                </span>
                <div className="flex flex-col gap-8">
                  {buttonSizes.map((size) => (
                    <div key={size} className="flex gap-4 items-center">
                      <Button
                        buttonStyle={style}
                        size={size}
                        target="destructive"
                        leadIcon={<Circle />}
                        tailIcon={<ChevronRight />}
                      >
                        Button
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Brand Target */}
        <div className="mb-32">
          <h3 className="text-t2 font-semibold mb-12">Brand</h3>
          <div className="grid grid-cols-4 gap-16">
            {buttonStyles.map((style) => (
              <div key={style} className="space-y-8">
                <span className="text-label-2 text-text-secondary capitalize">
                  {style}
                </span>
                <div className="flex flex-col gap-8">
                  {buttonSizes.map((size) => (
                    <div key={size} className="flex gap-4 items-center">
                      <Button
                        buttonStyle={style}
                        size={size}
                        target="brand"
                        leadIcon={<Circle />}
                        tailIcon={<ChevronRight />}
                      >
                        Button
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Icon Buttons */}
        <div className="mb-32">
          <h3 className="text-t2 font-semibold mb-12">Icon Only</h3>
          <div className="grid grid-cols-3 gap-16">
            {buttonTargets.map((target) => (
              <div key={target} className="space-y-8">
                <span className="text-label-2 text-text-secondary capitalize">
                  {target}
                </span>
                <div className="flex flex-wrap gap-8">
                  {buttonStyles.map((style) =>
                    buttonSizes.map((size) => (
                      <Button
                        key={`${style}-${size}`}
                        buttonType="icon"
                        buttonStyle={style}
                        size={size}
                        target={target}
                      >
                        <Circle />
                      </Button>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Disabled States */}
        <div className="mb-32">
          <h3 className="text-t2 font-semibold mb-12">Disabled States</h3>
          <div className="flex flex-wrap gap-8">
            {buttonTargets.map((target) =>
              buttonStyles.map((style) => (
                <Button
                  key={`${target}-${style}`}
                  buttonStyle={style}
                  size="md"
                  target={target}
                  disabled
                  leadIcon={<Circle />}
                >
                  Button
                </Button>
              ))
            )}
          </div>
        </div>
      </section>

      {/* Checkbox Playground */}
      <section className="mb-40">
        <h2 className="text-h3 font-semibold mb-16">Checkbox Playground</h2>
        <div className="p-24 bg-gray-50 rounded-medium">
          {/* Controls */}
          <div className="space-y-16 mb-24">
            {/* Size */}
            <div className="flex items-center gap-12">
              <span className="text-t3 font-medium text-text-secondary w-100">
                Size
              </span>
              <div className="flex gap-8">
                {checkboxSizes.map((size) => (
                  <OptionButton
                    key={size}
                    label={size}
                    selected={checkboxSize === size}
                    onClick={() => setCheckboxSize(size)}
                  />
                ))}
              </div>
            </div>

            {/* Checked State */}
            <div className="flex items-center gap-12">
              <span className="text-t3 font-medium text-text-secondary w-100">
                Checked
              </span>
              <div className="flex gap-8">
                {checkboxStates.map((state) => (
                  <OptionButton
                    key={state}
                    label={state}
                    selected={
                      state === "unchecked"
                        ? checkboxChecked === false
                        : state === "checked"
                          ? checkboxChecked === true
                          : checkboxChecked === "indeterminate"
                    }
                    onClick={() =>
                      setCheckboxChecked(
                        state === "unchecked"
                          ? false
                          : state === "checked"
                            ? true
                            : "indeterminate"
                      )
                    }
                  />
                ))}
              </div>
            </div>

            {/* Disabled */}
            <div className="flex items-center gap-12">
              <span className="text-t3 font-medium text-text-secondary w-100">
                Disabled
              </span>
              <div className="flex gap-8">
                <OptionButton
                  label="Yes"
                  selected={checkboxDisabled}
                  onClick={() => setCheckboxDisabled(true)}
                />
                <OptionButton
                  label="No"
                  selected={!checkboxDisabled}
                  onClick={() => setCheckboxDisabled(false)}
                />
              </div>
            </div>
          </div>

          {/* Preview */}
          <div className="flex items-center justify-center p-32 bg-white rounded-small border border-gray-200">
            <Checkbox
              size={checkboxSize}
              checked={checkboxChecked}
              disabled={checkboxDisabled}
              onCheckedChange={(checked) =>
                setCheckboxChecked(checked === "indeterminate" ? "indeterminate" : checked)
              }
            />
          </div>
        </div>
      </section>

      {/* Breadcrumb Playground */}
      <section className="mb-40">
        <h2 className="text-h3 font-semibold mb-16">Breadcrumb Playground</h2>
        <div className="p-24 bg-gray-50 rounded-medium">
          {/* Controls */}
          <div className="space-y-16 mb-24">
            {/* Divider */}
            <div className="flex items-center gap-12">
              <span className="text-t3 font-medium text-text-secondary w-100">
                Divider
              </span>
              <div className="flex gap-8">
                {dividerTypes.map((type) => (
                  <OptionButton
                    key={type}
                    label={type}
                    selected={breadcrumbDivider === type}
                    onClick={() => setBreadcrumbDivider(type)}
                  />
                ))}
              </div>
            </div>

            {/* Icon */}
            <div className="flex items-center gap-12">
              <span className="text-t3 font-medium text-text-secondary w-100">
                Icon
              </span>
              <div className="flex gap-8">
                <OptionButton
                  label="Show"
                  selected={showBreadcrumbIcon}
                  onClick={() => setShowBreadcrumbIcon(true)}
                />
                <OptionButton
                  label="Hide"
                  selected={!showBreadcrumbIcon}
                  onClick={() => setShowBreadcrumbIcon(false)}
                />
              </div>
            </div>
          </div>

          {/* Preview */}
          <div className="flex items-center justify-center p-32 bg-white rounded-small border border-gray-200">
            <Breadcrumb divider={breadcrumbDivider}>
              <BreadcrumbItem
                icon={showBreadcrumbIcon ? <Folder /> : undefined}
                href="#"
              >
                Label
              </BreadcrumbItem>
              <BreadcrumbItem
                icon={showBreadcrumbIcon ? <Folder /> : undefined}
                href="#"
              >
                Label
              </BreadcrumbItem>
              <BreadcrumbItem
                icon={showBreadcrumbIcon ? <Folder /> : undefined}
                href="#"
              >
                Label
              </BreadcrumbItem>
              <BreadcrumbItem
                icon={showBreadcrumbIcon ? <Folder /> : undefined}
              >
                Label
              </BreadcrumbItem>
            </Breadcrumb>
          </div>
        </div>
      </section>

      {/* Accordion Playground */}
      <section className="mb-40">
        <h2 className="text-h3 font-semibold mb-16">Accordion Playground</h2>
        <div className="p-24 bg-gray-50 rounded-medium">
          {/* Controls */}
          <div className="space-y-16 mb-24">
            {/* Type */}
            <div className="flex items-center gap-12">
              <span className="text-t3 font-medium text-text-secondary w-100">
                Type
              </span>
              <div className="flex gap-8">
                {accordionTypes.map((type) => (
                  <OptionButton
                    key={type}
                    label={type}
                    selected={accordionType === type}
                    onClick={() => setAccordionType(type)}
                  />
                ))}
              </div>
            </div>

            {/* Size */}
            <div className="flex items-center gap-12">
              <span className="text-t3 font-medium text-text-secondary w-100">
                Size
              </span>
              <div className="flex gap-8">
                {accordionSizes.map((size) => (
                  <OptionButton
                    key={size}
                    label={size}
                    selected={accordionSize === size}
                    onClick={() => setAccordionSize(size)}
                  />
                ))}
              </div>
            </div>

            {/* Lead Icon */}
            <div className="flex items-center gap-12">
              <span className="text-t3 font-medium text-text-secondary w-100">
                Lead Icon
              </span>
              <div className="flex gap-8">
                <OptionButton
                  label="Show"
                  selected={showLeadIcon}
                  onClick={() => setShowLeadIcon(true)}
                />
                <OptionButton
                  label="Hide"
                  selected={!showLeadIcon}
                  onClick={() => setShowLeadIcon(false)}
                />
              </div>
            </div>

            {/* Description */}
            <div className="flex items-center gap-12">
              <span className="text-t3 font-medium text-text-secondary w-100">
                Description
              </span>
              <div className="flex gap-8">
                <OptionButton
                  label="Show"
                  selected={showDescription}
                  onClick={() => setShowDescription(true)}
                />
                <OptionButton
                  label="Hide"
                  selected={!showDescription}
                  onClick={() => setShowDescription(false)}
                />
              </div>
            </div>

            {/* Description Icon */}
            <div className="flex items-center gap-12">
              <span className="text-t3 font-medium text-text-secondary w-100">
                Desc Icon
              </span>
              <div className="flex gap-8">
                <OptionButton
                  label="Show"
                  selected={showDescIcon}
                  onClick={() => setShowDescIcon(true)}
                />
                <OptionButton
                  label="Hide"
                  selected={!showDescIcon}
                  onClick={() => setShowDescIcon(false)}
                />
              </div>
            </div>
          </div>

          {/* Preview */}
          <div className="p-24 bg-gray-100 rounded-medium">
            <Accordion type={accordionType} size={accordionSize} className="flex flex-col gap-8">
              <AccordionItem value="item-1">
                <AccordionTrigger
                  leadIcon={showLeadIcon ? <Settings /> : undefined}
                  title="Headline"
                  description={showDescription ? "Description" : undefined}
                  icon={showDescription && showDescIcon ? <Info /> : undefined}
                />
                <AccordionContent>
                  <p className="text-body-s text-text-secondary mb-12">
                    Accordion content
                  </p>
                  <div className="h-120 bg-purple-100 rounded-medium border-2 border-dashed border-purple-300 flex items-center justify-center">
                    <span className="text-purple-600 text-body-m">Slot</span>
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-2">
                <AccordionTrigger
                  leadIcon={showLeadIcon ? <Settings /> : undefined}
                  title="Headline"
                  description={showDescription ? "Description" : undefined}
                  icon={showDescription && showDescIcon ? <Info /> : undefined}
                />
                <AccordionContent>
                  <p className="text-body-s text-text-secondary mb-12">
                    Accordion content
                  </p>
                  <div className="h-120 bg-purple-100 rounded-medium border-2 border-dashed border-purple-300 flex items-center justify-center">
                    <span className="text-purple-600 text-body-m">Slot</span>
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-3">
                <AccordionTrigger
                  leadIcon={showLeadIcon ? <Settings /> : undefined}
                  title="Headline"
                  description={showDescription ? "Description" : undefined}
                  icon={showDescription && showDescIcon ? <Info /> : undefined}
                />
                <AccordionContent>
                  <p className="text-body-s text-text-secondary mb-12">
                    Accordion content
                  </p>
                  <div className="h-120 bg-purple-100 rounded-medium border-2 border-dashed border-purple-300 flex items-center justify-center">
                    <span className="text-purple-600 text-body-m">Slot</span>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </div>
      </section>

      {/* Badge Playground - Single Badge */}
      <section className="mb-40">
        <h2 className="text-h3 font-semibold mb-16">Badge Playground</h2>
        <div className="p-24 bg-gray-50 rounded-medium">
          {/* Controls */}
          <div className="space-y-16 mb-24">
            {/* Size */}
            <div className="flex items-center gap-12">
              <span className="text-t3 font-medium text-text-secondary w-80">
                Size
              </span>
              <div className="flex gap-8">
                {sizes.map((size) => (
                  <OptionButton
                    key={size}
                    label={size}
                    selected={selectedSize === size}
                    onClick={() => setSelectedSize(size)}
                  />
                ))}
              </div>
            </div>

            {/* Shape */}
            <div className="flex items-center gap-12">
              <span className="text-t3 font-medium text-text-secondary w-80">
                Shape
              </span>
              <div className="flex gap-8">
                {shapes.map((shape) => (
                  <OptionButton
                    key={shape}
                    label={shape}
                    selected={selectedShape === shape}
                    onClick={() => setSelectedShape(shape)}
                  />
                ))}
              </div>
            </div>

            {/* Style */}
            <div className="flex items-center gap-12">
              <span className="text-t3 font-medium text-text-secondary w-80">
                Style
              </span>
              <div className="flex gap-8">
                {badgeStyles.map((style) => (
                  <OptionButton
                    key={style}
                    label={style}
                    selected={selectedStyle === style}
                    onClick={() => setSelectedStyle(style)}
                  />
                ))}
              </div>
            </div>

            {/* Theme */}
            <div className="flex items-center gap-12">
              <span className="text-t3 font-medium text-text-secondary w-80">
                Theme
              </span>
              <div className="flex gap-8 flex-wrap">
                {themes.map((theme) => (
                  <OptionButton
                    key={theme}
                    label={theme}
                    selected={selectedTheme === theme}
                    onClick={() => setSelectedTheme(theme)}
                  />
                ))}
              </div>
            </div>

            {/* Outline */}
            <div className="flex items-center gap-12">
              <span className="text-t3 font-medium text-text-secondary w-80">
                Outline
              </span>
              <div className="flex gap-8">
                <OptionButton
                  label="On"
                  selected={selectedOutline === true}
                  onClick={() => setSelectedOutline(true)}
                />
                <OptionButton
                  label="Off"
                  selected={selectedOutline === false}
                  onClick={() => setSelectedOutline(false)}
                />
              </div>
            </div>

            {/* Active */}
            <div className="flex items-center gap-12">
              <span className="text-t3 font-medium text-text-secondary w-80">
                Active
              </span>
              <div className="flex gap-8">
                <OptionButton
                  label="Active"
                  selected={selectedActive === true}
                  onClick={() => setSelectedActive(true)}
                />
                <OptionButton
                  label="Inactive"
                  selected={selectedActive === false}
                  onClick={() => setSelectedActive(false)}
                />
              </div>
            </div>

            {/* Icon */}
            <div className="flex items-center gap-12">
              <span className="text-t3 font-medium text-text-secondary w-80">
                Icon
              </span>
              <div className="flex gap-8">
                {iconOptions.map((option) => (
                  <OptionButton
                    key={option}
                    label={option}
                    selected={selectedIcon === option}
                    onClick={() => setSelectedIcon(option)}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Preview */}
          <div className="flex items-center justify-center p-32 bg-white rounded-small border border-gray-200">
            <Badge
              size={selectedSize}
              shape={selectedShape}
              badgeStyle={selectedStyle}
              theme={selectedTheme}
              outline={selectedOutline}
              active={selectedActive}
              leftIcon={
                selectedIcon === "left" || selectedIcon === "both" ? (
                  <CircleIcon />
                ) : undefined
              }
              rightIcon={
                selectedIcon === "right" || selectedIcon === "both" ? (
                  <CircleIcon />
                ) : undefined
              }
            >
              Badge
            </Badge>
          </div>
        </div>
      </section>

      {/* Checkbox - All Variants Matrix */}
      <section className="mb-40">
        <h2 className="text-h3 font-semibold mb-16">Checkbox - All Variants</h2>
        <div className="p-24 bg-gray-50 rounded-medium">
          <div className="grid grid-cols-6 gap-16">
            {/* Header */}
            <div className="col-span-3 text-center text-t3 font-semibold text-text-secondary border-b border-gray-200 pb-8">
              sm (16x16)
            </div>
            <div className="col-span-3 text-center text-t3 font-semibold text-text-secondary border-b border-gray-200 pb-8">
              md (20x20)
            </div>

            {/* Sub-headers */}
            <div className="text-center text-label-m text-text-secondary">unchecked</div>
            <div className="text-center text-label-m text-text-secondary">checked</div>
            <div className="text-center text-label-m text-text-secondary">indeterminate</div>
            <div className="text-center text-label-m text-text-secondary">unchecked</div>
            <div className="text-center text-label-m text-text-secondary">checked</div>
            <div className="text-center text-label-m text-text-secondary">indeterminate</div>

            {/* Default State */}
            <div className="col-span-6 text-label-2 text-text-secondary mt-16 mb-8">
              Default
            </div>
            <div className="flex justify-center p-16 bg-white rounded-small">
              <Checkbox size="sm" checked={false} />
            </div>
            <div className="flex justify-center p-16 bg-white rounded-small">
              <Checkbox size="sm" checked={true} />
            </div>
            <div className="flex justify-center p-16 bg-white rounded-small">
              <Checkbox size="sm" checked="indeterminate" />
            </div>
            <div className="flex justify-center p-16 bg-white rounded-small">
              <Checkbox size="md" checked={false} />
            </div>
            <div className="flex justify-center p-16 bg-white rounded-small">
              <Checkbox size="md" checked={true} />
            </div>
            <div className="flex justify-center p-16 bg-white rounded-small">
              <Checkbox size="md" checked="indeterminate" />
            </div>

            {/* Hover State (visual demonstration) */}
            <div className="col-span-6 text-label-2 text-text-secondary mt-16 mb-8">
              Hover (hover over checkboxes)
            </div>
            <div className="flex justify-center p-16 bg-white rounded-small">
              <Checkbox size="sm" checked={false} />
            </div>
            <div className="flex justify-center p-16 bg-white rounded-small">
              <Checkbox size="sm" checked={true} />
            </div>
            <div className="flex justify-center p-16 bg-white rounded-small">
              <Checkbox size="sm" checked="indeterminate" />
            </div>
            <div className="flex justify-center p-16 bg-white rounded-small">
              <Checkbox size="md" checked={false} />
            </div>
            <div className="flex justify-center p-16 bg-white rounded-small">
              <Checkbox size="md" checked={true} />
            </div>
            <div className="flex justify-center p-16 bg-white rounded-small">
              <Checkbox size="md" checked="indeterminate" />
            </div>

            {/* Focus State (click/tab to see) */}
            <div className="col-span-6 text-label-2 text-text-secondary mt-16 mb-8">
              Focus (click or tab to see focus ring)
            </div>
            <div className="flex justify-center p-16 bg-white rounded-small">
              <Checkbox size="sm" checked={false} />
            </div>
            <div className="flex justify-center p-16 bg-white rounded-small">
              <Checkbox size="sm" checked={true} />
            </div>
            <div className="flex justify-center p-16 bg-white rounded-small">
              <Checkbox size="sm" checked="indeterminate" />
            </div>
            <div className="flex justify-center p-16 bg-white rounded-small">
              <Checkbox size="md" checked={false} />
            </div>
            <div className="flex justify-center p-16 bg-white rounded-small">
              <Checkbox size="md" checked={true} />
            </div>
            <div className="flex justify-center p-16 bg-white rounded-small">
              <Checkbox size="md" checked="indeterminate" />
            </div>

            {/* Disabled State */}
            <div className="col-span-6 text-label-2 text-text-secondary mt-16 mb-8">
              Disabled
            </div>
            <div className="flex justify-center p-16 bg-white rounded-small">
              <Checkbox size="sm" checked={false} disabled />
            </div>
            <div className="flex justify-center p-16 bg-white rounded-small">
              <Checkbox size="sm" checked={true} disabled />
            </div>
            <div className="flex justify-center p-16 bg-white rounded-small">
              <Checkbox size="sm" checked="indeterminate" disabled />
            </div>
            <div className="flex justify-center p-16 bg-white rounded-small">
              <Checkbox size="md" checked={false} disabled />
            </div>
            <div className="flex justify-center p-16 bg-white rounded-small">
              <Checkbox size="md" checked={true} disabled />
            </div>
            <div className="flex justify-center p-16 bg-white rounded-small">
              <Checkbox size="md" checked="indeterminate" disabled />
            </div>
          </div>
        </div>
      </section>

      {/* Dots */}
      <section className="mb-40">
        <h2 className="text-h3 font-semibold mb-16">Dot</h2>
        <div className="flex gap-16">
          <Dot size="small" color="gray" />
          <Dot size="medium" color="gray" />
          <Dot size="large" color="gray" />
          <Dot size="xlarge" color="gray" />
          <Dot size="small" color="red" />
          <Dot size="medium" color="red" />
          <Dot size="large" color="red" />
          <Dot size="xlarge" color="red" />
          <Dot size="small" color="green" />
          <Dot size="medium" color="green" />
          <Dot size="large" color="green" />
          <Dot size="xlarge" color="green" />
          <Dot size="small" color="blue" />
          <Dot size="medium" color="blue" />
          <Dot size="large" color="blue" />
          <Dot size="xlarge" color="blue" />
        </div>
      </section>

      {/* Custom Badges - All Variants */}
      <section>
        <h2 className="text-h3 font-semibold mb-16">Badge - All Variants</h2>

        {/* Size: lg, Shape: pill, Style: light */}
        <div className="mb-24">
          <h3 className="text-t3 font-medium mb-8 text-text-secondary">
            Size: lg / Shape: pill / Style: light
          </h3>
          <div className="flex flex-wrap gap-8">
            {themes.map((theme) => (
              <Badge
                key={theme}
                size="lg"
                shape="pill"
                badgeStyle="light"
                theme={theme}
                leftIcon={<CircleIcon />}
                rightIcon={<CircleIcon />}
              >
                Badge
              </Badge>
            ))}
          </div>
        </div>

        {/* Size: lg, Shape: pill, Style: filled */}
        <div className="mb-24">
          <h3 className="text-t3 font-medium mb-8 text-text-secondary">
            Size: lg / Shape: pill / Style: filled
          </h3>
          <div className="flex flex-wrap gap-8">
            {themes.map((theme) => (
              <Badge
                key={theme}
                size="lg"
                shape="pill"
                badgeStyle="filled"
                theme={theme}
                leftIcon={<CircleIcon />}
                rightIcon={<CircleIcon />}
              >
                Badge
              </Badge>
            ))}
          </div>
        </div>

        {/* Size: sm, Shape: rounded, Style: light, Outline */}
        <div className="mb-24">
          <h3 className="text-t3 font-medium mb-8 text-text-secondary">
            Size: sm / Shape: rounded / Style: light / Outline
          </h3>
          <div className="flex flex-wrap gap-8">
            {themes.map((theme) => (
              <Badge
                key={theme}
                size="sm"
                shape="rounded"
                badgeStyle="light"
                theme={theme}
                outline
                leftIcon={<CircleIcon />}
              >
                Badge
              </Badge>
            ))}
          </div>
        </div>

        {/* Size: sm, Shape: rounded, Style: filled, Outline */}
        <div className="mb-24">
          <h3 className="text-t3 font-medium mb-8 text-text-secondary">
            Size: sm / Shape: rounded / Style: filled / Outline
          </h3>
          <div className="flex flex-wrap gap-8">
            {themes.map((theme) => (
              <Badge
                key={theme}
                size="sm"
                shape="rounded"
                badgeStyle="filled"
                theme={theme}
                outline
                rightIcon={<CircleIcon />}
              >
                Badge
              </Badge>
            ))}
          </div>
        </div>

        {/* Active vs Inactive */}
        <div className="mb-24">
          <h3 className="text-t3 font-medium mb-8 text-text-secondary">
            Active vs Inactive
          </h3>
          <div className="flex flex-wrap gap-8">
            <Badge
              size="lg"
              shape="pill"
              badgeStyle="filled"
              theme="blue"
              active
            >
              Active
            </Badge>
            <Badge
              size="lg"
              shape="pill"
              badgeStyle="filled"
              theme="blue"
              active={false}
            >
              Inactive
            </Badge>
            <Badge size="lg" shape="pill" badgeStyle="light" theme="red" active>
              Active
            </Badge>
            <Badge
              size="lg"
              shape="pill"
              badgeStyle="light"
              theme="red"
              active={false}
            >
              Inactive
            </Badge>
          </div>
        </div>

        {/* Icon positions */}
        <div className="mb-24">
          <h3 className="text-t3 font-medium mb-8 text-text-secondary">
            Icon Positions
          </h3>
          <div className="flex flex-wrap gap-8">
            <Badge
              size="lg"
              shape="pill"
              badgeStyle="light"
              theme="purple"
              leftIcon={<CircleIcon />}
            >
              Left Icon
            </Badge>
            <Badge
              size="lg"
              shape="pill"
              badgeStyle="light"
              theme="purple"
              rightIcon={<CircleIcon />}
            >
              Right Icon
            </Badge>
            <Badge
              size="lg"
              shape="pill"
              badgeStyle="light"
              theme="purple"
              leftIcon={<CircleIcon />}
              rightIcon={<CircleIcon />}
            >
              Both Icons
            </Badge>
            <Badge size="lg" shape="pill" badgeStyle="light" theme="purple">
              No Icon
            </Badge>
          </div>
        </div>
      </section>

      {/* Input Playground */}
      <section className="mb-40">
        <h2 className="text-h3 font-semibold mb-16">Input Playground</h2>
        <div className="p-24 bg-gray-50 rounded-medium">
          {/* Controls */}
          <div className="space-y-16 mb-24">
            {/* Size */}
            <div className="flex items-center gap-12">
              <span className="text-t3 font-medium text-text-secondary w-100">
                Size
              </span>
              <div className="flex gap-8">
                {inputSizes.map((size) => (
                  <OptionButton
                    key={size}
                    label={size}
                    selected={inputSize === size}
                    onClick={() => setInputSize(size)}
                  />
                ))}
              </div>
            </div>

            {/* Icon */}
            <div className="flex items-center gap-12">
              <span className="text-t3 font-medium text-text-secondary w-100">
                Icon
              </span>
              <div className="flex gap-8">
                {inputIconOptions.map((icon) => (
                  <OptionButton
                    key={icon}
                    label={icon}
                    selected={inputIcon === icon}
                    onClick={() => setInputIcon(icon)}
                  />
                ))}
              </div>
            </div>

            {/* Badge */}
            <div className="flex items-center gap-12">
              <span className="text-t3 font-medium text-text-secondary w-100">
                Badge
              </span>
              <div className="flex gap-8">
                <OptionButton
                  label="Show"
                  selected={inputShowBadge}
                  onClick={() => setInputShowBadge(true)}
                />
                <OptionButton
                  label="Hide"
                  selected={!inputShowBadge}
                  onClick={() => setInputShowBadge(false)}
                />
              </div>
            </div>

            {/* Value */}
            <div className="flex items-center gap-12">
              <span className="text-t3 font-medium text-text-secondary w-100">
                Value
              </span>
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Enter value..."
                className="px-12 py-6 border border-gray-300 rounded-small text-label-m"
              />
            </div>

            {/* Disabled */}
            <div className="flex items-center gap-12">
              <span className="text-t3 font-medium text-text-secondary w-100">
                Disabled
              </span>
              <div className="flex gap-8">
                <OptionButton
                  label="Yes"
                  selected={inputDisabled}
                  onClick={() => setInputDisabled(true)}
                />
                <OptionButton
                  label="No"
                  selected={!inputDisabled}
                  onClick={() => setInputDisabled(false)}
                />
              </div>
            </div>
          </div>

          {/* Preview */}
          <div className="flex items-center justify-center p-32 bg-white rounded-small border border-gray-200">
            <Input
              size={inputSize}
              placeholder="Input"
              value={inputValue}
              disabled={inputDisabled}
              leadIcon={
                inputIcon === "lead" || inputIcon === "both" ? (
                  <Search />
                ) : undefined
              }
              tailIcon={
                inputIcon === "tail" || inputIcon === "both" ? (
                  <Info />
                ) : undefined
              }
              badge={
                inputShowBadge ? (
                  <Badge size="sm" theme="gray" badgeStyle="light">
                    ⌘E
                  </Badge>
                ) : undefined
              }
            />
          </div>
        </div>
      </section>

      {/* Input - All Variants */}
      <section className="mb-40">
        <h2 className="text-h3 font-semibold mb-16">Input - All Variants</h2>
        <div className="p-24 bg-gray-50 rounded-medium space-y-16">
          {inputSizes.map((size) => (
            <div key={size} className="space-y-8">
              <h3 className="text-t2 font-semibold capitalize">{size}</h3>
              <div className="grid grid-cols-3 gap-16">
                {/* Default */}
                <div>
                  <p className="text-label-m text-text-secondary mb-8">
                    Default
                  </p>
                  <Input
                    size={size}
                    placeholder="Input"
                    leadIcon={<Search />}
                    badge={
                      <Badge size="sm" theme="gray" badgeStyle="light">
                        ⌘E
                      </Badge>
                    }
                    tailIcon={<Info />}
                  />
                </div>

                {/* Filled */}
                <div>
                  <p className="text-label-m text-text-secondary mb-8">
                    Filled
                  </p>
                  <Input
                    size={size}
                    placeholder="Input"
                    value="Filled value"
                    leadIcon={<Search />}
                    badge={
                      <Badge size="sm" theme="gray" badgeStyle="light">
                        ⌘E
                      </Badge>
                    }
                    tailIcon={<Info />}
                  />
                </div>

                {/* Disabled */}
                <div>
                  <p className="text-label-m text-text-secondary mb-8">
                    Disabled
                  </p>
                  <Input
                    size={size}
                    placeholder="Input"
                    disabled
                    leadIcon={<Search />}
                    badge={
                      <Badge size="sm" theme="gray" badgeStyle="light">
                        ⌘E
                      </Badge>
                    }
                    tailIcon={<Info />}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Textarea Playground */}
      <section className="mb-40">
        <h2 className="text-h3 font-semibold mb-16">Textarea Playground</h2>
        <div className="p-24 bg-gray-50 rounded-medium">
          {/* Controls */}
          <div className="space-y-16 mb-24">
            {/* Disabled */}
            <div className="flex items-center gap-12">
              <span className="text-t3 font-medium text-text-secondary w-100">
                Disabled
              </span>
              <div className="flex gap-8">
                <OptionButton
                  label="Yes"
                  selected={textareaDisabled}
                  onClick={() => setTextareaDisabled(true)}
                />
                <OptionButton
                  label="No"
                  selected={!textareaDisabled}
                  onClick={() => setTextareaDisabled(false)}
                />
              </div>
            </div>

            {/* Show Actions */}
            <div className="flex items-center gap-12">
              <span className="text-t3 font-medium text-text-secondary w-100">
                Show Actions
              </span>
              <div className="flex gap-8">
                <OptionButton
                  label="Yes"
                  selected={textareaShowActions}
                  onClick={() => setTextareaShowActions(true)}
                />
                <OptionButton
                  label="No"
                  selected={!textareaShowActions}
                  onClick={() => setTextareaShowActions(false)}
                />
              </div>
            </div>

            {textareaShowActions && (
              <>
                {/* Primary Button */}
                <div className="flex items-center gap-12">
                  <span className="text-t3 font-medium text-text-secondary w-100">
                    Primary Btn
                  </span>
                  <div className="flex gap-8">
                    <OptionButton
                      label="Show"
                      selected={textareaShowPrimaryBtn}
                      onClick={() => setTextareaShowPrimaryBtn(true)}
                    />
                    <OptionButton
                      label="Hide"
                      selected={!textareaShowPrimaryBtn}
                      onClick={() => setTextareaShowPrimaryBtn(false)}
                    />
                  </div>
                </div>

                {/* Secondary Button */}
                <div className="flex items-center gap-12">
                  <span className="text-t3 font-medium text-text-secondary w-100">
                    Secondary Btn
                  </span>
                  <div className="flex gap-8">
                    <OptionButton
                      label="Show"
                      selected={textareaShowSecondaryBtn}
                      onClick={() => setTextareaShowSecondaryBtn(true)}
                    />
                    <OptionButton
                      label="Hide"
                      selected={!textareaShowSecondaryBtn}
                      onClick={() => setTextareaShowSecondaryBtn(false)}
                    />
                  </div>
                </div>

                {/* Control */}
                <div className="flex items-center gap-12">
                  <span className="text-t3 font-medium text-text-secondary w-100">
                    Control
                  </span>
                  <div className="flex gap-8">
                    <OptionButton
                      label="Show"
                      selected={textareaShowControl}
                      onClick={() => setTextareaShowControl(true)}
                    />
                    <OptionButton
                      label="Hide"
                      selected={!textareaShowControl}
                      onClick={() => setTextareaShowControl(false)}
                    />
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Preview */}
          <div className="flex flex-col items-center justify-center p-32 bg-white rounded-small border border-gray-200">
            <div className="w-full max-w-[600px]">
              <Textarea
                placeholder="Placeholder..."
                rows={5}
                disabled={textareaDisabled}
              >
                {textareaShowActions && (
                  <Textarea.Actions>
                    {textareaShowSecondaryBtn && (
                      <Button buttonStyle="secondary" disabled={textareaDisabled}>
                        Button
                      </Button>
                    )}
                    {textareaShowPrimaryBtn && (
                      <Button disabled={textareaDisabled}>Button</Button>
                    )}
                    {textareaShowControl && (
                      <span className="text-text-secondary text-label-m">0/500</span>
                    )}
                  </Textarea.Actions>
                )}
              </Textarea>
            </div>
          </div>
        </div>
      </section>

      {/* Textarea - All States */}
      <section className="mb-40">
        <h2 className="text-h3 font-semibold mb-16">Textarea - All States</h2>
        <div className="p-24 bg-gray-50 rounded-medium">
          <div className="grid grid-cols-2 gap-16">
            {/* Default */}
            <div>
              <p className="text-label-m text-text-secondary mb-8">
                1-1. Default
              </p>
              <Textarea placeholder="Placeholder..." rows={5}>
                <Textarea.Actions>
                  <Button buttonStyle="secondary">Button</Button>
                  <Button>Button</Button>
                  <span className="text-text-secondary text-label-m">0/500</span>
                </Textarea.Actions>
              </Textarea>
            </div>

            {/* Hover - CSS로 자동 처리되므로 설명만 */}
            <div>
              <p className="text-label-m text-text-secondary mb-8">
                1-2. Hover (자동)
              </p>
              <Textarea
                placeholder="Hover over me..."
                rows={5}
                className="hover:border-border-200-hover"
              >
                <Textarea.Actions>
                  <Button buttonStyle="secondary">Button</Button>
                  <Button>Button</Button>
                  <span className="text-text-secondary text-label-m">0/500</span>
                </Textarea.Actions>
              </Textarea>
            </div>

            {/* Focused - CSS로 자동 처리되므로 설명만 */}
            <div>
              <p className="text-label-m text-text-secondary mb-8">
                1-3. Focused (클릭 시)
              </p>
              <Textarea placeholder="Click to focus..." rows={5}>
                <Textarea.Actions>
                  <Button buttonStyle="secondary">Button</Button>
                  <Button>Button</Button>
                  <span className="text-text-secondary text-label-m">0/500</span>
                </Textarea.Actions>
              </Textarea>
            </div>

            {/* Disabled */}
            <div>
              <p className="text-label-m text-text-secondary mb-8">
                1-4. Disabled
              </p>
              <Textarea placeholder="Placeholder..." rows={5} disabled>
                <Textarea.Actions>
                  <Button buttonStyle="secondary" disabled>
                    Button
                  </Button>
                  <Button disabled>Button</Button>
                  <span className="text-text-secondary text-label-m">0/500</span>
                </Textarea.Actions>
              </Textarea>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
