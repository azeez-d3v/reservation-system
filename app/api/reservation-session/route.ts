import { NextRequest, NextResponse } from "next/server"

interface ReservationSessionData {
  date: string
  time: string
  duration: number
}

// In-memory storage for reservation session data
// In production, you'd use Redis or a database
const sessionStorage = new Map<string, ReservationSessionData>()

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { date, time, duration } = body

    if (!date || !time || !duration) {
      return NextResponse.json(
        { error: "Missing required fields: date, time, duration" },
        { status: 400 }
      )
    }

    // Generate a unique session ID
    const sessionId = Math.random().toString(36).substring(2, 15)

    // Store the reservation data
    sessionStorage.set(sessionId, { date, time, duration })

    // Clean up old sessions (optional, for memory management)
    if (sessionStorage.size > 1000) {
      const firstKey = sessionStorage.keys().next().value
      if (firstKey) {
        sessionStorage.delete(firstKey)
      }
    }

    return NextResponse.json({ sessionId })
  } catch (error) {
    console.error("Error storing reservation session:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const sessionId = url.searchParams.get("sessionId")

    if (!sessionId) {
      return NextResponse.json(
        { error: "Missing sessionId parameter" },
        { status: 400 }
      )
    }

    const data = sessionStorage.get(sessionId)
    if (!data) {
      return NextResponse.json(
        { error: "Session not found or expired" },
        { status: 404 }
      )
    }

    // Clean up the session after retrieval
    sessionStorage.delete(sessionId)

    return NextResponse.json(data)
  } catch (error) {
    console.error("Error retrieving reservation session:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
