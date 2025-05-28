"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { getReservationStats, getEnhancedAvailability, getTimeSlotValidations } from "@/lib/actions"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts"
import { CalendarDays, Users, Clock, CheckCircle, AlertTriangle, AlertCircle, TrendingUp, Activity } from "lucide-react"

export function AdminDashboard() {
  const [stats, setStats] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [timeRange, setTimeRange] = useState("week")
  const [todayAvailability, setTodayAvailability] = useState<any>(null)
  const [availabilityMetrics, setAvailabilityMetrics] = useState<any>(null)
  const [isLoadingAvailability, setIsLoadingAvailability] = useState(true)

  useEffect(() => {
    const fetchStats = async () => {
      setIsLoading(true)
      try {
        const data = await getReservationStats(timeRange)
        setStats(data)
      } catch (error) {
        console.error("Failed to fetch stats:", error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchStats()
  }, [timeRange])

  // Fetch enhanced availability data for today
  useEffect(() => {
    const fetchAvailabilityData = async () => {
      setIsLoadingAvailability(true)
      try {
        const today = new Date()
        const [enhancedData, validations] = await Promise.all([
          getEnhancedAvailability(today),
          getTimeSlotValidations(today)
        ])

        setTodayAvailability(enhancedData)
        
        // Calculate availability metrics
        const timeSlots = enhancedData.timeSlots || []
        const totalSlots = timeSlots.length
        const availableSlots = timeSlots.filter(slot => slot.status === 'available').length
        const limitedSlots = timeSlots.filter(slot => slot.status === 'limited').length
        const fullSlots = timeSlots.filter(slot => slot.status === 'full' || slot.status === 'unavailable').length
        const totalOccupancy = timeSlots.reduce((sum, slot) => sum + (slot.occupancy || 0), 0)
        const totalCapacity = timeSlots.reduce((sum, slot) => sum + (slot.capacity || 3), 0)
        const conflictingSlots = timeSlots.filter(slot => slot.conflicts && slot.conflicts.length > 0).length

        setAvailabilityMetrics({
          totalSlots,
          availableSlots,
          limitedSlots,
          fullSlots,
          totalOccupancy,
          totalCapacity,
          conflictingSlots,
          utilizationRate: totalCapacity > 0 ? (totalOccupancy / totalCapacity) * 100 : 0,
          availabilityRate: totalSlots > 0 ? (availableSlots / totalSlots) * 100 : 0
        })
      } catch (error) {
        console.error("Failed to fetch availability data:", error)
      } finally {
        setIsLoadingAvailability(false)
      }
    }

    fetchAvailabilityData()
  }, [])

  if (isLoading) {
    return <div className="flex justify-center py-12">Loading statistics...</div>
  }

  if (!stats) {
    return <div className="flex justify-center py-12">Failed to load statistics</div>
  }

  const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8"]
  return (
    <div className="space-y-6">
      {/* Enhanced Availability Metrics */}
      {!isLoadingAvailability && availabilityMetrics && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Today's Availability Overview</h2>
            <Badge variant="outline" className="bg-blue-50 text-blue-700">
              Live Data
            </Badge>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between space-x-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Availability Rate</p>
                    <p className="text-3xl font-bold">{availabilityMetrics.availabilityRate.toFixed(1)}%</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {availabilityMetrics.availableSlots}/{availabilityMetrics.totalSlots} slots available
                    </p>
                  </div>
                  <div className="rounded-full bg-green-100 p-3 text-green-600">
                    <Activity className="h-6 w-6" />
                  </div>
                </div>
                <Progress 
                  value={availabilityMetrics.availabilityRate} 
                  className="mt-3 h-2"
                />
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between space-x-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Utilization Rate</p>
                    <p className="text-3xl font-bold">{availabilityMetrics.utilizationRate.toFixed(1)}%</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {availabilityMetrics.totalOccupancy}/{availabilityMetrics.totalCapacity} capacity used
                    </p>
                  </div>
                  <div className="rounded-full bg-blue-100 p-3 text-blue-600">
                    <TrendingUp className="h-6 w-6" />
                  </div>
                </div>
                <Progress 
                  value={availabilityMetrics.utilizationRate} 
                  className="mt-3 h-2"
                />
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between space-x-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Limited Slots</p>
                    <p className="text-3xl font-bold">{availabilityMetrics.limitedSlots}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Partially booked
                    </p>
                  </div>
                  <div className="rounded-full bg-amber-100 p-3 text-amber-600">
                    <AlertTriangle className="h-6 w-6" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between space-x-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Conflicts</p>
                    <p className="text-3xl font-bold">{availabilityMetrics.conflictingSlots}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Slots with overlaps
                    </p>
                  </div>
                  <div className="rounded-full bg-red-100 p-3 text-red-600">
                    <AlertCircle className="h-6 w-6" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Availability Status Alert */}
          {availabilityMetrics.conflictingSlots > 0 && (
            <Alert className="mt-4 border-orange-200 bg-orange-50">
              <AlertTriangle className="h-4 w-4 text-orange-600" />
              <AlertTitle className="text-orange-800">Attention Needed</AlertTitle>
              <AlertDescription className="text-orange-700">
                {availabilityMetrics.conflictingSlots} time slot{availabilityMetrics.conflictingSlots > 1 ? 's have' : ' has'} conflicting reservations. 
                Review the reservations management panel to resolve conflicts.
              </AlertDescription>
            </Alert>
          )}

          {availabilityMetrics.availabilityRate < 20 && (
            <Alert className="mt-4 border-red-200 bg-red-50">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertTitle className="text-red-800">Low Availability</AlertTitle>
              <AlertDescription className="text-red-700">
                Only {availabilityMetrics.availabilityRate.toFixed(1)}% of today's time slots are available. 
                Consider encouraging users to check alternative dates.
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}

      {/* Original Stats Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
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
                <p className="text-sm font-medium text-muted-foreground">Total Attendees</p>
                <p className="text-3xl font-bold">{stats.totalAttendees}</p>
              </div>
              <div className="rounded-full bg-green-100 p-3 text-green-600">
                <Users className="h-6 w-6" />
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
                <p className="text-sm font-medium text-muted-foreground">Approval Rate</p>
                <p className="text-3xl font-bold">{stats.approvalRate}%</p>
              </div>
              <div className="rounded-full bg-purple-100 p-3 text-purple-600">
                <CheckCircle className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="daily" onValueChange={setTimeRange}>
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl">Reservation Trends</CardTitle>
          <TabsList>
            <TabsTrigger value="daily">Daily</TabsTrigger>
            <TabsTrigger value="week">Weekly</TabsTrigger>
            <TabsTrigger value="month">Monthly</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value={timeRange} className="mt-6">
          <Card>
            <CardContent className="p-6">
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.trends}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" fill="#8884d8" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Reservation Types</CardTitle>
            <CardDescription>Distribution of reservations by type</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.typeDistribution}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  >
                    {stats.typeDistribution.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Popular Time Slots</CardTitle>
            <CardDescription>Most requested time slots</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.popularTimeSlots} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="time" type="category" width={80} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#82ca9d" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
