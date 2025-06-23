import { ParentAccessService } from '../parentAccessService';
import { FERPAAuditLogger } from '../ferpaAuditLogger';
import { monitoringService } from '../monitoringService';

jest.mock('../ferpaAuditLogger');
jest.mock('../monitoringService');
jest.mock('@/lib/firebase/firestore', () => ({
  db: {},
  getUserById: jest.fn(),
  getPassesByStudentName: jest.fn(),
  collection: jest.fn(),
  doc: jest.fn(),
  setDoc: jest.fn(),
  getDocs: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
  updateDoc: jest.fn(),
  Timestamp: { fromDate: jest.fn(() => ({ toDate: () => new Date() })) }
}));

describe('ParentAccessService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('submitAccessRequest', () => {
    it('should create and store a parent access request', async () => {
      jest.spyOn(ParentAccessService as any, 'verifyParentStudentRelationship').mockResolvedValue({});
      require('@/lib/firebase/firestore').getUserById.mockResolvedValue({ id: 's1', name: 'Student' });
      const storeSpy = jest.spyOn(ParentAccessService as any, 'storeAccessRequest').mockResolvedValue(undefined);
      jest.spyOn(FERPAAuditLogger, 'logRecordAccess').mockResolvedValue(undefined);
      const notifySpy = jest.spyOn(ParentAccessService as any, 'notifyAdministrators').mockResolvedValue(undefined);
      const req = await ParentAccessService.submitAccessRequest('p1', 'parent@example.com', 's1', 'inspection', 'purpose', 'details');
      expect(storeSpy).toHaveBeenCalled();
      expect(notifySpy).toHaveBeenCalled();
      expect(req).toHaveProperty('id');
      expect(req.status).toBe('pending');
    });
    it('should throw if no parent-student relationship', async () => {
      jest.spyOn(ParentAccessService as any, 'verifyParentStudentRelationship').mockResolvedValue(null);
      await expect(
        ParentAccessService.submitAccessRequest('p1', 'parent@example.com', 's1', 'inspection', 'purpose')
      ).rejects.toThrow('No verified parent-student relationship found');
    });
    it('should throw if student not found', async () => {
      jest.spyOn(ParentAccessService as any, 'verifyParentStudentRelationship').mockResolvedValue({});
      require('@/lib/firebase/firestore').getUserById.mockResolvedValue(null);
      await expect(
        ParentAccessService.submitAccessRequest('p1', 'parent@example.com', 's1', 'inspection', 'purpose')
      ).rejects.toThrow('Student not found');
    });
  });

  describe('getStudentRecordsForParent', () => {
    it('should return student records for approved request', async () => {
      jest.spyOn(ParentAccessService as any, 'getAccessRequest').mockResolvedValue({ status: 'approved' });
      jest.spyOn(ParentAccessService as any, 'verifyParentStudentRelationship').mockResolvedValue({});
      require('@/lib/firebase/firestore').getUserById.mockResolvedValue({ id: 's1', name: 'Student' });
      require('@/lib/firebase/firestore').getPassesByStudentName.mockResolvedValue([{ id: 'p1' }]);
      jest.spyOn(ParentAccessService as any, 'getStudentEventLogs').mockResolvedValue([{ id: 'e1' }]);
      jest.spyOn(FERPAAuditLogger, 'logRecordAccess').mockResolvedValue(undefined);
      jest.spyOn(ParentAccessService as any, 'markAccessRequestCompleted').mockResolvedValue(undefined);
      const result = await ParentAccessService.getStudentRecordsForParent('p1', 's1', 'ar1');
      expect(result.student).toHaveProperty('id', 's1');
      expect(result.passes.length).toBe(1);
      expect(result.eventLogs.length).toBe(1);
      expect(result.accessSummary.totalRecords).toBe(2);
    });
    it('should throw if access request is not approved', async () => {
      jest.spyOn(ParentAccessService as any, 'getAccessRequest').mockResolvedValue({ status: 'pending' });
      await expect(
        ParentAccessService.getStudentRecordsForParent('p1', 's1', 'ar1')
      ).rejects.toThrow('Access request not found or not approved');
    });
    it('should throw if no parent-student relationship', async () => {
      jest.spyOn(ParentAccessService as any, 'getAccessRequest').mockResolvedValue({ status: 'approved' });
      jest.spyOn(ParentAccessService as any, 'verifyParentStudentRelationship').mockResolvedValue(null);
      await expect(
        ParentAccessService.getStudentRecordsForParent('p1', 's1', 'ar1')
      ).rejects.toThrow('No verified parent-student relationship found');
    });
    it('should throw if student not found', async () => {
      jest.spyOn(ParentAccessService as any, 'getAccessRequest').mockResolvedValue({ status: 'approved' });
      jest.spyOn(ParentAccessService as any, 'verifyParentStudentRelationship').mockResolvedValue({});
      require('@/lib/firebase/firestore').getUserById.mockResolvedValue(null);
      await expect(
        ParentAccessService.getStudentRecordsForParent('p1', 's1', 'ar1')
      ).rejects.toThrow('Student not found');
    });
  });

  describe('submitRecordCorrectionRequest', () => {
    it('should create and store a record correction request', async () => {
      jest.spyOn(ParentAccessService as any, 'verifyParentStudentRelationship').mockResolvedValue({});
      jest.spyOn(ParentAccessService as any, 'getAccessRequest').mockResolvedValue({ status: 'approved', parentId: 'p1', studentId: 's1' });
      require('@/lib/firebase/firestore').getUserById.mockResolvedValue({ id: 's1', name: 'Student' });
      const storeSpy = jest.spyOn(ParentAccessService as any, 'storeCorrectionRequest').mockResolvedValue(undefined);
      jest.spyOn(FERPAAuditLogger, 'logRecordCorrection').mockResolvedValue(undefined);
      const notifySpy = jest.spyOn(ParentAccessService as any, 'notifyAdministratorsOfCorrection').mockResolvedValue(undefined);
      const req = await ParentAccessService.submitRecordCorrectionRequest('p1', 's1', 'rec1', 'pass', 'field', 'old', 'new', 'justification');
      expect(storeSpy).toHaveBeenCalled();
      expect(notifySpy).toHaveBeenCalled();
      expect(req).toHaveProperty('id');
      expect(req.status).toBe('pending');
    });
    it('should throw if no parent-student relationship', async () => {
      jest.spyOn(ParentAccessService as any, 'verifyParentStudentRelationship').mockResolvedValue(null);
      await expect(
        ParentAccessService.submitRecordCorrectionRequest('p1', 's1', 'rec1', 'pass', 'field', 'old', 'new', 'justification')
      ).rejects.toThrow('No verified parent-student relationship found');
    });
    it('should throw if no access request', async () => {
      jest.spyOn(ParentAccessService as any, 'verifyParentStudentRelationship').mockResolvedValue({});
      jest.spyOn(ParentAccessService as any, 'getAccessRequest').mockResolvedValue(null);
      await expect(
        ParentAccessService.submitRecordCorrectionRequest('p1', 's1', 'rec1', 'pass', 'field', 'old', 'new', 'justification')
      ).rejects.toThrow('No approved parent access request found');
    });
    it('should throw if student not found', async () => {
      jest.spyOn(ParentAccessService as any, 'verifyParentStudentRelationship').mockResolvedValue({});
      jest.spyOn(ParentAccessService as any, 'getAccessRequest').mockResolvedValue({ status: 'approved', parentId: 'p1', studentId: 's1' });
      require('@/lib/firebase/firestore').getUserById.mockResolvedValue(null);
      await expect(
        ParentAccessService.submitRecordCorrectionRequest('p1', 's1', 'rec1', 'pass', 'field', 'old', 'new', 'justification')
      ).rejects.toThrow('Student not found');
    });
  });

  describe('verifyParentStudentRelationship', () => {
    beforeAll(() => {
      jest.restoreAllMocks();
    });
    let getDocs: jest.Mock;
    beforeEach(() => {
      getDocs = require('firebase/firestore').getDocs;
      getDocs.mockReset();
    });
    it('should return a relationship if found', async () => {
      const mockRelationship = {
        parentId: 'p1',
        parentEmail: 'parent@example.com',
        studentId: 's1',
        studentName: 'Student',
        relationshipType: 'parent',
        verifiedAt: new Date(),
        verificationMethod: 'admin_confirmation',
        active: true,
        schoolYear: '2024-2025'
      };
      getDocs.mockResolvedValue({ docs: [{ data: () => mockRelationship }] });
      const result = await ParentAccessService.verifyParentStudentRelationship('p1', 's1');
      expect(result).toEqual(mockRelationship);
    });
    it('should return null if no relationship found', async () => {
      getDocs.mockResolvedValue({ docs: [] });
      const result = await ParentAccessService.verifyParentStudentRelationship('p1', 's1');
      expect(result).toBeNull();
    });
    it('should throw if db error occurs', async () => {
      getDocs.mockRejectedValue(new Error('db error'));
      await expect(
        ParentAccessService.verifyParentStudentRelationship('p1', 's1')
      ).rejects.toThrow('db error');
    });
  });

  describe('getParentAccessRequests', () => {
    let getDocs: jest.Mock;
    beforeEach(() => {
      getDocs = require('firebase/firestore').getDocs;
      getDocs.mockReset();
    });
    it('should return an array of requests if found', async () => {
      const mockRequest = {
        id: 'req1',
        parentId: 'p1',
        parentEmail: 'parent@example.com',
        studentId: 's1',
        studentName: 'Student',
        requestType: 'inspection',
        requestDate: { toDate: () => new Date('2024-01-01') },
        status: 'pending',
        responseDeadline: { toDate: () => new Date('2024-02-01') },
        purpose: 'purpose',
        schoolYear: '2024-2025',
        completedAt: { toDate: () => new Date('2024-03-01') }
      };
      getDocs.mockResolvedValue({ docs: [{ data: () => mockRequest }] });
      const result = await ParentAccessService.getParentAccessRequests('p1');
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(1);
      expect(result[0].id).toBe('req1');
      expect(result[0].requestDate).toBeInstanceOf(Date);
      expect(result[0].responseDeadline).toBeInstanceOf(Date);
      expect(result[0].completedAt).toBeInstanceOf(Date);
    });
    it('should return an empty array if no requests found', async () => {
      getDocs.mockResolvedValue({ docs: [] });
      const result = await ParentAccessService.getParentAccessRequests('p1');
      expect(result).toEqual([]);
    });
    it('should throw if db error occurs', async () => {
      getDocs.mockRejectedValue(new Error('db error'));
      await expect(
        ParentAccessService.getParentAccessRequests('p1')
      ).rejects.toThrow('db error');
    });
  });

  describe('getPendingAccessRequests', () => {
    let getDocs: jest.Mock;
    beforeEach(() => {
      getDocs = require('firebase/firestore').getDocs;
      getDocs.mockReset();
    });
    it('should return an array of pending requests if found', async () => {
      const mockRequest = {
        id: 'req2',
        parentId: 'p2',
        parentEmail: 'parent2@example.com',
        studentId: 's2',
        studentName: 'Student2',
        requestType: 'review',
        requestDate: { toDate: () => new Date('2024-04-01') },
        status: 'pending',
        responseDeadline: { toDate: () => new Date('2024-05-01') },
        purpose: 'purpose2',
        schoolYear: '2024-2025',
        completedAt: { toDate: () => new Date('2024-06-01') }
      };
      getDocs.mockResolvedValue({ docs: [{ data: () => mockRequest }] });
      const result = await ParentAccessService.getPendingAccessRequests();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(1);
      expect(result[0].id).toBe('req2');
      expect(result[0].requestDate).toBeInstanceOf(Date);
      expect(result[0].responseDeadline).toBeInstanceOf(Date);
      expect(result[0].completedAt).toBeInstanceOf(Date);
    });
    it('should return an empty array if no pending requests found', async () => {
      getDocs.mockResolvedValue({ docs: [] });
      const result = await ParentAccessService.getPendingAccessRequests();
      expect(result).toEqual([]);
    });
    it('should throw if db error occurs', async () => {
      getDocs.mockRejectedValue(new Error('db error'));
      await expect(
        ParentAccessService.getPendingAccessRequests()
      ).rejects.toThrow('db error');
    });
  });

  describe('approveAccessRequest', () => {
    let updateDoc: jest.Mock;
    let getDocs: jest.Mock;
    beforeEach(() => {
      updateDoc = require('firebase/firestore').updateDoc;
      getDocs = require('firebase/firestore').getDocs;
      updateDoc.mockReset();
      getDocs.mockReset();
    });
    it('should update request, log access, and notify parent on happy path', async () => {
      updateDoc.mockResolvedValue(undefined);
      const mockRequest = {
        id: 'req3',
        parentId: 'p3',
        parentEmail: 'parent3@example.com',
        studentId: 's3',
        studentName: 'Student3',
        requestType: 'copy',
        requestDate: { toDate: () => new Date('2024-07-01') },
        status: 'pending',
        responseDeadline: { toDate: () => new Date('2024-08-01') },
        purpose: 'purpose3',
        schoolYear: '2024-2025',
        completedAt: { toDate: () => new Date('2024-09-01') }
      };
      getDocs.mockResolvedValue({ empty: false, docs: [{ data: () => mockRequest }] });
      jest.spyOn(FERPAAuditLogger, 'logRecordAccess').mockResolvedValue(undefined);
      const notifySpy = jest.spyOn(ParentAccessService as any, 'notifyParentOfApproval').mockResolvedValue(undefined);
      await ParentAccessService.approveAccessRequest('req3', 'admin1', 'notes');
      expect(updateDoc).toHaveBeenCalled();
      expect(FERPAAuditLogger.logRecordAccess).toHaveBeenCalled();
      expect(notifySpy).toHaveBeenCalled();
    });
    it('should not log or notify if request not found', async () => {
      updateDoc.mockResolvedValue(undefined);
      getDocs.mockResolvedValue({ empty: true, docs: [] });
      const logSpy = jest.spyOn(FERPAAuditLogger, 'logRecordAccess');
      const notifySpy = jest.spyOn(ParentAccessService as any, 'notifyParentOfApproval');
      await ParentAccessService.approveAccessRequest('req404', 'admin1', 'notes');
      expect(updateDoc).toHaveBeenCalled();
      expect(logSpy).not.toHaveBeenCalled();
      expect(notifySpy).not.toHaveBeenCalled();
    });
    it('should throw if db error occurs', async () => {
      updateDoc.mockRejectedValue(new Error('db error'));
      await expect(
        ParentAccessService.approveAccessRequest('req3', 'admin1', 'notes')
      ).rejects.toThrow('db error');
    });
  });

  // Additional tests for getStudentRecordsForParent, submitRecordCorrectionRequest, etc. would follow a similar pattern.
}); 