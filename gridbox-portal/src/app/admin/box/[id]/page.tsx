// Server component wrapper — required for generateStaticParams with output: export
import { Suspense } from "react";
import AdminBoxConfigClient from "./AdminBoxConfigClient";

// Pre-render a placeholder shell; Firebase rewrite serves it for all /admin/box/* paths
export function generateStaticParams() {
  return [{ id: "_" }];
}

export default function AdminBoxConfigPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-sm text-slate-500">Laden…</p>
      </div>
    }>
      <AdminBoxConfigClient />
    </Suspense>
  );
}
