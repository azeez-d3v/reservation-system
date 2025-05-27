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

  if (!stats) {
    return null
  }

  return (
    <>
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between space-x-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Reservations</p>
              <p className="text-3xl font-bold">{stats.totalReservations}</p>
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
              <p className="text-3xl font-bold">{stats.pendingRequests}</p>
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
              <p className="text-3xl font-bold">{stats.approvedCount}</p>
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
              <p className="text-3xl font-bold">{stats.rejectedCount}</p>
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
