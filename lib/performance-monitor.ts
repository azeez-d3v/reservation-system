/**
 * Performance monitoring for email notifications and concurrent reservations
 */

interface PerformanceMetric {
  operationType: 'reservation_creation' | 'email_notification' | 'validation'
  startTime: number
  endTime?: number
  duration?: number
  success: boolean
  details?: Record<string, any>
}

interface ConcurrencyStats {
  simultaneousReservations: number
  peakConcurrency: number
  avgProcessingTime: number
  emailsProcessedParallel: number
  emailsProcessedSequential: number
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = []
  private activeOperations = new Map<string, PerformanceMetric>()
  private concurrencyStats: ConcurrencyStats = {
    simultaneousReservations: 0,
    peakConcurrency: 0,
    avgProcessingTime: 0,
    emailsProcessedParallel: 0,
    emailsProcessedSequential: 0
  }

  /**
   * Start tracking an operation
   */
  startOperation(
    operationId: string, 
    type: PerformanceMetric['operationType'],
    details?: Record<string, any>
  ): void {
    const metric: PerformanceMetric = {
      operationType: type,
      startTime: Date.now(),
      success: false,
      details
    }
    
    this.activeOperations.set(operationId, metric)
    
    // Track concurrent reservations
    if (type === 'reservation_creation') {
      this.concurrencyStats.simultaneousReservations++
      this.concurrencyStats.peakConcurrency = Math.max(
        this.concurrencyStats.peakConcurrency,
        this.concurrencyStats.simultaneousReservations
      )
    }
  }

  /**
   * End tracking an operation
   */
  endOperation(operationId: string, success: boolean, additionalDetails?: Record<string, any>): void {
    const metric = this.activeOperations.get(operationId)
    if (!metric) return

    metric.endTime = Date.now()
    metric.duration = metric.endTime - metric.startTime
    metric.success = success
    
    if (additionalDetails) {
      metric.details = { ...metric.details, ...additionalDetails }
    }

    this.metrics.push(metric)
    this.activeOperations.delete(operationId)

    // Update stats
    if (metric.operationType === 'reservation_creation') {
      this.concurrencyStats.simultaneousReservations--
      this.updateAvgProcessingTime(metric.duration)
    }

    // Track email processing method
    if (metric.operationType === 'email_notification') {
      if (metric.details?.processingMethod === 'parallel') {
        this.concurrencyStats.emailsProcessedParallel++
      } else {
        this.concurrencyStats.emailsProcessedSequential++
      }
    }
  }

  /**
   * Update average processing time
   */
  private updateAvgProcessingTime(newDuration: number): void {
    const reservationMetrics = this.metrics.filter(m => 
      m.operationType === 'reservation_creation' && m.duration
    )
    
    if (reservationMetrics.length > 0) {
      const totalTime = reservationMetrics.reduce((sum, m) => sum + (m.duration || 0), 0)
      this.concurrencyStats.avgProcessingTime = totalTime / reservationMetrics.length
    }
  }

  /**
   * Get performance statistics
   */
  getStats(): {
    concurrency: ConcurrencyStats
    recentMetrics: PerformanceMetric[]
    summary: {
      totalOperations: number
      successRate: number
      avgDurationByType: Record<string, number>
      emailEfficiencyGain: number
    }
  } {
    const last100Metrics = this.metrics.slice(-100)
    
    const summary = {
      totalOperations: this.metrics.length,
      successRate: this.metrics.filter(m => m.success).length / this.metrics.length,
      avgDurationByType: this.calculateAvgDurationByType(),
      emailEfficiencyGain: this.calculateEmailEfficiencyGain()
    }

    return {
      concurrency: this.concurrencyStats,
      recentMetrics: last100Metrics,
      summary
    }
  }

  /**
   * Calculate average duration by operation type
   */
  private calculateAvgDurationByType(): Record<string, number> {
    const typeGroups = this.metrics.reduce((groups, metric) => {
      if (!metric.duration) return groups
      
      if (!groups[metric.operationType]) {
        groups[metric.operationType] = []
      }
      groups[metric.operationType].push(metric.duration)
      return groups
    }, {} as Record<string, number[]>)

    return Object.entries(typeGroups).reduce((avg, [type, durations]) => {
      avg[type] = durations.reduce((sum, d) => sum + d, 0) / durations.length
      return avg
    }, {} as Record<string, number>)
  }

  /**
   * Calculate efficiency gain from parallel email processing
   */
  private calculateEmailEfficiencyGain(): number {
    const { emailsProcessedParallel, emailsProcessedSequential } = this.concurrencyStats
    const total = emailsProcessedParallel + emailsProcessedSequential
    
    if (total === 0) return 0
    
    return (emailsProcessedParallel / total) * 100
  }

  /**
   * Log performance insights
   */
  logPerformanceInsights(): void {
    const stats = this.getStats()
    
    console.log('=== PERFORMANCE INSIGHTS ===')
    console.log(`Peak Concurrent Reservations: ${stats.concurrency.peakConcurrency}`)
    console.log(`Average Processing Time: ${Math.round(stats.concurrency.avgProcessingTime)}ms`)
    console.log(`Email Parallel Processing: ${Math.round(stats.summary.emailEfficiencyGain)}%`)
    console.log(`Overall Success Rate: ${Math.round(stats.summary.successRate * 100)}%`)
    console.log('============================')
  }

  /**
   * Clear old metrics to prevent memory leaks
   */
  cleanup(maxMetrics: number = 1000): void {
    if (this.metrics.length > maxMetrics) {
      this.metrics = this.metrics.slice(-maxMetrics)
    }
  }

  /**
   * Export metrics for analysis
   */
  exportMetrics(): PerformanceMetric[] {
    return [...this.metrics]
  }
}

// Singleton instance
export const performanceMonitor = new PerformanceMonitor()

/**
 * Helper decorator for automatic operation tracking
 */
export function trackPerformance(
  operationType: PerformanceMetric['operationType'],
  operationName?: string
) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value

    descriptor.value = async function (...args: any[]) {
      const operationId = `${operationName || propertyKey}_${Date.now()}_${Math.random()}`
      
      performanceMonitor.startOperation(operationId, operationType, {
        methodName: propertyKey,
        args: args.length
      })

      try {
        const result = await originalMethod.apply(this, args)
        performanceMonitor.endOperation(operationId, true)
        return result
      } catch (error) {
        performanceMonitor.endOperation(operationId, false, {
          error: error instanceof Error ? error.message : 'Unknown error'
        })
        throw error
      }
    }

    return descriptor
  }
}

/**
 * Manual tracking helpers
 */
export function startTracking(
  operationId: string,
  type: PerformanceMetric['operationType'],
  details?: Record<string, any>
): void {
  performanceMonitor.startOperation(operationId, type, details)
}

export function endTracking(
  operationId: string,
  success: boolean,
  details?: Record<string, any>
): void {
  performanceMonitor.endOperation(operationId, success, details)
}

/**
 * Middleware for Express apps to track API performance
 */
export function createPerformanceMiddleware() {
  return (req: any, res: any, next: any) => {
    const operationId = `api_${req.method}_${req.path}_${Date.now()}`
    
    performanceMonitor.startOperation(operationId, 'reservation_creation', {
      method: req.method,
      path: req.path,
      userAgent: req.get('User-Agent')
    })

    const originalSend = res.send
    res.send = function (data: any) {
      performanceMonitor.endOperation(operationId, res.statusCode < 400, {
        statusCode: res.statusCode,
        responseSize: typeof data === 'string' ? data.length : JSON.stringify(data).length
      })
      
      return originalSend.call(this, data)
    }

    next()
  }
}
