"use client"

import type React from "react"
import { createContext, useContext, useState, useEffect } from "react"
import { useToast } from "@/components/ui/use-toast"

// Mock user data
const mockUsers = [
  {
    id: "1",
    name: "Admin User",
    email: "admin@example.com",
    role: "admin",
    status: "active",
    createdAt: new Date("2023-01-01"),
  },
  {
    id: "2",
    name: "Regular User",
    email: "user@example.com",
    role: "user",
    status: "active",
    createdAt: new Date("2023-01-15"),
  },
  {
    id: "3",
    name: "John Doe",
    email: "john@example.com",
    role: "user",
    status: "active",
    createdAt: new Date("2023-02-10"),
  },
  {
    id: "4",
    name: "Jane Smith",
    email: "jane@example.com",
    role: "user",
    status: "inactive",
    createdAt: new Date("2023-03-05"),
  },
]

type User = {
  id: string
  name: string
  email: string
  role: "admin" | "user"
  status: "active" | "inactive"
  createdAt: Date
}

type AuthContextType = {
  user: User | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  signup: (name: string, email: string, password: string) => Promise<void>
  logout: () => void
  updateUser: (user: User) => void
  getAllUsers: () => User[]
  updateUserStatus: (userId: string, status: "active" | "inactive") => void
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const { toast } = useToast()

  // Check for existing session on mount
  useEffect(() => {
    const storedUser = localStorage.getItem("user")
    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser)
        setUser(parsedUser)
      } catch (error) {
        console.error("Failed to parse stored user:", error)
        localStorage.removeItem("user")
      }
    }
    setIsLoading(false)
  }, [])

  const login = async (email: string, password: string) => {
    // Simulate API call delay
    await new Promise((resolve) => setTimeout(resolve, 1000))

    // Find user with matching email
    const foundUser = mockUsers.find((u) => u.email.toLowerCase() === email.toLowerCase())

    if (!foundUser) {
      throw new Error("User not found")
    }

    if (foundUser.status === "inactive") {
      throw new Error("Account is disabled")
    }

    // In a real app, we would verify the password here
    // For demo purposes, we'll accept any password

    // Store user in localStorage for persistence
    localStorage.setItem("user", JSON.stringify(foundUser))
    setUser(foundUser)

    toast({
      title: "Logged in successfully",
      description: `Welcome back, ${foundUser.name}!`,
    })
  }

  const signup = async (name: string, email: string, password: string) => {
    // Simulate API call delay
    await new Promise((resolve) => setTimeout(resolve, 1000))

    // Check if user already exists
    if (mockUsers.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
      throw new Error("Email already in use")
    }

    // Create new user
    const newUser: User = {
      id: (mockUsers.length + 1).toString(),
      name,
      email,
      role: "user",
      status: "active",
      createdAt: new Date(),
    }

    // Add to mock users (in a real app, this would be a database call)
    mockUsers.push(newUser)

    // Store user in localStorage for persistence
    localStorage.setItem("user", JSON.stringify(newUser))
    setUser(newUser)

    toast({
      title: "Account created",
      description: `Welcome, ${name}!`,
    })
  }

  const logout = () => {
    localStorage.removeItem("user")
    setUser(null)
    toast({
      title: "Logged out",
      description: "You have been logged out successfully.",
    })
  }

  const updateUser = (updatedUser: User) => {
    // Update the user in the mockUsers array
    const userIndex = mockUsers.findIndex((u) => u.id === updatedUser.id)
    if (userIndex !== -1) {
      mockUsers[userIndex] = updatedUser
    }

    // Update current user if it's the same user
    if (user && user.id === updatedUser.id) {
      setUser(updatedUser)
      localStorage.setItem("user", JSON.stringify(updatedUser))
    }
  }

  const getAllUsers = () => {
    return [...mockUsers]
  }

  const updateUserStatus = (userId: string, status: "active" | "inactive") => {
    const userIndex = mockUsers.findIndex((u) => u.id === userId)
    if (userIndex !== -1) {
      mockUsers[userIndex].status = status

      // If the user being updated is the current user and they're being deactivated, log them out
      if (user && user.id === userId && status === "inactive") {
        logout()
      }
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        login,
        signup,
        logout,
        updateUser,
        getAllUsers,
        updateUserStatus,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
