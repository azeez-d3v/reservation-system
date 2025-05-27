import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { format } from "date-fns"
import { CalendarDays, Clock, Users, Info } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import Link from "next/link"

interface ReservationListProps {
  reservations: any[]
  emptyMessage: string
  isLoading: boolean
}

export function ReservationList({ reservations, emptyMessage, isLoading }: ReservationListProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        <ReservationSkeleton />
        <ReservationSkeleton />
      </div>
    )
  }

  if (!reservations || reservations.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-10 text-center">
          <CalendarDays className="h-10 w-10 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">{emptyMessage}</p>
          <Button asChild className="mt-4">
            <Link href="/request">Create a Reservation</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {reservations.map((reservation) => (
        <Card key={reservation.id} className="overflow-hidden">
          <CardContent className="p-0">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-6">
              <div className="space-y-2">
                <h3 className="font-semibold">{reservation.purpose}</h3>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">{reservation.attendees} attendees</Badge>
                  <Badge
                    variant="outline"
                    className={cn(
                      reservation.type === "meeting" && "bg-blue-100 text-blue-800 border-blue-300",
                      reservation.type === "event" && "bg-green-100 text-green-800 border-green-300",
                      reservation.type === "training" && "bg-amber-100 text-amber-800 border-amber-300",
                      reservation.type === "other" && "bg-purple-100 text-purple-800 border-purple-300",
                    )}
                  >
                    {reservation.type}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={cn(
                      reservation.status === "approved" && "bg-green-100 text-green-800 border-green-300",
                      reservation.status === "pending" && "bg-amber-100 text-amber-800 border-amber-300",
                      reservation.status === "rejected" && "bg-red-100 text-red-800 border-red-300",
                    )}
                  >
                    {reservation.status}
                  </Badge>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center text-sm">
                  <CalendarDays className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span>{format(new Date(reservation.date), "PPP")}</span>
                </div>
                <div className="flex items-center text-sm">
                  <Clock className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span>
                    {reservation.startTime} - {reservation.endTime}
                  </span>
                </div>
                <div className="flex items-center text-sm">
                  <Users className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span>{reservation.attendees} attendees</span>
                </div>
              </div>

              {reservation.notes && (
                <div className="space-y-2">
                  <div className="flex items-center text-sm">
                    <Info className="mr-2 h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Notes:</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{reservation.notes}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function ReservationSkeleton() {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Skeleton className="h-5 w-[200px]" />
            <div className="flex gap-2">
              <Skeleton className="h-5 w-[100px]" />
              <Skeleton className="h-5 w-[80px]" />
            </div>
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-[150px]" />
            <Skeleton className="h-4 w-[120px]" />
            <Skeleton className="h-4 w-[100px]" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-[180px]" />
            <Skeleton className="h-4 w-full" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
