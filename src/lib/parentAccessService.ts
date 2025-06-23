import { collection, doc, setDoc, getDocs, query, where, orderBy, limit, updateDoc, Timestamp } from 'firebase/firestore';
import { db, getUserById, getPassesByStudentName } from '@/lib/firebase/firestore';
import { FERPAAuditLogger } from './ferpaAuditLogger';
// import { NotificationService } from './notificationService';
import { monitoringService } from './monitoringService';
import { User, Pass, EventLog } from '@/types';

export interface ParentAccessRequest {
  id: string;
  parentId: string;
  parentEmail: string;
  studentId: string;
  studentName: string;
  requestType: 'inspection' | 'review' | 'correction' | 'copy';
  requestDate: Date;
  status: 'pending' | 'approved' | 'completed' | 'denied';
  responseDeadline: Date; // 45 days max per FERPA
  purpose: string;
  requestDetails?: string;
  adminNotes?: string;
  completedAt?: Date;
  denialReason?: string;
  recordsProvided?: string[];
  schoolYear: string;
}

export interface RecordCorrectionRequest {
  id: string;
  parentAccessRequestId: string;
  parentId: string;
  studentId: string;
  recordId: string;
  recordType: string; // 'pass', 'eventLog', etc.
  fieldName: string;
  currentValue: string;
  requestedValue: string;
  justification: string;
  status: 'pending' | 'approved' | 'denied' | 'completed';
  submittedAt: Date;
  reviewedBy?: string;
  reviewedAt?: Date;
  reviewNotes?: string;
  schoolYear: string;
}

export interface ParentStudentRelationship {
  parentId: string;
  parentEmail: string;
  studentId: string;
  studentName: string;
  relationshipType: 'parent' | 'guardian' | 'authorized_representative';
  verifiedAt: Date;
  verificationMethod: 'school_records' | 'admin_confirmation' | 'document_verification';
  active: boolean;
  schoolYear: string;
}

export class ParentAccessService {
  
  /**
   * Submit a parent access request for student records
   */
  static async submitAccessRequest(
    parentId: string,
    parentEmail: string,
    studentId: string,
    requestType: ParentAccessRequest['requestType'],
    purpose: string,
    requestDetails?: string
  ): Promise<ParentAccessRequest> {
    try {
      // Verify parent-student relationship
      const relationship = await this.verifyParentStudentRelationship(parentId, studentId);
      if (!relationship) {
        throw new Error('No verified parent-student relationship found');
      }

      // Get student information
      const student = await getUserById(studentId);
      if (!student) {
        throw new Error('Student not found');
      }

      // Calculate response deadline (45 days per FERPA)
      const responseDeadline = new Date();
      responseDeadline.setDate(responseDeadline.getDate() + 45);

      const accessRequest: ParentAccessRequest = {
        id: this.generateRequestId(),
        parentId,
        parentEmail,
        studentId,
        studentName: this.getStudentDisplayName(student),
        requestType,
        requestDate: new Date(),
        status: 'pending',
        responseDeadline,
        purpose,
        requestDetails,
        schoolYear: this.getCurrentSchoolYear()
      };

      // Store the request
      await this.storeAccessRequest(accessRequest);

      // Log to FERPA audit system
      await FERPAAuditLogger.logRecordAccess(
        parentId,
        'parent',
        studentId,
        [], // Will be populated when records are provided
        `Parent access request - ${requestType}`,
        '§99.10 Parental access rights'
      );

      // Notify administrators
      await this.notifyAdministrators(accessRequest);

      console.log(`ParentAccessService: Created access request ${accessRequest.id} for parent ${parentId}`);

      return accessRequest;

    } catch (error) {
      console.error('ParentAccessService: Error submitting access request:', error);
      throw error;
    }
  }

