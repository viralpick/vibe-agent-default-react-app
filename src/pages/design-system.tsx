import { useState } from "react";
import { Dot } from "@/components/ui/dot";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { Settings, Info } from "lucide-react";

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

export function DesignSystemPage() {
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

  return (
    <main className="w-full min-h-screen p-24">
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
    </main>
  );
}
