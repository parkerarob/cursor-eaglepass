import { Pass, User } from '@/types';
import { logEvent } from './eventLogger';
import { getEventLogsByStudentId, getEventLogsByDateRange } from './firebase/firestore';

export interface SuspiciousActivityAlert {
  id: string;
  type: 'EXCESSIVE_PASSES' | 'RAPID_CREATION' | 'LONG_DURATION' | 'UNUSUAL_PATTERN' | 'SECURITY_VIOLATION';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  studentId: string;
  description: string;
  details: Record<string, unknown>;
  timestamp: Date;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
}

export interface AuditMetrics {
  totalPasses: number;
  averageDuration: number;
  longDurationPasses: number;
  rapidCreationIncidents: number;
  suspiciousPatterns: number;
  securityViolations: number;
}

export class AuditMonitor {
  private static alerts: Map<string, SuspiciousActivityAlert> = new Map();
  private static readonly THRESHOLDS = {
    EXCESSIVE_PASSES_PER_HOUR: 10,
    EXCESSIVE_PASSES_PER_DAY: 25,
    RAPID_CREATION_SECONDS: 10,
    LONG_DURATION_MINUTES: 30,
    VERY_LONG_DURATION_MINUTES: 60,
    MAX_CONSECUTIVE_RAPID_PASSES: 3
  };

