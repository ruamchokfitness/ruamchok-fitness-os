export default function MaintenanceLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="bg-gradient-to-br from-indigo-50 to-purple-50 min-h-screen">
      {children}
    </div>
  )
}
