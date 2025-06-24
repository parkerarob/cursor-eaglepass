import { getPerformance, trace } from '@firebase/performance';
import { getFirebaseApp } from '@/lib/firebase/config';

// Use lazy initialization instead of module-level initialization
const getPerf = () => {
  if (typeof window === 'undefined') return undefined;
  const app = getFirebaseApp();
  if (!app) return undefined;
  return getPerformance(app);
};

export interface MonitoringEvent {
  eventType: 'error' | 'warning' | 'info' | 'performance' | 'security' | 'user_action';
  category: string;
  message: string;
  details?: Record<string, unknown>;
  timestamp: Date;
  userId?: string;
  userRole?: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  stackTrace?: string;
  url?: string;
  userAgent?: string;
}

export interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  category: 'api' | 'ui' | 'database' | 'auth';
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

class MonitoringService {
  private static instance: MonitoringService;
  private isInitialized = false;
  private eventQueue: MonitoringEvent[] = [];
  private performanceTraces: Map<string, ReturnType<typeof trace>> = new Map();
  private isLoggingError = false; // Circuit breaker to prevent infinite loops

  private constructor() {
    if (typeof window !== 'undefined') {
      this.initializeErrorHandling();
    }
  }

  public static getInstance(): MonitoringService {
    if (!MonitoringService.instance) {
      MonitoringService.instance = new MonitoringService();
    }
    return MonitoringService.instance;
  }

  private initializeErrorHandling(): void {
    if (typeof window === 'undefined') return;
    window.addEventListener('error', (event) => {
      // Prevent infinite loops by checking if we're already logging an error
      if (this.isLoggingError) return;
      
      this.logError('Unhandled Error', {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error?.stack || event.error?.toString() || 'Unknown error',
      });
    });
    window.addEventListener('unhandledrejection', (event) => {
      // Prevent infinite loops by checking if we're already logging an error
      if (this.isLoggingError) return;
      
      this.logError('Unhandled Promise Rejection', {
        reason: typeof event.reason === 'object' ? JSON.stringify(event.reason) : event.reason,
        promise: event.promise?.toString(),
      });
    });
  }

  /**
   * Log an error event
   */
  public logError(message: string, details?: Record<string, unknown>, severity: 'low' | 'medium' | 'high' | 'critical' = 'medium'): void {
    // Circuit breaker: prevent infinite loops
    if (this.isLoggingError) return;
    
    try {
      this.isLoggingError = true;
      
      const event: MonitoringEvent = {
        eventType: 'error',
        category: 'application',
        message,
        details,
        timestamp: new Date(),
        severity,
        url: typeof window !== 'undefined' ? window.location.href : undefined,
        userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : undefined,
      };

      this.queueEvent(event);
      
      // Use a safer logging method that won't trigger error handlers
      // Only log in development to avoid production console noise
      if (process.env.NODE_ENV === 'development') {
        const logMessage = `[Monitoring] ${message}`;
        const logDetails = details && Object.keys(details).length > 0 ? details : undefined;
        
        // Use setTimeout to async log and prevent triggering error handlers
        setTimeout(() => {
          try {
            if (logDetails) {
              console.error(logMessage, logDetails);
            } else {
              console.error(logMessage);
            }
          } catch {
            // Silently fail if console.error fails
          }
        }, 0);
      }
    } finally {
      this.isLoggingError = false;
    }
  }

  /**
   * Log a warning event
   */
  public logWarning(message: string, details?: Record<string, unknown>): void {
    const event: MonitoringEvent = {
      eventType: 'warning',
      category: 'application',
      message,
      details,
      timestamp: new Date(),
      severity: 'low',
    };

    this.queueEvent(event);
    console.warn(`[Monitoring] ${message}`, details);
  }

