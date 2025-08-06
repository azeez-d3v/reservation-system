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
  },
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    async jwt({ token, user, account }) {
      // Only fetch user data on initial sign in or when user object exists
      if (user?.email || (account && token.email)) {
        const email = user?.email || token.email as string
        
        try {
          console.log("JWT Callback - Fetching user data for:", email)
          const userDoc = await adminDb.collection("users").doc(email).get()
          
          if (userDoc.exists) {
            const userData = userDoc.data()
            token.email = email
            token.role = userData?.role || "user"
            token.status = userData?.status || "active"
            console.log("JWT Callback - User data found:", { 
              email, 
              role: token.role, 
              status: token.status 
            })
          } else {
            // Set defaults if user document doesn't exist
            token.email = email
            token.role = "user"
            token.status = "active"
            console.log("JWT Callback - No user document found for:", email)
          }
        } catch (error) {
          console.error("Error fetching user data for JWT:", error)
          token.email = email
          token.role = "user"
          token.status = "active"
        }
      }
      
      // Always return the token to maintain session
      return token
    },

    async session({ session, token }) {
      if (session.user && token) {
        session.user.id = token.email as string
        session.user.email = token.email as string
        session.user.role = (token.role as string) || "user"
        session.user.status = (token.status as string) || "active"
      }
      return session
    },      
    
    async signIn({ user, account, profile }) {
      if (account?.provider === "google") {
        try {
          // Get email from multiple possible sources
          const email = user.email || profile?.email || (profile as any)?.email_verified
          
          if (!email) {
            console.log("Sign in denied - No email found in user or profile")
            return false
          }

          console.log("Processing sign in for email:", email)

          // Hardcoded allowed emails (bypass domain check)
          const allowedEmails = [
            "aziz.saricula@gmail.com"
          ]
          
          // If email is in allowed list, skip domain check
          if (allowedEmails.includes(email)) {
            console.log("Email in allowed list, bypassing domain check:", email)
          } else {
            // Check domain restriction for non-allowed emails
            let restrictEmailDomain = true
            let allowedEmailDomain = "@leadersics.edu.ph"
            
            try {
              const systemSettingsDoc = await adminDb.collection("systemSettings").doc("main").get()
              if (systemSettingsDoc.exists) {
                const systemSettings = systemSettingsDoc.data()
                restrictEmailDomain = systemSettings?.restrictEmailDomain !== false
                allowedEmailDomain = systemSettings?.allowedEmailDomain || "@leadersics.edu.ph"
              }
            } catch (error) {
              console.error("Error fetching system settings:", error)
              // Use defaults if system settings fetch fails
            }

            // Normalize email and domain for comparison
            const normalizedEmail = email.toLowerCase().trim()
            const normalizedDomain = allowedEmailDomain.toLowerCase().trim()

            if (restrictEmailDomain && !normalizedEmail.endsWith(normalizedDomain)) {
              console.log(`Sign in denied for email: ${email} - Invalid domain. Expected: ${allowedEmailDomain}`)
              return false
            }
          }

          // Handle user document creation/update
          try {
            const userDoc = await adminDb.collection("users").doc(email).get()
            
            if (!userDoc.exists) {
              // Create new user document
              const userData: any = {
                name: user.name || profile?.name || (profile as any)?.given_name || "Unknown User",
                email: email,
                role: "user",
                status: "active",
                createdAt: new Date(),
                updatedAt: new Date(),
              }
              
              // Add image if available
              const imageUrl = user.image || (profile as any)?.picture || (profile as any)?.avatar_url
              if (imageUrl) {
                userData.image = imageUrl
              }
              
              await adminDb.collection("users").doc(email).set(userData)
              console.log("Created new user document for:", email)
            } else {
              // Check if existing user is active
              const userData = userDoc.data()
              if (userData?.status === "inactive") {
                console.log(`Sign in denied for email: ${email} - User is inactive`)
                return false
              }
              
              // Update last login and any missing fields
              const updateData: any = {
                lastLoginAt: new Date(),
                updatedAt: new Date(),
              }

              // Update name if it's missing or different
              const currentName = user.name || profile?.name || (profile as any)?.given_name
              if (currentName && currentName !== userData?.name) {
                updateData.name = currentName
              }

              // Update image if it's missing or different
              const currentImage = user.image || (profile as any)?.picture || (profile as any)?.avatar_url
              if (currentImage && currentImage !== userData?.image) {
                updateData.image = currentImage
              }
              
              await adminDb.collection("users").doc(email).update(updateData)
              console.log("Updated existing user document for:", email)
            }
          } catch (firestoreError) {
            console.error("Error handling user document:", firestoreError)
            // Don't block sign in if Firestore operations fail
          }
          
          console.log("Sign in successful for:", email)
          return true
          
        } catch (error) {
          console.error("Error in signIn callback:", error)
          return false
        }      
      }
      
      console.log("Sign in allowed for non-Google provider")
      return true
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  debug: process.env.NODE_ENV === "development",
}
