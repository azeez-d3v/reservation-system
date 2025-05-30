/**
 * Advanced notification queue system for handling high-volume concurrent reservations
 * This demonstrates a more sophisticated approach for systems expecting heavy concurrent usage
 */

interface NotificationTask {
  id: string
  type: 'user_confirmation' | 'admin_notification' | 'approval' | 'rejection' | 'cancellation'
  priority: 'low' | 'normal' | 'high'
  payload: {
    reservationId: string
    recipientEmail: string
    emailData: any
  }
  attempts: number
  maxAttempts: number
  createdAt: Date
  scheduledAt?: Date
}

class NotificationQueue {
  private queue: NotificationTask[] = []
  private processing = false
  private readonly maxConcurrentTasks = 10
  private readonly retryDelay = 5000 // 5 seconds
  private activeTasks = new Set<string>()

  /**
   * Add a notification task to the queue
   */
  async enqueue(task: Omit<NotificationTask, 'id' | 'attempts' | 'createdAt'>): Promise<string> {
    const taskId = `${task.type}_${task.payload.reservationId}_${Date.now()}`
    
    const fullTask: NotificationTask = {
      ...task,
      id: taskId,
      attempts: 0,
      createdAt: new Date()
    }

    // Insert based on priority (high priority first)
    const priorityOrder = { high: 0, normal: 1, low: 2 }
    const insertIndex = this.queue.findIndex(
      existingTask => priorityOrder[existingTask.priority] > priorityOrder[task.priority]
    )
    
    if (insertIndex === -1) {
      this.queue.push(fullTask)
    } else {
      this.queue.splice(insertIndex, 0, fullTask)
    }

    // Start processing if not already running
    this.processQueue()
    
    return taskId
  }

  /**
   * Process the notification queue
   */
  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) {
      return
    }

    this.processing = true
    console.log(`Processing notification queue with ${this.queue.length} tasks`)

    try {
      while (this.queue.length > 0 && this.activeTasks.size < this.maxConcurrentTasks) {
        const task = this.queue.shift()
        if (!task) break

        // Skip if scheduled for later
        if (task.scheduledAt && task.scheduledAt > new Date()) {
          this.queue.push(task) // Re-queue for later
          continue
        }

        // Process task without blocking
        this.processTask(task).catch(error => {
          console.error(`Error processing task ${task.id}:`, error)
        })
      }
    } finally {
      this.processing = false
      
      // Continue processing if there are more tasks
      if (this.queue.length > 0) {
        setTimeout(() => this.processQueue(), 1000)
      }
    }
  }

  /**
   * Process a single notification task
   */
  private async processTask(task: NotificationTask): Promise<void> {
    this.activeTasks.add(task.id)
    
    try {
      console.log(`Processing notification task: ${task.type} for reservation ${task.payload.reservationId}`)
      
      // Import email functions dynamically to avoid circular dependencies
      const { 
        sendReservationSubmissionEmail,
        sendApprovalEmail, 
        sendRejectionEmail,
        sendCancellationEmail,
        sendAdminNotification 
      } = await import('./email')
      
      const { getNotificationSettings } = await import('./actions')
      const { getReservationById } = await import('./firestore')
      
      // Get fresh data
      const [{ emailSettings, systemSettings }, reservationDetails] = await Promise.all([
        getNotificationSettings(),
        getReservationById(task.payload.reservationId)
      ])
      
      if (!reservationDetails) {
        throw new Error(`Reservation ${task.payload.reservationId} not found`)
      }

      // Execute the appropriate email function
      switch (task.type) {
        case 'user_confirmation':
          if (emailSettings.sendUserEmails) {
            await sendReservationSubmissionEmail(reservationDetails, emailSettings)
          }
          break
          
        case 'admin_notification':
          if (emailSettings.sendAdminEmails && systemSettings.contactEmail) {
            await sendAdminNotification(reservationDetails, emailSettings, systemSettings, 'created')
          }
          break
          
        case 'approval':
          if (emailSettings.sendUserEmails) {
            await sendApprovalEmail(reservationDetails, emailSettings)
          }
          break
          
        case 'rejection':
          if (emailSettings.sendUserEmails) {
            await sendRejectionEmail(reservationDetails, emailSettings, task.payload.emailData?.reason)
          }
          break
          
        case 'cancellation':
          if (emailSettings.sendUserEmails) {
            await sendCancellationEmail(reservationDetails, emailSettings)
          }
          break
          
        default:
          throw new Error(`Unknown task type: ${task.type}`)
      }
      
      console.log(`Successfully processed notification task: ${task.id}`)
      
    } catch (error) {
      task.attempts++
      console.error(`Failed to process task ${task.id} (attempt ${task.attempts}/${task.maxAttempts}):`, error)
      
      // Retry with exponential backoff if not exceeded max attempts
      if (task.attempts < task.maxAttempts) {
        const delay = this.retryDelay * Math.pow(2, task.attempts - 1)
        task.scheduledAt = new Date(Date.now() + delay)
        
        console.log(`Scheduling retry for task ${task.id} in ${delay}ms`)
        
        // Re-queue the task
        this.queue.push(task)
      } else {
        console.error(`Task ${task.id} exceeded max attempts and will be discarded`)
      }
    } finally {
      this.activeTasks.delete(task.id)
    }
  }

  /**
   * Get queue statistics
   */
  getStats(): {
    queueLength: number
    activeTasks: number
    totalProcessed: number
  } {
    return {
      queueLength: this.queue.length,
      activeTasks: this.activeTasks.size,
      totalProcessed: 0 // Could be tracked with additional state
    }
  }

  /**
   * Clear the queue (useful for testing or emergency situations)
   */
  clear(): void {
    this.queue = []
    this.activeTasks.clear()
  }
}

// Singleton instance
export const notificationQueue = new NotificationQueue()

/**
 * Helper functions for easier integration
 */
export async function queueReservationEmails(reservationId: string): Promise<void> {
  // Queue user confirmation email (high priority)
  await notificationQueue.enqueue({
    type: 'user_confirmation',
    priority: 'high',
    maxAttempts: 3,
    payload: {
      reservationId,
      recipientEmail: '', // Will be fetched from reservation
      emailData: {}
    }
  })

  // Queue admin notification email (normal priority)
  await notificationQueue.enqueue({
    type: 'admin_notification',
    priority: 'normal',
    maxAttempts: 2,
    payload: {
      reservationId,
      recipientEmail: '', // Will be fetched from system settings
      emailData: {}
    }
  })
}

export async function queueApprovalEmail(reservationId: string): Promise<void> {
  await notificationQueue.enqueue({
    type: 'approval',
    priority: 'high',
    maxAttempts: 3,
    payload: {
      reservationId,
      recipientEmail: '',
      emailData: {}
    }
  })
}

export async function queueRejectionEmail(reservationId: string, reason?: string): Promise<void> {
  await notificationQueue.enqueue({
    type: 'rejection',
    priority: 'high',
    maxAttempts: 3,
    payload: {
      reservationId,
      recipientEmail: '',
      emailData: { reason }
    }
  })
}

export async function queueCancellationEmail(reservationId: string): Promise<void> {
  await notificationQueue.enqueue({
    type: 'cancellation',
    priority: 'normal',
    maxAttempts: 2,
    payload: {
      reservationId,
      recipientEmail: '',
      emailData: {}
    }
  })
}