  /**
   * Monitor pass creation for suspicious activity
   */
  static async checkPassCreationActivity(studentId: string, newPass: Pass): Promise<void> {
    try {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      // Get recent event logs for this student
      const recentEvents = await getEventLogsByStudentId(studentId);
      const recentPassEvents = recentEvents.filter(
        event => event.eventType === 'PASS_CREATED' && event.timestamp >= oneHourAgo
      );
      const dailyPassEvents = recentEvents.filter(
        event => event.eventType === 'PASS_CREATED' && event.timestamp >= oneDayAgo
      );

      // Check for excessive pass creation (hourly)
      if (recentPassEvents.length >= this.THRESHOLDS.EXCESSIVE_PASSES_PER_HOUR) {
        await this.createAlert({
          type: 'EXCESSIVE_PASSES',
          severity: 'HIGH',
          studentId,
          description: `Student has created ${recentPassEvents.length} passes in the last hour`,
          details: {
            timeframe: '1 hour',
            passCount: recentPassEvents.length,
            threshold: this.THRESHOLDS.EXCESSIVE_PASSES_PER_HOUR,
            recentPasses: recentPassEvents.slice(-5).map(e => ({
              timestamp: e.timestamp,
              passId: e.passId
            }))
          }
        });
      }

      // Check for excessive pass creation (daily)
      if (dailyPassEvents.length >= this.THRESHOLDS.EXCESSIVE_PASSES_PER_DAY) {
        await this.createAlert({
          type: 'EXCESSIVE_PASSES',
          severity: 'MEDIUM',
          studentId,
          description: `Student has created ${dailyPassEvents.length} passes in the last 24 hours`,
          details: {
            timeframe: '24 hours',
            passCount: dailyPassEvents.length,
            threshold: this.THRESHOLDS.EXCESSIVE_PASSES_PER_DAY
          }
        });
      }

      // Check for rapid pass creation (potential automation)
      await this.checkRapidPassCreation(studentId, recentPassEvents);

      // Check for unusual patterns
      await this.checkUnusualPatterns(studentId, recentEvents);

    } catch (error) {
      console.error('Error in pass creation monitoring:', error);
      await logEvent({
        passId: newPass.id,
        studentId,
        actorId: 'system',
        timestamp: new Date(),
        eventType: 'ERROR',
        details: `Audit monitoring failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        notificationLevel: 'admin'
      });
    }
  }

  /**
   * Monitor pass duration for alerts
   */
  static async checkPassDuration(pass: Pass, student: User): Promise<void> {
    try {
      const now = new Date();
      const createdAt = pass.createdAt instanceof Date ? pass.createdAt : new Date(pass.createdAt);
      const durationMinutes = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60));

      // Check for very long duration passes
      if (durationMinutes >= this.THRESHOLDS.VERY_LONG_DURATION_MINUTES) {
        await this.createAlert({
          type: 'LONG_DURATION',
          severity: 'HIGH',
          studentId: student.id,
          description: `Pass has been active for ${durationMinutes} minutes (threshold: ${this.THRESHOLDS.VERY_LONG_DURATION_MINUTES})`,
          details: {
            passId: pass.id,
            duration: durationMinutes,
            threshold: this.THRESHOLDS.VERY_LONG_DURATION_MINUTES,
            status: pass.status,
            legs: pass.legs.length,
            lastLocation: pass.legs[pass.legs.length - 1]?.destinationLocationId
          }
        });
      }
      // Check for long duration passes (lower threshold)
      else if (durationMinutes >= this.THRESHOLDS.LONG_DURATION_MINUTES) {
        await this.createAlert({
          type: 'LONG_DURATION',
          severity: 'MEDIUM',
          studentId: student.id,
          description: `Pass has been active for ${durationMinutes} minutes`,
          details: {
            passId: pass.id,
            duration: durationMinutes,
            threshold: this.THRESHOLDS.LONG_DURATION_MINUTES
          }
        });
      }
    } catch (error) {
      console.error('Error in duration monitoring:', error);
    }
  }

  /**
   * Check for rapid pass creation patterns
   */
  private static async checkRapidPassCreation(studentId: string, recentEvents: Array<{
    id?: string;
    passId?: string;
    studentId?: string;
    actorId: string;
    timestamp: Date;
    eventType: string;
    details?: string;
    notificationLevel?: string;
  }>): Promise<void> {
    if (recentEvents.length < 2) return;

    // Sort events by timestamp
    const sortedEvents = recentEvents
      .filter(e => e.eventType === 'PASS_CREATED')
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    let consecutiveRapidPasses = 0;
    const rapidPairs: Array<{ interval: number; timestamps: Date[] }> = [];

    for (let i = 1; i < sortedEvents.length; i++) {
      const timeDiff = (sortedEvents[i].timestamp.getTime() - sortedEvents[i-1].timestamp.getTime()) / 1000;
      
      if (timeDiff < this.THRESHOLDS.RAPID_CREATION_SECONDS) {
        consecutiveRapidPasses++;
        rapidPairs.push({
          interval: timeDiff,
          timestamps: [sortedEvents[i-1].timestamp, sortedEvents[i].timestamp]
        });
      } else {
        consecutiveRapidPasses = 0;
      }

      if (consecutiveRapidPasses >= this.THRESHOLDS.MAX_CONSECUTIVE_RAPID_PASSES) {
        await this.createAlert({
          type: 'RAPID_CREATION',
          severity: 'CRITICAL',
          studentId,
          description: `Detected ${consecutiveRapidPasses} rapid pass creations (potential automation)`,
          details: {
            consecutiveRapidPasses,
            threshold: this.THRESHOLDS.RAPID_CREATION_SECONDS,
            rapidPairs: rapidPairs.slice(-3), // Last 3 rapid pairs
            possibleAutomation: true
          }
        });
        break;
      }
    }
  }

  /**
   * Check for unusual activity patterns
   */
  private static async checkUnusualPatterns(studentId: string, recentEvents: Array<{
    id?: string;
    passId?: string;
    studentId?: string;
    actorId: string;
    timestamp: Date;
    eventType: string;
    details?: string;
    notificationLevel?: string;
  }>): Promise<void> {
    try {
      // Check for passes created outside normal hours
      const afterHoursEvents = recentEvents.filter(event => {
        const hour = event.timestamp.getHours();
        return hour < 7 || hour > 17; // Outside 7 AM - 5 PM
      });

      if (afterHoursEvents.length > 0) {
        await this.createAlert({
          type: 'UNUSUAL_PATTERN',
          severity: 'MEDIUM',
          studentId,
          description: `Activity detected outside normal school hours`,
          details: {
            afterHoursEvents: afterHoursEvents.length,
            events: afterHoursEvents.map(e => ({
              timestamp: e.timestamp,
              hour: e.timestamp.getHours(),
              eventType: e.eventType
            }))
          }
        });
      }

      // Check for weekend activity
      const weekendEvents = recentEvents.filter(event => {
        const dayOfWeek = event.timestamp.getDay();
        return dayOfWeek === 0 || dayOfWeek === 6; // Sunday or Saturday
      });

      if (weekendEvents.length > 0) {
        await this.createAlert({
          type: 'UNUSUAL_PATTERN',
          severity: 'LOW',
          studentId,
          description: `Activity detected during weekend`,
          details: {
            weekendEvents: weekendEvents.length,
            events: weekendEvents.map(e => ({
              timestamp: e.timestamp,
              dayOfWeek: e.timestamp.getDay(),
              eventType: e.eventType
            }))
          }
        });
      }

    } catch (error) {
      console.error('Error checking unusual patterns:', error);
    }
  }

  /**
   * Create and store a security alert
   */
  private static async createAlert(alertData: Omit<SuspiciousActivityAlert, 'id' | 'timestamp' | 'acknowledged'>): Promise<void> {
    const alert: SuspiciousActivityAlert = {
      id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      acknowledged: false,
      ...alertData
    };

    this.alerts.set(alert.id, alert);

    // Log the security alert
    await logEvent({
      passId: '', // No specific pass for system alerts
      studentId: alert.studentId,
      actorId: 'system',
      timestamp: alert.timestamp,
      eventType: 'ERROR', // Using ERROR type for security alerts
      details: JSON.stringify({
        alertType: alert.type,
        severity: alert.severity,
        description: alert.description,
        details: alert.details
      }),
      notificationLevel: alert.severity === 'CRITICAL' ? 'admin' : 'teacher'
    });

    // For critical alerts, also log to console for immediate attention
    if (alert.severity === 'CRITICAL') {
      console.error(`[CRITICAL SECURITY ALERT] ${alert.description}`, alert.details);
    }
  }

  /**
   * Get all active alerts
   */
  static getActiveAlerts(): SuspiciousActivityAlert[] {
    return Array.from(this.alerts.values())
      .filter(alert => !alert.acknowledged)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Get alerts by severity
   */
  static getAlertsBySeverity(severity: SuspiciousActivityAlert['severity']): SuspiciousActivityAlert[] {
    return this.getActiveAlerts().filter(alert => alert.severity === severity);
  }

  /**
   * Get alerts for a specific student
   */
  static getAlertsForStudent(studentId: string): SuspiciousActivityAlert[] {
    return Array.from(this.alerts.values())
      .filter(alert => alert.studentId === studentId)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Acknowledge an alert
   */
  static acknowledgeAlert(alertId: string, acknowledgedBy: string): boolean {
    const alert = this.alerts.get(alertId);
    if (alert && !alert.acknowledged) {
      alert.acknowledged = true;
      alert.acknowledgedBy = acknowledgedBy;
      alert.acknowledgedAt = new Date();
      return true;
    }
    return false;
  }

  /**
   * Generate audit metrics for admin dashboard
   */
  static async generateAuditMetrics(timeframe: 'hour' | 'day' | 'week' = 'day'): Promise<AuditMetrics> {
    try {
      const now = new Date();
      let startDate: Date;

      switch (timeframe) {
        case 'hour':
          startDate = new Date(now.getTime() - 60 * 60 * 1000);
          break;
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        default:
          startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      }

      const recentEvents = await getEventLogsByDateRange(startDate, now);
      const passCreationEvents = recentEvents.filter(e => e.eventType === 'PASS_CREATED');
      
      // Calculate basic metrics
      const totalPasses = passCreationEvents.length;
      
      // Get alerts in timeframe
      const recentAlerts = Array.from(this.alerts.values())
        .filter(alert => alert.timestamp >= startDate);

      const longDurationAlerts = recentAlerts.filter(a => a.type === 'LONG_DURATION').length;
      const rapidCreationAlerts = recentAlerts.filter(a => a.type === 'RAPID_CREATION').length;
      const unusualPatternAlerts = recentAlerts.filter(a => a.type === 'UNUSUAL_PATTERN').length;
      const securityViolationAlerts = recentAlerts.filter(a => a.type === 'SECURITY_VIOLATION').length;

      return {
        totalPasses,
        averageDuration: 0, // Would need pass data to calculate
        longDurationPasses: longDurationAlerts,
        rapidCreationIncidents: rapidCreationAlerts,
        suspiciousPatterns: unusualPatternAlerts,
        securityViolations: securityViolationAlerts
      };

    } catch (error) {
      console.error('Error generating audit metrics:', error);
      return {
        totalPasses: 0,
        averageDuration: 0,
        longDurationPasses: 0,
        rapidCreationIncidents: 0,
        suspiciousPatterns: 0,
        securityViolations: 0
      };
    }
  }

  /**
   * Update thresholds (admin function)
   */
  static updateThresholds(newThresholds: Partial<typeof AuditMonitor.THRESHOLDS>): void {
    Object.assign(this.THRESHOLDS, newThresholds);
  }

  /**
   * Clear old alerts (cleanup function)
   */
  static clearOldAlerts(daysToKeep: number = 30): number {
    const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);
    let clearedCount = 0;

    for (const [id, alert] of this.alerts.entries()) {
      if (alert.timestamp < cutoffDate) {
        this.alerts.delete(id);
        clearedCount++;
      }
    }

    return clearedCount;
  }

  /**
   * Get audit summary for admin dashboard
   */
  static getAuditSummary(): {
    totalAlerts: number;
    criticalAlerts: number;
    unacknowledgedAlerts: number;
    alertsByType: Record<string, number>;
    recentActivity: SuspiciousActivityAlert[];
  } {
    const allAlerts = Array.from(this.alerts.values());
    const activeAlerts = this.getActiveAlerts();
    
    const alertsByType: Record<string, number> = {};
    allAlerts.forEach(alert => {
      alertsByType[alert.type] = (alertsByType[alert.type] || 0) + 1;
    });

    return {
      totalAlerts: allAlerts.length,
      criticalAlerts: allAlerts.filter(a => a.severity === 'CRITICAL').length,
      unacknowledgedAlerts: activeAlerts.length,
      alertsByType,
      recentActivity: activeAlerts.slice(0, 10) // Last 10 alerts
    };
  }
} 