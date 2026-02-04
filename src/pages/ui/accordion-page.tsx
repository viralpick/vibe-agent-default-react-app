import { useState } from "react";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Settings, Info } from "lucide-react";
import { OptionButton } from "./ui-shared";

const accordionSizes = ["lg", "md"] as const;
const accordionTypes = ["single", "multiple"] as const;

export function AccordionPage() {
  const [accordionSize, setAccordionSize] = useState<(typeof accordionSizes)[number]>("lg");
  const [accordionType, setAccordionType] = useState<(typeof accordionTypes)[number]>("single");
  const [showLeadIcon, setShowLeadIcon] = useState(true);
  const [showDescription, setShowDescription] = useState(true);
  const [showDescIcon, setShowDescIcon] = useState(true);

  return (
    <div className="space-y-40">
      <section>
        <h2 className="text-h3 font-semibold mb-16">Accordion Playground</h2>
        <div className="p-24 bg-gray-50 rounded-medium">
          <div className="space-y-16 mb-24">
            <div className="flex items-center gap-12">
              <span className="text-t3 font-medium text-text-secondary w-100">Type</span>
              <div className="flex gap-8">
                {accordionTypes.map((type) => (
                  <OptionButton key={type} label={type} selected={accordionType === type} onClick={() => setAccordionType(type)} />
                ))}
              </div>
            </div>
            <div className="flex items-center gap-12">
              <span className="text-t3 font-medium text-text-secondary w-100">Size</span>
              <div className="flex gap-8">
                {accordionSizes.map((size) => (
                  <OptionButton key={size} label={size} selected={accordionSize === size} onClick={() => setAccordionSize(size)} />
                ))}
              </div>
            </div>
            <div className="flex items-center gap-12">
              <span className="text-t3 font-medium text-text-secondary w-100">Lead Icon</span>
              <div className="flex gap-8">
                <OptionButton label="Show" selected={showLeadIcon} onClick={() => setShowLeadIcon(true)} />
                <OptionButton label="Hide" selected={!showLeadIcon} onClick={() => setShowLeadIcon(false)} />
              </div>
            </div>
            <div className="flex items-center gap-12">
              <span className="text-t3 font-medium text-text-secondary w-100">Description</span>
              <div className="flex gap-8">
                <OptionButton label="Show" selected={showDescription} onClick={() => setShowDescription(true)} />
                <OptionButton label="Hide" selected={!showDescription} onClick={() => setShowDescription(false)} />
              </div>
            </div>
            <div className="flex items-center gap-12">
              <span className="text-t3 font-medium text-text-secondary w-100">Desc Icon</span>
              <div className="flex gap-8">
                <OptionButton label="Show" selected={showDescIcon} onClick={() => setShowDescIcon(true)} />
                <OptionButton label="Hide" selected={!showDescIcon} onClick={() => setShowDescIcon(false)} />
              </div>
            </div>
          </div>

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
                  <p className="text-body-s text-text-secondary mb-12">Accordion content</p>
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
                  <p className="text-body-s text-text-secondary mb-12">Accordion content</p>
                  <div className="h-120 bg-purple-100 rounded-medium border-2 border-dashed border-purple-300 flex items-center justify-center">
                    <span className="text-purple-600 text-body-m">Slot</span>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </div>
      </section>
    </div>
  );
}
