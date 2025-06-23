import { FERPAAuditLogger } from '../ferpaAuditLogger';
import { monitoringService } from '../monitoringService';

jest.mock('../monitoringService');
jest.mock('firebase/firestore', () => ({
  getFirestore: jest.fn(() => ({})),
  collection: jest.fn(),
  doc: jest.fn(),
  setDoc: jest.fn(),
  getDocs: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
  Timestamp: { fromDate: jest.fn(() => ({ toDate: () => new Date() })) }
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
  });

  describe('logRecordCorrection', () => {
    it('should store audit log', async () => {
      const originalStore = (FERPAAuditLogger as any)['storeAuditLog'];
      (FERPAAuditLogger as any)['storeAuditLog'] = jest.fn().mockResolvedValue(undefined);
      await FERPAAuditLogger.logRecordCorrection('id', 'admin', 'sid', 'rid', 'field', 'old', 'new', 'requested');
      expect((FERPAAuditLogger as any)['storeAuditLog']).toHaveBeenCalled();
      (FERPAAuditLogger as any)['storeAuditLog'] = originalStore;
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
  });

  describe('logConsentEvent', () => {
    it('should store audit log', async () => {
      const originalStore = (FERPAAuditLogger as any)['storeAuditLog'];
      (FERPAAuditLogger as any)['storeAuditLog'] = jest.fn().mockResolvedValue(undefined);
      await FERPAAuditLogger.logConsentEvent('pid', 'sid', 'type', 'consent_granted', 'purpose', ['cat']);
      expect((FERPAAuditLogger as any)['storeAuditLog']).toHaveBeenCalled();
      (FERPAAuditLogger as any)['storeAuditLog'] = originalStore;
    });
  });

  describe('getAuditLogsForStudent', () => {
    it('should return audit logs for a student', async () => {
      const mockDocs = [
        { data: () => ({ id: '1', eventType: 'record_access', actorId: 'a', actorRole: 'parent', studentId: 's', recordIds: [], purpose: 'p', legalBasis: 'l', timestamp: { toDate: () => new Date() }, schoolYear: '2024-2025' }),
          id: '1' }
      ];
      const firestore = require('firebase/firestore');
      firestore.getDocs.mockResolvedValue({ docs: mockDocs });
      const logs = await FERPAAuditLogger.getAuditLogsForStudent('s');
      expect(logs.length).toBe(1);
      expect(logs[0].id).toBe('1');
    });
  });
}); 