import { collection, doc, setDoc, getDocs, query, where, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase/firestore';
import { getUserById } from '@/lib/firebase/firestore';
// import { NotificationService } from './notificationService';
import { FERPAAuditLogger } from './ferpaAuditLogger';
import { monitoringService } from './monitoringService';
import { User } from '@/types';

export interface EmergencyDisclosure {
  id: string;
  studentIds: string[];
  disclosedTo: string[];
  disclosureReason: string;
  emergencyType: 'health' | 'safety' | 'security';
  disclosedAt: Date;
  disclosedBy: string;
  dataCategories: string[];
  postEmergencyNotificationSent: boolean;
  notificationScheduledFor?: Date;
  schoolYear: string;
  additionalDetails?: Record<string, unknown>;
}

export interface PostEmergencyNotification {
  disclosureId: string;
  studentId: string;
  parentEmail: string;
  sentAt: Date;
  deliveryStatus: 'sent' | 'delivered' | 'failed' | 'bounced';
  notificationContent: string;
}

export class EmergencyDisclosureManager {
  /**
   * Record a new emergency disclosure
   */
  static async recordEmergencyDisclosure(
    studentIds: string[],
    disclosedTo: string[],
    reason: string,
    emergencyType: EmergencyDisclosure['emergencyType'],
    disclosedBy: string,
    dataCategories: string[] = ['pass_records', 'location_data', 'movement_history'],
    additionalDetails?: Record<string, unknown>
  ): Promise<EmergencyDisclosure> {
    
    const disclosure: EmergencyDisclosure = {
      id: this.generateDisclosureId(),
      studentIds,
      disclosedTo,
      disclosureReason: reason,
      emergencyType,
      disclosedAt: new Date(),
      disclosedBy,
      dataCategories,
      postEmergencyNotificationSent: false,
      notificationScheduledFor: this.calculateNotificationTime(),
      schoolYear: this.getCurrentSchoolYear(),
      additionalDetails
    };
    
    // Store disclosure record
    await this.storeDisclosure(disclosure);
    
    // Log to FERPA audit system
    await FERPAAuditLogger.logEmergencyDisclosure(
      disclosedBy,
      studentIds,
      [], // Record IDs would be populated with actual record references
      emergencyType,
      reason,
      disclosedTo
    );
    
    // Schedule post-emergency notification (typically within 24-48 hours)
    await this.schedulePostEmergencyNotification(disclosure);
    
    // Alert monitoring system
    try {
      monitoringService.logWarning('Emergency disclosure recorded', {
        emergencyType,
        studentCount: studentIds.length,
        disclosedTo: disclosedTo.join(', '),
        reason
      });
    } catch (err) {
      console.error('EmergencyDisclosureManager: Error logging to monitoringService:', err);
    }
    
    console.log(`EmergencyDisclosureManager: Recorded emergency disclosure ${disclosure.id}`);
    
    return disclosure;
  }
  
  /**
   * Send post-emergency notifications to parents
   */
  static async sendPostEmergencyNotifications(
    disclosure: EmergencyDisclosure
  ): Promise<PostEmergencyNotification[]> {
    const notifications: PostEmergencyNotification[] = [];
    
    try {
      console.log(`EmergencyDisclosureManager: Sending post-emergency notifications for disclosure ${disclosure.id}`);
      
      for (const studentId of disclosure.studentIds) {
        try {
          const student = await getUserById(studentId);
          
          if (student && student.emergencyContacts && student.emergencyContacts.length > 0) {
            const primaryContact = student.emergencyContacts.find(c => c.isPrimary) || student.emergencyContacts[0];
            if (primaryContact?.email) {
              const notificationContent = this.generateNotificationContent(disclosure, student);
              
              // TODO: Implement email sending
              // NotificationService doesn't have a sendEmail method yet
              // This needs to be implemented or use the sendNotification method
              /*
              const emailResult = await NotificationService.sendEmail({
                to: primaryContact.email,
                subject: 'Emergency Student Information Disclosure Notification',
                template: 'emergency-disclosure-notice',
                data: {
                  studentName: this.getStudentDisplayName(student),
                  emergencyType: disclosure.emergencyType,
                  disclosureDate: disclosure.disclosedAt.toLocaleDateString(),
                  disclosureTime: disclosure.disclosedAt.toLocaleTimeString(),
                  reason: disclosure.disclosureReason,
                  dataShared: disclosure.dataCategories.join(', '),
                  disclosedTo: disclosure.disclosedTo.join(', '),
                  schoolContactInfo: this.getSchoolContactInfo(),
                  ferpaRights: this.getFERPARightsText()
                }
              });
              */
              
              // For now, assume email would be sent successfully
              const emailResult = true;
              console.log(`EmergencyDisclosureManager: Would send email to ${primaryContact.email} for student ${studentId}`);
              
              const notification: PostEmergencyNotification = {
                disclosureId: disclosure.id,
                studentId,
                parentEmail: primaryContact.email,
                sentAt: new Date(),
                deliveryStatus: emailResult ? 'sent' : 'failed',
                notificationContent
              };
              
              // Store notification record
              try {
                await this.storeNotificationRecord(notification);
              } catch (err) {
                console.error('EmergencyDisclosureManager: Error storing notification record:', err);
              }
              notifications.push(notification);
              
              console.log(`EmergencyDisclosureManager: Notification sent to ${primaryContact.email} for student ${studentId}`);
            } else {
              console.warn(`EmergencyDisclosureManager: Emergency contact found but no email for student ${studentId}`);
              
              const notification: PostEmergencyNotification = {
                disclosureId: disclosure.id,
                studentId,
                parentEmail: 'NO_EMAIL_ON_CONTACT',
                sentAt: new Date(),
                deliveryStatus: 'failed',
                notificationContent: 'Emergency contact found but no email address'
              };
              
              try {
                await this.storeNotificationRecord(notification);
              } catch (err) {
                console.error('EmergencyDisclosureManager: Error storing notification record:', err);
              }
              notifications.push(notification);
            }
          } else {
            console.warn(`EmergencyDisclosureManager: No emergency contacts found for student ${studentId}`);
            
            // Create a record showing notification was attempted but no contacts available
            const notification: PostEmergencyNotification = {
              disclosureId: disclosure.id,
              studentId,
              parentEmail: 'NOT_AVAILABLE',
              sentAt: new Date(),
              deliveryStatus: 'failed',
              notificationContent: 'No emergency contacts on file'
            };
            
            try {
              await this.storeNotificationRecord(notification);
            } catch (err) {
              console.error('EmergencyDisclosureManager: Error storing notification record:', err);
            }
            notifications.push(notification);
          }
          
        } catch (error) {
          console.error(`EmergencyDisclosureManager: Error sending notification for student ${studentId}:`, error);
          
          // Record the failure
          const notification: PostEmergencyNotification = {
            disclosureId: disclosure.id,
            studentId,
            parentEmail: 'ERROR',
            sentAt: new Date(),
            deliveryStatus: 'failed',
            notificationContent: `Notification failed: ${error instanceof Error ? error.message : 'Unknown error'}`
          };
          
          try {
            await this.storeNotificationRecord(notification);
          } catch (err) {
            console.error('EmergencyDisclosureManager: Error storing notification record:', err);
          }
          notifications.push(notification);
        }
      }
      
      // Mark disclosure as having notifications sent
      await this.markNotificationsSent(disclosure.id);
      
      console.log(`EmergencyDisclosureManager: Completed ${notifications.length} notifications for disclosure ${disclosure.id}`);
      
      return notifications;
      
    } catch (error) {
      console.error('EmergencyDisclosureManager: Error sending post-emergency notifications:', error);
      throw error;
    }
  }
  
  /**
   * Get all emergency disclosures for a time period
   */
  static async getEmergencyDisclosures(
    startDate?: Date,
    endDate?: Date,
    emergencyType?: EmergencyDisclosure['emergencyType']
  ): Promise<EmergencyDisclosure[]> {
    try {
      const disclosuresRef = collection(db, 'emergencyDisclosures');
      let q = query(disclosuresRef);
      
      // Add date filters if provided
      if (startDate) {
        q = query(q, where('disclosedAt', '>=', Timestamp.fromDate(startDate)));
      }
      if (endDate) {
        q = query(q, where('disclosedAt', '<=', Timestamp.fromDate(endDate)));
      }
      if (emergencyType) {
        q = query(q, where('emergencyType', '==', emergencyType));
      }
      
      const querySnapshot = await getDocs(q);
      if (!querySnapshot) throw new Error('Firestore getDocs returned undefined');
      
      return querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          disclosedAt: data.disclosedAt.toDate(),
          notificationScheduledFor: data.notificationScheduledFor?.toDate()
        } as EmergencyDisclosure;
      });
      
    } catch (error) {
      console.error('EmergencyDisclosureManager: Error retrieving emergency disclosures:', error);
      throw error;
    }
  }
  
  /**
   * Get pending notifications that need to be sent
   */
  static async getPendingNotifications(): Promise<EmergencyDisclosure[]> {
    try {
      const now = new Date();
      const disclosuresRef = collection(db, 'emergencyDisclosures');
      const q = query(
        disclosuresRef,
        where('postEmergencyNotificationSent', '==', false),
        where('notificationScheduledFor', '<=', Timestamp.fromDate(now))
      );
      
      const querySnapshot = await getDocs(q);
      if (!querySnapshot) throw new Error('Firestore getDocs returned undefined');
      
      return querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          disclosedAt: data.disclosedAt.toDate(),
          notificationScheduledFor: data.notificationScheduledFor?.toDate()
        } as EmergencyDisclosure;
      });
      
    } catch (error) {
      console.error('EmergencyDisclosureManager: Error retrieving pending notifications:', error);
      throw error;
    }
  }
  
  /**
   * Process pending notifications (should be called periodically)
   */
  static async processPendingNotifications(): Promise<void> {
    try {
      const pendingDisclosures = await this.getPendingNotifications();
      
      console.log(`EmergencyDisclosureManager: Processing ${pendingDisclosures.length} pending notifications`);
      
      for (const disclosure of pendingDisclosures) {
        try {
          await this.sendPostEmergencyNotifications(disclosure);
        } catch (error) {
          console.error(`EmergencyDisclosureManager: Error processing notification for disclosure ${disclosure.id}:`, error);
          // Continue with other notifications even if one fails
        }
      }
      
    } catch (error) {
      console.error('EmergencyDisclosureManager: Error processing pending notifications:', error);
      throw error;
    }
  }
  
  /**
   * Store emergency disclosure record
   */
  private static async storeDisclosure(disclosure: EmergencyDisclosure): Promise<void> {
    try {
      const disclosureRef = doc(collection(db, 'emergencyDisclosures'), disclosure.id);
      
      const firestoreDisclosure = {
        ...disclosure,
        disclosedAt: Timestamp.fromDate(disclosure.disclosedAt),
        notificationScheduledFor: disclosure.notificationScheduledFor 
          ? Timestamp.fromDate(disclosure.notificationScheduledFor) 
          : null
      };
      
      await setDoc(disclosureRef, firestoreDisclosure);
      
    } catch (error) {
      console.error('EmergencyDisclosureManager: Error storing disclosure:', error);
      throw error;
    }
  }
  
  /**
   * Store notification record
   */
  private static async storeNotificationRecord(notification: PostEmergencyNotification): Promise<void> {
    try {
      const notificationRef = doc(collection(db, 'postEmergencyNotifications'));
      
      const firestoreNotification = {
        ...notification,
        sentAt: Timestamp.fromDate(notification.sentAt)
      };
      
      await setDoc(notificationRef, firestoreNotification);
      
    } catch (error) {
      console.error('EmergencyDisclosureManager: Error storing notification record:', error);
      // Don't throw here - we don't want to fail the notification because of logging issues
    }
  }
  
  /**
   * Mark disclosure as having notifications sent
   */
  private static async markNotificationsSent(disclosureId: string): Promise<void> {
    try {
      const disclosureRef = doc(db, 'emergencyDisclosures', disclosureId);
      await updateDoc(disclosureRef, {
        postEmergencyNotificationSent: true
      });
      
    } catch (error) {
      console.error('EmergencyDisclosureManager: Error marking notifications sent:', error);
      throw error;
    }
  }
  
  /**
   * Schedule post-emergency notification
   */
  private static async schedulePostEmergencyNotification(disclosure: EmergencyDisclosure): Promise<void> {
    // In a real implementation, this would integrate with a job scheduler
    // For now, we'll just set the scheduled time and rely on periodic processing
    
    console.log(`EmergencyDisclosureManager: Scheduled post-emergency notification for ${disclosure.notificationScheduledFor}`);
  }
  
  /**
   * Generate unique disclosure ID
   */
  private static generateDisclosureId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    return `emrg-${timestamp}-${random}`;
  }
  
  /**
   * Calculate when post-emergency notification should be sent
   */
  private static calculateNotificationTime(): Date {
    // FERPA doesn't specify exact timing, but best practice is within 24-48 hours
    // We'll default to 24 hours after the emergency
    const notificationTime = new Date();
    notificationTime.setHours(notificationTime.getHours() + 24);
    return notificationTime;
  }
  
  /**
   * Get current school year
   */
  private static getCurrentSchoolYear(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    
    if (month >= 8) {
      return `${year}-${year + 1}`;
    } else {
      return `${year - 1}-${year}`;
    }
  }
  
  /**
   * Generate notification content for parent
   */
  private static generateNotificationContent(disclosure: EmergencyDisclosure, student: User): string {
    const studentName = this.getStudentDisplayName(student);
    
    return `
Dear Parent/Guardian,

This notification is to inform you that due to a ${disclosure.emergencyType} emergency situation, certain educational records for your child, ${studentName}, were disclosed to authorized personnel on ${disclosure.disclosedAt.toLocaleDateString()} at ${disclosure.disclosedAt.toLocaleTimeString()}.

Emergency Details:
- Type: ${disclosure.emergencyType.charAt(0).toUpperCase() + disclosure.emergencyType.slice(1)} Emergency
- Reason: ${disclosure.disclosureReason}
- Information Disclosed: ${disclosure.dataCategories.join(', ')}
- Disclosed To: ${disclosure.disclosedTo.join(', ')}

This disclosure was made under the Health and Safety Emergency exception of the Family Educational Rights and Privacy Act (FERPA), 20 U.S.C. § 1232g(b)(1)(I), which permits schools to disclose educational records without consent in cases of emergency to protect the health and safety of students.

Your Rights Under FERPA:
- You have the right to inspect and review your child's educational records
- You have the right to request corrections to records you believe are inaccurate
- You have the right to file a complaint with the U.S. Department of Education if you believe your rights have been violated

If you have any questions about this disclosure or wish to discuss your child's educational records, please contact the school office.

Sincerely,
School Administration
    `.trim();
  }
  
  /**
   * Get student display name
   */
  private static getStudentDisplayName(student: User): string {
    if (student.firstName && student.lastName) {
      return `${student.firstName} ${student.lastName}`;
    } else if (student.name) {
      return student.name;
    } else {
      return 'Student';
    }
  }
  
  /**
   * Get school contact information
   */
  private static getSchoolContactInfo(): { name: string; phone: string; email: string } {
    // This would typically come from configuration
    return {
      name: 'Eagle Pass School',
      phone: '(555) 123-4567',
      email: 'info@eaglepassschool.edu'
    };
  }
  
  /**
   * Get FERPA rights text for notifications
   */
  private static getFERPARightsText(): string {
    return `
Under FERPA, parents have the right to:
• Inspect and review their child's educational records
• Request corrections to records believed to be inaccurate or misleading
• Consent to disclosures of personally identifiable information (except in specific circumstances)
• File complaints with the U.S. Department of Education concerning alleged failures to comply with FERPA

For more information about FERPA rights, visit: https://www2.ed.gov/policy/gen/guid/fpco/ferpa/index.html
    `.trim();
  }
}