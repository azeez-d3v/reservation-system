import nodemailer from 'nodemailer'

export interface EmailConfig {
  host: string
  port: number
  secure: boolean
  auth: {
    user: string
    pass: string
  }
}

export interface EmailOptions {
  to: string | string[]
  subject: string
  text: string
  html?: string
  from?: string
}

class EmailService {
  private transporter: nodemailer.Transporter | null = null
  private config: EmailConfig

  constructor() {
    this.config = {
      host: process.env.EMAIL_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.EMAIL_PORT || '587'),
      secure: process.env.EMAIL_SECURE === 'true',
      auth: {
        user: process.env.EMAIL_USER || '',
        pass: process.env.EMAIL_PASS || ''
      }
    }
  }
  private async createTransporter(): Promise<nodemailer.Transporter> {
    if (this.transporter) {
      return this.transporter
    }

    this.transporter = nodemailer.createTransport({
      service: "gmail",
      auth: this.config.auth,
      tls: {
        rejectUnauthorized: true,
        ciphers: 'SSLv3',
        minVersion: 'TLSv1.2'
      }
    })

    // Verify connection configuration
    try {
      await this.transporter.verify()
      console.log('Email server connection verified successfully')
    } catch (error) {
      console.error('Email server connection verification failed:', error)
      this.transporter = null // Reset transporter on failure
      throw new Error('Failed to connect to email server')
    }

    return this.transporter
  }

  async sendEmail(options: EmailOptions): Promise<void> {
    try {
      const transporter = await this.createTransporter()
      
      const mailOptions = {
        from: options.from || `${process.env.EMAIL_FROM_NAME || 'Reservation System'} <${process.env.EMAIL_FROM}>`,
        to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
        subject: options.subject,
        text: options.text,
        html: options.html || options.text.replace(/\n/g, '<br>'),
        headers: {
          "X-Entity-Ref-ID": "newmail",
        },
      }

      const info = await transporter.sendMail(mailOptions)
      console.log('Email sent successfully:', info.messageId)
    } catch (error) {
      console.error('Failed to send email:', error)
      throw new Error(`Failed to send email: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
  /**
   * Enhanced bulk email sending with better error handling and concurrency control
   */
  async sendBulkEmails(emails: EmailOptions[], options: { 
    maxConcurrency?: number
    retryAttempts?: number 
  } = {}): Promise<{
    successful: number
    failed: number
    errors: Array<{ email: string; error: string }>
  }> {
    const { maxConcurrency = 5, retryAttempts = 2 } = options
    let successful = 0
    let failed = 0
    const errors: Array<{ email: string; error: string }> = []
    
    // Process emails in batches to control concurrency
    const batches = []
    for (let i = 0; i < emails.length; i += maxConcurrency) {
      batches.push(emails.slice(i, i + maxConcurrency))
    }
    
    for (const batch of batches) {
      const batchPromises = batch.map(async (emailData) => {
        let attempts = 0
        const recipientEmail = Array.isArray(emailData.to) ? emailData.to[0] : emailData.to
        
        while (attempts <= retryAttempts) {
          try {
            await this.sendEmail(emailData)
            return { success: true, email: recipientEmail }
          } catch (error) {
            attempts++
            
            if (attempts > retryAttempts) {
              const errorMessage = error instanceof Error ? error.message : 'Unknown error'
              return { 
                success: false, 
                email: recipientEmail, 
                error: errorMessage 
              }
            }
            
            // Wait before retry (exponential backoff)
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempts) * 1000))
          }
        }
        
        return { success: false, email: recipientEmail, error: 'Max retries exceeded' }
      })
      
      const results = await Promise.allSettled(batchPromises)
      
      results.forEach((result) => {
        if (result.status === 'fulfilled') {
          if (result.value.success) {
            successful++
          } else {
            failed++
            errors.push({ 
              email: result.value.email, 
              error: result.value.error || 'Unknown error' 
            })
          }
        } else {
          failed++
          errors.push({ 
            email: 'unknown', 
            error: result.reason?.message || 'Promise rejected' 
          })
        }
      })
    }
    
    console.log(`Bulk email results: ${successful} successful, ${failed} failed`)
    if (errors.length > 0) {
      console.error('Email errors:', errors)
    }
    
    return { successful, failed, errors }
  }
}

export const emailService = new EmailService()
