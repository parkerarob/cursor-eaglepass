export type GroupType = 'Positive' | 'Negative';
export type RestrictionType = 'Global' | 'Class-Level';
export type AutonomyType = 'Allow' | 'Disallow' | 'Require Approval';

export interface Group {
  id: string;
  name: string;
  groupType: GroupType;
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

export interface AutonomyMatrix {
  id: string;
  locationId: string;
  autonomyType: AutonomyType;
  groupId?: string; // Optional: specific group this applies to
  description?: string;
  createdAt: Date;
  lastUpdatedAt: Date;
}

export interface PolicyEvaluationResult {
  allowed: boolean;
  reason?: string;
  requiresApproval: boolean;
  approvalRequiredBy?: string; // ID of user who needs to approve
  restrictions: Restriction[];
  applicableGroups: Group[];
  applicableAutonomyRules: AutonomyMatrix[];
}

export interface PolicyContext {
  studentId: string;
  locationId: string;
  action: 'create_pass' | 'close_pass' | 'arrive' | 'return';
  destinationLocationId?: string;
  timestamp: Date;
}

export interface PolicyEngineConfig {
  enableGroupRules: boolean;
  enableRestrictions: boolean;
  enableAutonomyMatrix: boolean;
  emergencyMode: boolean;
} 