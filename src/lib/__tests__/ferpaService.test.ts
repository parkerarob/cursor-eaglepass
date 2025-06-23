import { FERPAService } from '../ferpaService';
import { DataRetentionService } from '../dataRetentionService';
import { FERPAAuditLogger } from '../ferpaAuditLogger';
import { EmergencyDisclosureManager } from '../emergencyDisclosureManager';
import { monitoringService } from '../monitoringService';
import { ParentRelationshipVerifier } from '../parentRelationshipVerifier';
import { DirectoryInfoService } from '../directoryInfoService';

jest.mock('../dataRetentionService');
jest.mock('../ferpaAuditLogger');
jest.mock('../emergencyDisclosureManager');
jest.mock('../monitoringService');
jest.mock('../parentRelationshipVerifier');
jest.mock('../directoryInfoService');

describe('FERPAService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('initialize', () => {
    it('should schedule cleanup and log initialization', async () => {
      const scheduleSpy = jest.spyOn(DataRetentionService, 'scheduleAutomatedCleanup').mockImplementation();
      const logSpy = jest.spyOn(FERPAAuditLogger, 'logRecordAccess').mockResolvedValue();
      await FERPAService.initialize();
      expect(scheduleSpy).toHaveBeenCalled();
      expect(logSpy).toHaveBeenCalledWith(
        'system',
        'system',
        'system-initialization',
        [],
        'FERPA system initialization',
        'System startup - automated compliance initialization'
      );
    });
    it('should log and throw errors', async () => {
      jest.spyOn(DataRetentionService, 'scheduleAutomatedCleanup').mockImplementation(() => { throw new Error('fail'); });
      await expect(FERPAService.initialize()).rejects.toThrow('fail');
    });
  });

  describe('logRecordAccess', () => {
    it('should call FERPAAuditLogger.logRecordAccess with correct legal basis for parent', async () => {
      const logSpy = jest.spyOn(FERPAAuditLogger, 'logRecordAccess').mockResolvedValue();
      await FERPAService.logRecordAccess('parent1', 'parent', 'student1', ['rec1'], 'purpose', 'ip', 'ua');
      expect(logSpy).toHaveBeenCalledWith(
        'parent1',
        'parent',
        'student1',
        ['rec1'],
        'purpose',
        '§99.10 Parental access rights',
        'ip',
        'ua'
      );
    });
    it('should not throw on error', async () => {
      jest.spyOn(FERPAAuditLogger, 'logRecordAccess').mockRejectedValue(new Error('fail'));
      await expect(FERPAService.logRecordAccess('id', 'parent', 'sid', [], 'p')).resolves.toBeUndefined();
    });
  });

  describe('recordEmergencyDisclosure', () => {
    it('should call EmergencyDisclosureManager and log warning', async () => {
      const disclosure = { id: 'd1' };
      jest.spyOn(EmergencyDisclosureManager, 'recordEmergencyDisclosure').mockResolvedValue(disclosure as any);
      const warnSpy = jest.spyOn(monitoringService, 'logWarning').mockImplementation();
      const result = await FERPAService.recordEmergencyDisclosure(['s1'], ['admin'], 'reason', 'health', 'admin1');
      expect(result).toBe(disclosure);
      expect(EmergencyDisclosureManager.recordEmergencyDisclosure).toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledWith('FERPA emergency disclosure recorded', expect.objectContaining({ disclosureId: 'd1' }));
    });
    it('should throw on error', async () => {
      jest.spyOn(EmergencyDisclosureManager, 'recordEmergencyDisclosure').mockRejectedValue(new Error('fail'));
      await expect(FERPAService.recordEmergencyDisclosure(['s1'], ['admin'], 'reason', 'health', 'admin1')).rejects.toThrow('fail');
    });
  });

  describe('processPendingNotifications', () => {
    it('should call EmergencyDisclosureManager.processPendingNotifications', async () => {
      const spy = jest.spyOn(EmergencyDisclosureManager, 'processPendingNotifications').mockResolvedValue();
      await FERPAService.processPendingNotifications();
      expect(spy).toHaveBeenCalled();
    });
    it('should throw on error', async () => {
      jest.spyOn(EmergencyDisclosureManager, 'processPendingNotifications').mockRejectedValue(new Error('fail'));
      await expect(FERPAService.processPendingNotifications()).rejects.toThrow('fail');
    });
  });

  describe('runDataRetentionCleanup', () => {
    it('should call DataRetentionService.runManualCleanup and log info', async () => {
      const metrics = { recordsProcessed: 1, recordsDeleted: 1, recordsAnonymized: 0, processingTime: 10 };
      jest.spyOn(DataRetentionService, 'runManualCleanup').mockResolvedValue(metrics as any);
      const infoSpy = jest.spyOn(monitoringService, 'logInfo').mockImplementation();
      const result = await FERPAService.runDataRetentionCleanup('type1');
      expect(result).toBe(metrics);
      expect(DataRetentionService.runManualCleanup).toHaveBeenCalledWith('type1');
      expect(infoSpy).toHaveBeenCalledWith('FERPA data retention cleanup completed', expect.objectContaining({ recordsProcessed: 1 }));
    });
    it('should throw on error', async () => {
      jest.spyOn(DataRetentionService, 'runManualCleanup').mockRejectedValue(new Error('fail'));
      await expect(FERPAService.runDataRetentionCleanup()).rejects.toThrow('fail');
    });
  });

  describe('getComplianceStatus', () => {
    it('should aggregate status from dependencies', async () => {
      jest.spyOn(DataRetentionService, 'getProcessingStatus').mockReturnValue({ active: true, lastCleanup: new Date() } as any);
      jest.spyOn(EmergencyDisclosureManager, 'getPendingNotifications').mockResolvedValue([{} as any]);
      jest.spyOn(FERPAAuditLogger, 'detectPotentialViolations').mockResolvedValue([
        { violation: 'violation1', details: {}, logs: [] }
      ]);
      const result = await FERPAService.getComplianceStatus();
      expect(result).toHaveProperty('dataRetentionActive', true);
      expect(result.pendingNotifications).toBe(1);
      expect(result.violations[0]).toBe('violation1');
    });
  });

  describe('verifyParentRelationship', () => {
    it('should call ParentRelationshipVerifier.verifyRelationship', async () => {
      const relationship = {
        id: 'rel1',
        parentId: 'p1',
        parentEmail: 'parent@example.com',
        studentId: 's1',
        studentName: 'Student',
        relationshipType: 'parent' as const,
        verifiedAt: new Date(),
        verificationMethod: 'admin_confirmation' as const,
        active: true,
        schoolYear: '2024-2025',
        verifiedBy: 'admin'
      };
      const spy = jest.spyOn(ParentRelationshipVerifier, 'verifyRelationship').mockResolvedValue(relationship);
      const result = await FERPAService.verifyParentRelationship('p1', 's1');
      expect(result).toBe(true);
      expect(spy).toHaveBeenCalledWith('p1', 's1');
    });
  });

  describe('checkDirectoryInfoPermission', () => {
    it('should call DirectoryInfoService.checkDisclosureAllowed', async () => {
      const spy = jest.spyOn(DirectoryInfoService, 'checkDisclosureAllowed').mockResolvedValue(true);
      const result = await FERPAService.checkDirectoryInfoPermission('s1', 'name');
      expect(result).toBe(true);
      expect(spy).toHaveBeenCalledWith('s1', 'name');
    });
  });
}); 