import { useState } from "react";
import { Progress } from "@/components/ui/progress";

export function ProgressPage() {
  const [progressValue, setProgressValue] = useState(65);

  return (
    <div className="space-y-40 p-24">
      <section>
        <h2 className="text-h1 font-bold mb-24">Progress</h2>
      </section>

      {/* Control Section */}
      <section className="p-24 bg-gray-50 rounded-medium border border-gray-200">
        <h3 className="text-h3 font-semibold mb-16">Playground</h3>
        <div className="flex items-center gap-12 mb-24">
          <span className="text-t3 font-medium text-text-secondary w-100">Progress</span>
          <input
            type="range"
            min="0"
            max="100"
            value={progressValue}
            onChange={(e) => setProgressValue(Number(e.target.value))}
            className="flex-1 max-w-[400px]"
          />
          <span className="text-label-m text-text-primary font-bold w-40">{progressValue}%</span>
        </div>
      </section>

      {/* Bar Variants */}
      <section className="space-y-24">
        <h3 className="text-h3 font-semibold">Bar Styles</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-24">
          <div className="p-24 border border-gray-200 rounded-medium space-y-16">
            <h4 className="text-t3 font-medium">Default Bar</h4>
            <Progress value={progressValue}>
              <Progress.Bar variant="default" />
            </Progress>
          </div>
          <div className="p-24 border border-gray-200 rounded-medium space-y-16">
            <h4 className="text-t3 font-medium">Stripped Bar</h4>
            <Progress value={progressValue}>
              <Progress.Bar variant="stripped" />
            </Progress>
          </div>
        </div>
      </section>

      {/* Bar Sizes */}
      <section className="space-y-24">
        <h3 className="text-h3 font-semibold">Bar Sizes</h3>
        <div className="p-24 border border-gray-200 rounded-medium space-y-32">
          <div className="space-y-8">
            <span className="text-label-m text-text-secondary">Small (4px)</span>
            <Progress value={progressValue}>
              <Progress.Bar size="sm" />
            </Progress>
          </div>
          <div className="space-y-8">
            <span className="text-label-m text-text-secondary">Medium (8px)</span>
            <Progress value={progressValue}>
              <Progress.Bar size="md" />
            </Progress>
          </div>
          <div className="space-y-8">
            <span className="text-label-m text-text-secondary">Large (12px)</span>
            <Progress value={progressValue}>
              <Progress.Bar size="lg" />
            </Progress>
          </div>
        </div>
      </section>

      {/* Circle Variants */}
      <section className="space-y-24">
        <h3 className="text-h3 font-semibold">Circle Sizes</h3>
        <div className="p-24 border border-gray-200 rounded-medium flex items-end gap-40">
          <div className="flex flex-col items-center gap-12">
            <Progress value={progressValue}>
              <Progress.Circle size="sm" />
            </Progress>
            <span className="text-label-m text-text-secondary">Small (32x32)</span>
          </div>
          <div className="flex flex-col items-center gap-12">
            <Progress value={progressValue}>
              <Progress.Circle size="md" />
            </Progress>
            <span className="text-label-m text-text-secondary">Medium (68x68)</span>
          </div>
          <div className="flex flex-col items-center gap-12">
            <Progress value={progressValue}>
              <Progress.Circle size="lg" />
            </Progress>
            <span className="text-label-m text-text-secondary">Large (80x80)</span>
          </div>
        </div>
      </section>

      {/* Compound Usage */}
      <section className="space-y-24">
        <h3 className="text-h3 font-semibold">Full Layout (Compound)</h3>
        <div className="p-32 border border-gray-200 rounded-medium max-w-[600px] mx-auto">
          <Progress value={progressValue}>
            <Progress.Header>
              <Progress.Label>Label</Progress.Label>
              <Progress.HelpText>Help text</Progress.HelpText>
              <div className="ml-auto flex items-center gap-8">
                <Progress.Value />
                <Progress.Spinner />
              </div>
            </Progress.Header>
            <Progress.Bar size="sm" />
            <Progress.Footer>
              <Progress.Caption>Caption here</Progress.Caption>
            </Progress.Footer>
          </Progress>
        </div>
      </section>
    </div>
  );
}
