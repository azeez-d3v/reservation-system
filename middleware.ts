import { withAuth } from "next-auth/middleware"

export default withAuth(
  function middleware(req) {
    // Additional middleware logic can go here
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        // Debug logging
        console.log("Middleware - Path:", req.nextUrl.pathname)
        console.log("Middleware - Token:", {
          email: token?.email,
          role: token?.role,
          status: token?.status,
          hasToken: !!token
        })

        // Check if user is authenticated
        if (!token) {
          console.log("Middleware - No token, denying access")
          return false
        }

        // Check if user is active
        if (token.status === "inactive") {
          console.log("Middleware - User inactive, denying access")
          return false
        }        // Admin routes require admin or staff role
        if (req.nextUrl.pathname.startsWith("/admin")) {
          const isAdminOrStaff = token.role === "admin" || token.role === "staff"
          return isAdminOrStaff
        }

        // Protected routes require authentication
        if (
          req.nextUrl.pathname.startsWith("/dashboard") ||
          req.nextUrl.pathname.startsWith("/request")
        ) {
          return !!token
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
