"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/hooks/use-auth"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Search, UserX, UserCheck } from "lucide-react"
import { format } from "date-fns"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useToast } from "@/components/ui/use-toast"
import type { User } from "@/lib/types"

export function AdminUsers() {
  const { getAllUsers, updateUserStatus, user: currentUser } = useAuth()
  const { toast } = useToast()
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [showDisableDialog, setShowDisableDialog] = useState(false)
  const [showEnableDialog, setShowEnableDialog] = useState(false)
  const [users, setUsers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function fetchUsers() {
      try {
        setIsLoading(true)
        const fetchedUsers = await getAllUsers()
        setUsers(fetchedUsers)
      } catch (error) {
        console.error("Failed to fetch users:", error)
        toast({
          title: "Error",
          description: "Failed to load users. Please try again.",
          variant: "destructive",
        })
      } finally {
        setIsLoading(false)
      }
    }

    fetchUsers()
  }, [getAllUsers, toast])

  const filteredUsers = users.filter(
    (user: User) =>
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  const handleDisableUser = (user: User) => {
    setSelectedUser(user)
    setShowDisableDialog(true)
  }

  const handleEnableUser = (user: User) => {
    setSelectedUser(user)
    setShowEnableDialog(true)
  }

  const confirmDisableUser = async () => {
    if (selectedUser) {
      try {
        await updateUserStatus(selectedUser.email, "inactive")
        // Refresh users list
        const updatedUsers = await getAllUsers()
        setUsers(updatedUsers)
      } catch (error) {
        console.error("Failed to disable user:", error)
      }
      setShowDisableDialog(false)
    }
  }

  const confirmEnableUser = async () => {
    if (selectedUser) {
      try {
        await updateUserStatus(selectedUser.email, "active")
        // Refresh users list
        const updatedUsers = await getAllUsers()
        setUsers(updatedUsers)
      } catch (error) {
        console.error("Failed to enable user:", error)
      }
      setShowEnableDialog(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="relative w-full sm:w-auto">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search users..."
            className="w-full pl-8 sm:w-[300px]"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>User Management</CardTitle>
          <CardDescription>Manage user accounts and permissions</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              <div className="h-4 bg-muted animate-pulse rounded" />
              <div className="h-4 bg-muted animate-pulse rounded" />
              <div className="h-4 bg-muted animate-pulse rounded" />
            </div>
          ) : (
            <div className="rounded-md border">
              <div className="grid grid-cols-5 border-b px-4 py-3 font-medium">
                <div className="col-span-2">User</div>
                <div>Role</div>
                <div>Joined</div>
                <div className="text-right">Actions</div>
              </div>
              <div className="divide-y">
                {filteredUsers.map((user: User) => (
                  <div key={user.id} className="grid grid-cols-5 items-center px-4 py-3">
                    <div className="col-span-2">
                      <div className="font-medium">{user.name}</div>
                      <div className="text-sm text-muted-foreground">{user.email}</div>
                    </div>
                    <div>
                      <Badge variant={user.role === "admin" ? "default" : "outline"}>
                        {user.role === "admin" ? "Admin" : "User"}
                      </Badge>
                      {user.status === "inactive" && (
                        <Badge variant="destructive" className="ml-2">
                          Disabled
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">{format(new Date(user.createdAt), "MMM d, yyyy")}</div>
                    <div className="flex justify-end gap-2">
                      {user.id !== currentUser?.id && (
                        <>
                          {user.status === "active" ? (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-destructive hover:bg-destructive/10"
                              onClick={() => handleDisableUser(user)}
                            >
                              <UserX className="mr-2 h-4 w-4" />
                              Disable
                            </Button>
                          ) : (
                            <Button variant="outline" size="sm" onClick={() => handleEnableUser(user)}>
                              <UserCheck className="mr-2 h-4 w-4" />
                              Enable
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Disable User Dialog */}
      <AlertDialog open={showDisableDialog} onOpenChange={setShowDisableDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disable User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to disable this user? They will no longer be able to log in or make reservations.
              {selectedUser && (
                <div className="mt-2 p-3 border rounded-md bg-muted/50">
                  <p>
                    <strong>{selectedUser.name}</strong>
                  </p>
                  <p className="text-sm">{selectedUser.email}</p>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDisableUser}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Disable User
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Enable User Dialog */}
      <AlertDialog open={showEnableDialog} onOpenChange={setShowEnableDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Enable User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to enable this user? They will be able to log in and make reservations again.
              {selectedUser && (
                <div className="mt-2 p-3 border rounded-md bg-muted/50">
                  <p>
                    <strong>{selectedUser.name}</strong>
                  </p>
                  <p className="text-sm">{selectedUser.email}</p>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmEnableUser}>Enable User</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
