import { withAuth } from "next-auth/middleware"

export default withAuth(
  function middleware(req) {
    // Additional middleware logic can go here
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const { pathname } = req.nextUrl

        // Debug logging
        console.log("Middleware - Path:", pathname)
        console.log("Middleware - Token:", {
          email: token?.email,
          role: token?.role,
          status: token?.status,
          hasToken: !!token
        })

        // Allow auth routes to pass through
        if (pathname.startsWith("/api/auth")) {
          return true
        }

        // Check if user is authenticated
        if (!token) {
          console.log("Middleware - No token, denying access to:", pathname)
          return false
        }

        // Check if user is active
        if (token.status === "inactive") {
          console.log("Middleware - User inactive, denying access")
          return false
        }

        // Admin routes require admin or staff role
        if (pathname.startsWith("/admin")) {
          const isAdminOrStaff = token.role === "admin" || token.role === "staff"
          console.log("Middleware - Admin route check:", { role: token.role, isAdminOrStaff })
          return isAdminOrStaff
        }

        // Protected routes require authentication
        if (
          pathname.startsWith("/dashboard") ||
          pathname.startsWith("/request")
        ) {
          console.log("Middleware - Protected route, allowing access")
          return true
        }

        return true
      },
    },
  }
)

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/admin/:path*",
    "/request/:path*",
  ],
}
