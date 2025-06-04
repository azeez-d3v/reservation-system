"use client"

import { useCallback } from "react"
import { useSession, signIn, signOut } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useToast } from "@/components/ui/use-toast"
import { getUserList, updateUserStatus, updateUserRoleAction, removeUser } from "@/lib/actions"
import type { User } from "@/lib/types"

export function useAuth() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()
  const isLoading = status === "loading"
  const isAuthenticated = !!session
  const user = session?.user

  const login = async (callbackUrl?: string) => {
    try {
      await signIn("google", { 
        callbackUrl: callbackUrl || "/dashboard",
        redirect: true 
      })
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
    } catch (error) {      toast({
        title: "Logout failed",
        description: "There was an error signing you out.",
        variant: "destructive",
      })
    }
  }
  const getAllUsers = useCallback(async (): Promise<User[]> => {
    try {
      return await getUserList()
    } catch (error) {
      console.error("Error fetching users:", error)
      toast({
        title: "Error",
        description: "Failed to fetch users.",
        variant: "destructive",      })
      return []
    }
  }, [toast])
  const updateUserStatusAction = useCallback(async (userEmail: string, status: "active" | "inactive") => {
    try {
      const result = await updateUserStatus(userEmail, status)

      if (result.success) {
        toast({
          title: "User updated",
          description: `User status has been updated to ${status}.`,
        })
      } else {
        toast({
          title: "Update failed", 
          description: result.message,
          variant: "destructive",
        })
      }

      // If the current user is being deactivated, log them out
      if (user?.email === userEmail && status === "inactive") {
        await logout()
      }
      
      return result
    } catch (error) {
      console.error("Error updating user status:", error)
      toast({
        title: "Update failed",
        description: "Failed to update user status.",
        variant: "destructive",
      })
      return { success: false, message: "Failed to update user status" }
    }
  }, [user?.email, logout, toast])

  const updateUserRole = useCallback(async (userId: string, role: "admin" | "staff" | "user") => {
    try {
      const result = await updateUserRoleAction(userId, role)

      if (result.success) {
        toast({
          title: "User role updated",
          description: `User role has been updated to ${role}.`,
        })
      } else {
        toast({
          title: "Update failed",
          description: result.message,
          variant: "destructive",
        })
      }
      
      return result
    } catch (error) {
      console.error("Error updating user role:", error)
      toast({
        title: "Update failed",
        description: "Failed to update user role.",
        variant: "destructive",
      })
      return { success: false, message: "Failed to update user role" }
    }
  }, [toast])

  const deleteUser = useCallback(async (userId: string, userEmail?: string, userName?: string) => {
    try {
      const result = await removeUser(userId, userEmail, true) // Use comprehensive cleanup
      
      if (result.success) {
        toast({
          title: "User deleted",
          description: `${userName || 'User'} and all associated data have been permanently deleted.`,
        })
      } else {
        toast({
          title: "Deletion failed",
          description: result.message,
          variant: "destructive",
        })
      }
      
      return result
    } catch (error) {
      console.error("Error deleting user:", error)
      toast({
        title: "Deletion failed",
        description: "Failed to delete user and associated data.",
        variant: "destructive",
      })
      return { success: false, message: "Failed to delete user" }
    }
  }, [toast])
  return {
    user,
    isLoading,
    isAuthenticated,
    login,
    logout,
    getAllUsers,
    updateUserStatus: updateUserStatusAction,
    updateUserRole,
    deleteUser,
  }
}
