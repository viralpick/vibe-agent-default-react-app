import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export function TabsPage() {
  return (
    <div className="space-y-40">
      <section>
        <h2 className="text-h2 mb-16">Tabs</h2>
        <div className="space-y-24">
          <div>
            <p className="text-label-m text-text-secondary mb-12">1. Segmented (Default)</p>
            <Tabs defaultValue="tab1" variant="segmented">
              <TabsList>
                <TabsTrigger value="tab1">Tab 1</TabsTrigger>
                <TabsTrigger value="tab2">Tab 2</TabsTrigger>
                <TabsTrigger value="tab3">Tab 3</TabsTrigger>
              </TabsList>
              <TabsContent value="tab1"><div className="p-16 bg-background-50 rounded-medium">Content for Tab 1</div></TabsContent>
              <TabsContent value="tab2"><div className="p-16 bg-background-50 rounded-medium">Content for Tab 2</div></TabsContent>
              <TabsContent value="tab3"><div className="p-16 bg-background-50 rounded-medium">Content for Tab 3</div></TabsContent>
            </Tabs>
          </div>
          <div>
            <p className="text-label-m text-text-secondary mb-12">2. Fill</p>
            <Tabs defaultValue="tab1" variant="fill">
              <TabsList>
                <TabsTrigger value="tab1">Tab 1</TabsTrigger>
                <TabsTrigger value="tab2">Tab 2</TabsTrigger>
                <TabsTrigger value="tab3">Tab 3</TabsTrigger>
              </TabsList>
              <TabsContent value="tab1"><div className="p-16 bg-background-50 rounded-medium">Content for Tab 1</div></TabsContent>
            </Tabs>
          </div>
          <div>
            <p className="text-label-m text-text-secondary mb-12">3. Line</p>
            <Tabs defaultValue="tab1" variant="line">
              <TabsList>
                <TabsTrigger value="tab1">Tab 1</TabsTrigger>
                <TabsTrigger value="tab2">Tab 2</TabsTrigger>
                <TabsTrigger value="tab3">Tab 3</TabsTrigger>
              </TabsList>
              <TabsContent value="tab1"><div className="p-16 bg-background-50 rounded-medium">Content for Tab 1</div></TabsContent>
            </Tabs>
          </div>
        </div>
      </section>
    </div>
  );
}
