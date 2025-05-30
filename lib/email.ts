"use server"

import type { Reservation, EmailSettings, SystemSettings } from "./types"
import { emailService } from "./email-service"
import { format } from "date-fns"

// Helper function to convert plain text to basic HTML
function textToHtml(text: string): string {
  return text
    .replace(/\n/g, '<br>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
}

// Helper function to format reservation details for emails
function formatReservationDetails(reservation: Reservation): string {
  const dateStr = reservation.date instanceof Date 
    ? format(reservation.date, "EEEE, MMMM d, yyyy")
    : format(new Date(reservation.date), "EEEE, MMMM d, yyyy")
    
  return `
**Reservation Details:**
- **Name:** ${reservation.name}
- **Date:** ${dateStr}
- **Time:** ${reservation.startTime} - ${reservation.endTime}
- **Purpose:** ${reservation.purpose}
- **Attendees:** ${reservation.attendees}
- **Type:** ${reservation.type}${reservation.notes ? `\n- **Notes:** ${reservation.notes}` : ''}
  `
}

// Helper function to process email template variables
function processEmailTemplate(template: string, reservation: Reservation): string {
  const dateStr = reservation.date instanceof Date 
    ? format(reservation.date, "EEEE, MMMM d, yyyy")
    : format(new Date(reservation.date), "EEEE, MMMM d, yyyy")

  return template
    .replace(/\{name\}/g, reservation.name)
    .replace(/\{email\}/g, reservation.email)
    .replace(/\{date\}/g, dateStr)
    .replace(/\{startTime\}/g, reservation.startTime)
    .replace(/\{endTime\}/g, reservation.endTime)
    .replace(/\{purpose\}/g, reservation.purpose)
    .replace(/\{attendees\}/g, reservation.attendees.toString())
    .replace(/\{type\}/g, reservation.type)
    .replace(/\{notes\}/g, reservation.notes || '')
    .replace(/\{id\}/g, reservation.id || '')
}

// Send reservation confirmation email to user when they submit a request
export async function sendReservationSubmissionEmail(reservation: Reservation, emailSettings: EmailSettings): Promise<void> {
  if (!emailSettings.sendUserEmails) {
    console.log('User emails are disabled, skipping submission confirmation')
    return
  }

  try {
    // Get the template
    let emailContent = emailSettings.templates.submission

    // Replace variables using the helper function
    emailContent = processEmailTemplate(emailContent, reservation)

    await emailService.sendEmail({
      to: reservation.email,
      subject: 'Reservation Request Received - Pending Approval',
      text: emailContent,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #3b82f6; margin-bottom: 20px;">Reservation Request Received</h2>
          ${textToHtml(emailContent)}
          <div style="background-color: #eff6ff; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #3b82f6;">
            <p style="margin: 0; color: #1e40af; font-weight: 500;">
              📋 Your reservation ID: ${reservation.id}
            </p>
          </div>
          <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;">
          <p style="color: #666; font-size: 14px;">
            This is an automated message from the Reservation System.
          </p>
        </div>
      `
    })

    console.log(`Submission confirmation email sent successfully to: ${reservation.email}`)
  } catch (error) {
    console.error('Failed to send submission confirmation email:', error)
    throw new Error('Failed to send submission confirmation email')
  }
}

export async function sendApprovalEmail(reservation: Reservation, emailSettings: EmailSettings): Promise<void> {
  if (!emailSettings.sendUserEmails) {
    console.log('User emails are disabled, skipping approval email')
    return
  }

  try {
    // Get the template
    let emailContent = emailSettings.templates.approval

    // Replace variables
    emailContent = emailContent
      .replace(/\{name\}/g, reservation.name)
      .replace(/\{date\}/g, reservation.date instanceof Date 
        ? format(reservation.date, "EEEE, MMMM d, yyyy")
        : format(new Date(reservation.date), "EEEE, MMMM d, yyyy"))
      .replace(/\{startTime\}/g, reservation.startTime)
      .replace(/\{endTime\}/g, reservation.endTime)
      .replace(/\{purpose\}/g, reservation.purpose)
      .replace(/\{attendees\}/g, reservation.attendees.toString())
      .replace(/\{type\}/g, reservation.type)
      .replace(/\{id\}/g, reservation.id)

    // Send actual email
    await emailService.sendEmail({
      to: reservation.email,
      subject: 'Your Reservation Has Been Approved ✅',
      text: emailContent,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #22c55e; margin-bottom: 20px;">Reservation Approved ✅</h2>
          ${textToHtml(emailContent)}
          <div style="background-color: #f0fdf4; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #22c55e;">
            <h3 style="margin: 0 0 10px 0; color: #166534;">Your reservation is confirmed!</h3>
            <p style="margin: 0; color: #15803d;">
              Please save this email for your records. If you need to make any changes, contact us immediately.
            </p>
          </div>
          <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;">
          <p style="color: #666; font-size: 14px;">
            This is an automated message from the Reservation System.
          </p>
        </div>
      `
    })

    console.log(`Approval email sent successfully to: ${reservation.email}`)
  } catch (error) {
    console.error('Failed to send approval email:', error)
    throw new Error('Failed to send approval email')
  }
}

export async function sendRejectionEmail(reservation: Reservation, emailSettings: EmailSettings, reason?: string): Promise<void> {
  if (!emailSettings.sendUserEmails) {
    console.log('User emails are disabled, skipping rejection email')
    return
  }

  try {
    // Get the template
    let emailContent = emailSettings.templates.rejection

    // Replace variables
    emailContent = emailContent
      .replace(/\{name\}/g, reservation.name)
      .replace(/\{date\}/g, reservation.date instanceof Date 
        ? format(reservation.date, "EEEE, MMMM d, yyyy")
        : format(new Date(reservation.date), "EEEE, MMMM d, yyyy"))
      .replace(/\{startTime\}/g, reservation.startTime)
      .replace(/\{endTime\}/g, reservation.endTime)
      .replace(/\{purpose\}/g, reservation.purpose)
      .replace(/\{attendees\}/g, reservation.attendees.toString())
      .replace(/\{type\}/g, reservation.type)
      .replace(/\{id\}/g, reservation.id)

    // Add reason if provided
    if (reason) {
      emailContent += `\n\n**Reason:** ${reason}`
    }

    // Send actual email
    await emailService.sendEmail({
      to: reservation.email,
      subject: 'Your Reservation Request Has Been Rejected',
      text: emailContent,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #ef4444; margin-bottom: 20px;">Reservation Request Rejected</h2>
          ${textToHtml(emailContent)}
          <div style="background-color: #fef2f2; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #ef4444;">
            <h3 style="margin: 0 0 10px 0; color: #991b1b;">Need to make a new request?</h3>
            <p style="margin: 0; color: #dc2626;">
              You can submit a new reservation request at any time. Consider adjusting the date, time, or other details.
            </p>
          </div>
          <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;">
          <p style="color: #666; font-size: 14px;">
            This is an automated message from the Reservation System.
          </p>
        </div>
      `
    })

    console.log(`Rejection email sent successfully to: ${reservation.email}`)
  } catch (error) {
    console.error('Failed to send rejection email:', error)
    throw new Error('Failed to send rejection email')
  }
}

// Send cancellation email to user when their reservation is cancelled
export async function sendCancellationEmail(reservation: Reservation, emailSettings: EmailSettings, cancelledBy: 'user' | 'admin' = 'admin', reason?: string): Promise<void> {
  if (!emailSettings.sendUserEmails) {
    console.log('User emails are disabled, skipping cancellation email')
    return
  }

  try {
    // Get the template
    let emailContent = emailSettings.templates.cancellation

    // Replace variables using the helper function
    emailContent = processEmailTemplate(emailContent, reservation)

    // Add reason if provided
    if (reason) {
      emailContent += `\n\n**Cancellation Reason:** ${reason}`
    }

    // Add context-specific message based on who cancelled (only for user cancellations)
    if (cancelledBy === 'user') {
      emailContent += '\n\nIf you need to make a new reservation, you can submit a new request at any time.'
    }
    // Note: Admin cancellations already have appropriate messaging in the template

    await emailService.sendEmail({
      to: reservation.email,
      subject: 'Reservation Cancelled',
      text: emailContent,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #f59e0b; margin-bottom: 20px;">Reservation Cancelled</h2>
          ${textToHtml(emailContent)}
          <div style="background-color: #fffbeb; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #f59e0b;">
            <p style="margin: 0; color: #92400e;">
              ${cancelledBy === 'admin' 
                ? '⚠️ This cancellation was processed by an administrator.' 
                : '📋 Your cancellation has been processed successfully.'}
            </p>
          </div>
          <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;">
          <p style="color: #666; font-size: 14px;">
            This is an automated message from the Reservation System.
          </p>
        </div>
      `
    })

    console.log(`Cancellation email sent successfully to: ${reservation.email}`)
  } catch (error) {
    console.error('Failed to send cancellation email:', error)
    throw new Error('Failed to send cancellation email')
  }
}

export async function sendAdminNotification(reservation: Reservation, emailSettings: EmailSettings, systemSettings: SystemSettings, action: 'created' | 'updated' | 'cancelled' = 'created'): Promise<void> {
  if (!emailSettings.sendAdminEmails || !systemSettings.contactEmail) {
    console.log('Admin emails are disabled or no contact email configured, skipping admin notification')
    return
  }

  try {
    // Get the template
    let emailContent = emailSettings.templates.notification

    // Replace variables
    emailContent = emailContent
      .replace(/\{name\}/g, reservation.name)
      .replace(/\{email\}/g, reservation.email)
      .replace(/\{date\}/g, reservation.date instanceof Date 
        ? format(reservation.date, "EEEE, MMMM d, yyyy")
        : format(new Date(reservation.date), "EEEE, MMMM d, yyyy"))
      .replace(/\{startTime\}/g, reservation.startTime)
      .replace(/\{endTime\}/g, reservation.endTime)
      .replace(/\{purpose\}/g, reservation.purpose)
      .replace(/\{attendees\}/g, reservation.attendees.toString())
      .replace(/\{type\}/g, reservation.type)
      .replace(/\{id\}/g, reservation.id)
      .replace(/\{status\}/g, reservation.status)

    // Customize based on action
    const actionTitles = {
      created: 'New Reservation Request',
      updated: 'Reservation Updated',
      cancelled: 'Reservation Cancelled'
    }

    const actionColors = {
      created: '#3b82f6',
      updated: '#f59e0b', 
      cancelled: '#ef4444'
    }

    const actionIcons = {
      created: '📋',
      updated: '📝',
      cancelled: '❌'
    }

    // Send email to the system contact email
    await emailService.sendEmail({
      to: systemSettings.contactEmail,
      subject: `${actionTitles[action]} - ${reservation.name}`,
      text: emailContent,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: ${actionColors[action]}; margin-bottom: 20px;">
            ${actionIcons[action]} ${actionTitles[action]}
          </h2>
          ${textToHtml(emailContent)}
          <div style="background-color: #f8fafc; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3 style="margin: 0 0 10px 0; color: #374151;">Quick Actions:</h3>
            <p style="margin: 0; color: #6b7280;">
              ${action === 'created' 
                ? 'Log in to the admin panel to approve or reject this reservation.' 
                : action === 'updated'
                ? 'Check the admin panel for updated reservation details.'
                : 'This reservation has been cancelled and requires no further action.'}
            </p>
          </div>
          <div style="background-color: #eff6ff; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #3b82f6;">
            <p style="margin: 0; color: #1e40af; font-weight: 500;">
              🔗 Reservation ID: ${reservation.id}
            </p>
          </div>
          <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;">
          <p style="color: #666; font-size: 14px;">
            This is an automated message from the Reservation System.
          </p>
        </div>
      `
    })

    console.log(`Admin notification email sent successfully to ${systemSettings.contactEmail} for ${action} action`)
  } catch (error) {
    console.error('Failed to send admin notification email:', error)
    throw new Error('Failed to send admin notification email')
  }
}

// Send reminder emails (for future enhancement)
export async function sendReservationReminder(reservation: Reservation, emailSettings: EmailSettings, reminderType: '24h' | '1h' = '24h'): Promise<void> {
  if (!emailSettings.sendUserEmails) {
    console.log('User emails are disabled, skipping reminder email')
    return
  }

  try {
    const reminderTimes = {
      '24h': '24 hours',
      '1h': '1 hour'
    }

    const emailContent = `Dear ${reservation.name},

This is a friendly reminder that you have an upcoming reservation in ${reminderTimes[reminderType]}.

${formatReservationDetails(reservation)}

**Please Note:**
- Arrive a few minutes early to ensure a smooth start
- If you need to cancel or modify your reservation, please contact us as soon as possible
- Bring any materials or equipment you might need

We look forward to seeing you!`

    await emailService.sendEmail({
      to: reservation.email,
      subject: `Reservation Reminder - ${reminderTimes[reminderType]} until your booking`,
      text: emailContent,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #3b82f6; margin-bottom: 20px;">Upcoming Reservation Reminder ⏰</h2>
          ${textToHtml(emailContent)}
          <div style="background-color: #eff6ff; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #3b82f6;">
            <p style="margin: 0; color: #1e40af; font-weight: 500;">
              ⏰ Your reservation is in ${reminderTimes[reminderType]}
            </p>
          </div>
          <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;">
          <p style="color: #666; font-size: 14px;">
            This is an automated reminder from the Reservation System.
          </p>
        </div>
      `
    })

    console.log(`Reservation reminder email sent successfully to: ${reservation.email}`)
  } catch (error) {
    console.error('Failed to send reminder email:', error)
    throw new Error('Failed to send reminder email')
  }
}
