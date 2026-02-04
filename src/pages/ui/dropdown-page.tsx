import { useState } from "react";
import { Select, MultiSelect, type DropdownOption } from "@/components/ui/dropdown";
import { Settings, User, Mail, Bell, Folder } from "lucide-react";
import { OptionButton } from "./ui-shared";

const simpleOptions: DropdownOption[] = [
  { value: "option-1", label: "Option 1" },
  { value: "option-2", label: "Option 2" },
  { value: "option-3", label: "Option 3" },
  { value: "option-4", label: "Option 4" },
  { value: "option-5", label: "Option 5" },
  { value: "option-6", label: "Option 6" },
  { value: "option-7", label: "Option 7" },
  { value: "option-8", label: "Option 8" },
];

const optionsWithIcons: DropdownOption[] = [
  { value: "settings", label: "Settings", leadIcon: <Settings size={16} /> },
  { value: "profile", label: "Profile", leadIcon: <User size={16} /> },
  { value: "messages", label: "Messages", leadIcon: <Mail size={16} /> },
  { value: "notifications", label: "Notifications", leadIcon: <Bell size={16} /> },
  { value: "files", label: "Files", leadIcon: <Folder size={16} /> },
];

const optionsWithCaptions: DropdownOption[] = [
  { value: "option-1", label: "Option 1", caption: "Help text" },
  { value: "option-2", label: "Option 2", caption: "Help text" },
  { value: "option-3", label: "Option 3", caption: "Help text" },
];

const optionsWithDisabled: DropdownOption[] = [
  { value: "option-1", label: "Option 1" },
  { value: "option-2", label: "Option 2", disabled: true },
  { value: "option-3", label: "Option 3" },
  { value: "option-4", label: "Option 4", disabled: true },
];

const sizes = ["sm", "md"] as const;
const variants = ["default", "inline"] as const;
const sides = ["left", "right"] as const;

