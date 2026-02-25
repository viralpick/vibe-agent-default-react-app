import type { ColumnDef } from "@tanstack/react-table";

import { DataTable, DataTableColumnHeader } from "@/components/ui/data-table";

type User = {
  id: number;
  name: string;
  email: string;
  role: string;
  status: string;
  joinedAt: string;
};

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
    </main>
  );
}

export default App;
