export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex-1 min-w-0 h-full bg-gray-0 p-32 flex flex-col gap-24 overflow-auto">
      {children}
    </main>
  );
}
