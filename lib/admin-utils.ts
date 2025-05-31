import { adminDb } from "./firebase-admin"

export async function getUserRole(email: string) {
  try {
    const userDoc = await adminDb.collection("users").doc(email).get()
    if (userDoc.exists) {
      const userData = userDoc.data()
      return {
        exists: true,
        role: userData?.role,
        status: userData?.status,
        data: userData
      }
    }
    return { exists: false }
  } catch (error) {
    console.error("Error getting user role:", error)
    throw error
  }
}

export async function setUserRole(email: string, role: "admin" | "staff" | "user") {
  try {
    const userRef = adminDb.collection("users").doc(email)
    await userRef.update({
      role,
      updatedAt: new Date()
    })
    console.log(`Updated role for ${email} to ${role}`)
    return true
  } catch (error) {
    console.error("Error setting user role:", error)
    throw error
  }
}

export async function createAdminUser(email: string, name: string) {
  try {
    await adminDb.collection("users").doc(email).set({
      email,
      name,
      role: "admin",
      status: "active",
      createdAt: new Date(),
      updatedAt: new Date()
    })
    console.log(`Created admin user: ${email}`)
    return true
  } catch (error) {
    console.error("Error creating admin user:", error)
    throw error
  }
}