  /**
   * Log an info event
   */
  public logInfo(message: string, details?: Record<string, unknown>): void {
    const event: MonitoringEvent = {
      eventType: 'info',
      category: 'application',
      message,
      details,
      timestamp: new Date(),
    };

    this.queueEvent(event);
    console.info(`[Monitoring] ${message}`, details);
  }

  /**
   * Log a user action
   */
  public logUserAction(action: string, details?: Record<string, unknown>, userId?: string, userRole?: string): void {
    const event: MonitoringEvent = {
      eventType: 'user_action',
      category: 'user_interaction',
      message: action,
      details,
      timestamp: new Date(),
      userId,
      userRole,
    };

    this.queueEvent(event);
  }

  /**
   * Log a security event
   */
  public logSecurityEvent(event: string, details?: Record<string, unknown>, severity: 'low' | 'medium' | 'high' | 'critical' = 'medium'): void {
    const monitoringEvent: MonitoringEvent = {
      eventType: 'security',
      category: 'security',
      message: event,
      details,
      timestamp: new Date(),
      severity,
    };

    this.queueEvent(monitoringEvent);
    console.warn(`[Security] ${event}`, details);
  }

  /**
   * Start a performance trace
   */
  public startTrace(traceName: string): void {
    const perf = getPerf();
    if (!perf) return;
    
    try {
      const performanceTrace = trace(perf, traceName);
      performanceTrace.start();
      this.performanceTraces.set(traceName, performanceTrace);
    } catch (error) {
      console.warn(`Failed to start performance trace: ${traceName}`, error);
    }
  }

  /**
   * Stop a performance trace
   */
  public stopTrace(traceName: string, attributes?: Record<string, string>): void {
    const perf = getPerf();
    if (!perf) return;
    
    try {
      const performanceTrace = this.performanceTraces.get(traceName);
      if (performanceTrace) {
        if (attributes) {
          Object.entries(attributes).forEach(([key, value]) => {
            performanceTrace.putAttribute(key, value);
          });
        }
        performanceTrace.stop();
        this.performanceTraces.delete(traceName);
      }
    } catch (error) {
      console.warn(`Failed to stop performance trace: ${traceName}`, error);
    }
  }

