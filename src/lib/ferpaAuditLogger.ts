import { collection, doc, setDoc, getDocs, query, where, orderBy, limit, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase/firestore';
import { monitoringService } from './monitoringService';

export interface FERPAAuditLog {
  id: string;
  eventType: 'record_access' | 'record_disclosure' | 'record_correction' | 'data_destruction' | 'consent_granted' | 'consent_revoked' | 'emergency_disclosure';
  actorId: string;
  actorRole: 'parent' | 'teacher' | 'admin' | 'system' | 'student';
  studentId: string | 'multiple';
  recordIds: string[];
  purpose: string;
  legalBasis: string; // FERPA exception or consent basis
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
  additionalDetails?: Record<string, unknown>;
  schoolYear: string;
}

export interface FERPAAuditSummary {
  totalRecordAccesses: number;
  parentAccesses: number;
  teacherAccesses: number;
  adminAccesses: number;
  emergencyDisclosures: number;
  dataDestructions: number;
  recordCorrections: number;
  consentEvents: number;
  timeRange: {
    startDate: Date;
    endDate: Date;
  };
}

export class FERPAAuditLogger {
  /**
   * Log student record access
   */
  static async logRecordAccess(
    actorId: string,
    actorRole: FERPAAuditLog['actorRole'],
    studentId: string,
    recordIds: string[],
    purpose: string,
    legalBasis: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    const auditLog: FERPAAuditLog = {
      id: this.generateAuditId(),
      eventType: 'record_access',
      actorId,
      actorRole,
      studentId,
      recordIds,
      purpose,
      legalBasis,
      timestamp: new Date(),
      ipAddress,
      userAgent,
      schoolYear: this.getCurrentSchoolYear()
    };
    
    await this.storeAuditLog(auditLog);
    
    // Log to monitoring service for real-time alerts
    monitoringService.logInfo('FERPA record access logged', {
      actorRole,
      studentId,
      recordCount: recordIds.length,
      purpose
    });
  }

  /**
   * Log data disclosure to third parties
   */
  static async logRecordDisclosure(
    actorId: string,
    actorRole: FERPAAuditLog['actorRole'],
    studentIds: string[],
    recordIds: string[],
    disclosedTo: string,
    purpose: string,
    legalBasis: string,
    additionalDetails?: Record<string, unknown>
  ): Promise<void> {
    const auditLog: FERPAAuditLog = {
      id: this.generateAuditId(),
      eventType: 'record_disclosure',
      actorId,
      actorRole,
      studentId: studentIds.length === 1 ? studentIds[0] : 'multiple',
      recordIds,
      purpose,
      legalBasis,
      timestamp: new Date(),
      additionalDetails: {
        ...additionalDetails,
        disclosedTo,
        studentIds: studentIds.length > 1 ? studentIds : undefined
      },
      schoolYear: this.getCurrentSchoolYear()
    };
    
    await this.storeAuditLog(auditLog);
    
    // Alert for non-emergency disclosures
    if (!legalBasis.includes('emergency')) {
      monitoringService.logWarning('FERPA record disclosure', {
        disclosedTo,
        studentCount: studentIds.length,
        legalBasis
      });
    }
  }

  /**
   * Log emergency disclosure
   */
  static async logEmergencyDisclosure(
    disclosedBy: string,
    studentIds: string[],
    recordIds: string[],
    emergencyType: 'health' | 'safety' | 'security',
    disclosureReason: string,
    disclosedTo: string[]
  ): Promise<void> {
    const auditLog: FERPAAuditLog = {
      id: this.generateAuditId(),
      eventType: 'emergency_disclosure',
      actorId: disclosedBy,
      actorRole: 'admin', // Emergency disclosures typically by admin
      studentId: studentIds.length === 1 ? studentIds[0] : 'multiple',
      recordIds,
      purpose: `Emergency disclosure - ${emergencyType}`,
      legalBasis: '§99.36 Health and safety emergency exception',
      timestamp: new Date(),
      additionalDetails: {
        emergencyType,
        disclosureReason,
        disclosedTo,
        studentIds: studentIds.length > 1 ? studentIds : undefined,
        requiresPostEmergencyNotification: true
      },
      schoolYear: this.getCurrentSchoolYear()
    };
    
    await this.storeAuditLog(auditLog);
    
    // Critical alert for emergency disclosures
    monitoringService.logWarning('FERPA emergency disclosure', {
      emergencyType,
      studentCount: studentIds.length,
      disclosedTo: disclosedTo.join(', ')
    });
  }

  /**
   * Log record correction request
   */
  static async logRecordCorrection(
    requestedBy: string,
    requesterRole: FERPAAuditLog['actorRole'],
    studentId: string,
    recordId: string,
    fieldName: string,
    oldValue: string,
    newValue: string,
    correctionStatus: 'requested' | 'approved' | 'denied' | 'completed'
  ): Promise<void> {
    const auditLog: FERPAAuditLog = {
      id: this.generateAuditId(),
      eventType: 'record_correction',
      actorId: requestedBy,
      actorRole: requesterRole,
      studentId,
      recordIds: [recordId],
      purpose: `Record correction - ${correctionStatus}`,
      legalBasis: '§99.20 Right to seek correction',
      timestamp: new Date(),
      additionalDetails: {
        fieldName,
        oldValue,
        newValue,
        correctionStatus
      },
      schoolYear: this.getCurrentSchoolYear()
    };
    
    await this.storeAuditLog(auditLog);
  }

  /**
   * Log data destruction
   */
  static async logDataDestruction(
    recordIds: string[],
    recordType: string,
    destructionMethod: string,
    legalBasis: string,
    additionalDetails?: Record<string, unknown>
  ): Promise<void> {
    const auditLog: FERPAAuditLog = {
      id: this.generateAuditId(),
      eventType: 'data_destruction',
      actorId: 'system',
      actorRole: 'system',
      studentId: 'multiple',
      recordIds,
      purpose: `Automated data retention - ${destructionMethod}`,
      legalBasis,
      timestamp: new Date(),
      additionalDetails: {
        recordType,
        destructionMethod,
        recordCount: recordIds.length,
        ...additionalDetails
      },
      schoolYear: this.getCurrentSchoolYear()
    };
    
    await this.storeAuditLog(auditLog);
    
    // Log significant destructions
    if (recordIds.length > 10) {
      monitoringService.logInfo('FERPA bulk data destruction', {
        recordType,
        recordCount: recordIds.length,
        destructionMethod
      });
    }
  }

  /**
   * Log consent events (granted/revoked)
   */
  static async logConsentEvent(
    parentId: string,
    studentId: string,
    consentType: string,
    eventType: 'consent_granted' | 'consent_revoked',
    purpose: string,
    dataCategories: string[]
  ): Promise<void> {
    const auditLog: FERPAAuditLog = {
      id: this.generateAuditId(),
      eventType,
      actorId: parentId,
      actorRole: 'parent',
      studentId,
      recordIds: [], // Consent applies broadly, not to specific records
      purpose,
      legalBasis: eventType === 'consent_granted' ? '§99.30 Written consent' : '§99.30 Consent withdrawal',
      timestamp: new Date(),
      additionalDetails: {
        consentType,
        dataCategories
      },
      schoolYear: this.getCurrentSchoolYear()
    };
    
    await this.storeAuditLog(auditLog);
  }

  /**
   * Store audit log in Firestore
   */
  private static async storeAuditLog(auditLog: FERPAAuditLog): Promise<void> {
    try {
      const auditRef = doc(collection(db, 'ferpaAuditLogs'), auditLog.id);
      
      // Convert Date to Timestamp for Firestore and filter undefined values
      const firestoreLog = {
        ...auditLog,
        timestamp: Timestamp.fromDate(auditLog.timestamp),
        // Remove undefined fields that Firestore doesn't accept
        ...(auditLog.ipAddress !== undefined && { ipAddress: auditLog.ipAddress }),
        ...(auditLog.userAgent !== undefined && { userAgent: auditLog.userAgent }),
        ...(auditLog.additionalDetails !== undefined && { additionalDetails: auditLog.additionalDetails })
      };
      
      // Remove the original optional fields to avoid undefined values
      delete (firestoreLog as any).ipAddress;
      delete (firestoreLog as any).userAgent;
      delete (firestoreLog as any).additionalDetails;
      
      // Re-add them only if they have values
      if (auditLog.ipAddress !== undefined) {
        (firestoreLog as any).ipAddress = auditLog.ipAddress;
      }
      if (auditLog.userAgent !== undefined) {
        (firestoreLog as any).userAgent = auditLog.userAgent;
      }
      if (auditLog.additionalDetails !== undefined) {
        (firestoreLog as any).additionalDetails = auditLog.additionalDetails;
      }
      
      await setDoc(auditRef, firestoreLog);
      
    } catch (error) {
      console.error('FERPAAuditLogger: Error storing audit log:', error);
      
      // Fallback: Log to monitoring service if Firestore fails
      monitoringService.logError('FERPA audit log storage failed', {
        auditLogId: auditLog.id,
        eventType: auditLog.eventType,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      throw error;
    }
  }

  /**
   * Generate unique audit log ID
   */
  private static generateAuditId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    return `ferpa-${timestamp}-${random}`;
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
   * Get audit logs for a specific student
   */
  static async getAuditLogsForStudent(
    studentId: string,
    limit_count: number = 50
  ): Promise<FERPAAuditLog[]> {
    try {
      const auditRef = collection(db, 'ferpaAuditLogs');
      const q = query(
        auditRef,
        where('studentId', '==', studentId),
        orderBy('timestamp', 'desc'),
        limit(limit_count)
      );
      
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          timestamp: data.timestamp.toDate() // Convert Timestamp back to Date
        } as FERPAAuditLog;
      });
      
    } catch (error) {
      console.error('FERPAAuditLogger: Error retrieving student audit logs:', error);
      throw error;
    }
  }

  /**
   * Get audit logs by event type
   */
  static async getAuditLogsByType(
    eventType: FERPAAuditLog['eventType'],
    limit_count: number = 100
  ): Promise<FERPAAuditLog[]> {
    try {
      const auditRef = collection(db, 'ferpaAuditLogs');
      const q = query(
        auditRef,
        where('eventType', '==', eventType),
        orderBy('timestamp', 'desc'),
        limit(limit_count)
      );
      
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          timestamp: data.timestamp.toDate()
        } as FERPAAuditLog;
      });
      
    } catch (error) {
      console.error('FERPAAuditLogger: Error retrieving audit logs by type:', error);
      throw error;
    }
  }

  /**
   * Generate audit summary for a time period
   */
  static async generateAuditSummary(
    startDate: Date,
    endDate: Date
  ): Promise<FERPAAuditSummary> {
    try {
      const auditRef = collection(db, 'ferpaAuditLogs');
      const q = query(
        auditRef,
        where('timestamp', '>=', Timestamp.fromDate(startDate)),
        where('timestamp', '<=', Timestamp.fromDate(endDate))
      );
      
      const querySnapshot = await getDocs(q);
      const logs = querySnapshot.docs.map(doc => doc.data() as FERPAAuditLog);
      
      const summary: FERPAAuditSummary = {
        totalRecordAccesses: 0,
        parentAccesses: 0,
        teacherAccesses: 0,
        adminAccesses: 0,
        emergencyDisclosures: 0,
        dataDestructions: 0,
        recordCorrections: 0,
        consentEvents: 0,
        timeRange: { startDate, endDate }
      };
      
      // Aggregate statistics
      for (const log of logs) {
        switch (log.eventType) {
          case 'record_access':
            summary.totalRecordAccesses++;
            if (log.actorRole === 'parent') summary.parentAccesses++;
            else if (log.actorRole === 'teacher') summary.teacherAccesses++;
            else if (log.actorRole === 'admin') summary.adminAccesses++;
            break;
          case 'emergency_disclosure':
            summary.emergencyDisclosures++;
            break;
          case 'data_destruction':
            summary.dataDestructions++;
            break;
          case 'record_correction':
            summary.recordCorrections++;
            break;
          case 'consent_granted':
          case 'consent_revoked':
            summary.consentEvents++;
            break;
        }
      }
      
      return summary;
      
    } catch (error) {
      console.error('FERPAAuditLogger: Error generating audit summary:', error);
      throw error;
    }
  }

  /**
   * Get recent audit activity (for dashboard)
   */
  static async getRecentActivity(limit_count: number = 20): Promise<FERPAAuditLog[]> {
    try {
      const auditRef = collection(db, 'ferpaAuditLogs');
      const q = query(
        auditRef,
        orderBy('timestamp', 'desc'),
        limit(limit_count)
      );
      
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          timestamp: data.timestamp.toDate()
        } as FERPAAuditLog;
      });
      
    } catch (error) {
      console.error('FERPAAuditLogger: Error retrieving recent activity:', error);
      throw error;
    }
  }

  /**
   * Check for potential FERPA violations
   */
  static async detectPotentialViolations(
    timeWindow: number = 24 // hours
  ): Promise<{ violation: string; details: unknown; logs: FERPAAuditLog[] }[]> {
    try {
      const cutoffTime = new Date(Date.now() - timeWindow * 60 * 60 * 1000);
      const auditRef = collection(db, 'ferpaAuditLogs');
      const q = query(
        auditRef,
        where('timestamp', '>=', Timestamp.fromDate(cutoffTime)),
        orderBy('timestamp', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      const logs = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          timestamp: data.timestamp.toDate()
        } as FERPAAuditLog;
      });
      
      const violations: { violation: string; details: unknown; logs: FERPAAuditLog[] }[] = [];
      
      // Check for excessive access by single actor
      const accessCounts = new Map<string, FERPAAuditLog[]>();
      
      for (const log of logs) {
        if (log.eventType === 'record_access') {
          const key = `${log.actorId}-${log.actorRole}`;
          if (!accessCounts.has(key)) {
            accessCounts.set(key, []);
          }
          accessCounts.get(key)!.push(log);
        }
      }
      
      // Flag excessive access (more than 50 records accessed by one person in time window)
      for (const [actor, actorLogs] of accessCounts.entries()) {
        if (actorLogs.length > 50) {
          violations.push({
            violation: 'Excessive record access',
            details: {
              actor,
              accessCount: actorLogs.length,
              timeWindow: `${timeWindow} hours`
            },
            logs: actorLogs
          });
        }
      }
      
      // Check for disclosures without proper legal basis
      const suspiciousDisclosures = logs.filter(log => 
        log.eventType === 'record_disclosure' && 
        !log.legalBasis.includes('§99') && 
        !log.legalBasis.toLowerCase().includes('consent')
      );
      
      if (suspiciousDisclosures.length > 0) {
        violations.push({
          violation: 'Disclosure without clear legal basis',
          details: {
            disclosureCount: suspiciousDisclosures.length
          },
          logs: suspiciousDisclosures
        });
      }
      
      return violations;
      
    } catch (error) {
      console.error('FERPAAuditLogger: Error detecting violations:', error);
      throw error;
    }
  }
}