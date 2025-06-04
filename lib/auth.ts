// lib/auth.ts
import { type NextAuthOptions } from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import { adminDb } from "@/lib/firebase-admin"

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      allowDangerousEmailAccountLinking: true,
    }),
  ],
  session: {
    strategy: "jwt" as const,
  },  secret: process.env.NEXTAUTH_SECRET,  callbacks: {
    async jwt({ token, user }) {
      // Add role and status to token for middleware to access
      if (user && user.email) {
        // Ensure email is in the token for Firestore rules
        token.email = user.email
        
        // Fetch user data from our custom collection to get role and status
        try {
          console.log("JWT Callback - Fetching user data for:", user.email)
          const userDoc = await adminDb.collection("users").doc(user.email).get()
          if (userDoc.exists) {
            const userData = userDoc.data()
            token.role = userData?.role || "user"
            token.status = userData?.status || "active"
            console.log("JWT Callback - User data found:", { 
              email: user.email, 
              role: token.role, 
              status: token.status,
              userData: userData 
            })
          } else {
            token.role = "user"
            token.status = "active"
            console.log("JWT Callback - No user document found for:", user.email)
          }
        } catch (error) {
          console.error("Error fetching user data for JWT:", error)
          token.role = "user"
          token.status = "active"
        }
      } else {
        // Preserve existing token data if no user (refresh scenario)
        console.log("JWT Callback - Preserving token data:", {
          email: token.email,
          role: token.role,
          status: token.status        })
      }
      return token},
    async session({ session, token }) {
      if (session.user && token) {
        session.user.id = token.email as string // Use email as ID to match Firestore document structure
        session.user.email = token.email as string
        session.user.role = token.role as string
        session.user.status = token.status as string
      }
      return session
    },      async signIn({ user, account, profile }) {
      if (account?.provider === "google" && user.email) {
        try {
          // Get system settings to check email domain restrictions
          const systemSettingsDoc = await adminDb.collection("systemSettings").doc("main").get()
          let restrictEmailDomain = true // Default to true for backwards compatibility
          let allowedEmailDomain = "@leadersics.edu.ph" // Default domain
          
          if (systemSettingsDoc.exists) {
            const systemSettings = systemSettingsDoc.data()
            restrictEmailDomain = systemSettings?.restrictEmailDomain !== false // Default to true if not specified
            allowedEmailDomain = systemSettings?.allowedEmailDomain || "@leadersics.edu.ph"
          }

          // Check email domain if restriction is enabled
          if (restrictEmailDomain) {
            const emailToCheck = user.email || profile?.email
            if (!emailToCheck?.endsWith(allowedEmailDomain)) {
              console.log(`Sign in denied for email: ${emailToCheck} - Invalid domain. Required: ${allowedEmailDomain}`)
              return false
            }
          }

          // Ensure the user document exists in our custom collection
          const userDoc = await adminDb.collection("users").doc(user.email).get()
          if (!userDoc.exists) {
            // Create new user document - filter out undefined values
            const userData: any = {
              name: user.name || profile?.name || "Unknown User",
              email: user.email,
              role: "user",
              status: "active",
              createdAt: new Date(),
              updatedAt: new Date(),
            }
            
            // Only add image if it's not undefined
            if (user.image) {
              userData.image = user.image
            } else if ((profile as any)?.picture) {
              userData.image = (profile as any).picture
            }
            
            await adminDb.collection("users").doc(user.email).set(userData)
          } else {
            // Check if user is active before allowing sign in
            const userData = userDoc.data()
            if (userData?.status === "inactive") {
              console.log(`Sign in denied for email: ${user.email} - User is inactive`)
              return false
            }
            
            // Update last login
            await adminDb.collection("users").doc(user.email).update({
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
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  debug: process.env.NODE_ENV === "development",
}
