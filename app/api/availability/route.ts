import { NextRequest, NextResponse } from "next/server"
import { getPublicAvailability } from "@/lib/actions"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")
    const includeAvailabilityMap = searchParams.get("includeAvailabilityMap") === "true"

    // Validate required parameters
    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: "Both startDate and endDate parameters are required" },
        { status: 400 }
      )
    }

    // Parse dates
    const start = new Date(startDate)
    const end = new Date(endDate)

    // Validate date parsing
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return NextResponse.json(
        { error: "Invalid date format. Use ISO date format (YYYY-MM-DD)" },
        { status: 400 }
      )
    }

    // Validate date range
    if (start > end) {
      return NextResponse.json(
        { error: "Start date must be before or equal to end date" },
        { status: 400 }
      )
    }

    // Fetch availability data
    const availabilityData = await getPublicAvailability(start, end, includeAvailabilityMap)

    return NextResponse.json({
      success: true,
      data: availabilityData
    })

  } catch (error) {
    console.error("Error in availability API route:", error)
    return NextResponse.json(
      { 
        error: "Failed to fetch availability data",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    )
  }
}
