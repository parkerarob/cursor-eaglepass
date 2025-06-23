import { Pass, User } from '@/types';
import { logEvent } from './eventLogger';

export interface NotificationResult {
  success: boolean;
  notificationSent?: boolean;
  notificationLevel?: 'student' | 'teacher' | 'admin';
  error?: string;
  channels?: {
    email?: { success: boolean; error?: string };
    sms?: { success: boolean; error?: string };
    push?: { success: boolean; error?: string };
    dashboard?: { success: boolean; error?: string };
  };
}

export interface NotificationConfig {
  studentNotificationMinutes: number; // Default: 10 minutes
  adminEscalationMinutes: number; // Default: 20 minutes
  notificationCooldownMinutes: number; // Default: 5 minutes
  emailEnabled: boolean;
  smsEnabled: boolean;
  pushEnabled: boolean;
  dashboardEnabled: boolean;
}

export interface NotificationChannelConfig {
  email?: {
    service: 'smtp' | 'firebase' | 'mock';
    apiKey?: string;
    from: string;
  };
  sms?: {
    service: 'twilio' | 'firebase' | 'mock';
    apiKey?: string;
    from: string;
  };
  push?: {
    service: 'firebase' | 'mock';
    serverKey?: string;
  };
}

export class NotificationService {
  private static config: NotificationConfig = {
    studentNotificationMinutes: 10,
    adminEscalationMinutes: 20,
    notificationCooldownMinutes: 5,
    emailEnabled: true,
    smsEnabled: true,
    pushEnabled: true,
    dashboardEnabled: true
  };

  private static channelConfig: NotificationChannelConfig = {
    email: {
      service: 'mock', // Will be configured based on environment
      from: 'noreply@eaglepass.edu'
    },
    sms: {
      service: 'mock', // Will be configured based on environment
      from: 'EaglePass'
    },
    push: {
      service: 'mock' // Will be configured based on environment
    }
  };

