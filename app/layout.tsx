import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { Toaster } from "@/components/ui/toaster"
import { SessionProvider } from "@/components/auth/session-provider"
import { ConditionalLayout } from "@/components/layout/conditional-layout"
import { getSettings } from "@/lib/actions"

const inter = Inter({ subsets: ["latin"] })

export async function generateMetadata(): Promise<Metadata> {
  try {
    const settings = await getSettings()
    return {
      title: settings.systemName,
      description: `A user-friendly ${settings.systemName.toLowerCase()} with approval workflow`,
    }
  } catch (error) {
    // Fallback metadata if settings can't be loaded
    return {
      title: "Reservation System",
      description: "A user-friendly reservation system with approval workflow",
    }
  }
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
          <ConditionalLayout>
            {children}
          </ConditionalLayout>
          <Toaster />
        </SessionProvider>
      </body>
    </html>
  )
}
