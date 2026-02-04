import { useState } from "react";
import {
  Layout,
  Grid,
  PageHeader,
  StatCard,
  StatusCard,
  ChartCard,
  CommentCard,
  ViewTabs,
  EditableText,
  DatePeriodSelector,
  DynamicLineChart,
  DynamicBarChart,
  type DatePeriodValue,
} from "@/components/patterns";
import { Button } from "@/components/ui/button";
import { Download, Plus, LayoutDashboard, BarChart3, Users, DollarSign, TrendingUp } from "lucide-react";

export default function PatternsPage() {
  const [period, setPeriod] = useState<DatePeriodValue>();

  const chartData = [
    { name: "Jan", value1: 400, value2: 240 },
    { name: "Feb", value1: 300, value2: 139 },
    { name: "Mar", value1: 200, value2: 980 },
    { name: "Apr", value1: 278, value2: 390 },
    { name: "May", value1: 189, value2: 480 },
  ];

  return (
    <Layout>
      <PageHeader
        title="Patterns Showcase"
        description="A comprehensive gallery of standardized UI patterns used for building data-driven views."
        icon={LayoutDashboard}
      >
        <div className="flex gap-8">
          <Button buttonStyle="secondary" leadIcon={<Download className="size-16" />}>
            Download Report
          </Button>
          <Button leadIcon={<Plus className="size-16" />}>Create New</Button>
        </div>
      </PageHeader>

      <div className="mb-24">
        <DatePeriodSelector value={period} onChange={setPeriod} />
      </div>

      <ViewTabs
        tabs={[
          { id: "overview", label: "Overview", default: true },
          { id: "metrics", label: "Detailed Metrics" },
          { id: "charts", label: "Charts" },
        ]}
        contentsById={{
          overview: (
            <Grid cols={4} gap={16}>
              <StatCard
                title="Total Sales"
                value="$128,430"
                trend={12.5}
                trendValue="12.5%"
                isLoading={false}
                icon={DollarSign}
              />
              <StatCard
                title="Active Users"
                value="2,420"
                trend={-3.2}
                trendValue="3.2%"
                isLoading={false}
                icon={Users}
              />
              <StatCard
                title="Conversion Rate"
                value="4.8%"
                trend={0.5}
                trendValue="0.5%"
                isLoading={false}
                icon={TrendingUp}
              />
              <StatCard
                title="Avg. Order Value"
                value="$53.12"
                trend={0}
                trendValue="0%"
                isLoading={false}
                icon={BarChart3}
              />

              <StatusCard
                title="Monthly Target Progress"
                percent={{ value: 75 }}
                value={75000}
                maxValue={100000}
                format={{ type: "currency" }}
                progress={{ current: 75, max: 100 }}
              />
              <StatusCard
                title="Customer Satisfaction"
                rating={{ value: 4.5, max: 5 }}
                value={4.5}
                format={{ type: "rating" }}
              />

              <CommentCard
                status="neutral"
                comment="Low stock detected for 12 items in the Electronics category. Consider restocking within the next 3 days to avoid stockouts."
              />
            </Grid>
          ),
          metrics: (
            <Grid cols={3} gap={16}>
              <StatusCard
                title="Revenue Growth"
                value={15.4}
                format={{ type: "percent" }}
                metrics={{ mom: 12.5, wow: 2.1 }}
              />
              <StatusCard
                title="Acquisition Cost"
                value={42.5}
                format={{ type: "currency" }}
                note="Across all channels"
              />
              <StatusCard
                title="Retention Rate"
                value={88}
                format={{ type: "percent" }}
                progress={{ current: 88, max: 100 }}
              />
            </Grid>
          ),
          charts: (
            <Grid cols={2} gap={24}>
              <ChartCard title="Sales Trend">
                <DynamicLineChart
                  data={chartData}
                  xAxisKey="name"
                  config={{
                    value1: { label: "Current Period", color: "#3b82f6" },
                    value2: { label: "Previous Period", color: "#94a3b8" },
                  }}
                />
              </ChartCard>
              <ChartCard title="Category Distribution">
                <DynamicBarChart
                  data={chartData}
                  xAxisKey="name"
                  config={{
                    value1: { label: "Electronics", color: "#3b82f6" },
                    value2: { label: "Apparel", color: "#10b981" },
                  }}
                />
              </ChartCard>
            </Grid>
          ),
        }}
      />

      <div className="mt-48 p-24 bg-gray-50 rounded-large">
        <h3 className="text-label-1 font-semibold mb-16">Editable Content</h3>
        <EditableText data-editable="true" data-line-number="127">
          Double click to edit this description of the campaign.
        </EditableText>
      </div>
    </Layout>
  );
}
