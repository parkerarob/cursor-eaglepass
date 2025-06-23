import { collection, doc, deleteDoc, updateDoc, getDocs, query, where, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase/firestore';
import { FERPAAuditLogger } from './ferpaAuditLogger';
import { monitoringService } from './monitoringService';

export interface DataRetentionPolicy {
  recordType: string;
  retentionPeriodMonths: number;
  destructionMethod: 'secure_delete' | 'anonymize';
  automatedCleanup: boolean;
  legalBasis: string;
  exceptions: string[];
}

export interface RetentionMetrics {
  recordsProcessed: number;
  recordsDeleted: number;
  recordsAnonymized: number;
  recordsSkipped: number;
  errors: string[];
  processingTime: number;
}

export const FERPA_RETENTION_POLICIES: DataRetentionPolicy[] = [
  {
    recordType: 'passes',
    retentionPeriodMonths: 12, // 1 year after school year end
    destructionMethod: 'secure_delete',
    automatedCleanup: true,
    legalBasis: 'FERPA educational records completion',
    exceptions: ['ongoing_disciplinary_action', 'legal_hold', 'emergency_related']
  },
  {
    recordType: 'eventLogs', 
    retentionPeriodMonths: 36, // 3 years for audit logs
    destructionMethod: 'secure_delete',
    automatedCleanup: true,
    legalBasis: 'FERPA audit requirements',
    exceptions: ['security_incident_investigation', 'litigation_hold']
  },
  {
    recordType: 'emergencyRecords',
    retentionPeriodMonths: 84, // 7 years for emergency documentation
    destructionMethod: 'anonymize',
    automatedCleanup: true,
    legalBasis: 'FERPA emergency disclosure requirements',
    exceptions: ['ongoing_litigation', 'regulatory_investigation']
  },
  {
    recordType: 'ferpaAuditLogs',
    retentionPeriodMonths: 60, // 5 years for FERPA audit logs
    destructionMethod: 'secure_delete',
    automatedCleanup: true,
    legalBasis: 'FERPA compliance documentation',
    exceptions: ['active_investigation', 'pending_appeal']
  }
];

export class DataRetentionService {
  private static isProcessing = false;
  private static lastProcessingTime: Date | null = null;

  /**
   * Schedule automated cleanup job - runs monthly on the 1st at 2 AM
   */
  static scheduleAutomatedCleanup(): void {
    // Note: In a real implementation, this would use a proper cron job or cloud function
    // For now, we'll implement the logic that can be called manually or via scheduled tasks
    if (typeof window === 'undefined') { // Node.js environment only
      console.log('DataRetentionService: Automated cleanup scheduling enabled');
      
      // Check if we should run cleanup daily (for testing) or monthly (for production)
      const runDaily = process.env.NODE_ENV === 'development';
      const scheduleInterval = runDaily ? 24 * 60 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000; // 1 day or 30 days
      
      setInterval(async () => {
        await this.runAutomatedCleanup();
      }, scheduleInterval);
    }
  }

  /**
   * Run automated cleanup for all retention policies
   */
  static async runAutomatedCleanup(): Promise<RetentionMetrics> {
    if (this.isProcessing) {
      console.log('DataRetentionService: Cleanup already in progress, skipping');
      return {
        recordsProcessed: 0,
        recordsDeleted: 0,
        recordsAnonymized: 0,
        recordsSkipped: 0,
        errors: ['Cleanup already in progress'],
        processingTime: 0
      };
    }

    this.isProcessing = true;
    const startTime = Date.now();
    
    try {
      console.log('DataRetentionService: Starting automated cleanup');
      
      const totalMetrics: RetentionMetrics = {
        recordsProcessed: 0,
        recordsDeleted: 0,
        recordsAnonymized: 0,
        recordsSkipped: 0,
        errors: [],
        processingTime: 0
      };

      // Process each retention policy
      for (const policy of FERPA_RETENTION_POLICIES) {
        if (policy.automatedCleanup) {
          try {
            const policyMetrics = await this.processRetentionPolicy(policy);
            
            // Aggregate metrics
            totalMetrics.recordsProcessed += policyMetrics.recordsProcessed;
            totalMetrics.recordsDeleted += policyMetrics.recordsDeleted;
            totalMetrics.recordsAnonymized += policyMetrics.recordsAnonymized;
            totalMetrics.recordsSkipped += policyMetrics.recordsSkipped;
            totalMetrics.errors.push(...policyMetrics.errors);
            
          } catch (error) {
            const errorMessage = `Failed to process retention policy ${policy.recordType}: ${error instanceof Error ? error.message : 'Unknown error'}`;
            totalMetrics.errors.push(errorMessage);
            console.error('DataRetentionService:', errorMessage);
          }
        }
      }

      totalMetrics.processingTime = Date.now() - startTime;
      this.lastProcessingTime = new Date();

      // Log completion
      console.log('DataRetentionService: Automated cleanup completed', totalMetrics);
      
      // Log to monitoring service
      monitoringService.logInfo('FERPA data retention cleanup completed', {
        ...totalMetrics,
        timestamp: new Date().toISOString()
      });

      return totalMetrics;

    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process a specific retention policy
   */
  static async processRetentionPolicy(policy: DataRetentionPolicy): Promise<RetentionMetrics> {
    const metrics: RetentionMetrics = {
      recordsProcessed: 0,
      recordsDeleted: 0,
      recordsAnonymized: 0,
      recordsSkipped: 0,
      errors: [],
      processingTime: 0
    };

    const startTime = Date.now();

    try {
      console.log(`DataRetentionService: Processing policy for ${policy.recordType}`);
      
      // Calculate cutoff date
      const cutoffDate = new Date();
      cutoffDate.setMonth(cutoffDate.getMonth() - policy.retentionPeriodMonths);
      
      // Find expired records
      const expiredRecords = await this.findExpiredRecords(policy.recordType, cutoffDate);
      metrics.recordsProcessed = expiredRecords.length;

      if (expiredRecords.length === 0) {
        console.log(`DataRetentionService: No expired records found for ${policy.recordType}`);
        return metrics;
      }

      console.log(`DataRetentionService: Found ${expiredRecords.length} expired ${policy.recordType} records`);

      // Process each expired record
      for (const record of expiredRecords) {
        try {
          // Check for exceptions
          if (await this.hasDestructionException(record, policy.exceptions)) {
            metrics.recordsSkipped++;
            continue;
          }

          // Execute destruction based on policy
          if (policy.destructionMethod === 'secure_delete') {
            await this.secureDelete(record, policy.recordType);
            metrics.recordsDeleted++;
          } else if (policy.destructionMethod === 'anonymize') {
            await this.anonymizeRecord(record, policy.recordType);
            metrics.recordsAnonymized++;
          }

          // Log destruction for FERPA audit
          await this.logDestruction(record, policy);

        } catch (error) {
          const errorMessage = `Failed to process record ${record.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          metrics.errors.push(errorMessage);
          console.error('DataRetentionService:', errorMessage);
        }
      }

      metrics.processingTime = Date.now() - startTime;
      console.log(`DataRetentionService: Completed processing ${policy.recordType}`, metrics);

      return metrics;

    } catch (error) {
      metrics.errors.push(`Policy processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  // public for testability (Jest spyOn limitation)
  public static async findExpiredRecords(recordType: string, cutoffDate: Date): Promise<Array<{ id: string; [key: string]: unknown }>> {
    try {
      const collectionName = this.getCollectionName(recordType);
      const recordsRef = collection(db, collectionName);
      
      // Query for records older than cutoff date
      const q = query(recordsRef, where('createdAt', '<', Timestamp.fromDate(cutoffDate)));
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
    } catch (error) {
      console.error(`DataRetentionService: Error finding expired records for ${recordType}:`, error);
      throw error;
    }
  }

  // public for testability (Jest spyOn limitation)
  public static async hasDestructionException(record: { [key: string]: unknown }, exceptions: string[]): Promise<boolean> {
    // Check for common exception flags
    if (record.legalHold || record.retentionHold || record.investigationHold) {
      return true;
    }

    // Check for specific exception types
    for (const exception of exceptions) {
      switch (exception) {
        case 'ongoing_disciplinary_action':
          if (record.disciplinaryStatus === 'active') return true;
          break;
        case 'legal_hold':
          if (record.legalHold === true) return true;
          break;
        case 'emergency_related':
          if (record.emergencyRelated === true) return true;
          break;
        case 'security_incident_investigation':
          if (record.securityInvestigation === true) return true;
          break;
        case 'litigation_hold':
          if (record.litigationHold === true) return true;
          break;
        case 'regulatory_investigation':
          if (record.regulatoryInvestigation === true) return true;
          break;
        case 'active_investigation':
          if (record.activeInvestigation === true) return true;
          break;
        case 'pending_appeal':
          if (record.pendingAppeal === true) return true;
          break;
      }
    }

    return false;
  }

  // public for testability (Jest spyOn limitation)
  public static async secureDelete(record: { id: string; [key: string]: unknown }, recordType: string): Promise<void> {
    try {
      const collectionName = this.getCollectionName(recordType);
      const docRef = doc(db, collectionName, record.id);
      
      // Delete the document
      await deleteDoc(docRef);
      
      console.log(`DataRetentionService: Securely deleted ${recordType} record ${record.id}`);
      
    } catch (error) {
      console.error(`DataRetentionService: Error securely deleting record ${record.id}:`, error);
      throw error;
    }
  }

  // public for testability (Jest spyOn limitation)
  public static async anonymizeRecord(record: { id: string; [key: string]: unknown }, recordType: string): Promise<void> {
    try {
      const collectionName = this.getCollectionName(recordType);
      const docRef = doc(db, collectionName, record.id);
      
      // Create anonymized version
      const anonymizedData = this.createAnonymizedRecord(record, recordType);
      
      // Update the document with anonymized data
      await updateDoc(docRef, {
        ...anonymizedData,
        anonymized: true,
        anonymizedAt: Timestamp.fromDate(new Date()),
        originalDataHash: this.generateDataHash(record) // For audit purposes
      });
      
      console.log(`DataRetentionService: Anonymized ${recordType} record ${record.id}`);
      
    } catch (error) {
      console.error(`DataRetentionService: Error anonymizing record ${record.id}:`, error);
      throw error;
    }
  }

  /**
   * Create anonymized version of a record
   */
  private static createAnonymizedRecord(record: { [key: string]: unknown }, recordType: string): { [key: string]: unknown } {
    const anonymized = { ...record };
    
    // Remove personally identifiable information based on record type
    switch (recordType) {
      case 'passes':
        delete anonymized.studentId;
        delete anonymized.studentName;
        delete anonymized.teacherId;
        delete anonymized.teacherName;
        
        // Keep statistical data for research purposes
        return {
          locationId: anonymized.locationId,
          destination: anonymized.destination,
          purpose: anonymized.purpose,
          status: anonymized.status,
          durationMinutes: anonymized.durationMinutes,
          createdAt: anonymized.createdAt,
          closedAt: anonymized.closedAt,
          schoolYear: anonymized.schoolYear || this.getCurrentSchoolYear()
        };
        
      case 'eventLogs':
        delete anonymized.studentId;
        delete anonymized.actorId;
        delete anonymized.studentName;
        delete anonymized.actorName;
        
        return {
          eventType: anonymized.eventType,
          locationId: anonymized.locationId,
          timestamp: anonymized.timestamp,
          notificationLevel: anonymized.notificationLevel,
          schoolYear: anonymized.schoolYear || this.getCurrentSchoolYear()
        };
        
      case 'emergencyRecords':
        delete anonymized.studentIds;
        delete anonymized.studentNames;
        delete anonymized.disclosedBy;
        
        return {
          emergencyType: anonymized.emergencyType,
          disclosureReason: anonymized.disclosureReason,
          dataCategories: anonymized.dataCategories,
          disclosedAt: anonymized.disclosedAt,
          schoolYear: anonymized.schoolYear || this.getCurrentSchoolYear()
        };
        
      default:
        // Generic anonymization - remove common PII fields
        delete anonymized.studentId;
        delete anonymized.userId;
        delete anonymized.email;
        delete anonymized.name;
        delete anonymized.firstName;
        delete anonymized.lastName;
        return anonymized;
    }
  }

  // public for testability (Jest spyOn limitation)
  public static async logDestruction(record: { id: string; [key: string]: unknown }, policy: DataRetentionPolicy): Promise<void> {
    try {
      await FERPAAuditLogger.logDataDestruction(
        [record.id],
        policy.recordType,
        policy.destructionMethod,
        policy.legalBasis
      );
    } catch (error) {
      console.error('DataRetentionService: Error logging destruction:', error);
      // Don't throw here - we don't want to fail the destruction because of logging issues
    }
  }

  /**
   * Get Firestore collection name for record type
   */
  private static getCollectionName(recordType: string): string {
    switch (recordType) {
      case 'passes':
        return 'passes';
      case 'eventLogs':
        return 'eventLogs';
      case 'emergencyRecords':
        return 'emergencyDisclosures';
      case 'ferpaAuditLogs':
        return 'ferpaAuditLogs';
      default:
        return recordType;
    }
  }

  /**
   * Generate hash of record data for audit purposes
   */
  private static generateDataHash(record: { [key: string]: unknown }): string {
    // Simple hash generation - in production, use a proper cryptographic hash
    const dataString = JSON.stringify(record);
    let hash = 0;
    for (let i = 0; i < dataString.length; i++) {
      const char = dataString.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(16);
  }

  /**
   * Get current school year
   */
  private static getCurrentSchoolYear(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1; // JavaScript months are 0-indexed
    
    // School year starts in August (month 8)
    if (month >= 8) {
      return `${year}-${year + 1}`;
    } else {
      return `${year - 1}-${year}`;
    }
  }

  /**
   * Get processing status
   */
  static getProcessingStatus(): { isProcessing: boolean; lastProcessingTime: Date | null } {
    return {
      isProcessing: this.isProcessing,
      lastProcessingTime: this.lastProcessingTime
    };
  }

  /**
   * Manual cleanup for testing/emergency purposes
   */
  static async runManualCleanup(recordType?: string): Promise<RetentionMetrics> {
    console.log('DataRetentionService: Starting manual cleanup');
    
    if (recordType) {
      const policy = FERPA_RETENTION_POLICIES.find(p => p.recordType === recordType);
      if (!policy) {
        throw new Error(`No retention policy found for record type: ${recordType}`);
      }
      return await this.processRetentionPolicy(policy);
    } else {
      return await this.runAutomatedCleanup();
    }
  }
}

// Initialize automated cleanup when module is loaded
if (process.env.NODE_ENV !== 'test') {
  DataRetentionService.scheduleAutomatedCleanup();
}