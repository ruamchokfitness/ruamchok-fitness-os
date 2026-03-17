export default function MaintenanceLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="bg-slate-50 min-h-screen">
      {children}
    </div>
  )
}
