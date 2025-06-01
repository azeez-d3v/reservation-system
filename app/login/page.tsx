"use client"

import type React from "react"
import { useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useAuth } from "@/hooks/use-auth"
import { Loader2, ShieldCheck, CalendarDays, AlertCircle, ShieldAlert, Mail } from "lucide-react"
import { format } from "date-fns"

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: session, status } = useSession()
  const { login, isLoading } = useAuth()

  // Get redirect and reservation parameters
  const callbackUrl = searchParams.get("callbackUrl")
  const redirect = searchParams.get("redirect") || "/dashboard"
  const date = searchParams.get("date")
  const time = searchParams.get("time")
  const error = searchParams.get("error")

  // Build the full redirect URL with all parameters
  const getRedirectUrl = () => {
    // If we have a callbackUrl from NextAuth, decode and use it
    if (callbackUrl) {
      try {
        return decodeURIComponent(callbackUrl)
      } catch (e) {
        console.error("Error decoding callbackUrl:", e)
      }
    }

    let redirectUrl = redirect

    // If we have date and time parameters, add them to the redirect URL
    if (date && time) {
      redirectUrl += `?date=${date}&time=${time}`
    }

    return redirectUrl
  }

  // Redirect if already authenticated
  useEffect(() => {
    if (session?.user) {
      console.log("User already authenticated, redirecting to:", getRedirectUrl())
      const redirectUrl = getRedirectUrl()
      router.replace(redirectUrl) // Use replace instead of push to avoid back button issues
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
      // Use the callbackUrl from NextAuth if available, otherwise use our constructed redirect URL
      const finalCallbackUrl = callbackUrl ? decodeURIComponent(callbackUrl) : getRedirectUrl()
      console.log("Login attempt with callbackUrl:", finalCallbackUrl)
      await login(finalCallbackUrl)
    } catch (error) {
      console.error("Login error:", error)
    }
  }

  if (status === "loading" || isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 overflow-hidden">
      <div className="w-full max-w-md px-6 py-8">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-3">
            <ShieldCheck className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 mb-2">
            Authentication
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            Sign in with your LICS Google account
          </p>
        </div>

        {/* Error Messages */}
        {error === "OAuthAccountNotLinked" && (
          <Alert variant="destructive" className="mb-4 border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-red-800 dark:text-red-200">
              This email is already associated with another account. Please try signing in with a different method or contact support.
            </AlertDescription>
          </Alert>
        )}

        {error === "AccessDenied" && (
          <Alert variant="destructive" className="mb-4 border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950">
            <div className="flex">
              <div className="flex-shrink-0">
                <ShieldAlert className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <div className="ml-3 flex-1">
                <h3 className="text-sm font-semibold text-red-800 dark:text-red-200 mb-1">
                  Access Denied
                </h3>
                <AlertDescription className="text-red-700 dark:text-red-300 text-sm leading-relaxed">
                  Your account doesn't have permission to access this system.
                </AlertDescription>
                <div className="mt-3 flex items-start space-x-2">
                  <Mail className="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                  <div className="text-xs text-red-600 dark:text-red-400">
                    <p className="font-medium mb-1">Need help?</p>
                    <p>Contact your administrator if you believe this is an error.</p>
                  </div>
                </div>
              </div>
            </div>
          </Alert>
        )}

        {error && error !== "OAuthAccountNotLinked" && error !== "AccessDenied" && (
          <Alert variant="destructive" className="mb-4 border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-red-800 dark:text-red-200">
              An error occurred during sign in. Please try again.
            </AlertDescription>
          </Alert>
        )}

        {/* Reservation Details */}
        {date && time && (
          <div className="mb-4 p-4 rounded-xl bg-emerald-50 border border-emerald-200 dark:bg-emerald-950/50 dark:border-emerald-800">
            <div className="flex items-center text-emerald-800 dark:text-emerald-200 mb-1">
              <CalendarDays className="mr-2 h-4 w-4" />
              <span className="font-medium text-sm">
                {format(new Date(date), "EEEE, MMMM d, yyyy")} at {time}
              </span>
            </div>
            <p className="text-xs text-emerald-700 dark:text-emerald-300">
              Sign in to complete your reservation
            </p>
          </div>
        )}

        {/* Sign In Card */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-6">
          <Button 
            onClick={handleGoogleLogin} 
            className="w-full h-12 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 shadow-sm transition-all duration-200 hover:shadow-md dark:bg-slate-800 dark:hover:bg-slate-700 dark:border-slate-600 dark:text-slate-200" 
            variant="outline"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-3 h-5 w-5 animate-spin" />
                <span className="font-medium">Signing in...</span>
              </>
            ) : (
              <>
                <svg className="mr-3 h-5 w-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                <span className="font-medium">Continue with Google</span>
              </>
            )}
          </Button>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-slate-500 dark:text-slate-400 mt-6 leading-relaxed">
          By signing in, you agree to our terms of service and privacy policy.
        </p>
      </div>
    </div>
  )
}
