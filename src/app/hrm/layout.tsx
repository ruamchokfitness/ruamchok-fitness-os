import { FirebaseClientProvider } from "@/firebase/client-provider";

export default function HrmLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <FirebaseClientProvider>
      <div className="bg-slate-50 min-h-screen">
        {children}
      </div>
    </FirebaseClientProvider>
  )
}
