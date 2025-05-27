import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { Toaster } from "@/components/ui/toaster"
import { SessionProvider } from "@/components/auth/session-provider"
import { MainNav } from "@/components/layout/main-nav"
import { UserAccountNav } from "@/components/layout/user-account-nav"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Reservation System",
  description: "A user-friendly reservation system with approval workflow"
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <SessionProvider>
          <div className="flex min-h-screen flex-col">
            <header className="sticky top-0 z-40 border-b bg-background">
              <div className="container mx-auto flex h-16 items-center justify-between py-4 px-4">
                <MainNav />
                <UserAccountNav />
              </div>
            </header>
            <main className="flex-1">{children}</main>
          </div>
          <Toaster />
        </SessionProvider>
      </body>
    </html>
  )
}
