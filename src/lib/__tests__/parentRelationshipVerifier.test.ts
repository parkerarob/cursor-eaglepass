const mockLogRecordAccess = jest.fn();
import { ParentRelationshipVerifier, ParentStudentRelationship } from '../parentRelationshipVerifier';
import { FERPAAuditLogger } from '../ferpaAuditLogger';
import { collection, doc, setDoc, getDocs, query, where, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase/firestore';

// Debug: Check what's being imported
console.log('collection imported:', typeof collection);
console.log('setDoc imported:', typeof setDoc);
console.log('doc imported:', typeof doc);
console.log('getDocs imported:', typeof getDocs);
console.log('query imported:', typeof query);
console.log('where imported:', typeof where);
console.log('Timestamp imported:', typeof Timestamp);

// Get the mocked functions from the global mock
const mockCollection = collection as jest.MockedFunction<typeof collection>;
const mockDoc = doc as jest.MockedFunction<typeof doc>;
const mockSetDoc = setDoc as jest.MockedFunction<typeof setDoc>;
const mockGetDocs = getDocs as jest.MockedFunction<typeof getDocs>;
const mockQuery = query as jest.MockedFunction<typeof query>;
const mockWhere = where as jest.MockedFunction<typeof where>;
const mockTimestamp = Timestamp as jest.Mocked<typeof Timestamp>;

// Debug: Check if mocks are working
console.log('mockCollection is function:', typeof mockCollection);
console.log('mockSetDoc is function:', typeof mockSetDoc);

describe('ParentRelationshipVerifier', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(FERPAAuditLogger, 'logRecordAccess').mockImplementation(mockLogRecordAccess);
  });

  describe('verifyRelationship', () => {
    it('should return relationship when valid relationship exists', async () => {
      const mockRelationship: ParentStudentRelationship = {
        id: 'rel-1',
        parentId: 'parent-1',
        parentEmail: 'parent@example.com',
        studentId: 'student-1',
        studentName: 'Emma Johnson',
        relationshipType: 'parent',
        verifiedAt: new Date('2024-01-01'),
        verificationMethod: 'admin_confirmation',
        active: true,
        schoolYear: '2024-2025',
        verifiedBy: 'admin-1'
      };

      const mockQuerySnapshot = {
        empty: false,
        docs: [{
          data: () => ({
            ...mockRelationship,
            verifiedAt: { toDate: () => mockRelationship.verifiedAt }
          })
        }]
      } as any;

      mockGetDocs.mockResolvedValue(mockQuerySnapshot);
      mockQuery.mockReturnValue({} as any);
      mockWhere.mockReturnValue({} as any);
      mockCollection.mockReturnValue({} as any);

      const result = await ParentRelationshipVerifier.verifyRelationship('parent-1', 'student-1');

      expect(result).toEqual(mockRelationship);
      expect(mockCollection).toHaveBeenCalledWith(db, 'parentStudentRelationships');
    });

    it('should return null when no relationship exists', async () => {
      const mockQuerySnapshot = {
        empty: true,
        docs: []
      } as any;

      mockGetDocs.mockResolvedValue(mockQuerySnapshot);
      mockQuery.mockReturnValue({} as any);
      mockWhere.mockReturnValue({} as any);
      mockCollection.mockReturnValue({} as any);

      const result = await ParentRelationshipVerifier.verifyRelationship('parent-1', 'student-2');

      expect(result).toBeNull();
    });

    it('should return null on error', async () => {
      mockGetDocs.mockRejectedValue(new Error('Database error'));
      mockQuery.mockReturnValue({} as any);
      mockWhere.mockReturnValue({} as any);
      mockCollection.mockReturnValue({} as any);

      const result = await ParentRelationshipVerifier.verifyRelationship('parent-1', 'student-1');

      expect(result).toBeNull();
    });
  });

  describe('createRelationship', () => {
    it('should create a new relationship successfully', async () => {
      mockSetDoc.mockResolvedValue(undefined);
      mockDoc.mockReturnValue({} as any);
      mockCollection.mockReturnValue({} as any);
      mockLogRecordAccess.mockResolvedValue(undefined);

      const result = await ParentRelationshipVerifier.createRelationship(
        'parent-1',
        'parent@example.com',
        'student-1',
        'Emma Johnson',
        'parent',
        'admin-1'
      );

      expect(result.id).toBeDefined();
      expect(result.parentId).toBe('parent-1');
      expect(result.studentId).toBe('student-1');
      expect(result.active).toBe(true);
      expect(mockSetDoc).toHaveBeenCalled();
      expect(mockLogRecordAccess).toHaveBeenCalled();
    });

    it('should throw error on database failure', async () => {
      mockSetDoc.mockRejectedValue(new Error('Database error'));
      mockDoc.mockReturnValue({} as any);
      mockCollection.mockReturnValue({} as any);

      await expect(
        ParentRelationshipVerifier.createRelationship(
          'parent-1',
          'parent@example.com',
          'student-1',
          'Emma Johnson',
          'parent',
          'admin-1'
        )
      ).rejects.toThrow('Database error');
    });
  });

  describe('getParentRelationships', () => {
    it('should return all relationships for a parent', async () => {
      const mockRelationships = [
        {
          id: 'rel-1',
          parentId: 'parent-1',
          parentEmail: 'parent@example.com',
          studentId: 'student-1',
          studentName: 'Emma Johnson',
          relationshipType: 'parent',
          verifiedAt: { toDate: () => new Date('2024-01-01') },
          verificationMethod: 'admin_confirmation',
          active: true,
          schoolYear: '2024-2025',
          verifiedBy: 'admin-1'
        }
      ];

      const mockQuerySnapshot = {
        empty: false,
        docs: mockRelationships.map(rel => ({ data: () => rel }))
      } as any;

      mockGetDocs.mockResolvedValue(mockQuerySnapshot);
      mockQuery.mockReturnValue({} as any);
      mockWhere.mockReturnValue({} as any);
      mockCollection.mockReturnValue({} as any);

      const result = await ParentRelationshipVerifier.getParentRelationships('parent-1');

      expect(result).toHaveLength(1);
      expect(result[0].parentId).toBe('parent-1');
      expect(result[0].active).toBe(true);
    });

    it('should return empty array when no relationships exist', async () => {
      const mockQuerySnapshot = {
        empty: true,
        docs: []
      } as any;

      mockGetDocs.mockResolvedValue(mockQuerySnapshot);
      mockQuery.mockReturnValue({} as any);
      mockWhere.mockReturnValue({} as any);
      mockCollection.mockReturnValue({} as any);

      const result = await ParentRelationshipVerifier.getParentRelationships('parent-1');

      expect(result).toEqual([]);
    });

    it('should return empty array on error', async () => {
      mockGetDocs.mockRejectedValue(new Error('Database error'));
      mockQuery.mockReturnValue({} as any);
      mockWhere.mockReturnValue({} as any);
      mockCollection.mockReturnValue({} as any);

      const result = await ParentRelationshipVerifier.getParentRelationships('parent-1');

      expect(result).toEqual([]);
    });
  });

  describe('getStudentRelationships', () => {
    it('should return all relationships for a student', async () => {
      const mockRelationships = [
        {
          id: 'rel-1',
          parentId: 'parent-1',
          parentEmail: 'parent@example.com',
          studentId: 'student-1',
          studentName: 'Emma Johnson',
          relationshipType: 'parent',
          verifiedAt: { toDate: () => new Date('2024-01-01') },
          verificationMethod: 'admin_confirmation',
          active: true,
          schoolYear: '2024-2025',
          verifiedBy: 'admin-1'
        }
      ];

      const mockQuerySnapshot = {
        empty: false,
        docs: mockRelationships.map(rel => ({ data: () => rel }))
      } as any;

      mockGetDocs.mockResolvedValue(mockQuerySnapshot);
      mockQuery.mockReturnValue({} as any);
      mockWhere.mockReturnValue({} as any);
      mockCollection.mockReturnValue({} as any);

      const result = await ParentRelationshipVerifier.getStudentRelationships('student-1');

      expect(result).toHaveLength(1);
      expect(result[0].studentId).toBe('student-1');
      expect(result[0].active).toBe(true);
    });

    it('should return empty array when no relationships exist', async () => {
      const mockQuerySnapshot = {
        empty: true,
        docs: []
      } as any;

      mockGetDocs.mockResolvedValue(mockQuerySnapshot);
      mockQuery.mockReturnValue({} as any);
      mockWhere.mockReturnValue({} as any);
      mockCollection.mockReturnValue({} as any);

      const result = await ParentRelationshipVerifier.getStudentRelationships('student-1');

      expect(result).toEqual([]);
    });

    it('should return empty array on error', async () => {
      mockGetDocs.mockRejectedValue(new Error('Database error'));
      mockQuery.mockReturnValue({} as any);
      mockWhere.mockReturnValue({} as any);
      mockCollection.mockReturnValue({} as any);

      const result = await ParentRelationshipVerifier.getStudentRelationships('student-1');

      expect(result).toEqual([]);
    });
  });
}); 