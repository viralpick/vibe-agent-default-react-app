"use client";

import React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type ViewTabItem = { id: string; label: string; default?: boolean };

export type ViewTabsProps = {
  tabs: ViewTabItem[];
  contentsById: Record<string, React.ReactNode>;
};

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
