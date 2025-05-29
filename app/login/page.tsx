"use client"

import type React from "react"
import { useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardDescription, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useAuth } from "@/hooks/use-auth"
import { Loader2, CalendarDays, AlertCircle } from "lucide-react"
import { format } from "date-fns"

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: session, status } = useSession()
  const { login, isLoading } = useAuth()

  // Get redirect and reservation parameters
  const redirect = searchParams.get("redirect") || "/dashboard"
  const date = searchParams.get("date")
  const time = searchParams.get("time")
  const error = searchParams.get("error")

  // Build the full redirect URL with all parameters
  const getRedirectUrl = () => {
    let redirectUrl = redirect

    // If we have date and time parameters, add them to the redirect URL
    if (date && time) {
      redirectUrl += `?date=${date}&time=${time}`
    }

    return redirectUrl
  }

  // Redirect if already authenticated
  useEffect(() => {
    if (session) {
      router.push(getRedirectUrl())
    }
  }, [session, router])

  // Debug information
  useEffect(() => {
    if (error) {
      console.log("Auth error:", error)
    }
  }, [error])

  const handleGoogleLogin = async () => {
    try {
      await login()
    } catch (error) {
      console.error("Login error:", error)
    }
  }

  if (status === "loading" || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="container flex h-screen w-screen flex-col items-center justify-center">
      <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[350px]">
        <div className="flex flex-col space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
          <p className="text-sm text-muted-foreground">Sign in with your @leadersics.edu.ph Google account</p>
        </div>

        {error === "OAuthAccountNotLinked" && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              This email is already associated with another account. Please try signing in with a different method or contact support if you need help linking your accounts.
            </AlertDescription>
          </Alert>
        )}

        {error === "AccessDenied" && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Access denied. Only email addresses with @leadersics.edu.ph domain are allowed to sign in.
            </AlertDescription>
          </Alert>
        )}

        {error && error !== "OAuthAccountNotLinked" && error !== "AccessDenied" && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              An error occurred during sign in. Please try again.
            </AlertDescription>
          </Alert>
        )}

        {date && time && (
          <Card className="border-green-200 bg-green-50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-green-800">Reservation Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center text-green-800">
                <CalendarDays className="mr-2 h-4 w-4" />
                <p className="text-sm">
                  {format(new Date(date), "EEEE, MMMM d, yyyy")} at {time}
                </p>
              </div>
              <CardDescription className="mt-1 text-green-700">Sign in to complete your reservation</CardDescription>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="pt-6">
            <Button 
              onClick={handleGoogleLogin} 
              className="w-full" 
              variant="outline"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                    <path
                      fill="currentColor"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="currentColor"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  Continue with Google
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <div className="text-center text-xs text-muted-foreground">
          <p>By signing in, you agree to our terms of service and privacy policy.</p>
        </div>
      </div>
    </div>
  )
}
