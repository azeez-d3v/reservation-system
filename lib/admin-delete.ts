/**
 * Server-only admin deletion functions
 * This file contains functions that use Firebase Admin SDK and should never be imported on the client side
 */

import { deleteUser } from "@/lib/firestore"

// Enhanced function to delete user with admin-level cleanup (including NextAuth data)
export async function deleteUserWithAuthCleanup(userId: string, userEmail?: string): Promise<void> {
  try {
    // First delete from our main collections
    await deleteUser(userId)
    
    // If we have the user's email, also clean up NextAuth collections
    if (userEmail) {
      const { adminDb } = await import("@/lib/firebase-admin")
      const batch = adminDb.batch()
      
      // Clean up NextAuth collections
      const authCollections = ["accounts", "sessions", "verification_tokens"]
      
      for (const collectionName of authCollections) {
        const q = adminDb.collection(collectionName).where("userId", "==", userEmail)
        const snapshot = await q.get()
        
        snapshot.docs.forEach((doc) => {
          batch.delete(doc.ref)
        })
        
        console.log(`Marked ${snapshot.size} ${collectionName} documents for deletion`)
      }
      
      // Also check for user documents in NextAuth users collection (different from our custom users)
      const nextAuthUserQuery = adminDb.collection("users").where("email", "==", userEmail)
      const nextAuthUserSnapshot = await nextAuthUserQuery.get()
      
      nextAuthUserSnapshot.docs.forEach((doc) => {
        batch.delete(doc.ref)
      })
      
      if (nextAuthUserSnapshot.size > 0) {
        console.log(`Marked ${nextAuthUserSnapshot.size} NextAuth user documents for deletion`)
      }
      
      // Commit NextAuth cleanup
      await batch.commit()
      console.log(`Completed NextAuth cleanup for user: ${userEmail}`)
    }
    
  } catch (error) {
    console.error("Error in comprehensive user deletion:", error)
    throw new Error(`Failed to completely delete user: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}
