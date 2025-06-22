export type GroupType = 'Positive' | 'Negative';
export type RestrictionType = 'Global' | 'Class-Level';
export type AutonomyType = 'Allow' | 'Require Approval' | 'Disallow';

export interface ClassroomPolicyRule {
  studentLeave: AutonomyType;
  studentArrive: AutonomyType;
  teacherRequest: AutonomyType;
}

export interface ClassroomPolicy {
  id: string; // Firestore document ID, same as the locationId
  locationId: string;
  ownerId: string; // Teacher's user ID
  rules: ClassroomPolicyRule;
  lastUpdatedAt: Date;
}

export interface StudentPolicyOverride {
  id: string; // Firestore document ID
  locationId: string;
  studentId: string;
  rules: Partial<ClassroomPolicyRule>; // Can override one or all rules
  lastUpdatedAt: Date;
}

export interface Group {
  id: string;
  name: string;
  groupType: GroupType;
  ownerId: string; // ID of the teacher who owns the group
  assignedStudents: string[]; // Array of student IDs
  description?: string;
  createdAt: Date;
  lastUpdatedAt: Date;
}

export interface Restriction {
  id: string;
  studentId: string;
  restrictionType: RestrictionType;
  isActive: boolean;
  reason?: string;
  locationId?: string; // For class-level restrictions
  createdBy: string; // ID of user who created the restriction
  createdAt: Date;
  expiresAt?: Date; // Optional expiration date
}

export interface PolicyEvaluationResult {
  allowed: boolean;
  requiresApproval: boolean;
  reason?: string;
  restrictions: Restriction[];
  applicableGroups: Group[];
  approvalRequiredBy?: string; // Teacher/Admin ID
}

export interface PolicyContext {
  studentId: string;
  locationId: string; // Deprecating in favor of origin/destination
  origin: string;
  destination: string;
  passType: 'Gated' | 'Immediate';
}

export interface PolicyEngineConfig {
  enableGroupRules: boolean;
  enableRestrictions: boolean;
  enableClassroomPolicies: boolean; // Replaces enableAutonomyMatrix
  emergencyMode: boolean;
}

// This is the old model and is now deprecated.
// It's being replaced by ClassroomPolicy and StudentPolicyOverride
// @deprecated Use ClassroomPolicy and StudentPolicyOverride instead
export interface AutonomyMatrix {
  id: string;
  locationId: string;
  groupId?: string;
  autonomyType: AutonomyType;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
} 