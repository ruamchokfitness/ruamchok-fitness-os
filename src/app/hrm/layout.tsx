export default function HrmLayout({
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
