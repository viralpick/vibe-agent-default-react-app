import { useState } from "react";
import { DatePicker, type DateRange } from "@/components/ui/date-picker";
import { Dot } from "@/components/ui/dot";
import { Info } from "lucide-react";
import { Input } from "@/components/ui/input";
import { OptionButton } from "./ui-shared";

export function DatePickerPage() {
  const [datePickerType, setDatePickerType] = useState<"single" | "range">("single");
  const [datePickerHeaderVariant, setDatePickerHeaderVariant] = useState<"variant-a" | "variant-b" | "variant-c" | "variant-d">("variant-a");
  const [datePickerSize, setDatePickerSize] = useState<"sm" | "md">("md");
  const [datePickerShowTime, setDatePickerShowTime] = useState(false);
  const [datePickerShowPresets, setDatePickerShowPresets] = useState(false);
  const [datePickerError, setDatePickerError] = useState(false);
  const [datePickerDisabled, setDatePickerDisabled] = useState(false);
  const [datePickerFormatType, setDatePickerFormatType] = useState<"date" | "iso" | "custom">("date");
  const [datePickerCustomFormat, setDatePickerCustomFormat] = useState("yyyy-MM-dd");
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedRange, setSelectedRange] = useState<DateRange | null>(null);
  const [datePickerShowIndicator, setDatePickerShowIndicator] = useState(true);

  return (
    <div className="space-y-40">
      <section className="space-y-32">
        <h2 className="text-h2 mb-16">DatePicker</h2>
        <div className="space-y-16 mb-32 p-24 bg-background-50 rounded-large">
          <div className="flex flex-wrap gap-8">
            <OptionButton label="Single" selected={datePickerType === "single"} onClick={() => setDatePickerType("single")} />
            <OptionButton label="Range" selected={datePickerType === "range"} onClick={() => setDatePickerType("range")} />
            <OptionButton label="Time Picker" selected={datePickerShowTime} onClick={() => setDatePickerShowTime(!datePickerShowTime)} />
            <OptionButton label="Presets" selected={datePickerShowPresets} onClick={() => setDatePickerShowPresets(!datePickerShowPresets)} />
            <OptionButton label="Error State" selected={datePickerError} onClick={() => setDatePickerError(!datePickerError)} />
            <OptionButton label="Disabled" selected={datePickerDisabled} onClick={() => setDatePickerDisabled(!datePickerDisabled)} />
            <OptionButton label="Indicator" selected={datePickerShowIndicator} onClick={() => setDatePickerShowIndicator(!datePickerShowIndicator)} />
          </div>

          <div>
            <h3 className="text-label-1 font-semibold mb-12">Header Variant</h3>
            <div className="flex flex-wrap gap-8">
              {(["variant-a", "variant-b", "variant-c", "variant-d"] as const).map((v) => (
                <OptionButton key={v} label={v} selected={datePickerHeaderVariant === v} onClick={() => setDatePickerHeaderVariant(v)} />
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-label-1 font-semibold mb-12">Size</h3>
            <div className="flex flex-wrap gap-8">
              {(["sm", "md"] as const).map((s) => (
                <OptionButton key={s} label={s === "sm" ? "Small" : "Medium"} selected={datePickerSize === s} onClick={() => setDatePickerSize(s)} />
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-label-1 font-semibold mb-12">Format Type</h3>
            <div className="flex flex-wrap gap-8">
              {(["date", "iso", "custom"] as const).map((f) => (
                <OptionButton key={f} label={f} selected={datePickerFormatType === f} onClick={() => setDatePickerFormatType(f)} />
              ))}
            </div>
            {datePickerFormatType === "custom" && (
              <div className="mt-12">
                <Input
                  value={datePickerCustomFormat}
                  onChange={(e) => setDatePickerCustomFormat(e.target.value)}
                  placeholder="yyyy년 M월 d일"
                  size="sm"
                  leadIcon={<Info size={14} />}
                />
              </div>
            )}
          </div>
        </div>

        <div className="space-y-24">
          <div className="p-32 bg-background-100 rounded-large max-w-md">
            <DatePicker
              type={datePickerType}
              headerVariant={datePickerHeaderVariant}
              size={datePickerSize}
              timePicker={datePickerShowTime}
              showPresets={datePickerShowPresets}
              formatType={datePickerFormatType}
              customFormat={datePickerFormatType === "custom" ? datePickerCustomFormat : undefined}
              label={datePickerType === "single" ? "날짜 선택" : "기간 선택"}
              placeholder={datePickerType === "single" ? "날짜를 선택하세요" : "시작 날짜 - 종료 날짜"}
              error={datePickerError}
              disabled={datePickerDisabled}
              indicator={datePickerShowIndicator ? () => <Dot size="small" /> : undefined}
              value={datePickerType === "single" ? selectedDate : undefined}
              onValueChange={datePickerType === "single" ? setSelectedDate : undefined}
              rangeValue={datePickerType === "range" ? selectedRange : undefined}
              onRangeValueChange={datePickerType === "range" ? setSelectedRange : undefined}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
