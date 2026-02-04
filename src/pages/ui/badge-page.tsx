import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Dot } from "@/components/ui/dot";
import { OptionButton, CircleIcon } from "./ui-shared";

const themes = ["gray", "slate", "blue", "green", "yellow", "red", "purple"] as const;
const sizes = ["lg", "sm"] as const;
const shapes = ["rounded", "pill"] as const;
const badgeStyles = ["light", "filled"] as const;
const iconOptions = ["none", "left", "right", "both"] as const;

export function BadgePage() {
  const [selectedSize, setSelectedSize] = useState<(typeof sizes)[number]>("lg");
  const [selectedShape, setSelectedShape] = useState<(typeof shapes)[number]>("pill");
  const [selectedStyle, setSelectedStyle] = useState<(typeof badgeStyles)[number]>("light");
  const [selectedTheme, setSelectedTheme] = useState<(typeof themes)[number]>("blue");
  const [selectedOutline, setSelectedOutline] = useState(false);
  const [selectedActive, setSelectedActive] = useState(true);
  const [selectedIcon, setSelectedIcon] = useState<(typeof iconOptions)[number]>("none");

  return (
    <div className="space-y-40">
      <section>
        <h2 className="text-h3 font-semibold mb-16">Badge Playground</h2>
        <div className="p-24 bg-gray-50 rounded-medium">
          <div className="space-y-16 mb-24">
            <div className="flex items-center gap-12">
              <span className="text-t3 font-medium text-text-secondary w-80">Size</span>
              <div className="flex gap-8">
                {sizes.map((size) => (
                  <OptionButton key={size} label={size} selected={selectedSize === size} onClick={() => setSelectedSize(size)} />
                ))}
              </div>
            </div>
            <div className="flex items-center gap-12">
              <span className="text-t3 font-medium text-text-secondary w-80">Shape</span>
              <div className="flex gap-8">
                {shapes.map((shape) => (
                  <OptionButton key={shape} label={shape} selected={selectedShape === shape} onClick={() => setSelectedShape(shape)} />
                ))}
              </div>
            </div>
            <div className="flex items-center gap-12">
              <span className="text-t3 font-medium text-text-secondary w-80">Style</span>
              <div className="flex gap-8">
                {badgeStyles.map((style) => (
                  <OptionButton key={style} label={style} selected={selectedStyle === style} onClick={() => setSelectedStyle(style)} />
                ))}
              </div>
            </div>
            <div className="flex items-center gap-12">
              <span className="text-t3 font-medium text-text-secondary w-80">Theme</span>
              <div className="flex gap-8 flex-wrap">
                {themes.map((theme) => (
                  <OptionButton key={theme} label={theme} selected={selectedTheme === theme} onClick={() => setSelectedTheme(theme)} />
                ))}
              </div>
            </div>
            <div className="flex items-center gap-12">
              <span className="text-t3 font-medium text-text-secondary w-80">Outline</span>
              <div className="flex gap-8">
                <OptionButton label="On" selected={selectedOutline === true} onClick={() => setSelectedOutline(true)} />
                <OptionButton label="Off" selected={selectedOutline === false} onClick={() => setSelectedOutline(false)} />
              </div>
            </div>
            <div className="flex items-center gap-12">
              <span className="text-t3 font-medium text-text-secondary w-80">Active</span>
              <div className="flex gap-8">
                <OptionButton label="Active" selected={selectedActive === true} onClick={() => setSelectedActive(true)} />
                <OptionButton label="Inactive" selected={selectedActive === false} onClick={() => setSelectedActive(false)} />
              </div>
            </div>
            <div className="flex items-center gap-12">
              <span className="text-t3 font-medium text-text-secondary w-80">Icon</span>
              <div className="flex gap-8">
                {iconOptions.map((option) => (
                  <OptionButton key={option} label={option} selected={selectedIcon === option} onClick={() => setSelectedIcon(option)} />
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center p-32 bg-white rounded-small border border-gray-200">
            <Badge
              size={selectedSize}
              shape={selectedShape}
              badgeStyle={selectedStyle}
              theme={selectedTheme}
              outline={selectedOutline}
              active={selectedActive}
              leftIcon={(selectedIcon === "left" || selectedIcon === "both") ? <CircleIcon /> : undefined}
              rightIcon={(selectedIcon === "right" || selectedIcon === "both") ? <CircleIcon /> : undefined}
            >
              Badge
            </Badge>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-h3 font-semibold mb-16">Dot</h2>
        <div className="flex gap-16">
          {["gray", "red", "green", "blue"].map(color => (
            <div key={color} className="flex gap-8">
              <Dot size="small" color={color as any} />
              <Dot size="medium" color={color as any} />
              <Dot size="large" color={color as any} />
              <Dot size="xlarge" color={color as any} />
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-h3 font-semibold mb-16">Badge - All Variants</h2>
        <div className="space-y-24">
          <h3 className="text-t3 font-medium mb-8 text-text-secondary">Size: lg / Shape: pill / Style: light</h3>
          <div className="flex flex-wrap gap-8">
            {themes.map((theme) => (
              <Badge key={theme} size="lg" shape="pill" badgeStyle="light" theme={theme} leftIcon={<CircleIcon />} rightIcon={<CircleIcon />}>Badge</Badge>
            ))}
          </div>
          <h3 className="text-t3 font-medium mb-8 text-text-secondary">Size: lg / Shape: pill / Style: filled</h3>
          <div className="flex flex-wrap gap-8">
            {themes.map((theme) => (
              <Badge key={theme} size="lg" shape="pill" badgeStyle="filled" theme={theme} leftIcon={<CircleIcon />} rightIcon={<CircleIcon />}>Badge</Badge>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
