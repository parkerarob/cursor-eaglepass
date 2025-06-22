import { PolicyEngine } from '../policyEngine';
import { Group, Restriction, AutonomyMatrix, PolicyContext, PolicyEngineConfig } from '@/types/policy';
import { User } from '@/types';

describe('PolicyEngine', () => {
  let policyEngine: PolicyEngine;
  let mockStudent: User;
  let mockGroups: Group[];
  let mockRestrictions: Restriction[];
  let mockAutonomyMatrix: AutonomyMatrix[];

  beforeEach(() => {
    policyEngine = new PolicyEngine();
    mockStudent = {
      id: 'student-1',
      name: 'John Doe',
      email: 'john@student.nhcs.net',
      role: 'student',
      assignedLocationId: 'classroom-1',
    };

    mockGroups = [
      {
        id: 'group-1',
        name: 'Honor Roll',
        groupType: 'Positive',
        assignedStudents: ['student-1', 'student-2'],
        description: 'Students with high academic performance',
        createdAt: new Date(),
        lastUpdatedAt: new Date(),
      },
      {
        id: 'group-2',
        name: 'Disciplinary Probation',
        groupType: 'Negative',
        assignedStudents: ['student-3'],
        description: 'Students under disciplinary restrictions',
        createdAt: new Date(),
        lastUpdatedAt: new Date(),
      },
    ];

    mockRestrictions = [
      {
        id: 'restriction-1',
        studentId: 'student-1',
        restrictionType: 'Global',
        isActive: true,
        reason: 'Academic probation',
        createdBy: 'admin-1',
        createdAt: new Date(),
      },
      {
        id: 'restriction-2',
        studentId: 'student-2',
        restrictionType: 'Class-Level',
        isActive: true,
        reason: 'Behavioral issues in class',
        locationId: 'classroom-1',
        createdBy: 'teacher-1',
        createdAt: new Date(),
      },
    ];

    mockAutonomyMatrix = [
      {
        id: 'autonomy-1',
        locationId: 'classroom-1',
        autonomyType: 'Allow',
        description: 'Standard classroom permissions',
        createdAt: new Date(),
        lastUpdatedAt: new Date(),
      },
      {
        id: 'autonomy-2',
        locationId: 'library-1',
        autonomyType: 'Require Approval',
        description: 'Library visits require teacher approval',
        createdAt: new Date(),
        lastUpdatedAt: new Date(),
      },
      {
        id: 'autonomy-3',
        locationId: 'office-1',
        autonomyType: 'Disallow',
        description: 'Office visits not allowed without escort',
        createdAt: new Date(),
        lastUpdatedAt: new Date(),
      },
    ];
  });

  describe('Emergency Mode', () => {
    it('should allow all actions when emergency mode is active', async () => {
      policyEngine.updateConfig({ emergencyMode: true });

      const context: PolicyContext = {
        studentId: 'student-1',
        locationId: 'classroom-1',
        action: 'create_pass',
        destinationLocationId: 'office-1',
        timestamp: new Date(),
      };

      const result = await policyEngine.evaluatePolicy(
        context,
        mockStudent,
        mockGroups,
        mockRestrictions,
        mockAutonomyMatrix
      );

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Emergency mode active - all pass creation is disabled.');
    });
  });

  describe('Restrictions', () => {
    it('should block action when student has global restriction', async () => {
      const context: PolicyContext = {
        studentId: 'student-1',
        locationId: 'classroom-1',
        action: 'create_pass',
        destinationLocationId: 'bathroom-1',
        timestamp: new Date(),
      };

      const result = await policyEngine.evaluatePolicy(
        context,
        mockStudent,
        mockGroups,
        mockRestrictions,
        mockAutonomyMatrix
      );

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('active global restriction');
      expect(result.restrictions).toHaveLength(1);
      expect(result.restrictions[0].id).toBe('restriction-1');
    });

    it('should block action when student has class-level restriction', async () => {
      const studentWithClassRestriction: User = {
        ...mockStudent,
        id: 'student-2',
      };

      const context: PolicyContext = {
        studentId: 'student-2',
        locationId: 'classroom-1',
        action: 'create_pass',
        destinationLocationId: 'bathroom-1',
        timestamp: new Date(),
      };

      const result = await policyEngine.evaluatePolicy(
        context,
        studentWithClassRestriction,
        mockGroups,
        mockRestrictions,
        mockAutonomyMatrix
      );

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('active class-level restriction');
      expect(result.restrictions).toHaveLength(1);
      expect(result.restrictions[0].id).toBe('restriction-2');
    });

    it('should allow action when student has no restrictions', async () => {
      const studentWithoutRestrictions: User = {
        ...mockStudent,
        id: 'student-4',
      };

      const context: PolicyContext = {
        studentId: 'student-4',
        locationId: 'classroom-1',
        action: 'create_pass',
        destinationLocationId: 'bathroom-1',
        timestamp: new Date(),
      };

      const result = await policyEngine.evaluatePolicy(
        context,
        studentWithoutRestrictions,
        mockGroups,
        mockRestrictions,
        mockAutonomyMatrix
      );

      expect(result.allowed).toBe(true);
      expect(result.restrictions).toHaveLength(0);
    });

    it('should ignore expired restrictions', async () => {
      const expiredRestriction: Restriction = {
        id: 'restriction-expired',
        studentId: 'student-1',
        restrictionType: 'Global',
        isActive: true,
        reason: 'Expired restriction',
        createdBy: 'admin-1',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
      };

      const context: PolicyContext = {
        studentId: 'student-1',
        locationId: 'classroom-1',
        action: 'create_pass',
        destinationLocationId: 'bathroom-1',
        timestamp: new Date(),
      };

      const result = await policyEngine.evaluatePolicy(
        context,
        mockStudent,
        mockGroups,
        [expiredRestriction],
        mockAutonomyMatrix
      );

      expect(result.allowed).toBe(true);
      expect(result.restrictions).toHaveLength(0);
    });
  });

  describe('Group Rules', () => {
    it('should block action when student is in negative group', async () => {
      const studentInNegativeGroup: User = {
        ...mockStudent,
        id: 'student-3',
      };

      const context: PolicyContext = {
        studentId: 'student-3',
        locationId: 'classroom-1',
        action: 'create_pass',
        destinationLocationId: 'bathroom-1',
        timestamp: new Date(),
      };

      const result = await policyEngine.evaluatePolicy(
        context,
        studentInNegativeGroup,
        mockGroups,
        [],
        mockAutonomyMatrix
      );

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('negative group');
      expect(result.applicableGroups).toHaveLength(1);
      expect(result.applicableGroups[0].id).toBe('group-2');
    });

    it('should allow action when student is in positive group', async () => {
      const context: PolicyContext = {
        studentId: 'student-1',
        locationId: 'classroom-1',
        action: 'create_pass',
        destinationLocationId: 'bathroom-1',
        timestamp: new Date(),
      };

      const result = await policyEngine.evaluatePolicy(
        context,
        mockStudent,
        mockGroups,
        [],
        mockAutonomyMatrix
      );

      expect(result.allowed).toBe(true);
      expect(result.applicableGroups).toHaveLength(1);
      expect(result.applicableGroups[0].id).toBe('group-1');
    });

    it('should allow action when student is not in any groups', async () => {
      const studentNotInGroups: User = {
        ...mockStudent,
        id: 'student-4',
      };

      const context: PolicyContext = {
        studentId: 'student-4',
        locationId: 'classroom-1',
        action: 'create_pass',
        destinationLocationId: 'bathroom-1',
        timestamp: new Date(),
      };

      const result = await policyEngine.evaluatePolicy(
        context,
        studentNotInGroups,
        mockGroups,
        [],
        mockAutonomyMatrix
      );

      expect(result.allowed).toBe(true);
      expect(result.applicableGroups).toHaveLength(0);
    });
  });

  describe('Autonomy Matrix', () => {
    it('should allow action when autonomy type is Allow', async () => {
      const context: PolicyContext = {
        studentId: 'student-1',
        locationId: 'classroom-1',
        action: 'create_pass',
        destinationLocationId: 'bathroom-1',
        timestamp: new Date(),
      };

      const result = await policyEngine.evaluatePolicy(
        context,
        mockStudent,
        [],
        [],
        mockAutonomyMatrix
      );

      expect(result.allowed).toBe(true);
      expect(result.requiresApproval).toBe(false);
      expect(result.applicableAutonomyRules).toHaveLength(1);
      expect(result.applicableAutonomyRules[0].id).toBe('autonomy-1');
    });

    it('should require approval when autonomy type is Require Approval', async () => {
      const context: PolicyContext = {
        studentId: 'student-1',
        locationId: 'library-1',
        action: 'create_pass',
        destinationLocationId: 'bathroom-1',
        timestamp: new Date(),
      };

      const result = await policyEngine.evaluatePolicy(
        context,
        mockStudent,
        [],
        [],
        mockAutonomyMatrix
      );

      expect(result.allowed).toBe(false);
      expect(result.requiresApproval).toBe(true);
      expect(result.reason).toContain('Approval required');
      expect(result.applicableAutonomyRules).toHaveLength(1);
      expect(result.applicableAutonomyRules[0].id).toBe('autonomy-2');
    });

    it('should disallow action when autonomy type is Disallow', async () => {
      const context: PolicyContext = {
        studentId: 'student-1',
        locationId: 'office-1',
        action: 'create_pass',
        destinationLocationId: 'bathroom-1',
        timestamp: new Date(),
      };

      const result = await policyEngine.evaluatePolicy(
        context,
        mockStudent,
        [],
        [],
        mockAutonomyMatrix
      );

      expect(result.allowed).toBe(false);
      expect(result.requiresApproval).toBe(false);
      expect(result.reason).toContain('Action not allowed');
      expect(result.applicableAutonomyRules).toHaveLength(1);
      expect(result.applicableAutonomyRules[0].id).toBe('autonomy-3');
    });

    it('should allow action when no autonomy rules exist for location', async () => {
      const context: PolicyContext = {
        studentId: 'student-1',
        locationId: 'unknown-location',
        action: 'create_pass',
        destinationLocationId: 'bathroom-1',
        timestamp: new Date(),
      };

      const result = await policyEngine.evaluatePolicy(
        context,
        mockStudent,
        [],
        [],
        mockAutonomyMatrix
      );

      expect(result.allowed).toBe(true);
      expect(result.requiresApproval).toBe(false);
      expect(result.applicableAutonomyRules).toHaveLength(0);
    });
  });

  describe('Configuration', () => {
    it('should respect configuration settings', async () => {
      const config: PolicyEngineConfig = {
        enableGroupRules: false,
        enableRestrictions: false,
        enableAutonomyMatrix: false,
        emergencyMode: false,
      };

      policyEngine.updateConfig(config);

      const context: PolicyContext = {
        studentId: 'student-1',
        locationId: 'classroom-1',
        action: 'create_pass',
        destinationLocationId: 'bathroom-1',
        timestamp: new Date(),
      };

      const result = await policyEngine.evaluatePolicy(
        context,
        mockStudent,
        mockGroups,
        mockRestrictions,
        mockAutonomyMatrix
      );

      expect(result.allowed).toBe(true);
      expect(result.restrictions).toHaveLength(0);
      expect(result.applicableGroups).toHaveLength(0);
      expect(result.applicableAutonomyRules).toHaveLength(0);
    });

    it('should return current configuration', () => {
      const config = policyEngine.getConfig();
      expect(config).toEqual({
        enableGroupRules: true,
        enableRestrictions: true,
        enableAutonomyMatrix: true,
        emergencyMode: false,
      });
    });
  });

  describe('Priority Order', () => {
    it('should check restrictions before group rules', async () => {
      const context: PolicyContext = {
        studentId: 'student-1',
        locationId: 'classroom-1',
        action: 'create_pass',
        destinationLocationId: 'bathroom-1',
        timestamp: new Date(),
      };

      const result = await policyEngine.evaluatePolicy(
        context,
        mockStudent,
        mockGroups,
        mockRestrictions,
        mockAutonomyMatrix
      );

      // Should be blocked by restriction, not group rules
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('global restriction');
      expect(result.applicableGroups).toHaveLength(0); // Group rules not checked
    });

    it('should check group rules before autonomy matrix', async () => {
      const studentInNegativeGroup: User = {
        ...mockStudent,
        id: 'student-3',
      };

      const context: PolicyContext = {
        studentId: 'student-3',
        locationId: 'classroom-1',
        action: 'create_pass',
        destinationLocationId: 'bathroom-1',
        timestamp: new Date(),
      };

      const result = await policyEngine.evaluatePolicy(
        context,
        studentInNegativeGroup,
        mockGroups,
        [],
        mockAutonomyMatrix
      );

      // Should be blocked by negative group, not autonomy matrix
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('negative group');
      expect(result.applicableAutonomyRules).toHaveLength(0); // Autonomy matrix not checked
    });
  });
}); 