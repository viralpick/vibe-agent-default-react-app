import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Info } from "lucide-react";
import { OptionButton } from "./ui-shared";

const inputSizes = ["sm", "md"] as const;
const inputIconOptions = ["none", "lead", "tail", "both"] as const;

export function InputPage() {
  const [inputSize, setInputSize] = useState<(typeof inputSizes)[number]>("md");
  const [inputIcon, setInputIcon] = useState<(typeof inputIconOptions)[number]>("both");
  const [inputShowBadge, setInputShowBadge] = useState(true);
  const [inputValue, setInputValue] = useState("");
  const [inputDisabled, setInputDisabled] = useState(false);

  return (
    <div className="space-y-40">
      <section>
        <h2 className="text-h3 font-semibold mb-16">Input Playground</h2>
        <div className="p-24 bg-gray-50 rounded-medium">
          <div className="space-y-16 mb-24">
            <div className="flex items-center gap-12">
              <span className="text-t3 font-medium text-text-secondary w-100">Size</span>
              <div className="flex gap-8">
                {inputSizes.map((size) => (
                  <OptionButton key={size} label={size} selected={inputSize === size} onClick={() => setInputSize(size)} />
                ))}
              </div>
            </div>
            <div className="flex items-center gap-12">
              <span className="text-t3 font-medium text-text-secondary w-100">Icon</span>
              <div className="flex gap-8">
                {inputIconOptions.map((icon) => (
                  <OptionButton key={icon} label={icon} selected={inputIcon === icon} onClick={() => setInputIcon(icon)} />
                ))}
              </div>
            </div>
            <div className="flex items-center gap-12">
              <span className="text-t3 font-medium text-text-secondary w-100">Badge</span>
              <div className="flex gap-8">
                <OptionButton label="Show" selected={inputShowBadge} onClick={() => setInputShowBadge(true)} />
                <OptionButton label="Hide" selected={!inputShowBadge} onClick={() => setInputShowBadge(false)} />
              </div>
            </div>
            <div className="flex items-center gap-12">
              <span className="text-t3 font-medium text-text-secondary w-100">Value</span>
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Enter value..."
                className="px-12 py-6 border border-gray-300 rounded-small text-label-m"
              />
            </div>
            <div className="flex items-center gap-12">
              <span className="text-t3 font-medium text-text-secondary w-100">Disabled</span>
              <div className="flex gap-8">
                <OptionButton label="Yes" selected={inputDisabled} onClick={() => setInputDisabled(true)} />
                <OptionButton label="No" selected={!inputDisabled} onClick={() => setInputDisabled(false)} />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center p-32 bg-white rounded-small border border-gray-200">
            <Input
              size={inputSize}
              placeholder="Input"
              value={inputValue}
              disabled={inputDisabled}
              leadIcon={(inputIcon === "lead" || inputIcon === "both") ? <Search /> : undefined}
              tailIcon={(inputIcon === "tail" || inputIcon === "both") ? <Info /> : undefined}
              badge={inputShowBadge ? <Badge size="sm" theme="gray" badgeStyle="light">⌘E</Badge> : undefined}
            />
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-h3 font-semibold mb-16">Input - All Variants</h2>
        <div className="p-24 bg-gray-50 rounded-medium space-y-16">
          {inputSizes.map((size) => (
            <div key={size} className="space-y-8">
              <h3 className="text-t2 font-semibold capitalize">{size}</h3>
              <div className="grid grid-cols-3 gap-16">
                <div>
                  <p className="text-label-m text-text-secondary mb-8">Default</p>
                  <Input size={size} placeholder="Input" leadIcon={<Search />} badge={<Badge size="sm" theme="gray" badgeStyle="light">⌘E</Badge>} tailIcon={<Info />} />
                </div>
                <div>
                  <p className="text-label-m text-text-secondary mb-8">Filled</p>
                  <Input size={size} placeholder="Input" value="Filled value" leadIcon={<Search />} badge={<Badge size="sm" theme="gray" badgeStyle="light">⌘E</Badge>} tailIcon={<Info />} />
                </div>
                <div>
                  <p className="text-label-m text-text-secondary mb-8">Disabled</p>
                  <Input size={size} placeholder="Input" disabled leadIcon={<Search />} badge={<Badge size="sm" theme="gray" badgeStyle="light">⌘E</Badge>} tailIcon={<Info />} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
