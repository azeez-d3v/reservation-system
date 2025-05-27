import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { CalendarDays, Clock, CheckCircle, XCircle } from "lucide-react"

interface DashboardStatsProps {
  stats: any
  isLoading: boolean
}

export function DashboardStats({ stats, isLoading }: DashboardStatsProps) {
  if (isLoading) {
    return (
      <>
        <StatSkeleton />
        <StatSkeleton />
        <StatSkeleton />
        <StatSkeleton />
      </>
    )
  }

  // Use default values of 0 if stats is null or undefined
  const defaultStats = {
    totalReservations: 0,
    pendingRequests: 0,
    approvedReservations: 0,
    rejectedReservations: 0,
    approvedCount: 0,
    rejectedCount: 0
  }
  
  // Ensure all required stats properties exist with fallback values
  const displayStats = {
    ...defaultStats,
    ...(stats || {}),
    // Map pendingReservations to pendingRequests for display
    pendingRequests: stats?.pendingReservations || stats?.pendingRequests || stats?.pending || 0,
    // Count both rejected and cancelled reservations for the "Rejected" card
    rejectedReservations: (stats?.rejectedReservations || 0) + (stats?.cancelledReservations || 0)
  }

  return (
    <>
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between space-x-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Reservations</p>
              <p className="text-3xl font-bold">{displayStats.totalReservations}</p>
            </div>
            <div className="rounded-full bg-blue-100 p-3 text-blue-600">
              <CalendarDays className="h-6 w-6" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between space-x-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Pending Requests</p>
              <p className="text-3xl font-bold">{displayStats.pendingRequests}</p>
            </div>
            <div className="rounded-full bg-amber-100 p-3 text-amber-600">
              <Clock className="h-6 w-6" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between space-x-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Approved</p>
              <p className="text-3xl font-bold">{displayStats.approvedReservations}</p>
            </div>
            <div className="rounded-full bg-green-100 p-3 text-green-600">
              <CheckCircle className="h-6 w-6" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between space-x-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Rejected</p>
              <p className="text-3xl font-bold">{displayStats.rejectedReservations}</p>
            </div>
            <div className="rounded-full bg-red-100 p-3 text-red-600">
              <XCircle className="h-6 w-6" />
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  )
}

function StatSkeleton() {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between space-x-4">
          <div className="space-y-2">
            <Skeleton className="h-4 w-[100px]" />
            <Skeleton className="h-8 w-[60px]" />
          </div>
          <Skeleton className="h-12 w-12 rounded-full" />
        </div>
      </CardContent>
    </Card>
  )
}