  /**
   * Get student records for parent access (after approval)
   */
  static async getStudentRecordsForParent(
    parentId: string,
    studentId: string,
    accessRequestId: string
  ): Promise<{
    student: User;
    passes: Pass[];
    eventLogs: EventLog[];
    ferpaNotice: string;
    accessSummary: {
      totalRecords: number;
      recordTypes: string[];
      accessDate: Date;
    };
  }> {
    try {
      // Verify the access request is approved
      const accessRequest = await this.getAccessRequest(accessRequestId);
      if (!accessRequest || accessRequest.status !== 'approved') {
        throw new Error('Access request not found or not approved');
      }

      // Verify parent-student relationship
      const relationship = await this.verifyParentStudentRelationship(parentId, studentId);
      if (!relationship) {
        throw new Error('No verified parent-student relationship found');
      }

      // Get student information
      const student = await getUserById(studentId);
      if (!student) {
        throw new Error('Student not found');
      }

      // Get student pass records
      const passes = await getPassesByStudentName(this.getStudentDisplayName(student));

      // Get event logs (limited to student-related events)
      const eventLogs = await this.getStudentEventLogs(studentId);

      // Log this access for FERPA compliance
      const recordIds = [
        ...passes.map(p => p.id),
        ...eventLogs.map(e => e.id)
      ];

      await FERPAAuditLogger.logRecordAccess(
        parentId,
        'parent',
        studentId,
        recordIds,
        `Parent record access - request ${accessRequestId}`,
        '§99.10 Parental access rights - approved request'
      );

      // Update access request status
      await this.markAccessRequestCompleted(accessRequestId, recordIds);

      const accessSummary = {
        totalRecords: passes.length + eventLogs.length,
        recordTypes: ['passes', 'eventLogs'],
        accessDate: new Date()
      };

      console.log(`ParentAccessService: Provided ${accessSummary.totalRecords} records to parent ${parentId} for student ${studentId}`);

      return {
        student,
        passes,
        eventLogs,
        ferpaNotice: this.getFERPANoticeText(),
        accessSummary
      };

    } catch (error) {
      console.error('ParentAccessService: Error getting student records for parent:', error);
      throw error;
    }
  }

  /**
   * Submit a record correction request
   */
  static async submitRecordCorrectionRequest(
    parentId: string,
    studentId: string,
    recordId: string,
    recordType: string,
    fieldName: string,
    currentValue: string,
    requestedValue: string,
    justification: string
  ): Promise<RecordCorrectionRequest> {
    try {
      // Verify parent-student relationship
      const relationship = await this.verifyParentStudentRelationship(parentId, studentId);
      if (!relationship) {
        throw new Error('No verified parent-student relationship found');
      }

      // Verify access request exists and is approved
      const accessRequest = await this.getAccessRequest(''); // Should be passed or looked up
      if (!accessRequest) {
        throw new Error('No approved parent access request found');
      }

      // Get student information
      const student = await getUserById(studentId);
      if (!student) {
        throw new Error('Student not found');
      }

      const correctionRequest: RecordCorrectionRequest = {
        id: this.generateCorrectionId(),
        parentAccessRequestId: '', // Will be linked if part of an access request
        parentId,
        studentId,
        recordId,
        recordType,
        fieldName,
        currentValue,
        requestedValue,
        justification,
        status: 'pending',
        submittedAt: new Date(),
        schoolYear: this.getCurrentSchoolYear()
      };

      // Store the correction request
      await this.storeCorrectionRequest(correctionRequest);

      // Log to FERPA audit system
      await FERPAAuditLogger.logRecordCorrection(
        parentId,
        'parent',
        studentId,
        recordId,
        fieldName,
        currentValue,
        requestedValue,
        'requested'
      );

      // Notify administrators
      await this.notifyAdministratorsOfCorrection(correctionRequest);

      console.log(`ParentAccessService: Created correction request ${correctionRequest.id}`);

      return correctionRequest;

    } catch (error) {
      console.error('ParentAccessService: Error submitting correction request:', error);
      throw error;
    }
  }

  /**
   * Verify parent-student relationship
   */
  static async verifyParentStudentRelationship(
    parentId: string,
    studentId: string
  ): Promise<ParentStudentRelationship | null> {
    // Query Firestore for a verified, active relationship
    const q = query(
      collection(db, 'parentStudentRelationships'),
      where('parentId', '==', parentId),
      where('studentId', '==', studentId),
      where('active', '==', true)
    );
    const snapshot = await getDocs(q);
    if (snapshot.docs.length > 0) {
      return snapshot.docs[0].data() as ParentStudentRelationship;
    }
    return null;
  }

