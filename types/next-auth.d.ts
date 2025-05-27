import "next-auth"
import "next-auth/jwt"

declare module "next-auth" {
  interface User {
    role?: string
    status?: string
  }

  interface Session {
    user: {
      id: string
      name?: string | null
      email?: string | null
      image?: string | null
      role: string
      status: string
    }
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: string
    status?: string
  }
}
