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
  
  afterEach(() => {
    // Restore all spies after each test
    jest.restoreAllMocks();
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
    const basePolicy: import('../dataRetentionService').DataRetentionPolicy = {
      recordType: 'passes',
      retentionPeriodMonths: 12,
      destructionMethod: 'secure_delete',
      automatedCleanup: true,
      legalBasis: 'FERPA educational records completion',
      exceptions: []
    };
    
    it('should process and delete expired records (secure_delete)', async () => {
      const findSpy = jest.spyOn(DataRetentionService, 'findExpiredRecords').mockResolvedValue([{ id: '1' }, { id: '2' }]);
      const exceptionSpy = jest.spyOn(DataRetentionService, 'hasDestructionException').mockResolvedValue(false);
      const deleteSpy = jest.spyOn(DataRetentionService, 'secureDelete').mockResolvedValue(undefined);
      const logSpy = jest.spyOn(DataRetentionService, 'logDestruction').mockResolvedValue(undefined);
      
      const metrics = await DataRetentionService.processRetentionPolicy(basePolicy);
      
      expect(findSpy).toHaveBeenCalledWith('passes', expect.any(Date));
      expect(exceptionSpy).toHaveBeenCalledTimes(2);
      expect(deleteSpy).toHaveBeenCalledTimes(2);
      expect(logSpy).toHaveBeenCalledTimes(2);
      expect(metrics.recordsDeleted).toBe(2);
      expect(metrics.recordsProcessed).toBe(2);
    });
    
    it('should process and anonymize expired records (anonymize)', async () => {
      const policy: import('../dataRetentionService').DataRetentionPolicy = { ...basePolicy, destructionMethod: 'anonymize', recordType: 'emergencyRecords' };
      const findSpy = jest.spyOn(DataRetentionService, 'findExpiredRecords').mockResolvedValue([{ id: '3' }]);
      const exceptionSpy = jest.spyOn(DataRetentionService, 'hasDestructionException').mockResolvedValue(false);
      const anonymizeSpy = jest.spyOn(DataRetentionService, 'anonymizeRecord').mockResolvedValue(undefined);
      const logSpy = jest.spyOn(DataRetentionService, 'logDestruction').mockResolvedValue(undefined);
      
      const metrics = await DataRetentionService.processRetentionPolicy(policy);
      
      expect(findSpy).toHaveBeenCalledWith('emergencyRecords', expect.any(Date));
      expect(exceptionSpy).toHaveBeenCalledTimes(1);
      expect(anonymizeSpy).toHaveBeenCalledWith({ id: '3' }, 'emergencyRecords');
      expect(logSpy).toHaveBeenCalledTimes(1);
      expect(metrics.recordsAnonymized).toBe(1);
      expect(metrics.recordsProcessed).toBe(1);
    });
    
    it('should skip records with destruction exceptions', async () => {
      const findSpy = jest.spyOn(DataRetentionService, 'findExpiredRecords').mockResolvedValue([{ id: '4' }]);
      const exceptionSpy = jest.spyOn(DataRetentionService, 'hasDestructionException').mockResolvedValue(true);
      const deleteSpy = jest.spyOn(DataRetentionService, 'secureDelete');
      const logSpy = jest.spyOn(DataRetentionService, 'logDestruction');
      
      const metrics = await DataRetentionService.processRetentionPolicy(basePolicy);
      
      expect(findSpy).toHaveBeenCalledWith('passes', expect.any(Date));
      expect(exceptionSpy).toHaveBeenCalledTimes(1);
      expect(deleteSpy).not.toHaveBeenCalled();
      expect(logSpy).not.toHaveBeenCalled();
      expect(metrics.recordsSkipped).toBe(1);
      expect(metrics.recordsProcessed).toBe(1);
    });
    
    it('should handle errors and add to metrics', async () => {
      const findSpy = jest.spyOn(DataRetentionService, 'findExpiredRecords').mockResolvedValue([{ id: '5' }]);
      const exceptionSpy = jest.spyOn(DataRetentionService, 'hasDestructionException').mockResolvedValue(false);
      const deleteSpy = jest.spyOn(DataRetentionService, 'secureDelete').mockRejectedValue(new Error('delete error'));
      const logSpy = jest.spyOn(DataRetentionService, 'logDestruction').mockResolvedValue(undefined);
      
      const metrics = await DataRetentionService.processRetentionPolicy(basePolicy);
      
      expect(findSpy).toHaveBeenCalledWith('passes', expect.any(Date));
      expect(exceptionSpy).toHaveBeenCalledTimes(1);
      expect(deleteSpy).toHaveBeenCalledTimes(1);
      expect(logSpy).not.toHaveBeenCalled(); // Should not be called due to error
      expect(metrics.errors.some(e => e.includes('delete error'))).toBe(true);
      expect(metrics.recordsProcessed).toBe(1);
    });
    
    it('should return zero metrics if no expired records', async () => {
      const findSpy = jest.spyOn(DataRetentionService, 'findExpiredRecords').mockResolvedValue([]);
      const metrics = await DataRetentionService.processRetentionPolicy(basePolicy);
      expect(findSpy).toHaveBeenCalledWith('passes', expect.any(Date));
      expect(metrics.recordsProcessed).toBe(0);
      expect(metrics.recordsDeleted).toBe(0);
      expect(metrics.recordsAnonymized).toBe(0);
    });
  });

  // Additional tests for processRetentionPolicy, findExpiredRecords, secureDelete, anonymizeRecord, getProcessingStatus, runManualCleanup, etc. would follow a similar pattern.
}); 