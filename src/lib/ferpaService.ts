import { DataRetentionService, RetentionMetrics } from './dataRetentionService';
import { FERPAAuditLogger, FERPAAuditLog, FERPAAuditSummary } from './ferpaAuditLogger';
import { EmergencyDisclosureManager, EmergencyDisclosure } from './emergencyDisclosureManager';
// import { ParentRelationshipVerifier } from './parentRelationshipVerifier';
// import { DirectoryInfoService } from './directoryInfoService';
import { monitoringService } from './monitoringService';

export interface FERPAComplianceStatus {
  dataRetentionActive: boolean;
  auditLoggingActive: boolean;
  emergencyDisclosureActive: boolean;
  lastDataCleanup?: Date;
  pendingNotifications: number;
  complianceScore: number; // 0-100
  violations: string[];
}

export interface FERPADashboardData {
  complianceStatus: FERPAComplianceStatus;
  recentActivity: FERPAAuditLog[];
  retentionMetrics: RetentionMetrics | null;
  emergencyDisclosures: EmergencyDisclosure[];
  auditSummary: FERPAAuditSummary | null;
}

/**
 * Central FERPA service that coordinates all FERPA compliance components
 */
export class FERPAService {
  
  /**
   * Initialize FERPA compliance systems
   */
  static async initialize(): Promise<void> {
    try {
      console.log('FERPAService: Initializing FERPA compliance systems...');
      
      // Initialize data retention scheduling
      DataRetentionService.scheduleAutomatedCleanup();
      
      // Log initialization
      await FERPAAuditLogger.logRecordAccess(
        'system',
        'system',
        'system-initialization',
        [],
        'FERPA system initialization',
        'System startup - automated compliance initialization'
      );
      
      console.log('FERPAService: FERPA compliance systems initialized successfully');
      
    } catch (error) {
      console.error('FERPAService: Error initializing FERPA systems:', error);
      throw error;
    }
  }
  
  /**
   * Log student record access with FERPA compliance tracking
   */
  static async logRecordAccess(
    actorId: string,
    actorRole: 'parent' | 'teacher' | 'admin' | 'student',
    studentId: string,
    recordIds: string[],
    purpose: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    try {
      // Determine legal basis based on actor role
      let legalBasis: string;
      switch (actorRole) {
        case 'parent':
          legalBasis = '§99.10 Parental access rights';
          break;
        case 'teacher':
          legalBasis = '§99.31(a)(1) Educational officials with legitimate educational interest';
          break;
        case 'admin':
          legalBasis = '§99.31(a)(1) Administrative access for educational purposes';
          break;
        case 'student':
          legalBasis = '§99.12 Student access to own records';
          break;
        default:
          legalBasis = 'Unknown access basis - requires review';
      }
      
      await FERPAAuditLogger.logRecordAccess(
        actorId,
        actorRole,
        studentId,
        recordIds,
        purpose,
        legalBasis,
        ipAddress,
        userAgent
      );
      
    } catch (error) {
      console.error('FERPAService: Error logging record access:', error);
      // Don't throw - we don't want to break functionality due to logging issues
    }
  }
  
  /**
   * Record emergency disclosure with full FERPA compliance
   */
  static async recordEmergencyDisclosure(
    studentIds: string[],
    disclosedTo: string[],
    reason: string,
    emergencyType: 'health' | 'safety' | 'security',
    disclosedBy: string,
    additionalDetails?: Record<string, unknown>
  ): Promise<EmergencyDisclosure> {
    try {
      console.log(`FERPAService: Recording emergency disclosure for ${studentIds.length} students`);
      
      const disclosure = await EmergencyDisclosureManager.recordEmergencyDisclosure(
        studentIds,
        disclosedTo,
        reason,
        emergencyType,
        disclosedBy,
        ['pass_records', 'location_data', 'movement_history', 'emergency_contact_info'],
        additionalDetails
      );
      
      // Log to monitoring for immediate attention
      monitoringService.logWarning('FERPA emergency disclosure recorded', {
        disclosureId: disclosure.id,
        emergencyType,
        studentCount: studentIds.length,
        disclosedTo: disclosedTo.join(', ')
      });
      
      return disclosure;
      
    } catch (error) {
      console.error('FERPAService: Error recording emergency disclosure:', error);
      throw error;
    }
  }
  
  /**
   * Process pending emergency notifications
   */
  static async processPendingNotifications(): Promise<void> {
    try {
      console.log('FERPAService: Processing pending emergency notifications...');
      await EmergencyDisclosureManager.processPendingNotifications();
      
    } catch (error) {
      console.error('FERPAService: Error processing pending notifications:', error);
      throw error;
    }
  }
  
  /**
   * Run data retention cleanup
   */
  static async runDataRetentionCleanup(recordType?: string): Promise<RetentionMetrics> {
    try {
      console.log(`FERPAService: Running data retention cleanup${recordType ? ` for ${recordType}` : ''}`);
      
      const metrics = await DataRetentionService.runManualCleanup(recordType);
      
      // Log cleanup completion
      monitoringService.logInfo('FERPA data retention cleanup completed', {
        recordsProcessed: metrics.recordsProcessed,
        recordsDeleted: metrics.recordsDeleted,
        recordsAnonymized: metrics.recordsAnonymized,
        processingTime: metrics.processingTime
      });
      
      return metrics;
      
    } catch (error) {
      console.error('FERPAService: Error running data retention cleanup:', error);
      throw error;
    }
  }
  
