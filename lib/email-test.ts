import { emailService } from './email-service'

export async function testEmailConnection(): Promise<boolean> {
  try {
    // Get email settings to check if emails are enabled
    const { getEmailConfiguration } = await import('./actions')
    const emailSettings = await getEmailConfiguration()
    
    if (!emailSettings.sendUserEmails && !emailSettings.sendAdminEmails) {
      console.log('Email notifications are disabled in admin settings, skipping connection test')
      return false
    }
    
    // Test email configuration by sending a test email
    await emailService.sendEmail({
      to: process.env.EMAIL_FROM || 'test@example.com',
      subject: 'Email Configuration Test',
      text: 'This is a test email to verify that the email configuration is working correctly.'
    })
    
    console.log('Email configuration test passed')
    return true
  } catch (error) {
    console.error('Email configuration test failed:', error)
    return false
  }
}

export async function sendTestEmail(to: string): Promise<void> {
  try {
    // Get email settings to check if emails are enabled
    const { getEmailConfiguration } = await import('./actions')
    const emailSettings = await getEmailConfiguration()
    
    if (!emailSettings.sendUserEmails && !emailSettings.sendAdminEmails) {
      console.log('Email notifications are disabled in admin settings, skipping test email')
      throw new Error('Email notifications are disabled in admin settings')
    }
    
    await emailService.sendEmail({
      to,
      subject: 'Test Email from Reservation System',
      text: `Hello!\n\nThis is a test email from the Reservation System to verify that email functionality is working correctly.\n\nBest regards,\nReservation System`,
      html: `
        <h2>Hello!</h2>
        <p>This is a test email from the <strong>Reservation System</strong> to verify that email functionality is working correctly.</p>
        <p>Best regards,<br>Reservation System</p>
      `
    })
    
    console.log(`Test email sent successfully to: ${to}`)
  } catch (error) {
    console.error('Failed to send test email:', error)
    throw error
  }
}
