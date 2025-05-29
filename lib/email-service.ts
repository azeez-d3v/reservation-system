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

  async sendBulkEmails(emails: EmailOptions[]): Promise<void> {
    const promises = emails.map(email => this.sendEmail(email))
    await Promise.all(promises)
  }
}

export const emailService = new EmailService()
