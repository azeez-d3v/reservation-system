"use client"

import type React from "react"
import { usePathname } from "next/navigation"
import { MainNav } from "@/components/layout/main-nav"
import { UserAccountNav } from "@/components/layout/user-account-nav"

interface ConditionalLayoutProps {
  children: React.ReactNode
}

export function ConditionalLayout({ children }: ConditionalLayoutProps) {
  const pathname = usePathname()
  const isLoginPage = pathname.startsWith("/login")

  if (isLoginPage) {
    return <>{children}</>
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b bg-background">
        <div className="container mx-auto flex h-16 items-center justify-between py-4 px-4">
          <MainNav />
          <UserAccountNav />
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  )
}
