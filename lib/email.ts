"use server"

import type { Reservation, EmailSettings } from "./types"

// In a real application, this would use an email service like SendGrid, Mailgun, etc.
export async function sendApprovalEmail(reservation: Reservation, emailSettings: EmailSettings): Promise<void> {
  // Get the template
  let emailContent = emailSettings.templates.approval

  // Replace variables
  emailContent = emailContent
    .replace("{name}", reservation.name)
    .replace("{date}", new Date(reservation.date).toLocaleDateString())
    .replace("{startTime}", reservation.startTime)
    .replace("{endTime}", reservation.endTime)
    .replace("{purpose}", reservation.purpose)

  // Simulate sending an email
  console.log(`
    Sending approval email to: ${reservation.email}
    Subject: Your Reservation Has Been Approved
    
    ${emailContent}
  `)

  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 500))
}

export async function sendRejectionEmail(reservation: Reservation, emailSettings: EmailSettings): Promise<void> {
  // Get the template
  let emailContent = emailSettings.templates.rejection

  // Replace variables
  emailContent = emailContent
    .replace("{name}", reservation.name)
    .replace("{date}", new Date(reservation.date).toLocaleDateString())
    .replace("{startTime}", reservation.startTime)
    .replace("{endTime}", reservation.endTime)
    .replace("{purpose}", reservation.purpose)

  // Simulate sending an email
  console.log(`
    Sending rejection email to: ${reservation.email}
    Subject: Your Reservation Request Has Been Rejected
    
    ${emailContent}
  `)

  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 500))
}

export async function sendAdminNotification(reservation: Reservation, emailSettings: EmailSettings): Promise<void> {
  // Get the template
  let emailContent = emailSettings.templates.notification

  // Replace variables
  emailContent = emailContent
    .replace("{name}", reservation.name)
    .replace("{email}", reservation.email)
    .replace("{date}", new Date(reservation.date).toLocaleDateString())
    .replace("{startTime}", reservation.startTime)
    .replace("{endTime}", reservation.endTime)
    .replace("{purpose}", reservation.purpose)
    .replace("{attendees}", reservation.attendees.toString())

  // Simulate sending emails to all notification recipients
  emailSettings.notificationRecipients.forEach((recipient) => {
    console.log(`
      Sending notification to: ${recipient.email}
      Subject: New Reservation Request
      
      ${emailContent}
    `)
  })

  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 500))
}