  /**
   * Measure API performance
   */
  public async measureApiCall<T>(
    apiName: string,
    apiCall: () => Promise<T>,
    metadata?: Record<string, unknown>
  ): Promise<T> {
    const startTime = performance.now();
    this.startTrace(`api_${apiName}`);

    try {
      const result = await apiCall();
      const duration = performance.now() - startTime;
      
      this.recordPerformanceMetric({
        name: `api_${apiName}`,
        value: duration,
        unit: 'ms',
        category: 'api',
        timestamp: new Date(),
        metadata,
      });

      this.stopTrace(`api_${apiName}`, {
        success: 'true',
        duration: duration.toString(),
      });

      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      
      this.logError(`API call failed: ${apiName}`, {
        error: error instanceof Error ? error.message : 'Unknown error',
        duration,
        metadata,
      });

      this.stopTrace(`api_${apiName}`, {
        success: 'false',
        duration: duration.toString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw error;
    }
  }

  /**
   * Record a performance metric
   */
  public recordPerformanceMetric(metric: PerformanceMetric): void {
    // Log to console for development
    
    // In a real implementation, this would send to Firebase Performance
    // For now, we'll just queue it as an event
    const event: MonitoringEvent = {
      eventType: 'performance',
      category: metric.category,
      message: `Performance metric: ${metric.name}`,
      details: {
        value: metric.value,
        unit: metric.unit,
        metadata: metric.metadata,
      },
      timestamp: metric.timestamp,
    };

    this.queueEvent(event);
  }

  /**
   * Queue an event for processing
   */
  private queueEvent(event: MonitoringEvent): void {
    this.eventQueue.push(event);
    
    // Process queue if it gets too large
    if (this.eventQueue.length > 100) {
      this.processEventQueue();
    }
  }

  /**
   * Process the event queue
   */
  private async processEventQueue(): Promise<void> {
    if (this.eventQueue.length === 0) return;

    const events = [...this.eventQueue];
    this.eventQueue = [];

    try {
      // In a real implementation, this would send events to Firebase Analytics
      // or a logging service. For now, we'll just log them.
      events.forEach(event => {
        try {
          // Safely serialize details to avoid circular references or undefined values
          const safeDetails = event.details ? JSON.parse(JSON.stringify(event.details)) : undefined;
          
          if (event.eventType === 'error' || event.eventType === 'security') {
            console.error(`[${event.eventType.toUpperCase()}] ${event.message}`, safeDetails);
          } else if (event.eventType === 'warning') {
            console.warn(`[WARNING] ${event.message}`, safeDetails);
          } else {
          }
        } catch (logError) {
          // If individual event logging fails, just log the message without details
        }
      });
    } catch (error) {
      console.error('Failed to process monitoring events:', error);
      // Re-queue events that failed to process
      this.eventQueue.unshift(...events);
    }
  }

  /**
   * Get system health metrics
   */
  public getSystemHealth(): {
    eventQueueSize: number;
    activeTraces: number;
    isInitialized: boolean;
  } {
    return {
      eventQueueSize: this.eventQueue.length,
      activeTraces: this.performanceTraces.size,
      isInitialized: this.isInitialized,
    };
  }

  /**
   * Initialize the monitoring service
   */
  public initialize(): void {
    this.isInitialized = true;
    this.logInfo('Monitoring service initialized');
  }

  /**
   * Cleanup resources
   */
  public cleanup(): void {
    try {
      // Stop all active traces
      this.performanceTraces.forEach((trace, name) => {
        try {
          trace.stop();
        } catch (error) {
          console.warn(`Failed to stop trace during cleanup: ${name}`, error);
        }
      });
      this.performanceTraces.clear();

      // Process any remaining events
      this.processEventQueue();
    } catch (error) {
      console.warn('Error during monitoring service cleanup:', error);
    }
  }
}

// Export singleton instance
export const monitoringService = typeof window !== 'undefined'
  ? MonitoringService.getInstance()
  : {
      initialize: () => {},
      cleanup: () => {},
      logError: () => {},
      logWarning: () => {},
      logInfo: () => {},
      logUserAction: () => {},
      logSecurityEvent: () => {},
      startTrace: () => {},
      stopTrace: () => {},
      measureApiCall: async <T>(_: string, apiCall: () => Promise<T>) => apiCall(),
      recordPerformanceMetric: () => {},
      getSystemHealth: () => ({ eventQueueSize: 0, activeTraces: 0, isInitialized: false }),
    } as unknown as MonitoringService;

// Export convenience functions
export const logError = (message: string, details?: Record<string, unknown>, severity?: 'low' | 'medium' | 'high' | 'critical') => 
  monitoringService.logError(message, details, severity);

export const logWarning = (message: string, details?: Record<string, unknown>) => 
  monitoringService.logWarning(message, details);

export const logInfo = (message: string, details?: Record<string, unknown>) => 
  monitoringService.logInfo(message, details);

export const logUserAction = (action: string, details?: Record<string, unknown>, userId?: string, userRole?: string) => 
  monitoringService.logUserAction(action, details, userId, userRole);

export const logSecurityEvent = (event: string, details?: Record<string, unknown>, severity?: 'low' | 'medium' | 'high' | 'critical') => 
  monitoringService.logSecurityEvent(event, details, severity);

export const measureApiCall = <T>(apiName: string, apiCall: () => Promise<T>, metadata?: Record<string, unknown>) => 
  monitoringService.measureApiCall(apiName, apiCall, metadata);

export const startTrace = (traceName: string) => monitoringService.startTrace(traceName);
export const stopTrace = (traceName: string, attributes?: Record<string, string>) => monitoringService.stopTrace(traceName, attributes); 