  /**
   * Update notification configuration
   */
  static updateConfig(newConfig: Partial<NotificationConfig>) {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Update notification channel configuration
   */
  static updateChannelConfig(newChannelConfig: Partial<NotificationChannelConfig>) {
    this.channelConfig = { ...this.channelConfig, ...newChannelConfig };
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
   * Send notification for a pass via multiple channels
   */
  static async sendNotification(
    pass: Pass, 
    student: User, 
    notificationLevel: 'student' | 'teacher' | 'admin'
  ): Promise<NotificationResult> {
    try {
      const durationMinutes = this.calculateDuration(pass);
      
      // Get notification recipients
      const recipients = await this.getNotificationRecipients(student, notificationLevel);
      
      // Send notifications through enabled channels in parallel
      const notificationPromises: Promise<void>[] = [];
      const channels: NonNullable<NotificationResult['channels']> = {};

      if (this.config.emailEnabled && recipients.email.length > 0) {
        notificationPromises.push(
          this.sendEmailNotification(pass, student, recipients.email, notificationLevel, durationMinutes)
            .then(result => { channels.email = result; })
            .catch(error => { channels.email = { success: false, error: error.message }; })
        );
      }

      if (this.config.smsEnabled && recipients.sms.length > 0) {
        notificationPromises.push(
          this.sendSMSNotification(pass, student, recipients.sms, notificationLevel, durationMinutes)
            .then(result => { channels.sms = result; })
            .catch(error => { channels.sms = { success: false, error: error.message }; })
        );
      }

      if (this.config.pushEnabled && recipients.pushTokens.length > 0) {
        notificationPromises.push(
          this.sendPushNotification(pass, student, recipients.pushTokens, notificationLevel, durationMinutes)
            .then(result => { channels.push = result; })
            .catch(error => { channels.push = { success: false, error: error.message }; })
        );
      }

      if (this.config.dashboardEnabled) {
        notificationPromises.push(
          this.updateDashboardAlert(pass, student, notificationLevel, durationMinutes)
            .then(result => { channels.dashboard = result; })
            .catch(error => { channels.dashboard = { success: false, error: error.message }; })
        );
      }

      // Wait for all notification attempts to complete
      await Promise.allSettled(notificationPromises);

      // Log the notification event
      await logEvent({
        passId: pass.id,
        studentId: student.id,
        actorId: 'system',
        timestamp: new Date(),
        eventType: 'NOTIFICATION_SENT',
        details: JSON.stringify({
          level: notificationLevel,
          duration: durationMinutes,
          channels: Object.keys(channels).filter(key => channels[key as keyof typeof channels]?.success),
          recipients: recipients.summary
        }),
        notificationLevel
      });

      // Check if at least one channel succeeded
      const anyChannelSucceeded = Object.values(channels).some(channel => channel?.success);

      return {
        success: true,
        notificationSent: anyChannelSucceeded,
        notificationLevel,
        channels
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
   * Get notification recipients based on escalation level
   */
  private static async getNotificationRecipients(student: User, level: 'student' | 'teacher' | 'admin'): Promise<{
    email: string[];
    sms: string[];
    pushTokens: string[];
    summary: string;
  }> {
    const recipients = {
      email: [] as string[],
      sms: [] as string[],
      pushTokens: [] as string[],
      summary: ''
    };

    try {
      // Get student's assigned teacher
      if (student.assignedLocationId) {
        // Implementation note: Teacher lookup by location would be implemented here
        // For now, use mock data - in production this would query the users collection
        const teacherEmail = `teacher-${student.assignedLocationId}@eaglepass.edu`;
        recipients.email.push(teacherEmail);
        recipients.summary += `Teacher: ${teacherEmail}`;
      }

      // Add admin contacts for admin-level notifications
      if (level === 'admin') {
        recipients.email.push('admin@eaglepass.edu', 'principal@eaglepass.edu');
        recipients.sms.push('+1-XXX-XXX-XXXX'); // Admin emergency number
        recipients.summary += ', Administrators';
      }

      // Add emergency contacts if available
      if (student.emergencyContacts) {
        student.emergencyContacts.forEach(contact => {
          if (contact.email) recipients.email.push(contact.email);
          if (contact.phone) recipients.sms.push(contact.phone);
        });
        recipients.summary += ', Emergency Contacts';
      }

    } catch (error) {
      console.error('Error getting notification recipients:', error);
    }

    return recipients;
  }

  /**
   * Send email notification
   */
  private static async sendEmailNotification(
    pass: Pass, 
    student: User, 
    recipients: string[], 
    level: string, 
    duration: number
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const subject = `🚨 Student Pass Alert - ${level.toUpperCase()} Level`;
      const body = this.generateEmailBody(pass, student, level, duration);

      // Mock implementation - replace with actual email service
      if (this.channelConfig.email?.service === 'mock') {
        console.log(`[EMAIL] ${subject}`);
        console.log(`To: ${recipients.join(', ')}`);
        console.log(`Body: ${body}`);
        return { success: true };
      }

      // Implementation note: Email service integration would be implemented here
      // if (this.channelConfig.email?.service === 'smtp') {
      //   return await this.sendSMTPEmail(recipients, subject, body);
      // }
      // if (this.channelConfig.email?.service === 'firebase') {
      //   return await this.sendFirebaseEmail(recipients, subject, body);
      // }

      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Email send failed' 
      };
    }
  }

  /**
   * Send SMS notification
   */
  private static async sendSMSNotification(
    pass: Pass, 
    student: User, 
    recipients: string[], 
    level: string, 
    duration: number
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const message = `🚨 STUDENT ALERT: ${student.name} has been out of class for ${duration} minutes. Pass ID: ${pass.id}. ${level.toUpperCase()} notification. Please check immediately.`;

      // Mock implementation - replace with actual SMS service  
      if (this.channelConfig.sms?.service === 'mock') {
        console.log(`[SMS] To: ${recipients.join(', ')}`);
        console.log(`Message: ${message}`);
        return { success: true };
      }

      // Implementation note: SMS service integration would be implemented here
      // if (this.channelConfig.sms?.service === 'twilio') {
      //   return await this.sendTwilioSMS(recipients, message);
      // }

      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'SMS send failed' 
      };
    }
  }

  /**
   * Send push notification
   */
  private static async sendPushNotification(
    pass: Pass, 
    student: User, 
    tokens: string[], 
    level: string, 
    duration: number
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const title = `🚨 Student Pass Alert`;
      const body = `${student.name} - ${duration} minutes - ${level.toUpperCase()} level`;

      // Mock implementation - replace with actual push service
      if (this.channelConfig.push?.service === 'mock') {
        console.log(`[PUSH] Title: ${title}`);
        console.log(`Body: ${body}`);
        console.log(`Tokens: ${tokens.length} devices`);
        return { success: true };
      }

      // Implementation note: Push notification service would be implemented here
      // if (this.channelConfig.push?.service === 'firebase') {
      //   return await this.sendFirebasePush(tokens, title, body);
      // }

      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Push notification failed' 
      };
    }
  }

  /**
   * Update dashboard alert
   */
  private static async updateDashboardAlert(
    pass: Pass, 
    student: User, 
    level: string, 
    duration: number
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Create real-time dashboard alert
      const alert = {
        id: `alert-${pass.id}-${Date.now()}`,
        passId: pass.id,
        studentId: student.id,
        studentName: student.name,
        level,
        duration,
        timestamp: new Date(),
        acknowledged: false,
        type: 'duration_alert'
      };

      // In a real implementation, this would update a real-time dashboard
      // using Firestore, WebSockets, or Server-Sent Events
      console.log(`[DASHBOARD] Creating ${level} alert for pass ${pass.id}`, alert);

      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Dashboard alert failed' 
      };
    }
  }

  /**
   * Generate email body for notifications
   */
  private static generateEmailBody(pass: Pass, student: User, level: string, duration: number): string {
    return `
    🚨 STUDENT PASS ALERT - ${level.toUpperCase()} LEVEL

    Student: ${student.name}
    Pass ID: ${pass.id}
    Duration: ${duration} minutes
    Status: ${pass.status}
    
    ${level === 'admin' ? '⚠️ IMMEDIATE ATTENTION REQUIRED' : '📝 Please check on student'}
    
    Current Location: ${pass.legs[pass.legs.length - 1]?.destinationLocationId || 'Unknown'}
    
    Pass Details:
    - Created: ${pass.createdAt}
    - Legs: ${pass.legs.length}
    
    Please take appropriate action immediately.
    
    ---
    Eagle Pass Safety System
    This is an automated message.
    `;
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

    // Only apply escalation logic if the student is currently OUT
    const currentLeg = pass.legs[pass.legs.length - 1];
    if (currentLeg && currentLeg.state === 'OUT') {
      const isOverdue = durationMinutes >= this.config.adminEscalationMinutes;
      const shouldEscalate = durationMinutes >= this.config.studentNotificationMinutes;

      return {
        durationMinutes,
        notificationLevel: pass.notificationLevel || 'none',
        isOverdue,
        shouldEscalate
      };
    }

    // Default status for students who are IN a location
    return {
      durationMinutes,
      notificationLevel: pass.notificationLevel || 'none',
      isOverdue: false,
      shouldEscalate: false
    };
  }
} 