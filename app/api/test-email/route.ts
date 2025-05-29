import { NextRequest, NextResponse } from 'next/server'
import { sendTestEmail, testEmailConnection } from '@/lib/email-test'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, email } = body

    if (action === 'test-connection') {
      const isWorking = await testEmailConnection()
      return NextResponse.json({ 
        success: isWorking,
        message: isWorking ? 'Email connection test passed' : 'Email connection test failed'
      })
    }

    if (action === 'send-test' && email) {
      await sendTestEmail(email)
      return NextResponse.json({ 
        success: true,
        message: `Test email sent successfully to ${email}`
      })
    }

    return NextResponse.json({ 
      success: false,
      message: 'Invalid action or missing email parameter'
    }, { status: 400 })

  } catch (error) {
    console.error('Email test API error:', error)
    return NextResponse.json({ 
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Email test API',
    endpoints: {
      'POST /api/test-email': {
        description: 'Test email functionality',
        body: {
          action: 'test-connection | send-test',
          email: 'required for send-test action'
        }
      }
    }
  })
}
