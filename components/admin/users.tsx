"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/hooks/use-auth"
import { useSession } from "next-auth/react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Search, UserX, UserCheck, Settings, Trash2 } from "lucide-react"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/components/ui/use-toast"
import { canChangeUserRoles, getRoleBadgeVariant, getRoleDisplayName, canManageUsers, type UserRole } from "@/lib/permissions"
import type { User } from "@/lib/types"

export function AdminUsers() {
  const { getAllUsers, updateUserStatus, updateUserRole, deleteUser, user: currentUser } = useAuth()
  const { data: session } = useSession()
  const { toast } = useToast()
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [showDisableDialog, setShowDisableDialog] = useState(false)
  const [showEnableDialog, setShowEnableDialog] = useState(false)
  const [showRoleDialog, setShowRoleDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deleteConfirmation, setDeleteConfirmation] = useState("")
  const [newRole, setNewRole] = useState<UserRole>("user")
  const [users, setUsers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Check permissions using utility functions
  const canChangeRoles = session?.user?.role ? canChangeUserRoles(session.user.role as "admin" | "staff" | "user") : false
  const canManageUsersPermission = session?.user?.role ? canManageUsers(session.user.role as "admin" | "staff" | "user") : false

  const refreshUsers = async () => {
    try {
      const fetchedUsers = await getAllUsers()
      setUsers(fetchedUsers)
    } catch (error) {
      console.error("Failed to refresh users:", error)
      toast({
        title: "Error",
        description: "Failed to refresh users.",
        variant: "destructive",
      })
    }
  }

  useEffect(() => {
    async function fetchUsers() {
      try {
        setIsLoading(true)
        await refreshUsers()
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
  }, [])

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

  const handleRoleChange = (user: User) => {
    setSelectedUser(user)
    setNewRole(user.role as UserRole) // Start with current role
    setShowRoleDialog(true)
  }
  const handleDeleteUser = (user: User) => {
    setSelectedUser(user)
    setDeleteConfirmation("") // Reset confirmation input
    setShowDeleteDialog(true)
  }

  const confirmDisableUser = async () => {
    if (selectedUser) {
      try {
        await updateUserStatus(selectedUser.email, "inactive")
        // Refresh users list
        await refreshUsers()
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
        await refreshUsers()
      } catch (error) {
        console.error("Failed to enable user:", error)
      }
      setShowEnableDialog(false)
    }
  }

  const confirmRoleChange = async () => {
    if (selectedUser) {
      try {
        await updateUserRole(selectedUser.id, newRole)
        // Refresh users list
        await refreshUsers()
      } catch (error) {
        console.error("Failed to update user role:", error)
      }
      setShowRoleDialog(false)
    }
  }
  const confirmDeleteUser = async () => {
    if (selectedUser) {
      try {
        const result = await deleteUser(selectedUser.id, selectedUser.email, selectedUser.name)
        if (result.success) {
          // Refresh users list
          await refreshUsers()
        }
      } catch (error) {
        console.error("Failed to delete user:", error)
      }
      setShowDeleteDialog(false)
      setDeleteConfirmation("") // Reset confirmation input
    }
  }

  const handleDeleteDialogChange = (open: boolean) => {
    setShowDeleteDialog(open)
    if (!open) {
      setDeleteConfirmation("") // Reset confirmation when dialog closes
    }
  }

  return (
    <div className="space-y-6">
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
        <Input
          placeholder="Search users by name or email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Users List */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between p-4 border rounded-lg bg-card">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-full bg-muted animate-pulse shrink-0" />
                <div className="space-y-2 flex-1">
                  <div className="h-4 w-32 bg-muted animate-pulse rounded" />
                  <div className="h-3 w-48 bg-muted animate-pulse rounded" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-6 w-16 bg-muted animate-pulse rounded" />
                <div className="h-8 w-20 bg-muted animate-pulse rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="text-center py-12">
          <Search className="mx-auto h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-semibold">No users found</h3>
          <p className="text-muted-foreground">Try adjusting your search terms.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredUsers.map((user: User) => (
            <div
              key={user.id}
              className="flex flex-col gap-4 p-4 border rounded-lg bg-card hover:bg-accent/50 transition-colors sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex items-center gap-4">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={user.image} alt={user.name} />
                  <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                    {user.name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium truncate">{user.name}</h3>
                    <Badge 
                      variant={getRoleBadgeVariant(user.role as "admin" | "staff" | "user")} 
                      className="shrink-0"
                    >
                      {getRoleDisplayName(user.role as "admin" | "staff" | "user")}
                    </Badge>
                    {user.status === "inactive" && (
                      <Badge variant="destructive" className="shrink-0">
                        Disabled
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground truncate">{user.email}</p>
                  <p className="text-xs text-muted-foreground">
                    Joined {format(new Date(user.createdAt), "MMM d, yyyy")}
                  </p>
                </div>
              </div>
              
              {user.id !== currentUser?.id && canManageUsersPermission && (
                <div className="flex gap-2 sm:shrink-0">
                  {canChangeRoles && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRoleChange(user)}
                      className="text-blue-600 hover:bg-blue-50 hover:border-blue-200 dark:hover:bg-blue-950"
                    >
                      <Settings className="mr-2 h-4 w-4" />
                      Change Role
                    </Button>                  )}
                  {user.status === "active" ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive hover:bg-destructive/10 hover:border-destructive/20"
                      onClick={() => handleDisableUser(user)}
                    >
                      <UserX className="mr-2 h-4 w-4" />
                      Disable
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-green-600 hover:bg-green-50 hover:border-green-200 dark:hover:bg-green-950"
                      onClick={() => handleEnableUser(user)}
                    >
                      <UserCheck className="mr-2 h-4 w-4" />
                      Enable
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-red-600 hover:bg-red-50 hover:border-red-200 dark:hover:bg-red-950"
                    onClick={() => handleDeleteUser(user)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Disable User Dialog */}
      <AlertDialog open={showDisableDialog} onOpenChange={setShowDisableDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disable User</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                <p>Are you sure you want to disable this user? They will no longer be able to log in or make reservations.</p>
                {selectedUser && (
                  <div className="mt-3 p-3 border rounded-md bg-muted/50">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={selectedUser.image} alt={selectedUser.name} />
                        <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                          {selectedUser.name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">{selectedUser.name}</div>
                        <div className="text-sm text-muted-foreground">{selectedUser.email}</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
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
            <AlertDialogDescription asChild>
              <div>
                <p>Are you sure you want to enable this user? They will be able to log in and make reservations again.</p>
                {selectedUser && (
                  <div className="mt-3 p-3 border rounded-md bg-muted/50">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={selectedUser.image} alt={selectedUser.name} />
                        <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                          {selectedUser.name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">{selectedUser.name}</div>
                        <div className="text-sm text-muted-foreground">{selectedUser.email}</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmEnableUser}>Enable User</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Role Management Dialog */}
      <AlertDialog open={showRoleDialog} onOpenChange={setShowRoleDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Update User Role</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                <p>Select a new role for this user. This will change their permissions and access level.</p>
                {selectedUser && (
                  <div className="mt-4 space-y-4">
                    <div className="p-3 border rounded-md bg-muted/50">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={selectedUser.image} alt={selectedUser.name} />
                          <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                            {selectedUser.name.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">{selectedUser.name}</div>
                          <div className="text-sm text-muted-foreground">{selectedUser.email}</div>
                          <div className="text-sm mt-1">
                            <strong>Current Role:</strong> {getRoleDisplayName(selectedUser.role as UserRole)}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">New Role</label>
                      <Select value={newRole} onValueChange={(value) => setNewRole(value as UserRole)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a role" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="user">
                            <div className="flex flex-col items-start">
                              <span>User</span>
                              <span className="text-xs text-muted-foreground">Can make and manage their own reservations</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="staff">
                            <div className="flex flex-col items-start">
                              <span>Staff</span>
                              <span className="text-xs text-muted-foreground">Can manage all reservations and users</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="admin">
                            <div className="flex flex-col items-start">
                              <span>Admin</span>
                              <span className="text-xs text-muted-foreground">Full access to all system features</span>
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmRoleChange}
              disabled={!selectedUser || newRole === selectedUser.role}
            >
              Update Role
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>      {/* Delete User Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={handleDeleteDialogChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                <div className="space-y-3">
                  <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3">
                    <div className="flex items-center gap-2 text-destructive mb-2">
                      <Trash2 className="h-4 w-4" />
                      <span className="font-semibold">Permanent Deletion</span>
                    </div>
                    <p className="text-sm text-destructive/80">
                      This action cannot be undone. This will permanently delete the user and all associated data including:
                    </p>
                    <ul className="text-sm text-destructive/80 mt-2 ml-4 space-y-1">
                      <li>• User account and profile information</li>
                      <li>• All reservation history (approved, pending, rejected, cancelled)</li>
                      <li>• Authentication data and sessions</li>
                      <li>• Any other associated system data</li>
                    </ul>
                  </div>
                  
                  {selectedUser && (
                    <div className="p-3 border rounded-md bg-muted/50">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={selectedUser.image} alt={selectedUser.name} />
                          <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                            {selectedUser.name.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">{selectedUser.name}</div>
                          <div className="text-sm text-muted-foreground">{selectedUser.email}</div>
                          <div className="text-xs text-muted-foreground mt-1">
                            Role: {getRoleDisplayName(selectedUser.role as UserRole)} • 
                            Joined {format(new Date(selectedUser.createdAt), "MMM d, yyyy")}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <p className="text-sm text-muted-foreground">
                    Please type <span className="font-mono bg-muted px-1 rounded">DELETE</span> to confirm:
                  </p>
                  <Input
                    placeholder="Type DELETE to confirm"
                    onChange={(e) => setDeleteConfirmation(e.target.value)}
                  />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteUser}
              disabled={deleteConfirmation !== "DELETE"}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete User Permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
