import { PolicyEngine } from '../policyEngine';
import { 
  PolicyContext, 
  PolicyEngineConfig, 
  Group, 
  Restriction, 
  ClassroomPolicy,
  StudentPolicyOverride 
} from '@/types/policy';
import { User } from '@/types';
import { 
  getClassroomPolicy, 
  getStudentPolicyOverridesForStudent 
} from '../firebase/firestore';

// Mock Firebase functions
jest.mock('../firebase/firestore', () => ({
  getClassroomPolicy: jest.fn(),
  getStudentPolicyOverridesForStudent: jest.fn()
}));

const mockGetClassroomPolicy = getClassroomPolicy as jest.MockedFunction<typeof getClassroomPolicy>;
const mockGetStudentPolicyOverrides = getStudentPolicyOverridesForStudent as jest.MockedFunction<typeof getStudentPolicyOverridesForStudent>;

describe('PolicyEngine', () => {
  let policyEngine: PolicyEngine;
  let mockContext: PolicyContext;
  let mockStudent: User;
  let mockGroups: Group[];
  let mockRestrictions: Restriction[];

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Create a new PolicyEngine with default config
    policyEngine = new PolicyEngine();
    
    // Setup mock data
    mockContext = {
      studentId: 'student-123',
      locationId: 'location-123', // deprecated field
      origin: 'classroom-A',
      destination: 'library',
      passType: 'Gated'
    };

    mockStudent = {
      id: 'student-123',
      email: 'student@test.com',
      name: 'Test Student',
      role: 'student',
      assignedLocationId: 'location-123',
      schoolId: 'school-123'
    };

    mockGroups = [
      {
        id: 'group-positive',
        name: 'Honor Roll',
        groupType: 'Positive',
        ownerId: 'teacher-123',
        assignedStudents: ['student-123'],
        createdAt: new Date(),
        lastUpdatedAt: new Date()
      },
      {
        id: 'group-negative',
        name: 'Detention',
        groupType: 'Negative',
        ownerId: 'teacher-123',
        assignedStudents: ['student-456'],
        createdAt: new Date(),
        lastUpdatedAt: new Date()
      }
    ];

    mockRestrictions = [
      {
        id: 'restriction-active',
        studentId: 'student-123',
        restrictionType: 'Global',
        isActive: true,
        reason: 'Test restriction',
        createdBy: 'admin-123',
        createdAt: new Date()
      }
    ];
  });

  describe('constructor', () => {
    it('should initialize with default config', () => {
      const engine = new PolicyEngine();
      const config = engine.getConfig();
      
      expect(config).toEqual({
        enableGroupRules: true,
        enableRestrictions: true,
        enableClassroomPolicies: true,
        emergencyMode: false
      });
    });

    it('should initialize with custom config', () => {
      const customConfig: PolicyEngineConfig = {
        enableGroupRules: false,
        enableRestrictions: false,
        enableClassroomPolicies: false,
        emergencyMode: true
      };
      
      const engine = new PolicyEngine(customConfig);
      const config = engine.getConfig();
      
      expect(config).toEqual(customConfig);
    });

    it('should accept partial custom config (constructor replaces entire config)', () => {
      const partialConfig = { emergencyMode: true };
      const engine = new PolicyEngine(partialConfig as PolicyEngineConfig);
      const config = engine.getConfig();
      
      // Constructor replaces entire config when provided, so only passed values exist
      expect(config).toEqual({
        emergencyMode: true
      });
    });
  });

  describe('updateConfig', () => {
    it('should update config with new values', () => {
      const newConfig = { emergencyMode: true };
      policyEngine.updateConfig(newConfig);
      
      const config = policyEngine.getConfig();
      expect(config.emergencyMode).toBe(true);
      expect(config.enableGroupRules).toBe(true); // Should preserve existing values
    });

    it('should update multiple config values', () => {
      const newConfig = { 
        emergencyMode: true,
        enableRestrictions: false
      };
      policyEngine.updateConfig(newConfig);
      
      const config = policyEngine.getConfig();
      expect(config.emergencyMode).toBe(true);
      expect(config.enableRestrictions).toBe(false);
      expect(config.enableGroupRules).toBe(true); // Should preserve existing values
    });
  });

  describe('getConfig', () => {
    it('should return a copy of the config', () => {
      const config1 = policyEngine.getConfig();
      const config2 = policyEngine.getConfig();
      
      expect(config1).toEqual(config2);
      expect(config1).not.toBe(config2); // Should be different objects
    });
  });

  describe('evaluatePolicy', () => {
    beforeEach(() => {
      // Mock successful classroom policy responses
      mockGetClassroomPolicy.mockResolvedValue({
        id: 'policy-123',
        locationId: 'classroom-A',
        ownerId: 'teacher-123',
        rules: {
          studentLeave: 'Allow',
          studentArrive: 'Allow',
          teacherRequest: 'Allow'
        },
        lastUpdatedAt: new Date()
      });
      
      mockGetStudentPolicyOverrides.mockResolvedValue(null);
    });

    it('should return allowed for normal case', async () => {
      const result = await policyEngine.evaluatePolicy(
        mockContext,
        mockStudent,
        [],
        []
      );

      expect(result.allowed).toBe(true);
      expect(result.requiresApproval).toBe(false);
      expect(result.restrictions).toEqual([]);
      expect(result.applicableGroups).toEqual([]);
    });

    it('should deny all requests in emergency mode', async () => {
      policyEngine.updateConfig({ emergencyMode: true });

      const result = await policyEngine.evaluatePolicy(
        mockContext,
        mockStudent,
        mockGroups,
        mockRestrictions
      );

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Emergency mode active - all pass creation is disabled.');
    });

    it('should deny request with global restrictions', async () => {
      const globalRestriction: Restriction = {
        id: 'restriction-global',
        studentId: 'student-123',
        restrictionType: 'Global',
        isActive: true,
        reason: 'Global restriction',
        createdBy: 'admin-123',
        createdAt: new Date()
      };

      const result = await policyEngine.evaluatePolicy(
        mockContext,
        mockStudent,
        [],
        [globalRestriction]
      );

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Student has 1 active global restriction(s)');
      expect(result.restrictions).toEqual([globalRestriction]);
    });

    it('should deny request with class-level restrictions', async () => {
      const classRestriction: Restriction = {
        id: 'restriction-class',
        studentId: 'student-123',
        restrictionType: 'Class-Level',
        locationId: 'location-123',
        isActive: true,
        reason: 'Class restriction',
        createdBy: 'teacher-123',
        createdAt: new Date()
      };

      const result = await policyEngine.evaluatePolicy(
        mockContext,
        mockStudent,
        [],
        [classRestriction]
      );

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Student has 1 active class-level restriction(s)');
      expect(result.restrictions).toEqual([classRestriction]);
    });

    it('should deny request for student in negative group', async () => {
      const negativeGroup: Group = {
        id: 'group-negative',
        name: 'Detention',
        groupType: 'Negative',
        ownerId: 'teacher-123',
        assignedStudents: ['student-123'],
        createdAt: new Date(),
        lastUpdatedAt: new Date()
      };

      const result = await policyEngine.evaluatePolicy(
        mockContext,
        mockStudent,
        [negativeGroup],
        []
      );

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Student is in 1 negative group(s)');
      expect(result.applicableGroups).toEqual([negativeGroup]);
    });

    it('should deny request when classroom policy disallows leaving origin', async () => {
      mockGetClassroomPolicy.mockImplementation((locationId) => {
        if (locationId === 'classroom-A') {
          return Promise.resolve({
            id: 'policy-origin',
            locationId: 'classroom-A',
            ownerId: 'teacher-123',
            rules: {
              studentLeave: 'Disallow',
              studentArrive: 'Allow',
              teacherRequest: 'Allow'
            },
            lastUpdatedAt: new Date()
          });
        }
        return Promise.resolve({
          id: 'policy-dest',
          locationId: 'library',
          ownerId: 'librarian-123',
          rules: {
            studentLeave: 'Allow',
            studentArrive: 'Allow',
            teacherRequest: 'Allow'
          },
          lastUpdatedAt: new Date()
        });
      });

      const result = await policyEngine.evaluatePolicy(
        mockContext,
        mockStudent,
        [],
        []
      );

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Leaving classroom-A is not allowed by classroom policy.');
    });

    it('should deny request when classroom policy disallows arriving at destination', async () => {
      mockGetClassroomPolicy.mockImplementation((locationId) => {
        if (locationId === 'library') {
          return Promise.resolve({
            id: 'policy-dest',
            locationId: 'library',
            ownerId: 'librarian-123',
            rules: {
              studentLeave: 'Allow',
              studentArrive: 'Disallow',
              teacherRequest: 'Allow'
            },
            lastUpdatedAt: new Date()
          });
        }
        return Promise.resolve({
          id: 'policy-origin',
          locationId: 'classroom-A',
          ownerId: 'teacher-123',
          rules: {
            studentLeave: 'Allow',
            studentArrive: 'Allow',
            teacherRequest: 'Allow'
          },
          lastUpdatedAt: new Date()
        });
      });

      const result = await policyEngine.evaluatePolicy(
        mockContext,
        mockStudent,
        [],
        []
      );

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Arriving at library is not allowed by classroom policy.');
    });

    it('should require approval when classroom policy requires approval for leaving', async () => {
      mockGetClassroomPolicy.mockImplementation((locationId) => {
        if (locationId === 'classroom-A') {
          return Promise.resolve({
            id: 'policy-origin',
            locationId: 'classroom-A',
            ownerId: 'teacher-123',
            rules: {
              studentLeave: 'Require Approval',
              studentArrive: 'Allow',
              teacherRequest: 'Allow'
            },
            lastUpdatedAt: new Date()
          });
        }
        return Promise.resolve({
          id: 'policy-dest',
          locationId: 'library',
          ownerId: 'librarian-123',
          rules: {
            studentLeave: 'Allow',
            studentArrive: 'Allow',
            teacherRequest: 'Allow'
          },
          lastUpdatedAt: new Date()
        });
      });

      const result = await policyEngine.evaluatePolicy(
        mockContext,
        mockStudent,
        [],
        []
      );

      expect(result.allowed).toBe(false);
      expect(result.requiresApproval).toBe(true);
      expect(result.reason).toBe('Approval is required by classroom policy.');
      expect(result.approvalRequiredBy).toBe('teacher-123');
    });

    it('should require approval when classroom policy requires approval for arriving', async () => {
      mockGetClassroomPolicy.mockImplementation((locationId) => {
        if (locationId === 'library') {
          return Promise.resolve({
            id: 'policy-dest',
            locationId: 'library',
            ownerId: 'librarian-123',
            rules: {
              studentLeave: 'Allow',
              studentArrive: 'Require Approval',
              teacherRequest: 'Allow'
            },
            lastUpdatedAt: new Date()
          });
        }
        return Promise.resolve({
          id: 'policy-origin',
          locationId: 'classroom-A',
          ownerId: 'teacher-123',
          rules: {
            studentLeave: 'Allow',
            studentArrive: 'Allow',
            teacherRequest: 'Allow'
          },
          lastUpdatedAt: new Date()
        });
      });

      const result = await policyEngine.evaluatePolicy(
        mockContext,
        mockStudent,
        [],
        []
      );

      expect(result.allowed).toBe(false);
      expect(result.requiresApproval).toBe(true);
      expect(result.reason).toBe('Approval is required by classroom policy.');
      expect(result.approvalRequiredBy).toBe('librarian-123');
    });

    it('should use student policy overrides when available', async () => {
      mockGetStudentPolicyOverrides.mockImplementation((locationId, studentId) => {
        if (locationId === 'classroom-A' && studentId === 'student-123') {
          return Promise.resolve({
            id: 'override-123',
            locationId: 'classroom-A',
            studentId: 'student-123',
            rules: {
              studentLeave: 'Disallow'
            },
            lastUpdatedAt: new Date()
          });
        }
        return Promise.resolve(null);
      });

      const result = await policyEngine.evaluatePolicy(
        mockContext,
        mockStudent,
        [],
        []
      );

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Leaving classroom-A is not allowed by classroom policy.');
    });

    it('should handle disabled features', async () => {
      policyEngine.updateConfig({
        enableRestrictions: false,
        enableGroupRules: false,
        enableClassroomPolicies: false
      });

      const result = await policyEngine.evaluatePolicy(
        mockContext,
        mockStudent,
        mockGroups,
        mockRestrictions
      );

      expect(result.allowed).toBe(true);
      expect(result.restrictions).toEqual([]);
      expect(result.applicableGroups).toEqual([]);
    });

    it('should handle null classroom policies gracefully', async () => {
      mockGetClassroomPolicy.mockResolvedValue(null);

      const result = await policyEngine.evaluatePolicy(
        mockContext,
        mockStudent,
        [],
        []
      );

      expect(result.allowed).toBe(true);
      expect(result.requiresApproval).toBe(false);
    });
  });

  describe('evaluateRestrictions', () => {
    it('should filter restrictions by student ID', async () => {
      const restrictions: Restriction[] = [
        {
          id: 'restriction-1',
          studentId: 'student-123',
          restrictionType: 'Global',
          isActive: true,
          createdBy: 'admin',
          createdAt: new Date()
        },
        {
          id: 'restriction-2',
          studentId: 'student-456', // Different student
          restrictionType: 'Global',
          isActive: true,
          createdBy: 'admin',
          createdAt: new Date()
        }
      ];

      const result = await policyEngine.evaluatePolicy(
        mockContext,
        mockStudent,
        [],
        restrictions
      );

      expect(result.restrictions).toHaveLength(1);
      expect(result.restrictions[0].studentId).toBe('student-123');
    });

    it('should filter out inactive restrictions', async () => {
      const restrictions: Restriction[] = [
        {
          id: 'restriction-inactive',
          studentId: 'student-123',
          restrictionType: 'Global',
          isActive: false,
          createdBy: 'admin',
          createdAt: new Date()
        }
      ];

      const result = await policyEngine.evaluatePolicy(
        mockContext,
        mockStudent,
        [],
        restrictions
      );

      expect(result.allowed).toBe(true);
      expect(result.restrictions).toEqual([]);
    });

    it('should filter out expired restrictions', async () => {
      const expiredRestriction: Restriction = {
        id: 'restriction-expired',
        studentId: 'student-123',
        restrictionType: 'Global',
        isActive: true,
        createdBy: 'admin',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() - 1000) // Expired 1 second ago
      };

      const result = await policyEngine.evaluatePolicy(
        mockContext,
        mockStudent,
        [],
        [expiredRestriction]
      );

      expect(result.allowed).toBe(true);
      expect(result.restrictions).toEqual([]);
    });

    it('should allow non-expired restrictions', async () => {
      const futureRestriction: Restriction = {
        id: 'restriction-future',
        studentId: 'student-123',
        restrictionType: 'Global',
        isActive: true,
        createdBy: 'admin',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 10000) // Expires in 10 seconds
      };

      const result = await policyEngine.evaluatePolicy(
        mockContext,
        mockStudent,
        [],
        [futureRestriction]
      );

      expect(result.allowed).toBe(false);
      expect(result.restrictions).toEqual([futureRestriction]);
    });

    it('should handle multiple global restrictions', async () => {
      const restrictions: Restriction[] = [
        {
          id: 'restriction-1',
          studentId: 'student-123',
          restrictionType: 'Global',
          isActive: true,
          createdBy: 'admin',
          createdAt: new Date()
        },
        {
          id: 'restriction-2',
          studentId: 'student-123',
          restrictionType: 'Global',
          isActive: true,
          createdBy: 'admin',
          createdAt: new Date()
        }
      ];

      const result = await policyEngine.evaluatePolicy(
        mockContext,
        mockStudent,
        [],
        restrictions
      );

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Student has 2 active global restriction(s)');
    });

    it('should match class-level restrictions by location', async () => {
      const classRestriction: Restriction = {
        id: 'restriction-class',
        studentId: 'student-123',
        restrictionType: 'Class-Level',
        locationId: 'location-123',
        isActive: true,
        createdBy: 'teacher',
        createdAt: new Date()
      };

      const result = await policyEngine.evaluatePolicy(
        mockContext,
        mockStudent,
        [],
        [classRestriction]
      );

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Student has 1 active class-level restriction(s)');
    });

    it('should not match class-level restrictions for different locations', async () => {
      const classRestriction: Restriction = {
        id: 'restriction-class',
        studentId: 'student-123',
        restrictionType: 'Class-Level',
        locationId: 'different-location',
        isActive: true,
        createdBy: 'teacher',
        createdAt: new Date()
      };

      const result = await policyEngine.evaluatePolicy(
        mockContext,
        mockStudent,
        [],
        [classRestriction]
      );

      expect(result.allowed).toBe(true);
      expect(result.restrictions).toEqual([classRestriction]); // Still included in result but doesn't block
    });
  });

  describe('evaluateGroupRules', () => {
    it('should identify student groups correctly', async () => {
      const positiveGroup: Group = {
        id: 'group-positive',
        name: 'Honor Roll',
        groupType: 'Positive',
        ownerId: 'teacher-123',
        assignedStudents: ['student-123'],
        createdAt: new Date(),
        lastUpdatedAt: new Date()
      };

      const result = await policyEngine.evaluatePolicy(
        mockContext,
        mockStudent,
        [positiveGroup],
        []
      );

      expect(result.allowed).toBe(true);
      expect(result.applicableGroups).toEqual([positiveGroup]);
    });

    it('should handle students not in any groups', async () => {
      const groups: Group[] = [
        {
          id: 'group-other',
          name: 'Other Group',
          groupType: 'Positive',
          ownerId: 'teacher-123',
          assignedStudents: ['student-456'], // Different student
          createdAt: new Date(),
          lastUpdatedAt: new Date()
        }
      ];

      const result = await policyEngine.evaluatePolicy(
        mockContext,
        mockStudent,
        groups,
        []
      );

      expect(result.allowed).toBe(true);
      expect(result.applicableGroups).toEqual([]);
    });

    it('should handle multiple negative groups', async () => {
      const negativeGroups: Group[] = [
        {
          id: 'group-negative-1',
          name: 'Detention 1',
          groupType: 'Negative',
          ownerId: 'teacher-123',
          assignedStudents: ['student-123'],
          createdAt: new Date(),
          lastUpdatedAt: new Date()
        },
        {
          id: 'group-negative-2',
          name: 'Detention 2',
          groupType: 'Negative',
          ownerId: 'teacher-123',
          assignedStudents: ['student-123'],
          createdAt: new Date(),
          lastUpdatedAt: new Date()
        }
      ];

      const result = await policyEngine.evaluatePolicy(
        mockContext,
        mockStudent,
        negativeGroups,
        []
      );

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Student is in 2 negative group(s)');
      expect(result.applicableGroups).toEqual(negativeGroups);
    });

    it('should prioritize negative groups over positive groups', async () => {
      const mixedGroups: Group[] = [
        {
          id: 'group-positive',
          name: 'Honor Roll',
          groupType: 'Positive',
          ownerId: 'teacher-123',
          assignedStudents: ['student-123'],
          createdAt: new Date(),
          lastUpdatedAt: new Date()
        },
        {
          id: 'group-negative',
          name: 'Detention',
          groupType: 'Negative',
          ownerId: 'teacher-123',
          assignedStudents: ['student-123'],
          createdAt: new Date(),
          lastUpdatedAt: new Date()
        }
      ];

      const result = await policyEngine.evaluatePolicy(
        mockContext,
        mockStudent,
        mixedGroups,
        []
      );

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Student is in 1 negative group(s)');
      expect(result.applicableGroups).toHaveLength(1);
      expect(result.applicableGroups[0].groupType).toBe('Negative');
    });
  });
}); 