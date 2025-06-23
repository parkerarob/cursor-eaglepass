import { DirectoryInfoService, DirectoryInfoItem, DirectoryInfoOptOut } from '../directoryInfoService';
import { collection, doc, setDoc, getDocs, query, where, Timestamp } from 'firebase/firestore';
import { FERPAAuditLogger } from '../ferpaAuditLogger';

// Mock Firebase Firestore
jest.mock('@/lib/firebase/firestore', () => ({
  db: {},
  collection: jest.fn(),
  doc: jest.fn(),
  setDoc: jest.fn(),
  getDocs: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  Timestamp: {
    fromDate: jest.fn((date) => ({ toDate: () => date }))
  }
}));

// Mock FERPAAuditLogger
jest.mock('../ferpaAuditLogger', () => ({
  FERPAAuditLogger: {
    logConsentEvent: jest.fn()
  }
}));

describe('DirectoryInfoService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('submitOptOut', () => {
    it('should submit opt-out successfully', async () => {
      (setDoc as jest.Mock).mockResolvedValue(undefined);
      (doc as jest.Mock).mockReturnValue({});
      (collection as jest.Mock).mockReturnValue({});

      (FERPAAuditLogger.logConsentEvent as jest.Mock).mockResolvedValue(undefined);

      const result = await DirectoryInfoService.submitOptOut(
        'parent-1',
        'student-1',
        'Emma Johnson',
        [DirectoryInfoItem.NAME, DirectoryInfoItem.PHOTO]
      );

      expect(result.id).toBeDefined();
      expect(result.studentId).toBe('student-1');
      expect(result.parentId).toBe('parent-1');
      expect(result.optedOutItems).toContain(DirectoryInfoItem.NAME);
      expect(result.optedOutItems).toContain(DirectoryInfoItem.PHOTO);
      expect(result.active).toBe(true);
      expect(setDoc).toHaveBeenCalled();
      expect(FERPAAuditLogger.logConsentEvent).toHaveBeenCalled();
    });

    it('should throw error on database failure', async () => {
      (setDoc as jest.Mock).mockRejectedValue(new Error('Database error'));
      (doc as jest.Mock).mockReturnValue({});
      (collection as jest.Mock).mockReturnValue({});

      await expect(
        DirectoryInfoService.submitOptOut(
          'parent-1',
          'student-1',
          'Emma Johnson',
          [DirectoryInfoItem.NAME]
        )
      ).rejects.toThrow('Database error');
    });
  });

  describe('checkDisclosureAllowed', () => {
    it('should return true when no opt-out exists', async () => {
      const mockQuerySnapshot = {
        empty: true,
        docs: []
      };

      (getDocs as jest.Mock).mockResolvedValue(mockQuerySnapshot);
      (query as jest.Mock).mockReturnValue({});
      (where as jest.Mock).mockReturnValue({});
      (collection as jest.Mock).mockReturnValue({});

      const result = await DirectoryInfoService.checkDisclosureAllowed(
        'student-1',
        DirectoryInfoItem.NAME
      );

      expect(result).toBe(true);
    });

    it('should return false when opt-out exists for the info type', async () => {
      const mockOptOut = {
        id: 'opt-1',
        studentId: 'student-1',
        parentId: 'parent-1',
        studentName: 'Emma Johnson',
        schoolYear: '2024-2025',
        optedOutAt: { toDate: () => new Date() },
        optedOutItems: [DirectoryInfoItem.NAME, DirectoryInfoItem.PHOTO],
        active: true
      };

      const mockQuerySnapshot = {
        empty: false,
        docs: [{ data: () => mockOptOut }]
      };

      (getDocs as jest.Mock).mockResolvedValue(mockQuerySnapshot);
      (query as jest.Mock).mockReturnValue({});
      (where as jest.Mock).mockReturnValue({});
      (collection as jest.Mock).mockReturnValue({});

      const result = await DirectoryInfoService.checkDisclosureAllowed(
        'student-1',
        DirectoryInfoItem.NAME
      );

      expect(result).toBe(false);
    });

    it('should return true when opt-out exists but not for the specific info type', async () => {
      const mockOptOut = {
        id: 'opt-1',
        studentId: 'student-1',
        parentId: 'parent-1',
        studentName: 'Emma Johnson',
        schoolYear: '2024-2025',
        optedOutAt: { toDate: () => new Date() },
        optedOutItems: [DirectoryInfoItem.PHOTO],
        active: true
      };

      const mockQuerySnapshot = {
        empty: false,
        docs: [{ data: () => mockOptOut }]
      };

      (getDocs as jest.Mock).mockResolvedValue(mockQuerySnapshot);
      (query as jest.Mock).mockReturnValue({});
      (where as jest.Mock).mockReturnValue({});
      (collection as jest.Mock).mockReturnValue({});

      const result = await DirectoryInfoService.checkDisclosureAllowed(
        'student-1',
        DirectoryInfoItem.NAME
      );

      expect(result).toBe(true);
    });

    it('should return false on error (err on side of caution)', async () => {
      (getDocs as jest.Mock).mockRejectedValue(new Error('Database error'));
      (query as jest.Mock).mockReturnValue({});
      (where as jest.Mock).mockReturnValue({});
      (collection as jest.Mock).mockReturnValue({});

      const result = await DirectoryInfoService.checkDisclosureAllowed(
        'student-1',
        DirectoryInfoItem.NAME
      );

      expect(result).toBe(false);
    });
  });

  describe('getOptOutForStudent', () => {
    it('should return opt-out when exists', async () => {
      const mockOptOut = {
        id: 'opt-1',
        studentId: 'student-1',
        parentId: 'parent-1',
        studentName: 'Emma Johnson',
        schoolYear: '2024-2025',
        optedOutAt: { toDate: () => new Date() },
        optedOutItems: [DirectoryInfoItem.NAME, DirectoryInfoItem.PHOTO],
        active: true
      };

      const mockQuerySnapshot = {
        empty: false,
        docs: [{ data: () => mockOptOut }]
      };

      (getDocs as jest.Mock).mockResolvedValue(mockQuerySnapshot);
      (query as jest.Mock).mockReturnValue({});
      (where as jest.Mock).mockReturnValue({});
      (collection as jest.Mock).mockReturnValue({});

      const result = await DirectoryInfoService.getOptOutForStudent('student-1');

      expect(result).toEqual({
        ...mockOptOut,
        optedOutAt: mockOptOut.optedOutAt.toDate()
      });
    });

    it('should return null when no opt-out exists', async () => {
      const mockQuerySnapshot = {
        empty: true,
        docs: []
      };

      (getDocs as jest.Mock).mockResolvedValue(mockQuerySnapshot);
      (query as jest.Mock).mockReturnValue({});
      (where as jest.Mock).mockReturnValue({});
      (collection as jest.Mock).mockReturnValue({});

      const result = await DirectoryInfoService.getOptOutForStudent('student-1');

      expect(result).toBeNull();
    });

    it('should return null on error', async () => {
      (getDocs as jest.Mock).mockRejectedValue(new Error('Database error'));
      (query as jest.Mock).mockReturnValue({});
      (where as jest.Mock).mockReturnValue({});
      (collection as jest.Mock).mockReturnValue({});

      const result = await DirectoryInfoService.getOptOutForStudent('student-1');

      expect(result).toBeNull();
    });
  });
}); 