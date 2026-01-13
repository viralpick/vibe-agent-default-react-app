"use client";

import React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

/**
 * Tab item definition
 * @property id - Unique identifier for the tab
 * @property label - Display text for the tab trigger
 * @property default - Whether this tab is selected by default
 */
export type ViewTabItem = { id: string; label: string; default?: boolean };

/**
 * Props for ViewTabs component
 */
export type ViewTabsProps = {
  tabs: ViewTabItem[];
  contentsById: Record<string, React.ReactNode>;
};

/**
 * @component ViewTabs
 * @description A tab-based view switcher that renders different content sections
 * based on tab selection. Wraps the base Tabs component with a convenient API.
 *
 * @dataStructure
 * - tabs: ViewTabItem[] - Array of tab definitions (required)
 *   - id: string - Unique tab identifier
 *   - label: string - Display text
 *   - default?: boolean - Set as default active tab
 * - contentsById: Record<string, ReactNode> - Map of tab id to content (required)
 *   - Keys must match tab ids
 *   - Values are React nodes to render
 *
 * @designTokens
 * - Uses w-full for full width
 * - Uses mt-2 for content top margin
 * - Uses gap-6 between content elements
 *
 * @useCase
 * - Dashboard section navigation
 * - Multi-view data displays
 * - Settings/configuration panels
 * - Any page with distinct content sections
 *
 * @example
 * ```tsx
 * <ViewTabs
 *   tabs={[
 *     { id: "overview", label: "Overview", default: true },
 *     { id: "details", label: "Details" },
 *     { id: "analytics", label: "Analytics" }
 *   ]}
 *   contentsById={{
 *     overview: <OverviewSection />,
 *     details: <DetailsSection />,
 *     analytics: <AnalyticsSection />
 *   }}
 * />
 * ```
 */
export function ViewTabs({
  tabs,
  contentsById,
}: ViewTabsProps): React.JSX.Element {
  const defaultValue = tabs.find((t) => t.default)?.id || tabs[0]?.id || "";
  return (
    <Tabs defaultValue={defaultValue} className="w-full">
      <TabsList>
        {tabs.map((t) => (
          <TabsTrigger key={t.id} value={t.id}>
            {t.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {tabs.map((t) => (
        <TabsContent
          key={t.id}
          value={t.id}
          className="mt-2 flex flex-col gap-6"
        >
          {contentsById[t.id] ?? null}
        </TabsContent>
      ))}
    </Tabs>
  );
}
