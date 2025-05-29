import type React from "react"
import type { Metadata } from "next"
import { SessionProvider } from "@/components/auth/session-provider"
import { Toaster } from "@/components/ui/toaster"

export const metadata: Metadata = {
  title: "Sign In - Reservation System",
  description: "Sign in to access the reservation system"
}

export default function LoginLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <SessionProvider>
      {children}
      <Toaster />
    </SessionProvider>
  )
}
