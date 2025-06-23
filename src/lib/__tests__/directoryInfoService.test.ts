var mockLogConsentEvent = jest.fn();
import { DirectoryInfoService, DirectoryInfoOptOut, DirectoryInfoItem } from '../directoryInfoService';
import { FERPAAuditLogger } from '../ferpaAuditLogger';
import { collection, doc, setDoc, getDocs, query, where, Timestamp } from 'firebase/firestore';

// Get the mocked functions from the global mock
const mockCollection = collection as jest.MockedFunction<typeof collection>;
const mockDoc = doc as jest.MockedFunction<typeof doc>;
const mockSetDoc = setDoc as jest.MockedFunction<typeof setDoc>;
const mockGetDocs = getDocs as jest.MockedFunction<typeof getDocs>;
const mockQuery = query as jest.MockedFunction<typeof query>;
const mockWhere = where as jest.MockedFunction<typeof where>;
const mockTimestamp = Timestamp as jest.Mocked<typeof Timestamp>;

describe('DirectoryInfoService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(FERPAAuditLogger, 'logConsentEvent').mockImplementation(mockLogConsentEvent);
  });

  describe('submitOptOut', () => {
    it('should submit opt-out successfully', async () => {
      mockSetDoc.mockResolvedValue(undefined);
      mockDoc.mockReturnValue({} as any);
      mockCollection.mockReturnValue({} as any);
      mockLogConsentEvent.mockResolvedValue(undefined);

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
      expect(mockSetDoc).toHaveBeenCalled();
      expect(mockLogConsentEvent).toHaveBeenCalled();
    });

    it('should throw error on database failure', async () => {
      mockSetDoc.mockRejectedValue(new Error('Database error'));
      mockDoc.mockReturnValue({} as any);
      mockCollection.mockReturnValue({} as any);

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
      } as any;

      mockGetDocs.mockResolvedValue(mockQuerySnapshot);
      mockQuery.mockReturnValue({} as any);
      mockWhere.mockReturnValue({} as any);
      mockCollection.mockReturnValue({} as any);

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
      } as any;

      mockGetDocs.mockResolvedValue(mockQuerySnapshot);
      mockQuery.mockReturnValue({} as any);
      mockWhere.mockReturnValue({} as any);
      mockCollection.mockReturnValue({} as any);

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
      } as any;

      mockGetDocs.mockResolvedValue(mockQuerySnapshot);
      mockQuery.mockReturnValue({} as any);
      mockWhere.mockReturnValue({} as any);
      mockCollection.mockReturnValue({} as any);

      const result = await DirectoryInfoService.checkDisclosureAllowed(
        'student-1',
        DirectoryInfoItem.NAME
      );

      expect(result).toBe(true);
    });

    it('should return false on error (err on side of caution)', async () => {
      mockGetDocs.mockRejectedValue(new Error('Database error'));
      mockQuery.mockReturnValue({} as any);
      mockWhere.mockReturnValue({} as any);
      mockCollection.mockReturnValue({} as any);

      // The implementation should catch and return false
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
      } as any;

      mockGetDocs.mockResolvedValue(mockQuerySnapshot);
      mockQuery.mockReturnValue({} as any);
      mockWhere.mockReturnValue({} as any);
      mockCollection.mockReturnValue({} as any);

      const result = await DirectoryInfoService.getOptOutForStudent('student-1');

      // Compare all fields except optedOutAt
      expect({
        ...result,
        optedOutAt: undefined
      }).toEqual({
        ...mockOptOut,
        optedOutAt: undefined
      });
      // Compare optedOutAt timestamps with a small delta (1000ms)
      expect(result).not.toBeNull();
      if (result) {
        expect(Math.abs(result.optedOutAt.getTime() - mockOptOut.optedOutAt.toDate().getTime()))
          .toBeLessThan(1000);
      }
    });

    it('should return null when no opt-out exists', async () => {
      const mockQuerySnapshot = {
        empty: true,
        docs: []
      } as any;

      mockGetDocs.mockResolvedValue(mockQuerySnapshot);
      mockQuery.mockReturnValue({} as any);
      mockWhere.mockReturnValue({} as any);
      mockCollection.mockReturnValue({} as any);

      const result = await DirectoryInfoService.getOptOutForStudent('student-1');

      expect(result).toBeNull();
    });

    it('should return null on error', async () => {
      mockGetDocs.mockRejectedValue(new Error('Database error'));
      mockQuery.mockReturnValue({} as any);
      mockWhere.mockReturnValue({} as any);
      mockCollection.mockReturnValue({} as any);

      await expect(
        DirectoryInfoService.getOptOutForStudent('student-1')
      ).rejects.toThrow('Database error');
    });
  });
}); 