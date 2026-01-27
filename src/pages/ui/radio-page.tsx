import { useState } from "react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio";
import { OptionButton } from "./ui-shared";

const radioSizes = ["sm", "md"] as const;

export function RadioPage() {
  const [radioSize, setRadioSize] = useState<(typeof radioSizes)[number]>("sm");
  const [radioDisabled, setRadioDisabled] = useState(false);
  const [playgroundValue, setPlaygroundValue] = useState("option1");

  return (
    <div className="space-y-40">
      <section>
        <h2 className="text-h3 font-semibold mb-16">Radio Playground</h2>
        <div className="p-24 bg-gray-50 rounded-medium">
          <div className="space-y-16 mb-24">
            <div className="flex items-center gap-12">
              <span className="text-t3 font-medium text-text-secondary w-100">Size</span>
              <div className="flex gap-8">
                {radioSizes.map((size) => (
                  <OptionButton
                    key={size}
                    label={size}
                    selected={radioSize === size}
                    onClick={() => setRadioSize(size)}
                  />
                ))}
              </div>
            </div>
            <div className="flex items-center gap-12">
              <span className="text-t3 font-medium text-text-secondary w-100">Disabled</span>
              <div className="flex gap-8">
                <OptionButton label="Yes" selected={radioDisabled} onClick={() => setRadioDisabled(true)} />
                <OptionButton label="No" selected={!radioDisabled} onClick={() => setRadioDisabled(false)} />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center p-32 bg-white rounded-small border border-gray-200">
            <RadioGroup value={playgroundValue} onValueChange={setPlaygroundValue} disabled={radioDisabled}>
              <div className="flex items-center space-x-8">
                <RadioGroupItem value="option1" id="playground-r1" size={radioSize} />
                <label htmlFor="playground-r1" className="text-t3 cursor-pointer">
                  Option 1
                </label>
              </div>
              <div className="flex items-center space-x-8">
                <RadioGroupItem value="option2" id="playground-r2" size={radioSize} />
                <label htmlFor="playground-r2" className="text-t3 cursor-pointer">
                  Option 2
                </label>
              </div>
              <div className="flex items-center space-x-8">
                <RadioGroupItem value="option3" id="playground-r3" size={radioSize} />
                <label htmlFor="playground-r3" className="text-t3 cursor-pointer">
                  Option 3
                </label>
              </div>
            </RadioGroup>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-h3 font-semibold mb-16">Radio - All Variants</h2>
        <div className="space-y-32">
          <div>
            <h3 className="text-t2 font-semibold mb-12">Sizes</h3>
            <div className="grid grid-cols-2 gap-16">
              {radioSizes.map((size) => (
                <div key={size} className="space-y-8">
                  <span className="text-label-2 text-text-secondary capitalize">{size}</span>
                  <RadioGroup defaultValue="option1">
                    <div className="flex items-center space-x-8">
                      <RadioGroupItem value="option1" id={`${size}-r1`} size={size} />
                      <label htmlFor={`${size}-r1`} className="text-t3 cursor-pointer">
                        Option 1
                      </label>
                    </div>
                    <div className="flex items-center space-x-8">
                      <RadioGroupItem value="option2" id={`${size}-r2`} size={size} />
                      <label htmlFor={`${size}-r2`} className="text-t3 cursor-pointer">
                        Option 2
                      </label>
                    </div>
                    <div className="flex items-center space-x-8">
                      <RadioGroupItem value="option3" id={`${size}-r3`} size={size} />
                      <label htmlFor={`${size}-r3`} className="text-t3 cursor-pointer">
                        Option 3
                      </label>
                    </div>
                  </RadioGroup>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-t2 font-semibold mb-12">Disabled States</h3>
            <div className="grid grid-cols-2 gap-16">
              <div className="space-y-8">
                <span className="text-label-2 text-text-secondary">Group Disabled</span>
                <RadioGroup defaultValue="option1" disabled>
                  <div className="flex items-center space-x-8">
                    <RadioGroupItem value="option1" id="disabled-r1" size="md" />
                    <label htmlFor="disabled-r1" className="text-t3 cursor-pointer">
                      Option 1
                    </label>
                  </div>
                  <div className="flex items-center space-x-8">
                    <RadioGroupItem value="option2" id="disabled-r2" size="md" />
                    <label htmlFor="disabled-r2" className="text-t3 cursor-pointer">
                      Option 2
                    </label>
                  </div>
                </RadioGroup>
              </div>
              <div className="space-y-8">
                <span className="text-label-2 text-text-secondary">Item Disabled</span>
                <RadioGroup defaultValue="option1">
                  <div className="flex items-center space-x-8">
                    <RadioGroupItem value="option1" id="item-disabled-r1" size="md" />
                    <label htmlFor="item-disabled-r1" className="text-t3 cursor-pointer">
                      Option 1
                    </label>
                  </div>
                  <div className="flex items-center space-x-8">
                    <RadioGroupItem value="option2" id="item-disabled-r2" size="md" disabled />
                    <label htmlFor="item-disabled-r2" className="text-t3 cursor-not-allowed text-text-disabled">
                      Option 2 (Disabled)
                    </label>
                  </div>
                  <div className="flex items-center space-x-8">
                    <RadioGroupItem value="option3" id="item-disabled-r3" size="md" />
                    <label htmlFor="item-disabled-r3" className="text-t3 cursor-pointer">
                      Option 3
                    </label>
                  </div>
                </RadioGroup>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-t2 font-semibold mb-12">Without Labels</h3>
            <div className="flex gap-16">
              {radioSizes.map((size) => (
                <RadioGroup key={size} defaultValue="option1">
                  <RadioGroupItem value="option1" size={size} />
                  <RadioGroupItem value="option2" size={size} />
                  <RadioGroupItem value="option3" size={size} />
                </RadioGroup>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
