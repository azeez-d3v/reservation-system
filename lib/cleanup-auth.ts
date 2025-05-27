/**
 * Database Cleanup Script for NextAuth
 * 
 * This script helps clear NextAuth database collections that might be causing
 * OAuthAccountNotLinked errors when switching between session strategies.
 * 
 * Run this script if you're experiencing authentication issues after changing
 * from JWT to database sessions.
 */

import { adminDb } from "@/lib/firebase-admin"

async function clearNextAuthData() {
  try {
    console.log("Starting NextAuth database cleanup...")
    
    // Collections created by NextAuth FirestoreAdapter
    const collections = [
      "accounts",
      "sessions", 
      "users",
      "verification_tokens"
    ]
    
    for (const collectionName of collections) {
      console.log(`Clearing ${collectionName} collection...`)
      
      const snapshot = await adminDb.collection(collectionName).get()
      const batch = adminDb.batch()
      
      snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref)
      })
      
      if (!snapshot.empty) {
        await batch.commit()
        console.log(`✅ Cleared ${snapshot.size} documents from ${collectionName}`)
      } else {
        console.log(`✅ ${collectionName} collection was already empty`)
      }
    }
    
    console.log("✅ NextAuth database cleanup completed successfully!")
    console.log("You can now try signing in again.")
    
  } catch (error) {
    console.error("❌ Error during cleanup:", error)
  }
}

// Uncomment the line below to run the cleanup
// clearNextAuthData()

export { clearNextAuthData }
