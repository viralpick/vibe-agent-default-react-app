import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { OptionButton } from "./ui-shared";

const checkboxSizes = ["sm", "md"] as const;
const checkboxStates = ["unchecked", "checked", "indeterminate"] as const;

export function CheckboxPage() {
  const [checkboxSize, setCheckboxSize] = useState<(typeof checkboxSizes)[number]>("sm");
  const [checkboxChecked, setCheckboxChecked] = useState<boolean | "indeterminate">(false);
  const [checkboxDisabled, setCheckboxDisabled] = useState(false);

  return (
    <div className="space-y-40">
      <section>
        <h2 className="text-h3 font-semibold mb-16">Checkbox Playground</h2>
        <div className="p-24 bg-gray-50 rounded-medium">
          <div className="space-y-16 mb-24">
            <div className="flex items-center gap-12">
              <span className="text-t3 font-medium text-text-secondary w-100">Size</span>
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
            <div className="flex items-center gap-12">
              <span className="text-t3 font-medium text-text-secondary w-100">Checked</span>
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
                        state === "unchecked" ? false : state === "checked" ? true : "indeterminate"
                      )
                    }
                  />
                ))}
              </div>
            </div>
            <div className="flex items-center gap-12">
              <span className="text-t3 font-medium text-text-secondary w-100">Disabled</span>
              <div className="flex gap-8">
                <OptionButton label="Yes" selected={checkboxDisabled} onClick={() => setCheckboxDisabled(true)} />
                <OptionButton label="No" selected={!checkboxDisabled} onClick={() => setCheckboxDisabled(false)} />
              </div>
            </div>
          </div>

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

      <section>
        <h2 className="text-h3 font-semibold mb-16">Checkbox - All Variants</h2>
        <div className="p-24 bg-gray-50 rounded-medium">
          <div className="grid grid-cols-6 gap-16">
            <div className="col-span-3 text-center text-t3 font-semibold text-text-secondary border-b border-gray-200 pb-8">sm (16x16)</div>
            <div className="col-span-3 text-center text-t3 font-semibold text-text-secondary border-b border-gray-200 pb-8">md (20x20)</div>

            <div className="text-center text-label-m text-text-secondary">unchecked</div>
            <div className="text-center text-label-m text-text-secondary">checked</div>
            <div className="text-center text-label-m text-text-secondary">indeterminate</div>
            <div className="text-center text-label-m text-text-secondary">unchecked</div>
            <div className="text-center text-label-m text-text-secondary">checked</div>
            <div className="text-center text-label-m text-text-secondary">indeterminate</div>

            <div className="col-span-6 text-label-2 text-text-secondary mt-16 mb-8">Default</div>
            <div className="flex justify-center p-16 bg-white rounded-small"><Checkbox size="sm" checked={false} /></div>
            <div className="flex justify-center p-16 bg-white rounded-small"><Checkbox size="sm" checked={true} /></div>
            <div className="flex justify-center p-16 bg-white rounded-small"><Checkbox size="sm" checked="indeterminate" /></div>
            <div className="flex justify-center p-16 bg-white rounded-small"><Checkbox size="md" checked={false} /></div>
            <div className="flex justify-center p-16 bg-white rounded-small"><Checkbox size="md" checked={true} /></div>
            <div className="flex justify-center p-16 bg-white rounded-small"><Checkbox size="md" checked="indeterminate" /></div>

            <div className="col-span-6 text-label-2 text-text-secondary mt-16 mb-8">Disabled</div>
            <div className="flex justify-center p-16 bg-white rounded-small"><Checkbox size="sm" checked={false} disabled /></div>
            <div className="flex justify-center p-16 bg-white rounded-small"><Checkbox size="sm" checked={true} disabled /></div>
            <div className="flex justify-center p-16 bg-white rounded-small"><Checkbox size="sm" checked="indeterminate" disabled /></div>
            <div className="flex justify-center p-16 bg-white rounded-small"><Checkbox size="md" checked={false} disabled /></div>
            <div className="flex justify-center p-16 bg-white rounded-small"><Checkbox size="md" checked={true} disabled /></div>
            <div className="flex justify-center p-16 bg-white rounded-small"><Checkbox size="md" checked="indeterminate" disabled /></div>
          </div>
        </div>
      </section>
    </div>
  );
}
