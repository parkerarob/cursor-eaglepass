import { ParentRelationshipVerifier, ParentStudentRelationship } from '../parentRelationshipVerifier';
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
    logRecordAccess: jest.fn()
  }
}));

describe('ParentRelationshipVerifier', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
      };

      (getDocs as jest.Mock).mockResolvedValue(mockQuerySnapshot);
      (query as jest.Mock).mockReturnValue({});
      (where as jest.Mock).mockReturnValue({});
      (collection as jest.Mock).mockReturnValue({});

      const result = await ParentRelationshipVerifier.verifyRelationship('parent-1', 'student-1');

      expect(result).toEqual(mockRelationship);
      expect(collection).toHaveBeenCalledWith({}, 'parentStudentRelationships');
    });

    it('should return null when no relationship exists', async () => {
      const mockQuerySnapshot = {
        empty: true,
        docs: []
      };

      (getDocs as jest.Mock).mockResolvedValue(mockQuerySnapshot);
      (query as jest.Mock).mockReturnValue({});
      (where as jest.Mock).mockReturnValue({});
      (collection as jest.Mock).mockReturnValue({});

      const result = await ParentRelationshipVerifier.verifyRelationship('parent-1', 'student-2');

      expect(result).toBeNull();
    });

    it('should return null on error', async () => {
      (getDocs as jest.Mock).mockRejectedValue(new Error('Database error'));
      (query as jest.Mock).mockReturnValue({});
      (where as jest.Mock).mockReturnValue({});
      (collection as jest.Mock).mockReturnValue({});

      const result = await ParentRelationshipVerifier.verifyRelationship('parent-1', 'student-1');

      expect(result).toBeNull();
    });
  });

  describe('createRelationship', () => {
    it('should create a new relationship successfully', async () => {
      (setDoc as jest.Mock).mockResolvedValue(undefined);
      (doc as jest.Mock).mockReturnValue({});
      (collection as jest.Mock).mockReturnValue({});

      (FERPAAuditLogger.logRecordAccess as jest.Mock).mockResolvedValue(undefined);

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
      expect(setDoc).toHaveBeenCalled();
      expect(FERPAAuditLogger.logRecordAccess).toHaveBeenCalled();
    });

    it('should throw error on database failure', async () => {
      (setDoc as jest.Mock).mockRejectedValue(new Error('Database error'));
      (doc as jest.Mock).mockReturnValue({});
      (collection as jest.Mock).mockReturnValue({});

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
      };

      (getDocs as jest.Mock).mockResolvedValue(mockQuerySnapshot);
      (query as jest.Mock).mockReturnValue({});
      (where as jest.Mock).mockReturnValue({});
      (collection as jest.Mock).mockReturnValue({});

      const result = await ParentRelationshipVerifier.getParentRelationships('parent-1');

      expect(result).toHaveLength(1);
      expect(result[0].parentId).toBe('parent-1');
      expect(result[0].active).toBe(true);
    });

    it('should return empty array when no relationships exist', async () => {
      const mockQuerySnapshot = {
        empty: true,
        docs: []
      };

      (getDocs as jest.Mock).mockResolvedValue(mockQuerySnapshot);
      (query as jest.Mock).mockReturnValue({});
      (where as jest.Mock).mockReturnValue({});
      (collection as jest.Mock).mockReturnValue({});

      const result = await ParentRelationshipVerifier.getParentRelationships('parent-1');

      expect(result).toEqual([]);
    });

    it('should return empty array on error', async () => {
      (getDocs as jest.Mock).mockRejectedValue(new Error('Database error'));
      (query as jest.Mock).mockReturnValue({});
      (where as jest.Mock).mockReturnValue({});
      (collection as jest.Mock).mockReturnValue({});

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
      };

      (getDocs as jest.Mock).mockResolvedValue(mockQuerySnapshot);
      (query as jest.Mock).mockReturnValue({});
      (where as jest.Mock).mockReturnValue({});
      (collection as jest.Mock).mockReturnValue({});

      const result = await ParentRelationshipVerifier.getStudentRelationships('student-1');

      expect(result).toHaveLength(1);
      expect(result[0].studentId).toBe('student-1');
      expect(result[0].active).toBe(true);
    });
  });
}); 