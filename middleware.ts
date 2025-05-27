import { withAuth } from "next-auth/middleware"

export default withAuth(
  function middleware(req) {
    // Additional middleware logic can go here
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        // Check if user is authenticated
        if (!token) return false

        // Check if user is active
        if (token.status === "inactive") return false

        // Admin routes require admin role
        if (req.nextUrl.pathname.startsWith("/admin")) {
          return token.role === "admin"
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
