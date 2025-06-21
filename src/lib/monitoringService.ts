import { getPerformance, trace } from '@firebase/performance';
import { firebaseApp } from '@/lib/firebase/config';

let perf: ReturnType<typeof getPerformance> | undefined = undefined;
if (typeof window !== 'undefined') {
  perf = getPerformance(firebaseApp);
}

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
      this.logError('Unhandled Error', {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error?.stack,
      });
    });
    window.addEventListener('unhandledrejection', (event) => {
      this.logError('Unhandled Promise Rejection', {
        reason: event.reason,
        promise: event.promise,
      });
    });
  }

  /**
   * Log an error event
   */
  public logError(message: string, details?: Record<string, unknown>, severity: 'low' | 'medium' | 'high' | 'critical' = 'medium'): void {
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
    console.error(`[Monitoring] ${message}`, details);
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
    if (typeof window === 'undefined' || !perf) return;
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
    if (typeof window === 'undefined' || !perf) return;
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

      this.stopTrace(`api_${apiName}`, { status: 'success' });
      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      
      this.recordPerformanceMetric({
        name: `api_${apiName}`,
        value: duration,
        unit: 'ms',
        category: 'api',
        timestamp: new Date(),
        metadata: { ...metadata, error: true },
      });

      this.stopTrace(`api_${apiName}`, { status: 'error' });
      throw error;
    }
  }

  /**
   * Record a performance metric
   */
  public recordPerformanceMetric(metric: PerformanceMetric): void {
    // Log to console for development
    console.log(`[Performance] ${metric.name}: ${metric.value}${metric.unit}`, metric.metadata);
    
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
        if (event.eventType === 'error' || event.eventType === 'security') {
          console.error(`[${event.eventType.toUpperCase()}] ${event.message}`, event.details);
        } else if (event.eventType === 'warning') {
          console.warn(`[WARNING] ${event.message}`, event.details);
        } else {
          console.log(`[${event.eventType.toUpperCase()}] ${event.message}`, event.details);
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