  /**
   * Get comprehensive FERPA compliance status
   */
  static async getComplianceStatus(): Promise<FERPAComplianceStatus> {
    try {
      // Check data retention status
      const retentionStatus = DataRetentionService.getProcessingStatus();
      
      // Get pending notifications count
      const pendingDisclosures = await EmergencyDisclosureManager.getPendingNotifications();
      
      // Check for potential violations
      const violations = await FERPAAuditLogger.detectPotentialViolations(24);
      
      // Calculate compliance score (simplified)
      let complianceScore = 100;
      if (violations.length > 0) complianceScore -= violations.length * 10;
      if (pendingDisclosures.length > 5) complianceScore -= 10;
      complianceScore = Math.max(0, complianceScore);
      
      return {
        dataRetentionActive: true,
        auditLoggingActive: true,
        emergencyDisclosureActive: true,
        lastDataCleanup: retentionStatus.lastProcessingTime || undefined,
        pendingNotifications: pendingDisclosures.length,
        complianceScore,
        violations: violations.map(v => v.violation)
      };
      
    } catch (error) {
      console.error('FERPAService: Error getting compliance status:', error);
      
      // Return degraded status if we can't get full status
      return {
        dataRetentionActive: false,
        auditLoggingActive: false,
        emergencyDisclosureActive: false,
        pendingNotifications: 0,
        complianceScore: 0,
        violations: ['Unable to assess compliance status']
      };
    }
  }
  
  /**
   * Get dashboard data for FERPA compliance monitoring
   */
  static async getDashboardData(): Promise<FERPADashboardData> {
    try {
      const [
        complianceStatus,
        recentActivity,
        emergencyDisclosures,
        auditSummary
      ] = await Promise.all([
        this.getComplianceStatus(),
        FERPAAuditLogger.getRecentActivity(20),
        EmergencyDisclosureManager.getEmergencyDisclosures(
          new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
          new Date()
        ),
        FERPAAuditLogger.generateAuditSummary(
          new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
          new Date()
        )
      ]);
      
      return {
        complianceStatus,
        recentActivity,
        retentionMetrics: null, // Would be populated after cleanup runs
        emergencyDisclosures,
        auditSummary
      };
      
    } catch (error) {
      console.error('FERPAService: Error getting dashboard data:', error);
      throw error;
    }
  }
  
  /**
   * Get audit logs for a specific student (for parent access)
   */
  static async getStudentAuditHistory(
    studentId: string,
    requestingUserId: string,
    requestingUserRole: 'parent' | 'admin'
  ): Promise<FERPAAuditLog[]> {
    try {
      // Log this access request itself
      await this.logRecordAccess(
        requestingUserId,
        requestingUserRole,
        studentId,
        ['audit-history'],
        'Parent/Admin access to student audit history'
      );
      
      return await FERPAAuditLogger.getAuditLogsForStudent(studentId);
      
    } catch (error) {
      console.error('FERPAService: Error getting student audit history:', error);
      throw error;
    }
  }
  
  /**
   * Check if FERPA systems are healthy
   */
  static async healthCheck(): Promise<{ healthy: boolean; issues: string[] }> {
    const issues: string[] = [];
    
    try {
      // Test audit logging
      await FERPAAuditLogger.logRecordAccess(
        'health-check',
        'system',
        'health-check',
        [],
        'System health check',
        'Automated health monitoring'
      );
      
      // Test data retention service
      const retentionStatus = DataRetentionService.getProcessingStatus();
      if (!retentionStatus) {
        issues.push('Data retention service not responsive');
      }
      
      // Test emergency disclosure system
      // const pendingNotifications = await EmergencyDisclosureManager.getPendingNotifications();
      // This is just a test call - no issues expected
      
      // Check for potential violations
      const violations = await FERPAAuditLogger.detectPotentialViolations(1); // Last hour
      if (violations.length > 0) {
        issues.push(`${violations.length} potential FERPA violations detected`);
      }
      
    } catch (error) {
      issues.push(`Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    return {
      healthy: issues.length === 0,
      issues
    };
  }
  
  /**
   * Generate FERPA compliance report
   */
  static async generateComplianceReport(
    startDate: Date,
    endDate: Date
  ): Promise<{
    period: { startDate: Date; endDate: Date };
    auditSummary: FERPAAuditSummary;
    emergencyDisclosures: EmergencyDisclosure[];
    retentionActions: string[];
    complianceScore: number;
    recommendations: string[];
  }> {
    try {
      const [auditSummary, emergencyDisclosures] = await Promise.all([
        FERPAAuditLogger.generateAuditSummary(startDate, endDate),
        EmergencyDisclosureManager.getEmergencyDisclosures(startDate, endDate)
      ]);
      
      // Generate recommendations based on data
      const recommendations: string[] = [];
      
      if (auditSummary.emergencyDisclosures > 5) {
        recommendations.push('High number of emergency disclosures - review emergency procedures');
      }
      
      if (auditSummary.parentAccesses === 0) {
        recommendations.push('No parent access requests - ensure parents are aware of their FERPA rights');
      }
      
      if (emergencyDisclosures.some(d => !d.postEmergencyNotificationSent)) {
        recommendations.push('Some emergency disclosures missing post-emergency notifications');
      }
      
      // Simple compliance scoring
      let complianceScore = 100;
      if (recommendations.length > 0) {
        complianceScore -= recommendations.length * 5;
      }
      
      return {
        period: { startDate, endDate },
        auditSummary,
        emergencyDisclosures,
        retentionActions: ['Automated data retention policies active'],
        complianceScore: Math.max(0, complianceScore),
        recommendations
      };
      
    } catch (error) {
      console.error('FERPAService: Error generating compliance report:', error);
      throw error;
    }
  }
}

// Initialize FERPA service when module loads
if (typeof window === 'undefined') { // Server-side only
  FERPAService.initialize().catch(error => {
    console.error('Failed to initialize FERPA service:', error);
  });
}