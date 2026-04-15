// Server component wrapper — required for generateStaticParams with output: export
import AdminBoxConfigClient from "./AdminBoxConfigClient";

// Pre-render a placeholder shell; Firebase rewrite serves it for all /admin/box/* paths
export function generateStaticParams() {
  return [{ id: "_" }];
}

export default function AdminBoxConfigPage() {
  return <AdminBoxConfigClient />;
}
