import { FERPAAuditLogger } from '../ferpaAuditLogger';
import { monitoringService } from '../monitoringService';
import { getDocs } from 'firebase/firestore';

jest.mock('../monitoringService', () => ({
  monitoringService: {
    logInfo: jest.fn(),
    logWarning: jest.fn(),
    logError: jest.fn()
  }
}));
jest.mock('@/lib/firebase/config', () => ({
  firebaseApp: {},
  firestore: {},
  auth: {}
}));
jest.mock('@/lib/firebase/firestore', () => ({
  db: {},
  collection: jest.fn(),
  doc: jest.fn(),
  addDoc: jest.fn(),
  getDocs: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
  Timestamp: { fromDate: jest.fn(() => ({ toDate: () => new Date() })) }
}));
jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  doc: jest.fn(),
  addDoc: jest.fn(),
  getDocs: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
  Timestamp: { fromDate: jest.fn(() => ({ toDate: () => new Date() })) }
}));
jest.mock('firebase/performance', () => ({
  getPerformance: jest.fn(() => ({
    trace: jest.fn(() => ({
      start: jest.fn(),
      stop: jest.fn()
    }))
  }))
}));

describe('FERPAAuditLogger', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('logRecordAccess', () => {
    it('should store audit log and log info', async () => {
      const infoSpy = jest.spyOn(monitoringService, 'logInfo').mockImplementation();
      const originalStore = (FERPAAuditLogger as any)['storeAuditLog'];
      (FERPAAuditLogger as any)['storeAuditLog'] = jest.fn().mockResolvedValue(undefined);
      await FERPAAuditLogger.logRecordAccess('id', 'parent', 'sid', ['rid'], 'purpose', 'legal', 'ip', 'ua');
      expect((FERPAAuditLogger as any)['storeAuditLog']).toHaveBeenCalled();
      expect(infoSpy).toHaveBeenCalledWith('FERPA record access logged', expect.objectContaining({ actorRole: 'parent' }));
      (FERPAAuditLogger as any)['storeAuditLog'] = originalStore;
    });
    it('should handle Firestore failure', async () => {
      const error = new Error('Firestore error');
      (FERPAAuditLogger as any)['storeAuditLog'] = jest.fn().mockRejectedValue(error);
      await expect(FERPAAuditLogger.logRecordAccess('id', 'parent', 'sid', ['rid'], 'purpose', 'legal')).rejects.toThrow('Firestore error');
    });
  });

  describe('logRecordDisclosure', () => {
    it('should store audit log and log warning for non-emergency', async () => {
      const warnSpy = jest.spyOn(monitoringService, 'logWarning').mockImplementation();
      const originalStore = (FERPAAuditLogger as any)['storeAuditLog'];
      (FERPAAuditLogger as any)['storeAuditLog'] = jest.fn().mockResolvedValue(undefined);
      await FERPAAuditLogger.logRecordDisclosure('id', 'teacher', ['sid'], ['rid'], 'admin', 'purpose', 'standard disclosure');
      expect((FERPAAuditLogger as any)['storeAuditLog']).toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledWith('FERPA record disclosure', expect.objectContaining({ disclosedTo: 'admin' }));
      (FERPAAuditLogger as any)['storeAuditLog'] = originalStore;
    });
    it('should handle multiple students', async () => {
      const warnSpy = jest.spyOn(monitoringService, 'logWarning').mockImplementation();
      (FERPAAuditLogger as any)['storeAuditLog'] = jest.fn().mockResolvedValue(undefined);
      await FERPAAuditLogger.logRecordDisclosure('id', 'teacher', ['s1', 's2'], ['rid'], 'admin', 'purpose', 'standard disclosure');
      expect((FERPAAuditLogger as any)['storeAuditLog']).toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalled();
    });
    it('should handle Firestore failure', async () => {
      (FERPAAuditLogger as any)['storeAuditLog'] = jest.fn().mockRejectedValue(new Error('fail'));
      await expect(FERPAAuditLogger.logRecordDisclosure('id', 'teacher', ['sid'], ['rid'], 'admin', 'purpose', 'standard disclosure')).rejects.toThrow('fail');
    });
  });

  describe('logEmergencyDisclosure', () => {
    it('should store audit log and log warning', async () => {
      const warnSpy = jest.spyOn(monitoringService, 'logWarning').mockImplementation();
      const originalStore = (FERPAAuditLogger as any)['storeAuditLog'];
      (FERPAAuditLogger as any)['storeAuditLog'] = jest.fn().mockResolvedValue(undefined);
      await FERPAAuditLogger.logEmergencyDisclosure('admin', ['sid'], ['rid'], 'health', 'reason', ['admin']);
      expect((FERPAAuditLogger as any)['storeAuditLog']).toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledWith('FERPA emergency disclosure', expect.objectContaining({ emergencyType: 'health' }));
      (FERPAAuditLogger as any)['storeAuditLog'] = originalStore;
    });
    it('should handle multiple students and recipients', async () => {
      const warnSpy = jest.spyOn(monitoringService, 'logWarning').mockImplementation();
      (FERPAAuditLogger as any)['storeAuditLog'] = jest.fn().mockResolvedValue(undefined);
      await FERPAAuditLogger.logEmergencyDisclosure('admin', ['s1', 's2'], ['rid'], 'safety', 'reason', ['admin', 'nurse']);
      expect((FERPAAuditLogger as any)['storeAuditLog']).toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledWith('FERPA emergency disclosure', expect.objectContaining({ emergencyType: 'safety' }));
    });
    it('should handle Firestore failure', async () => {
      (FERPAAuditLogger as any)['storeAuditLog'] = jest.fn().mockRejectedValue(new Error('fail'));
      await expect(FERPAAuditLogger.logEmergencyDisclosure('admin', ['sid'], ['rid'], 'health', 'reason', ['admin'])).rejects.toThrow('fail');
    });
  });

  describe('logRecordCorrection', () => {
    it('should store audit log', async () => {
      const originalStore = (FERPAAuditLogger as any)['storeAuditLog'];
      (FERPAAuditLogger as any)['storeAuditLog'] = jest.fn().mockResolvedValue(undefined);
      await FERPAAuditLogger.logRecordCorrection('id', 'admin', 'sid', 'rid', 'field', 'old', 'new', 'requested');
      expect((FERPAAuditLogger as any)['storeAuditLog']).toHaveBeenCalled();
      (FERPAAuditLogger as any)['storeAuditLog'] = originalStore;
    });
    it('should handle Firestore failure', async () => {
      (FERPAAuditLogger as any)['storeAuditLog'] = jest.fn().mockRejectedValue(new Error('fail'));
      await expect(FERPAAuditLogger.logRecordCorrection('id', 'admin', 'sid', 'rid', 'field', 'old', 'new', 'requested')).rejects.toThrow('fail');
    });
  });

  describe('logDataDestruction', () => {
    it('should store audit log', async () => {
      const originalStore = (FERPAAuditLogger as any)['storeAuditLog'];
      (FERPAAuditLogger as any)['storeAuditLog'] = jest.fn().mockResolvedValue(undefined);
      await FERPAAuditLogger.logDataDestruction(['rid'], 'type', 'method', 'legal');
      expect((FERPAAuditLogger as any)['storeAuditLog']).toHaveBeenCalled();
      (FERPAAuditLogger as any)['storeAuditLog'] = originalStore;
    });
    it('should log info for bulk destruction', async () => {
      const infoSpy = jest.spyOn(monitoringService, 'logInfo').mockImplementation();
      (FERPAAuditLogger as any)['storeAuditLog'] = jest.fn().mockResolvedValue(undefined);
      const ids = Array.from({ length: 11 }, (_, i) => `id${i}`);
      await FERPAAuditLogger.logDataDestruction(ids, 'type', 'method', 'legal');
      expect(infoSpy).toHaveBeenCalledWith('FERPA bulk data destruction', expect.objectContaining({ recordCount: 11 }));
    });
    it('should handle Firestore failure', async () => {
      (FERPAAuditLogger as any)['storeAuditLog'] = jest.fn().mockRejectedValue(new Error('fail'));
      await expect(FERPAAuditLogger.logDataDestruction(['rid'], 'type', 'method', 'legal')).rejects.toThrow('fail');
    });
  });

  describe('logConsentEvent', () => {
    it('should store audit log', async () => {
      const originalStore = (FERPAAuditLogger as any)['storeAuditLog'];
      (FERPAAuditLogger as any)['storeAuditLog'] = jest.fn().mockResolvedValue(undefined);
      await FERPAAuditLogger.logConsentEvent('pid', 'sid', 'type', 'consent_granted', 'purpose', ['cat']);
      expect((FERPAAuditLogger as any)['storeAuditLog']).toHaveBeenCalled();
      (FERPAAuditLogger as any)['storeAuditLog'] = originalStore;
    });
    it('should store consent_revoked event', async () => {
      (FERPAAuditLogger as any)['storeAuditLog'] = jest.fn().mockResolvedValue(undefined);
      await FERPAAuditLogger.logConsentEvent('pid', 'sid', 'type', 'consent_revoked', 'purpose', ['cat']);
      expect((FERPAAuditLogger as any)['storeAuditLog']).toHaveBeenCalled();
    });
    it('should handle Firestore failure', async () => {
      (FERPAAuditLogger as any)['storeAuditLog'] = jest.fn().mockRejectedValue(new Error('fail'));
      await expect(FERPAAuditLogger.logConsentEvent('pid', 'sid', 'type', 'consent_granted', 'purpose', ['cat'])).rejects.toThrow('fail');
    });
  });

  describe('getAuditLogsForStudent', () => {
    it('should return audit logs for a student', async () => {
      const mockDocs = [
        { data: () => ({ id: '1', eventType: 'record_access', actorId: 'a', actorRole: 'parent', studentId: 's', recordIds: [], purpose: 'p', legalBasis: 'l', timestamp: { toDate: () => new Date() }, schoolYear: '2024-2025' }),
          id: '1' }
      ];
      (getDocs as jest.Mock).mockResolvedValue({ docs: mockDocs });
      const logs = await FERPAAuditLogger.getAuditLogsForStudent('s');
      expect(logs.length).toBe(1);
      expect(logs[0].id).toBe('1');
    });
  });

  describe('getAuditLogsByType', () => {
    it('should return logs filtered by type', async () => {
      const mockDocs = [
        { data: () => ({ id: '1', eventType: 'record_access', actorId: 'a', actorRole: 'parent', studentId: 's', recordIds: [], purpose: 'p', legalBasis: 'l', timestamp: { toDate: () => new Date() }, schoolYear: '2024-2025' }), id: '1' },
        { data: () => ({ id: '2', eventType: 'record_access', actorId: 'b', actorRole: 'teacher', studentId: 's', recordIds: [], purpose: 'p', legalBasis: 'l', timestamp: { toDate: () => new Date() }, schoolYear: '2024-2025' }), id: '2' }
      ];
      (getDocs as jest.Mock).mockResolvedValue({ docs: mockDocs });
      const logs = await FERPAAuditLogger.getAuditLogsByType('record_access');
      expect(logs.length).toBe(2);
      expect(logs[0].eventType).toBe('record_access');
    });
    it('should handle Firestore failure', async () => {
      (getDocs as jest.Mock).mockRejectedValue(new Error('fail'));
      await expect(FERPAAuditLogger.getAuditLogsByType('record_access')).rejects.toThrow('fail');
    });
  });

  describe('generateAuditSummary', () => {
    it('should aggregate logs by event type', async () => {
      const now = new Date();
      const mockDocs = [
        { data: () => ({ eventType: 'record_access', actorRole: 'parent', timestamp: { toDate: () => now } }) },
        { data: () => ({ eventType: 'record_access', actorRole: 'teacher', timestamp: { toDate: () => now } }) },
        { data: () => ({ eventType: 'emergency_disclosure', actorRole: 'admin', timestamp: { toDate: () => now } }) },
        { data: () => ({ eventType: 'data_destruction', actorRole: 'system', timestamp: { toDate: () => now } }) },
        { data: () => ({ eventType: 'record_correction', actorRole: 'parent', timestamp: { toDate: () => now } }) },
        { data: () => ({ eventType: 'consent_granted', actorRole: 'parent', timestamp: { toDate: () => now } }) },
        { data: () => ({ eventType: 'consent_revoked', actorRole: 'parent', timestamp: { toDate: () => now } }) }
      ];
      (getDocs as jest.Mock).mockResolvedValue({ docs: mockDocs });
      const summary = await FERPAAuditLogger.generateAuditSummary(now, now);
      expect(summary.totalRecordAccesses).toBe(2);
      expect(summary.parentAccesses).toBe(1);
      expect(summary.teacherAccesses).toBe(1);
      expect(summary.emergencyDisclosures).toBe(1);
      expect(summary.dataDestructions).toBe(1);
      expect(summary.recordCorrections).toBe(1);
      expect(summary.consentEvents).toBe(2);
    });
    it('should handle Firestore failure', async () => {
      (getDocs as jest.Mock).mockRejectedValue(new Error('fail'));
      await expect(FERPAAuditLogger.generateAuditSummary(new Date(), new Date())).rejects.toThrow('fail');
    });
  });

  describe('getRecentActivity', () => {
    it('should return recent logs', async () => {
      const mockDocs = [
        { data: () => ({ id: '1', eventType: 'record_access', actorId: 'a', actorRole: 'parent', studentId: 's', recordIds: [], purpose: 'p', legalBasis: 'l', timestamp: { toDate: () => new Date() }, schoolYear: '2024-2025' }), id: '1' }
      ];
      (getDocs as jest.Mock).mockResolvedValue({ docs: mockDocs });
      const logs = await FERPAAuditLogger.getRecentActivity();
      expect(logs.length).toBe(1);
      expect(logs[0].id).toBe('1');
    });
    it('should handle Firestore failure', async () => {
      (getDocs as jest.Mock).mockRejectedValue(new Error('fail'));
      await expect(FERPAAuditLogger.getRecentActivity()).rejects.toThrow('fail');
    });
  });

  describe('detectPotentialViolations', () => {
    it('should detect excessive access', async () => {
      const now = new Date();
      const logs = Array.from({ length: 51 }, (_, i) => ({
        data: () => ({ eventType: 'record_access', actorId: 'a', actorRole: 'parent', timestamp: { toDate: () => now } })
      }));
      (getDocs as jest.Mock).mockResolvedValue({ docs: logs });
      const violations = await FERPAAuditLogger.detectPotentialViolations(24);
      expect(violations.some(v => v.violation === 'Excessive record access')).toBe(true);
    });
    it('should detect improper disclosure', async () => {
      const now = new Date();
      const logs = [
        { data: () => ({ eventType: 'record_disclosure', legalBasis: 'not-a-legal-basis', timestamp: { toDate: () => now } }) }
      ];
      (getDocs as jest.Mock).mockResolvedValue({ docs: logs });
      const violations = await FERPAAuditLogger.detectPotentialViolations(24);
      expect(violations.some(v => v.violation === 'Disclosure without clear legal basis')).toBe(true);
    });
    it('should handle no violations', async () => {
      const now = new Date();
      const logs = [
        { data: () => ({ eventType: 'record_access', actorId: 'a', actorRole: 'parent', timestamp: { toDate: () => now } }) }
      ];
      (getDocs as jest.Mock).mockResolvedValue({ docs: logs });
      const violations = await FERPAAuditLogger.detectPotentialViolations(24);
      expect(violations.length).toBe(0);
    });
    it('should handle Firestore failure', async () => {
      (getDocs as jest.Mock).mockRejectedValue(new Error('fail'));
      await expect(FERPAAuditLogger.detectPotentialViolations(24)).rejects.toThrow('fail');
    });
  });
}); 