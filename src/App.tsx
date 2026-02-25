import type { ColumnDef } from "@tanstack/react-table";

import { DataTable, DataTableColumnHeader } from "@/components/ui/data-table";
import {
  DynamicLineChart,
  DynamicAreaChart,
  DynamicBarChart,
  DynamicComposedChart,
  DynamicPieChart,
} from "@/components/patterns/dynamic-chart";

type User = {
  id: number;
  name: string;
  email: string;
  role: string;
  status: string;
  joinedAt: string;
};

// ---------------------------------------------------------------------------
// Chart sample data
// ---------------------------------------------------------------------------

const monthlySalesData = [
  { month: "2025-01-01", revenue: 4200, orders: 320, target: 4000 },
  { month: "2025-02-01", revenue: 3800, orders: 280, target: 4100 },
  { month: "2025-03-01", revenue: 5100, orders: 410, target: 4200 },
  { month: "2025-04-01", revenue: 4700, orders: 350, target: 4300 },
  { month: "2025-05-01", revenue: 5600, orders: 480, target: 4500 },
  { month: "2025-06-01", revenue: 6200, orders: 520, target: 4700 },
  { month: "2025-07-01", revenue: 5900, orders: 490, target: 4800 },
  { month: "2025-08-01", revenue: 6800, orders: 560, target: 5000 },
];

const categoryData = [
  { category: "Electronics", sales: 12400 },
  { category: "Clothing", sales: 8200 },
  { category: "Food", sales: 6800 },
  { category: "Books", sales: 4300 },
  { category: "Sports", sales: 3100 },
];

const sentimentData = [
  { name: "POSITIVE", value: 2437 },
  { name: "NEUTRAL", value: 456 },
  { name: "NEGATIVE", value: 189 },
];

// ---------------------------------------------------------------------------
// DataTable sample data
// ---------------------------------------------------------------------------

const sampleData: User[] = [
  {
    id: 1,
    name: "김태양",
    email: "taeyang@example.com",
    role: "Admin",
    status: "active",
    joinedAt: "2024-01-15",
  },
  {
    id: 2,
    name: "이수진",
    email: "sujin@example.com",
    role: "Editor",
    status: "active",
    joinedAt: "2024-03-22",
  },
  {
    id: 3,
    name: "박민수",
    email: "minsu@example.com",
    role: "Viewer",
    status: "inactive",
    joinedAt: "2024-06-10",
  },
  {
    id: 4,
    name: "최지연",
    email: "jiyeon@example.com",
    role: "Editor",
    status: "active",
    joinedAt: "2024-02-28",
  },
  {
    id: 5,
    name: "정우성",
    email: "wooseong@example.com",
    role: "Admin",
    status: "active",
    joinedAt: "2024-04-05",
  },
  {
    id: 6,
    name: "한소희",
    email: "sohee@example.com",
    role: "Viewer",
    status: "inactive",
    joinedAt: "2024-05-12",
  },
  {
    id: 7,
    name: "강동원",
    email: "dongwon@example.com",
    role: "Editor",
    status: "active",
    joinedAt: "2024-07-18",
  },
  {
    id: 8,
    name: "손예진",
    email: "yejin@example.com",
    role: "Admin",
    status: "active",
    joinedAt: "2024-08-01",
  },
  {
    id: 9,
    name: "유아인",
    email: "ain@example.com",
    role: "Viewer",
    status: "inactive",
    joinedAt: "2024-09-14",
  },
  {
    id: 10,
    name: "배수지",
    email: "suzy@example.com",
    role: "Editor",
    status: "active",
    joinedAt: "2024-10-20",
  },
  {
    id: 11,
    name: "공유",
    email: "gongyoo@example.com",
    role: "Admin",
    status: "active",
    joinedAt: "2024-11-03",
  },
  {
    id: 12,
    name: "전지현",
    email: "jihyun@example.com",
    role: "Viewer",
    status: "active",
    joinedAt: "2024-12-08",
  },
];

const columns: ColumnDef<User>[] = [
  {
    accessorKey: "name",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Name" />
    ),
    meta: { title: "Name" },
  },
  {
    accessorKey: "email",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Email" />
    ),
    meta: { title: "Email" },
  },
  {
    accessorKey: "role",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Role" />
    ),
    meta: { title: "Role" },
  },
  {
    accessorKey: "status",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Status" />
    ),
    meta: { title: "Status" },
  },
  {
    accessorKey: "joinedAt",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Joined" />
    ),
    meta: { title: "Joined" },
  },
];

function App() {
  return (
    <main className="p-8 max-w-6xl mx-auto flex flex-col gap-12">
      <section>
        <h1 className="text-2xl font-bold mb-6">
          DataTable Demo — Full Featured
        </h1>
        <DataTable
          data={sampleData}
          columns={columns}
          pageSize={5}
          searchKeys={["name", "email"]}
        >
          <DataTable.Header title="Users" />
          <DataTable.Toolbar>
            <DataTable.Toolbar.Left>
              <DataTable.Search placeholder="Search by name or email..." />
            </DataTable.Toolbar.Left>
            <DataTable.Toolbar.Right>
              <DataTable.Filter />
              <DataTable.ColumnVisibility />
              <DataTable.Download fileNamePrefix="users" />
            </DataTable.Toolbar.Right>
          </DataTable.Toolbar>
          <DataTable.Body />
          <DataTable.Pagination showPageSize pageSizeOptions={[5, 10, 20]} />
        </DataTable>
      </section>

      <section>
        <h1 className="text-2xl font-bold mb-6">DataTable Demo — Minimal</h1>
        <DataTable data={sampleData} columns={columns}>
          <DataTable.Body />
          <DataTable.Pagination />
        </DataTable>
      </section>

      <section>
        <h1 className="text-2xl font-bold mb-6">Chart Demo</h1>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <DynamicLineChart
            title="Monthly Revenue Trend"
            description="Revenue & orders over time"
            xAxisKey="month"
            data={monthlySalesData}
            config={{
              revenue: { label: "Revenue", color: "#8884d8" },
              orders: { label: "Orders", color: "#82ca9d" },
            }}
          />

          <DynamicAreaChart
            title="Revenue Accumulation"
            xAxisKey="month"
            data={monthlySalesData}
            config={{
              revenue: { label: "Revenue", color: "#3b82f6" },
            }}
          />

          <DynamicBarChart
            title="Sales by Category"
            xAxisKey="category"
            data={categoryData}
            config={{
              sales: { label: "Sales", color: "#f59e0b" },
            }}
          />

          <DynamicBarChart
            title="Category Ranking"
            layout="horizontal"
            xAxisKey="sales"
            yAxisKey="category"
            data={categoryData}
            config={{
              sales: { label: "Sales", color: "#8b5cf6" },
            }}
          />

          <DynamicComposedChart
            title="Revenue vs Target"
            description="Bar = Revenue, Line = Target"
            xAxisKey="month"
            data={monthlySalesData}
            config={{
              revenue: { label: "Revenue", color: "#3b82f6", type: "bar", yAxisId: "left" },
              target: { label: "Target", color: "#ef4444", type: "line", yAxisId: "left" },
            }}
          />

          <DynamicPieChart
            title="Sentiment Distribution"
            data={sentimentData}
            colors={["#22c55e", "#94a3b8", "#ef4444"]}
            innerRadius={50}
          />
        </div>
      </section>
    </main>
  );
}

export default App;
