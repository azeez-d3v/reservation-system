import type React from "react"
interface DashboardShellProps {
  children: React.ReactNode
}

export function DashboardShell({ children }: DashboardShellProps) {
  return <div className="container mx-auto py-10 space-y-6 px-4">{children}</div>
}
