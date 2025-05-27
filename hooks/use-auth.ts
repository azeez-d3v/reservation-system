"use client"

import { useSession, signIn, signOut } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useToast } from "@/components/ui/use-toast"
import { getUsers, updateUserStatus as updateUserStatusFirestore, updateUser as updateUserFirestore } from "@/lib/firestore"
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
      return await getUsers()
    } catch (error) {
      console.error("Error fetching users:", error)
      toast({
        title: "Error",
        description: "Failed to fetch users.",
        variant: "destructive",
      })
      return []
    }
  }
  const updateUserStatus = async (userId: string, status: "active" | "inactive") => {
    try {
      await updateUserStatusFirestore(userId, status)

      toast({
        title: "User updated",
        description: `User status has been updated to ${status}.`,
      })

      // If the current user is being deactivated, log them out
      if (user?.email === userId && status === "inactive") {
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
  const updateUser = async (userData: Partial<User> & { id: string }) => {
    try {
      await updateUserFirestore(userData.id, userData)

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