export function DropdownPage() {
  // Single Select state
  const [selectValue, setSelectValue] = useState("");
  const [selectSize, setSelectSize] = useState<(typeof sizes)[number]>("md");
  const [selectVariant, setSelectVariant] = useState<(typeof variants)[number]>("default");
  const [selectSide, setSelectSide] = useState<(typeof sides)[number]>("left");
  const [selectDisabled, setSelectDisabled] = useState(false);

  // Multi Select state
  const [multiValues, setMultiValues] = useState<string[]>([]);
  const [multiSize, setMultiSize] = useState<(typeof sizes)[number]>("md");
  const [multiVariant, setMultiVariant] = useState<(typeof variants)[number]>("default");

  return (
    <div className="space-y-40">
      {/* Single Select Playground */}
      <section>
        <h2 className="text-h3 font-semibold mb-16">Select (단일 선택)</h2>
        <div className="p-24 bg-gray-50 rounded-medium">
          <div className="space-y-16 mb-24">
            <div className="flex items-center gap-12">
              <span className="text-t3 font-medium text-text-secondary w-100">Size</span>
              <div className="flex gap-8">
                {sizes.map((size) => (
                  <OptionButton key={size} label={size} selected={selectSize === size} onClick={() => setSelectSize(size)} />
                ))}
              </div>
            </div>
            <div className="flex items-center gap-12">
              <span className="text-t3 font-medium text-text-secondary w-100">Variant</span>
              <div className="flex gap-8">
                {variants.map((v) => (
                  <OptionButton key={v} label={v} selected={selectVariant === v} onClick={() => setSelectVariant(v)} />
                ))}
              </div>
            </div>
            <div className="flex items-center gap-12">
              <span className="text-t3 font-medium text-text-secondary w-100">Side</span>
              <div className="flex gap-8">
                {sides.map((s) => (
                  <OptionButton key={s} label={s} selected={selectSide === s} onClick={() => setSelectSide(s)} />
                ))}
              </div>
            </div>
            <div className="flex items-center gap-12">
              <span className="text-t3 font-medium text-text-secondary w-100">Disabled</span>
              <div className="flex gap-8">
                <OptionButton label="Yes" selected={selectDisabled} onClick={() => setSelectDisabled(true)} />
                <OptionButton label="No" selected={!selectDisabled} onClick={() => setSelectDisabled(false)} />
              </div>
            </div>
          </div>

          <div className="flex items-start gap-32 p-32 bg-white rounded-small border border-gray-200">
            <Select
              options={simpleOptions}
              value={selectValue}
              onValueChange={setSelectValue}
              placeholder="Select"
              size={selectSize}
              variant={selectVariant}
              side={selectSide}
              disabled={selectDisabled}
            />
          </div>

          {/* Result Display */}
          <div className="mt-16 p-16 bg-background-100 rounded-medium">
            <span className="text-label-2 text-text-secondary">선택된 값: </span>
            <span className="text-label-2 text-text-primary font-medium">
              {selectValue || "(없음)"}
            </span>
          </div>
        </div>
      </section>

      {/* Multi Select Playground */}
      <section>
        <h2 className="text-h3 font-semibold mb-16">MultiSelect (복수 선택)</h2>
        <div className="p-24 bg-gray-50 rounded-medium">
          <div className="space-y-16 mb-24">
            <div className="flex items-center gap-12">
              <span className="text-t3 font-medium text-text-secondary w-100">Size</span>
              <div className="flex gap-8">
                {sizes.map((size) => (
                  <OptionButton key={size} label={size} selected={multiSize === size} onClick={() => setMultiSize(size)} />
                ))}
              </div>
            </div>
            <div className="flex items-center gap-12">
              <span className="text-t3 font-medium text-text-secondary w-100">Variant</span>
              <div className="flex gap-8">
                {variants.map((v) => (
                  <OptionButton key={v} label={v} selected={multiVariant === v} onClick={() => setMultiVariant(v)} />
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-start gap-32 p-32 bg-white rounded-small border border-gray-200">
            <MultiSelect
              options={simpleOptions}
              values={multiValues}
              onValuesChange={setMultiValues}
              placeholder="Select"
              size={multiSize}
              variant={multiVariant}
            />
          </div>

          {/* Result Display */}
          <div className="mt-16 p-16 bg-background-100 rounded-medium">
            <span className="text-label-2 text-text-secondary">선택된 값: </span>
            <span className="text-label-2 text-text-primary font-medium">
              {multiValues.length > 0 ? multiValues.join(", ") : "(없음)"}
            </span>
          </div>
        </div>
      </section>

      {/* Examples */}
      <section>
        <h2 className="text-h3 font-semibold mb-16">Dropdown - Examples</h2>
        <div className="grid grid-cols-2 gap-24">
          <div className="p-24 bg-gray-50 rounded-medium">
            <h3 className="text-t2 font-semibold mb-12">아이콘 포함</h3>
            <Select
              options={optionsWithIcons}
              placeholder="Select with icons"
              label="With Icons"
            />
          </div>

          <div className="p-24 bg-gray-50 rounded-medium">
            <h3 className="text-t2 font-semibold mb-12">캡션 포함</h3>
            <Select
              options={optionsWithCaptions}
              placeholder="Select with captions"
              label="With Captions"
            />
          </div>

          <div className="p-24 bg-gray-50 rounded-medium">
            <h3 className="text-t2 font-semibold mb-12">비활성화 옵션</h3>
            <Select
              options={optionsWithDisabled}
              placeholder="Select with disabled"
              label="With Disabled Options"
            />
          </div>

          <div className="p-24 bg-gray-50 rounded-medium">
            <h3 className="text-t2 font-semibold mb-12">Small 사이즈</h3>
            <Select
              options={simpleOptions}
              placeholder="Small select"
              size="sm"
              label="Small Size"
            />
          </div>
        </div>
      </section>
    </div>
  );
}