  /**
   * Get access requests for a parent
   */
  static async getParentAccessRequests(
    parentId: string,
    limit_count: number = 20
  ): Promise<ParentAccessRequest[]> {
    try {
      const requestsRef = collection(db, 'parentAccessRequests');
      const q = query(
        requestsRef,
        where('parentId', '==', parentId),
        orderBy('requestDate', 'desc'),
        limit(limit_count)
      );

      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          requestDate: data.requestDate.toDate(),
          responseDeadline: data.responseDeadline.toDate(),
          completedAt: data.completedAt?.toDate()
        } as ParentAccessRequest;
      });

    } catch (error) {
      console.error('ParentAccessService: Error getting parent access requests:', error);
      throw error;
    }
  }

  /**
   * Get pending access requests (for admin)
   */
  static async getPendingAccessRequests(): Promise<ParentAccessRequest[]> {
    try {
      const requestsRef = collection(db, 'parentAccessRequests');
      const q = query(
        requestsRef,
        where('status', '==', 'pending'),
        orderBy('requestDate', 'desc')
      );

      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          requestDate: data.requestDate.toDate(),
          responseDeadline: data.responseDeadline.toDate(),
          completedAt: data.completedAt?.toDate()
        } as ParentAccessRequest;
      });

    } catch (error) {
      console.error('ParentAccessService: Error getting pending access requests:', error);
      throw error;
    }
  }

  /**
   * Approve an access request (admin action)
   */
  static async approveAccessRequest(
    requestId: string,
    adminId: string,
    adminNotes?: string
  ): Promise<void> {
    try {
      const requestRef = doc(db, 'parentAccessRequests', requestId);
      
      await updateDoc(requestRef, {
        status: 'approved',
        adminNotes: adminNotes || '',
        approvedBy: adminId,
        approvedAt: Timestamp.fromDate(new Date())
      });

      // Get request details for logging
      const accessRequest = await this.getAccessRequest(requestId);
      if (accessRequest) {
        await FERPAAuditLogger.logRecordAccess(
          adminId,
          'admin',
          accessRequest.studentId,
          [],
          `Access request approved - ${requestId}`,
          '§99.10 Administrative approval of parent access request'
        );

        // Notify parent of approval
        await this.notifyParentOfApproval(accessRequest);
      }

      console.log(`ParentAccessService: Access request ${requestId} approved by admin ${adminId}`);

    } catch (error) {
      console.error('ParentAccessService: Error approving access request:', error);
      throw error;
    }
  }

  /**
   * Store access request in Firestore
   */
  private static async storeAccessRequest(request: ParentAccessRequest): Promise<void> {
    try {
        const firestoreRequest = {
          ...request,
          requestDate: Timestamp.fromDate(request.requestDate),
          responseDeadline: Timestamp.fromDate(request.responseDeadline),
          completedAt: request.completedAt ? Timestamp.fromDate(request.completedAt) : null
        };
        
        await setDoc(doc(collection(db, 'parentAccessRequests'), request.id), firestoreRequest);

    } catch (error) {
      console.error('ParentAccessService: Error storing access request:', error);
      throw error;
    }
  }

  /**
   * Store correction request in Firestore
   */
  private static async storeCorrectionRequest(request: RecordCorrectionRequest): Promise<void> {
    try {
      const firestoreRequest = {
        ...request,
        submittedAt: Timestamp.fromDate(request.submittedAt),
        reviewedAt: request.reviewedAt ? Timestamp.fromDate(request.reviewedAt) : null
      };
      
      await setDoc(doc(collection(db, 'recordCorrectionRequests'), request.id), firestoreRequest);

    } catch (error) {
      console.error('ParentAccessService: Error storing correction request:', error);
      throw error;
    }
  }

  /**
   * Get a specific access request
   */
  private static async getAccessRequest(requestId: string): Promise<ParentAccessRequest | null> {
    try {
      const requestSnap = await getDocs(query(collection(db, 'parentAccessRequests'), where('id', '==', requestId)));
      
      if (requestSnap.empty) {
        return null;
      }

      const data = requestSnap.docs[0].data();
      return {
        ...data,
        requestDate: data.requestDate.toDate(),
        responseDeadline: data.responseDeadline.toDate(),
        completedAt: data.completedAt?.toDate()
      } as ParentAccessRequest;

    } catch (error) {
      console.error('ParentAccessService: Error getting access request:', error);
      return null;
    }
  }

  /**
   * Get student event logs (filtered for appropriate events)
   */
  private static async getStudentEventLogs(studentId: string): Promise<EventLog[]> {
    try {
      const eventLogsRef = collection(db, 'eventLogs');
      const q = query(
        eventLogsRef,
        where('studentId', '==', studentId),
        orderBy('timestamp', 'desc'),
        limit(100) // Reasonable limit for parent review
      );

      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp.toDate()
      }) as EventLog);

    } catch (error) {
      console.error('ParentAccessService: Error getting student event logs:', error);
      return [];
    }
  }

  /**
   * Mark access request as completed
   */
  private static async markAccessRequestCompleted(
    requestId: string,
    recordIds: string[]
  ): Promise<void> {
    try {
      await updateDoc(doc(db, 'parentAccessRequests', requestId), {
        status: 'completed',
        completedAt: Timestamp.fromDate(new Date()),
        recordsProvided: recordIds
      });

    } catch (error) {
      console.error('ParentAccessService: Error marking request completed:', error);
    }
  }

  /**
   * Notify administrators of new access request
   */
  private static async notifyAdministrators(request: ParentAccessRequest): Promise<void> {
    try {
      // In a real implementation, this would send emails to administrators
      console.log(`ParentAccessService: Notifying administrators of access request ${request.id}`);
      
      // Log for monitoring
      monitoringService.logInfo('Parent access request submitted', {
        requestId: request.id,
        parentId: request.parentId,
        studentId: request.studentId,
        requestType: request.requestType
      });

    } catch (error) {
      console.error('ParentAccessService: Error notifying administrators:', error);
    }
  }

  /**
   * Notify administrators of correction request
   */
  private static async notifyAdministratorsOfCorrection(request: RecordCorrectionRequest): Promise<void> {
    try {
      console.log(`ParentAccessService: Notifying administrators of correction request ${request.id}`);
      
      monitoringService.logInfo('Record correction request submitted', {
        requestId: request.id,
        parentId: request.parentId,
        studentId: request.studentId,
        recordType: request.recordType,
        fieldName: request.fieldName
      });

    } catch (error) {
      console.error('ParentAccessService: Error notifying administrators of correction:', error);
    }
  }

  /**
   * Notify parent of request approval
   */
  private static async notifyParentOfApproval(request: ParentAccessRequest): Promise<void> {
    try {
      // In a real implementation, send email notification
      console.log(`ParentAccessService: Notifying parent ${request.parentEmail} of approval for request ${request.id}`);

    } catch (error) {
      console.error('ParentAccessService: Error notifying parent of approval:', error);
    }
  }

  /**
   * Generate unique request ID
   */
  private static generateRequestId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    return `par-${timestamp}-${random}`;
  }

  /**
   * Generate unique correction ID
   */
  private static generateCorrectionId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    return `cor-${timestamp}-${random}`;
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
   * Get FERPA notice text for parent access
   */
  private static getFERPANoticeText(): string {
    return `
FERPA Rights Notice:

As a parent, you have the right under the Family Educational Rights and Privacy Act (FERPA) to:

• Inspect and review your child's educational records maintained by the school
• Request corrections to records you believe are inaccurate or misleading
• Have some control over the disclosure of personally identifiable information from your child's records
• File a complaint with the U.S. Department of Education if you believe your rights have been violated

These records are protected under FERPA and may not be shared with unauthorized third parties without your written consent, except as permitted by law.

For questions about these records or your FERPA rights, please contact the school administration.
    `.trim();
  }
}