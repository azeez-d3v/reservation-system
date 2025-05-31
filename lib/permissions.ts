// Role-based permission utility functions

export type UserRole = "admin" | "staff" | "user"

export interface Permission {
  canViewAdminPanel: boolean
  canManageUsers: boolean
  canChangeUserRoles: boolean
  canManageReservations: boolean
  canModifySystemSettings: boolean
  canModifyTimeSlots: boolean
  canModifyEmailSettings: boolean
  canViewUserStats: boolean
  canViewSystemStats: boolean
  canDeleteReservations: boolean
  canApproveReservations: boolean
  canRejectReservations: boolean
}

/**
 * Get permissions for a specific user role
 */
export function getPermissions(role: UserRole): Permission {
  switch (role) {
    case "admin":
      return {
        canViewAdminPanel: true,
        canManageUsers: true,
        canChangeUserRoles: true,
        canManageReservations: true,
        canModifySystemSettings: true,
        canModifyTimeSlots: true,
        canModifyEmailSettings: true,
        canViewUserStats: true,
        canViewSystemStats: true,
        canDeleteReservations: true,
        canApproveReservations: true,
        canRejectReservations: true,
      }
    case "staff":
      return {
        canViewAdminPanel: true,
        canManageUsers: true,
        canChangeUserRoles: false, // Staff cannot change roles
        canManageReservations: true,
        canModifySystemSettings: false, // Staff cannot modify system settings
        canModifyTimeSlots: false, // Staff cannot modify time slots
        canModifyEmailSettings: false, // Staff cannot modify email settings
        canViewUserStats: true,
        canViewSystemStats: true,
        canDeleteReservations: true,
        canApproveReservations: true,
        canRejectReservations: true,
      }
    case "user":
    default:
      return {
        canViewAdminPanel: false,
        canManageUsers: false,
        canChangeUserRoles: false,
        canManageReservations: false,
        canModifySystemSettings: false,
        canModifyTimeSlots: false,
        canModifyEmailSettings: false,
        canViewUserStats: false,
        canViewSystemStats: false,
        canDeleteReservations: false,
        canApproveReservations: false,
        canRejectReservations: false,
      }
  }
}

/**
 * Check if a user has a specific permission
 */
export function hasPermission(role: UserRole, permission: keyof Permission): boolean {
  const permissions = getPermissions(role)
  return permissions[permission]
}

/**
 * Check if a user can access the admin panel
 */
export function canAccessAdminPanel(role: UserRole): boolean {
  return hasPermission(role, "canViewAdminPanel")
}

/**
 * Check if a user can modify system settings
 */
export function canModifySettings(role: UserRole): boolean {
  return hasPermission(role, "canModifySystemSettings")
}

/**
 * Check if a user can access the settings tab
 */
export function canAccessSettings(role: UserRole): boolean {
  return canModifySettings(role)
}

/**
 * Check if a user can manage other users
 */
export function canManageUsers(role: UserRole): boolean {
  return hasPermission(role, "canManageUsers")
}

/**
 * Check if a user can change user roles
 */
export function canChangeUserRoles(role: UserRole): boolean {
  return hasPermission(role, "canChangeUserRoles")
}

/**
 * Check if a user can manage reservations
 */
export function canManageReservations(role: UserRole): boolean {
  return hasPermission(role, "canManageReservations")
}

/**
 * Get a user-friendly role description
 */
export function getRoleDescription(role: UserRole): string {
  switch (role) {
    case "admin":
      return "Administrator - Full system access"
    case "staff":
      return "Staff Member - Can manage reservations and users"
    case "user":
      return "Regular User - Can create and view own reservations"
    default:
      return "Unknown Role"
  }
}

/**
 * Get the next role in the hierarchy (for role cycling in UI)
 */
export function getNextRole(currentRole: UserRole): UserRole {
  switch (currentRole) {
    case "user":
      return "staff"
    case "staff":
      return "admin"
    case "admin":
      return "user"
    default:
      return "user"
  }
}

/**
 * Get role badge variant for UI components
 */
export function getRoleBadgeVariant(role: UserRole): "default" | "secondary" | "outline" {
  switch (role) {
    case "admin":
      return "default"
    case "staff":
      return "secondary"
    case "user":
      return "outline"
    default:
      return "outline"
  }
}

/**
 * Get role display name
 */
export function getRoleDisplayName(role: UserRole): string {
  switch (role) {
    case "admin":
      return "Admin"
    case "staff":
      return "Staff"
    case "user":
      return "User"
    default:
      return "Unknown"
  }
}
