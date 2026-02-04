import { useState } from "react";
import { Breadcrumb, BreadcrumbItem } from "@/components/ui/breadcrumb";
import { Folder } from "lucide-react";
import { OptionButton } from "./ui-shared";

const dividerTypes = ["chevron", "slash"] as const;

export function BreadcrumbPage() {
  const [breadcrumbDivider, setBreadcrumbDivider] = useState<(typeof dividerTypes)[number]>("chevron");
  const [showBreadcrumbIcon, setShowBreadcrumbIcon] = useState(true);

  return (
    <div className="space-y-40">
      <section>
        <h2 className="text-h3 font-semibold mb-16">Breadcrumb Playground</h2>
        <div className="p-24 bg-gray-50 rounded-medium">
          <div className="space-y-16 mb-24">
            <div className="flex items-center gap-12">
              <span className="text-t3 font-medium text-text-secondary w-100">Divider</span>
              <div className="flex gap-8">
                {dividerTypes.map((type) => (
                  <OptionButton
                    key={type}
                    label={type}
                    selected={breadcrumbDivider === type}
                    onClick={() => setBreadcrumbDivider(type)}
                  />
                ))}
              </div>
            </div>
            <div className="flex items-center gap-12">
              <span className="text-t3 font-medium text-text-secondary w-100">Icon</span>
              <div className="flex gap-8">
                <OptionButton label="Show" selected={showBreadcrumbIcon} onClick={() => setShowBreadcrumbIcon(true)} />
                <OptionButton label="Hide" selected={!showBreadcrumbIcon} onClick={() => setShowBreadcrumbIcon(false)} />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center p-32 bg-white rounded-small border border-gray-200">
            <Breadcrumb divider={breadcrumbDivider}>
              <BreadcrumbItem icon={showBreadcrumbIcon ? <Folder /> : undefined} href="#">Label</BreadcrumbItem>
              <BreadcrumbItem icon={showBreadcrumbIcon ? <Folder /> : undefined} href="#">Label</BreadcrumbItem>
              <BreadcrumbItem icon={showBreadcrumbIcon ? <Folder /> : undefined} href="#">Label</BreadcrumbItem>
              <BreadcrumbItem icon={showBreadcrumbIcon ? <Folder /> : undefined}>Label</BreadcrumbItem>
            </Breadcrumb>
          </div>
        </div>
      </section>
    </div>
  );
}
