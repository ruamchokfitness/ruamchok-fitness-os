import { ModuleAuthGuard } from "@/components/auth/ModuleAuthGuard";

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ModuleAuthGuard requiredRole="admin">
      <div className="bg-slate-50 min-h-screen">
        {children}
      </div>
    </ModuleAuthGuard>
  )
}
