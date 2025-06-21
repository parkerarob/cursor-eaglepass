import { Pass, User } from '@/types';
import { logEvent } from './eventLogger';

export interface NotificationResult {
  success: boolean;
  notificationSent?: boolean;
  notificationLevel?: 'student' | 'teacher' | 'admin';
  error?: string;
}

export interface NotificationConfig {
  studentNotificationMinutes: number; // Default: 10 minutes
  adminEscalationMinutes: number; // Default: 20 minutes
  notificationCooldownMinutes: number; // Default: 5 minutes
}

export class NotificationService {
  private static config: NotificationConfig = {
    studentNotificationMinutes: 10,
    adminEscalationMinutes: 20,
    notificationCooldownMinutes: 5
  };

  /**
   * Update notification configuration
   */
  static updateConfig(newConfig: Partial<NotificationConfig>) {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Calculate current duration of a pass in minutes
   */
  static calculateDuration(pass: Pass): number {
    const now = new Date();
    const createdAt = pass.createdAt instanceof Date ? pass.createdAt : new Date(pass.createdAt);
    const durationMs = now.getTime() - createdAt.getTime();
    return Math.floor(durationMs / (1000 * 60)); // Convert to minutes
  }

  /**
   * Check if a notification should be sent based on duration
   */
  static shouldSendNotification(pass: Pass): NotificationResult {
    try {
      const durationMinutes = this.calculateDuration(pass);
      const lastNotificationAt = pass.lastNotificationAt instanceof Date 
        ? pass.lastNotificationAt 
        : pass.lastNotificationAt ? new Date(pass.lastNotificationAt) : null;

      // Check cooldown period
      if (lastNotificationAt) {
        const cooldownMs = this.config.notificationCooldownMinutes * 60 * 1000;
        const timeSinceLastNotification = Date.now() - lastNotificationAt.getTime();
        if (timeSinceLastNotification < cooldownMs) {
          return { success: true, notificationSent: false };
        }
      }

      // Determine notification level based on duration
      let notificationLevel: 'student' | 'teacher' | 'admin' | undefined;
      
      if (durationMinutes >= this.config.adminEscalationMinutes) {
        notificationLevel = 'admin';
      } else if (durationMinutes >= this.config.studentNotificationMinutes) {
        notificationLevel = 'teacher';
      }

      // Check if we need to escalate from previous level
      if (notificationLevel && pass.notificationLevel !== notificationLevel) {
        return {
          success: true,
          notificationSent: true,
          notificationLevel
        };
      }

      return { success: true, notificationSent: false };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to check notification status'
      };
    }
  }

  /**
   * Send notification for a pass
   */
  static async sendNotification(
    pass: Pass, 
    student: User, 
    notificationLevel: 'student' | 'teacher' | 'admin'
  ): Promise<NotificationResult> {
    try {
      const durationMinutes = this.calculateDuration(pass);
      
      // Log the notification event
      await logEvent({
        passId: pass.id,
        studentId: student.id,
        actorId: 'system',
        timestamp: new Date(),
        eventType: 'NOTIFICATION_SENT',
        details: `Duration notification sent at ${durationMinutes} minutes (${notificationLevel} level)`,
        notificationLevel
      });

      // In a real implementation, this would integrate with:
      // - Email notifications
      // - SMS notifications  
      // - Push notifications
      // - In-app notifications
      // - Emergency contact systems
      
      // For now, we'll simulate the notification and log it
      console.log(`[NOTIFICATION] Pass ${pass.id} for student ${student.name} has been active for ${durationMinutes} minutes. Escalating to ${notificationLevel} level.`);

      return {
        success: true,
        notificationSent: true,
        notificationLevel
      };
    } catch (error) {
      // Log notification failure
      await logEvent({
        passId: pass.id,
        studentId: student.id,
        actorId: 'system',
        timestamp: new Date(),
        eventType: 'NOTIFICATION_FAILED',
        details: error instanceof Error ? error.message : 'Failed to send notification',
        notificationLevel
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send notification'
      };
    }
  }

  /**
   * Update pass with notification information
   */
  static updatePassWithNotification(
    pass: Pass, 
    notificationLevel: 'student' | 'teacher' | 'admin'
  ): Pass {
    return {
      ...pass,
      durationMinutes: this.calculateDuration(pass),
      lastNotificationAt: new Date(),
      notificationLevel,
      lastUpdatedAt: new Date()
    };
  }

  /**
   * Get notification status for display
   */
  static getNotificationStatus(pass: Pass): {
    durationMinutes: number;
    notificationLevel: string;
    isOverdue: boolean;
    shouldEscalate: boolean;
  } {
    const durationMinutes = this.calculateDuration(pass);
    const isOverdue = durationMinutes >= this.config.adminEscalationMinutes;
    const shouldEscalate = durationMinutes >= this.config.studentNotificationMinutes;

    return {
      durationMinutes,
      notificationLevel: pass.notificationLevel || 'none',
      isOverdue,
      shouldEscalate
    };
  }
} 