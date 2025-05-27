"use client"

import { useSession, signIn, signOut } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useToast } from "@/components/ui/use-toast"
import { db } from "@/lib/firebase"
import { collection, getDocs, doc, updateDoc, query, where } from "firebase/firestore"
import type { User } from "@/lib/types"

export function useAuth() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()

  const isLoading = status === "loading"
  const isAuthenticated = !!session
  const user = session?.user

  const login = async () => {
    try {
      await signIn("google", { callbackUrl: "/dashboard" })
    } catch (error) {
      toast({
        title: "Login failed",
        description: "There was an error signing you in. Please try again.",
        variant: "destructive",
      })
    }
  }

  const logout = async () => {
    try {
      await signOut({ callbackUrl: "/login" })
      toast({
        title: "Logged out",
        description: "You have been logged out successfully.",
      })
    } catch (error) {
      toast({
        title: "Logout failed",
        description: "There was an error signing you out.",
        variant: "destructive",
      })
    }
  }

  const getAllUsers = async (): Promise<User[]> => {
    try {
      const usersSnapshot = await getDocs(collection(db, "users"))
      return usersSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as User[]
    } catch (error) {
      console.error("Error fetching users:", error)
      return []
    }
  }

  const updateUserStatus = async (userEmail: string, status: "active" | "inactive") => {
    try {
      const userDoc = doc(db, "users", userEmail)
      await updateDoc(userDoc, {
        status,
        updatedAt: new Date(),
      })

      toast({
        title: "User updated",
        description: `User status has been updated to ${status}.`,
      })

      // If the current user is being deactivated, log them out
      if (user?.email === userEmail && status === "inactive") {
        await logout()
      }
    } catch (error) {
      console.error("Error updating user status:", error)
      toast({
        title: "Update failed",
        description: "Failed to update user status.",
        variant: "destructive",
      })
    }
  }

  const updateUser = async (userData: Partial<User> & { email: string }) => {
    try {
      const userDoc = doc(db, "users", userData.email)
      await updateDoc(userDoc, {
        ...userData,
        updatedAt: new Date(),
      })

      toast({
        title: "User updated",
        description: "User information has been updated successfully.",
      })
    } catch (error) {
      console.error("Error updating user:", error)
      toast({
        title: "Update failed",
        description: "Failed to update user information.",
        variant: "destructive",
      })
    }
  }

  return {
    user,
    isLoading,
    isAuthenticated,
    login,
    logout,
    getAllUsers,
    updateUserStatus,
    updateUser,
  }
}
