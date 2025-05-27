import NextAuth, { type NextAuthOptions } from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import { adminDb } from "@/lib/firebase-admin"

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      allowDangerousEmailAccountLinking: true,
    }),  ],
  session: {
    strategy: "jwt" as const,
  },
  callbacks: {
    async jwt({ token, user }) {
      // Add role and status to token for middleware to access
      if (user) {
        // Fetch user data from our custom collection to get role and status
        try {
          const userDoc = await adminDb.collection("users").doc(user.email!).get()
          if (userDoc.exists) {
            const userData = userDoc.data()
            token.role = userData?.role || "user"
            token.status = userData?.status || "active"
          } else {
            token.role = "user"
            token.status = "active"
          }
        } catch (error) {
          console.error("Error fetching user data for JWT:", error)
          token.role = "user"
          token.status = "active"
        }
      }
      return token
    },    async session({ session, token }) {
      if (session.user && token) {
        session.user.id = token.sub as string
        session.user.role = token.role as string
        session.user.status = token.status as string
      }
      return session
    },    async signIn({ user, account, profile }) {
      if (account?.provider === "google") {
        // Check if email is verified and from allowed domain
        const googleProfile = profile as any
        if (!googleProfile?.email_verified || !googleProfile?.email?.endsWith("@leadersics.edu.ph")) {
          return false
        }
        
        try {
          // Ensure the user document exists in our custom collection
          const userDoc = await adminDb.collection("users").doc(user.email!).get()
          
          if (!userDoc.exists) {
            // Create new user document
            await adminDb.collection("users").doc(user.email!).set({
              name: user.name,
              email: user.email,
              image: user.image,
              role: "user",
              status: "active",
              createdAt: new Date(),
              updatedAt: new Date(),
            })
          } else {
            // Update last login
            await adminDb.collection("users").doc(user.email!).update({
              lastLoginAt: new Date(),
              updatedAt: new Date(),
            })
          }
          
          return true
        } catch (error) {
          console.error("Error handling sign in:", error)
          return false
        }
      }
      return true
    },
  },  pages: {
    signIn: "/login",
    error: "/login",
  },
  debug: process.env.NODE_ENV === "development",
}

const handler = NextAuth(authOptions)
export { handler as GET, handler as POST }
