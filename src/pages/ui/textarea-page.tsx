import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { OptionButton } from "./ui-shared";

export function TextareaPage() {
  const [textareaDisabled, setTextareaDisabled] = useState(false);
  const [textareaShowActions, setTextareaShowActions] = useState(true);
  const [textareaShowPrimaryBtn, setTextareaShowPrimaryBtn] = useState(true);
  const [textareaShowSecondaryBtn, setTextareaShowSecondaryBtn] = useState(true);
  const [textareaShowControl, setTextareaShowControl] = useState(true);

  return (
    <div className="space-y-40">
      <section>
        <h2 className="text-h3 font-semibold mb-16">Textarea Playground</h2>
        <div className="p-24 bg-gray-50 rounded-medium">
          <div className="space-y-16 mb-24">
            <div className="flex items-center gap-12">
              <span className="text-t3 font-medium text-text-secondary w-100">Disabled</span>
              <div className="flex gap-8">
                <OptionButton label="Yes" selected={textareaDisabled} onClick={() => setTextareaDisabled(true)} />
                <OptionButton label="No" selected={!textareaDisabled} onClick={() => setTextareaDisabled(false)} />
              </div>
            </div>
            <div className="flex items-center gap-12">
              <span className="text-t3 font-medium text-text-secondary w-100">Show Actions</span>
              <div className="flex gap-8">
                <OptionButton label="Yes" selected={textareaShowActions} onClick={() => setTextareaShowActions(true)} />
                <OptionButton label="No" selected={!textareaShowActions} onClick={() => setTextareaShowActions(false)} />
              </div>
            </div>

            {textareaShowActions && (
              <>
                <div className="flex items-center gap-12">
                  <span className="text-t3 font-medium text-text-secondary w-100">Primary Btn</span>
                  <div className="flex gap-8">
                    <OptionButton label="Show" selected={textareaShowPrimaryBtn} onClick={() => setTextareaShowPrimaryBtn(true)} />
                    <OptionButton label="Hide" selected={!textareaShowPrimaryBtn} onClick={() => setTextareaShowPrimaryBtn(false)} />
                  </div>
                </div>
                <div className="flex items-center gap-12">
                  <span className="text-t3 font-medium text-text-secondary w-100">Secondary Btn</span>
                  <div className="flex gap-8">
                    <OptionButton label="Show" selected={textareaShowSecondaryBtn} onClick={() => setTextareaShowSecondaryBtn(true)} />
                    <OptionButton label="Hide" selected={!textareaShowSecondaryBtn} onClick={() => setTextareaShowSecondaryBtn(false)} />
                  </div>
                </div>
                <div className="flex items-center gap-12">
                  <span className="text-t3 font-medium text-text-secondary w-100">Control</span>
                  <div className="flex gap-8">
                    <OptionButton label="Show" selected={textareaShowControl} onClick={() => setTextareaShowControl(true)} />
                    <OptionButton label="Hide" selected={!textareaShowControl} onClick={() => setTextareaShowControl(false)} />
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="flex flex-col items-center justify-center p-32 bg-white rounded-small border border-gray-200">
            <div className="w-full max-w-[600px]">
              <Textarea placeholder="Placeholder..." rows={5} disabled={textareaDisabled}>
                {textareaShowActions && (
                  <Textarea.Actions>
                    {textareaShowSecondaryBtn && <Button buttonStyle="secondary" disabled={textareaDisabled}>Button</Button>}
                    {textareaShowPrimaryBtn && <Button disabled={textareaDisabled}>Button</Button>}
                    {textareaShowControl && <span className="text-text-secondary text-label-m">0/500</span>}
                  </Textarea.Actions>
                )}
              </Textarea>
            </div>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-h3 font-semibold mb-16">Textarea - All States</h2>
        <div className="p-24 bg-gray-50 rounded-medium grid grid-cols-2 gap-16">
          <div>
            <p className="text-label-m text-text-secondary mb-8">Default</p>
            <Textarea placeholder="Placeholder..." rows={5}>
              <Textarea.Actions>
                <Button buttonStyle="secondary">Button</Button>
                <Button>Button</Button>
                <span className="text-text-secondary text-label-m">0/500</span>
              </Textarea.Actions>
            </Textarea>
          </div>
          <div>
            <p className="text-label-m text-text-secondary mb-8">Disabled</p>
            <Textarea placeholder="Placeholder..." rows={5} disabled>
              <Textarea.Actions>
                <Button buttonStyle="secondary" disabled>Button</Button>
                <Button disabled>Button</Button>
                <span className="text-text-secondary text-label-m">0/500</span>
              </Textarea.Actions>
            </Textarea>
          </div>
        </div>
      </section>
    </div>
  );
}
