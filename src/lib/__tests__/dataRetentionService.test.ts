import { DataRetentionService, FERPA_RETENTION_POLICIES } from '../dataRetentionService';
import { monitoringService } from '../monitoringService';

jest.mock('../monitoringService');
jest.mock('@/lib/firebase/firestore', () => ({
  db: {},
  collection: jest.fn(),
  doc: jest.fn(),
  deleteDoc: jest.fn(),
  updateDoc: jest.fn(),
  getDocs: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  Timestamp: { fromDate: jest.fn(() => ({ toDate: () => new Date() })) }
}));

describe('DataRetentionService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset processing state
    (DataRetentionService as any).isProcessing = false;
    (DataRetentionService as any).lastProcessingTime = null;
  });

  describe('runAutomatedCleanup', () => {
    it('should process all automated policies and log completion', async () => {
      jest.spyOn(DataRetentionService as any, 'processRetentionPolicy').mockResolvedValue({
        recordsProcessed: 2,
        recordsDeleted: 2,
        recordsAnonymized: 0,
        recordsSkipped: 0,
        errors: [],
        processingTime: 10
      });
      const logSpy = jest.spyOn(monitoringService, 'logInfo').mockImplementation();
      const result = await DataRetentionService.runAutomatedCleanup();
      expect(result.recordsProcessed).toBeGreaterThanOrEqual(2);
      expect(logSpy).toHaveBeenCalledWith('FERPA data retention cleanup completed', expect.any(Object));
    });
    it('should skip if already processing', async () => {
      (DataRetentionService as any).isProcessing = true;
      const result = await DataRetentionService.runAutomatedCleanup();
      expect(result.errors).toContain('Cleanup already in progress');
    });
    it('should aggregate errors from policies', async () => {
      jest.spyOn(DataRetentionService as any, 'processRetentionPolicy').mockImplementationOnce(() => { throw new Error('fail policy'); });
      jest.spyOn(DataRetentionService as any, 'processRetentionPolicy').mockResolvedValue({
        recordsProcessed: 0,
        recordsDeleted: 0,
        recordsAnonymized: 0,
        recordsSkipped: 0,
        errors: [],
        processingTime: 0
      });
      const result = await DataRetentionService.runAutomatedCleanup();
      expect(result.errors.some(e => e.includes('fail policy'))).toBe(true);
    });
  });

  describe('processRetentionPolicy', () => {
    let DataRetentionService: typeof import('../dataRetentionService').DataRetentionService;
    let FERPA_RETENTION_POLICIES: typeof import('../dataRetentionService').FERPA_RETENTION_POLICIES;
    beforeEach(() => {
      jest.resetModules();
      // Re-import after resetting modules
      ({ DataRetentionService, FERPA_RETENTION_POLICIES } = require('../dataRetentionService'));
      jest.clearAllMocks();
    });
    const basePolicy: import('../dataRetentionService').DataRetentionPolicy = {
      recordType: 'passes',
      retentionPeriodMonths: 12,
      destructionMethod: 'secure_delete',
      automatedCleanup: true,
      legalBasis: 'FERPA educational records completion',
      exceptions: []
    };
    it('should process and delete expired records (secure_delete)', async () => {
      jest.spyOn(DataRetentionService, 'findExpiredRecords').mockResolvedValue([{ id: '1' }, { id: '2' }]);
      jest.spyOn(DataRetentionService, 'hasDestructionException').mockResolvedValue(false);
      const deleteSpy = jest.spyOn(DataRetentionService, 'secureDelete').mockResolvedValue(undefined);
      const metrics = await DataRetentionService.processRetentionPolicy(basePolicy);
      expect(metrics.recordsDeleted).toBe(2);
      expect(deleteSpy).toHaveBeenCalledTimes(2);
    });
    it('should process and anonymize expired records (anonymize)', async () => {
      const policy: import('../dataRetentionService').DataRetentionPolicy = { ...basePolicy, destructionMethod: 'anonymize', recordType: 'emergencyRecords' };
      jest.spyOn(DataRetentionService, 'findExpiredRecords').mockResolvedValue([{ id: '3' }]);
      jest.spyOn(DataRetentionService, 'hasDestructionException').mockResolvedValue(false);
      const anonymizeSpy = jest.spyOn(DataRetentionService, 'anonymizeRecord').mockResolvedValue(undefined);
      const metrics = await DataRetentionService.processRetentionPolicy(policy);
      expect(metrics.recordsAnonymized).toBe(1);
      expect(anonymizeSpy).toHaveBeenCalledWith({ id: '3' }, 'emergencyRecords');
    });
    it('should skip records with destruction exceptions', async () => {
      jest.spyOn(DataRetentionService, 'findExpiredRecords').mockResolvedValue([{ id: '4' }]);
      jest.spyOn(DataRetentionService, 'hasDestructionException').mockResolvedValue(true);
      const deleteSpy = jest.spyOn(DataRetentionService, 'secureDelete');
      const metrics = await DataRetentionService.processRetentionPolicy(basePolicy);
      expect(metrics.recordsSkipped).toBe(1);
      expect(deleteSpy).not.toHaveBeenCalled();
    });
    it('should handle errors and add to metrics', async () => {
      jest.spyOn(DataRetentionService, 'findExpiredRecords').mockResolvedValue([{ id: '5' }]);
      jest.spyOn(DataRetentionService, 'hasDestructionException').mockResolvedValue(false);
      jest.spyOn(DataRetentionService, 'secureDelete').mockRejectedValue(new Error('delete error'));
      const metrics = await DataRetentionService.processRetentionPolicy(basePolicy);
      expect(metrics.errors.some(e => e.includes('delete error'))).toBe(true);
    });
    it('should return zero metrics if no expired records', async () => {
      jest.spyOn(DataRetentionService, 'findExpiredRecords').mockResolvedValue([]);
      const metrics = await DataRetentionService.processRetentionPolicy(basePolicy);
      expect(metrics.recordsProcessed).toBe(0);
      expect(metrics.recordsDeleted).toBe(0);
      expect(metrics.recordsAnonymized).toBe(0);
    });
  });

  // Additional tests for processRetentionPolicy, findExpiredRecords, secureDelete, anonymizeRecord, getProcessingStatus, runManualCleanup, etc. would follow a similar pattern.
}); 