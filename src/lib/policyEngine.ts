import { 
  Group, 
  Restriction, 
  PolicyEvaluationResult, 
  PolicyContext, 
  PolicyEngineConfig,
} from '@/types/policy';
import { User } from '@/types';
import { 
  getClassroomPolicy, 
  getStudentPolicyOverridesForStudent 
} from './firebase/firestore';

export class PolicyEngine {
  private config: PolicyEngineConfig;

  constructor(config: PolicyEngineConfig = {
    enableGroupRules: true,
    enableRestrictions: true,
    enableClassroomPolicies: true,
    emergencyMode: false
  }) {
    this.config = config;
  }

  /**
   * Evaluate if a student is allowed to perform an action
   */
  async evaluatePolicy(
    context: PolicyContext,
    student: User,
    groups: Group[],
    restrictions: Restriction[],
  ): Promise<PolicyEvaluationResult> {
    const result: PolicyEvaluationResult = {
      allowed: true,
      requiresApproval: false,
      restrictions: [],
      applicableGroups: [],
    };

    // Emergency mode overrides all policies
    if (this.config.emergencyMode) {
      result.allowed = true;
      result.reason = 'Emergency mode active - all actions allowed';
      return result;
    }

    // Check restrictions first (most restrictive)
    if (this.config.enableRestrictions) {
      const restrictionResult = this.evaluateRestrictions(context, restrictions);
      if (!restrictionResult.allowed) {
        result.allowed = false;
        result.reason = restrictionResult.reason;
        result.restrictions = restrictionResult.restrictions;
        return result;
      }
      result.restrictions = restrictionResult.restrictions;
    }

    // Check group rules
    if (this.config.enableGroupRules) {
      const groupResult = this.evaluateGroupRules(context, student, groups);
      if (!groupResult.allowed) {
        result.allowed = false;
        result.reason = groupResult.reason;
        result.applicableGroups = groupResult.applicableGroups;
        return result;
      }
      result.applicableGroups = groupResult.applicableGroups;
    }

    // Check classroom policies
    if (this.config.enableClassroomPolicies) {
      const autonomyResult = await this.evaluateClassroomPolicies(context);
      if (!autonomyResult.allowed) {
        result.allowed = false;
        result.reason = autonomyResult.reason;
        result.requiresApproval = autonomyResult.requiresApproval;
        result.approvalRequiredBy = autonomyResult.approvalRequiredBy;
        return result;
      }
      result.requiresApproval = autonomyResult.requiresApproval;
      result.approvalRequiredBy = autonomyResult.approvalRequiredBy;
    }

    return result;
  }

  /**
   * Evaluate student restrictions
   */
  private evaluateRestrictions(
    context: PolicyContext,
    restrictions: Restriction[]
  ): { allowed: boolean; reason?: string; restrictions: Restriction[] } {
    const applicableRestrictions = restrictions.filter(restriction => 
      restriction.studentId === context.studentId && 
      restriction.isActive &&
      (!restriction.expiresAt || restriction.expiresAt > new Date())
    );

    // Check for global restrictions
    const globalRestrictions = applicableRestrictions.filter(r => r.restrictionType === 'Global');
    if (globalRestrictions.length > 0) {
      return {
        allowed: false,
        reason: `Student has ${globalRestrictions.length} active global restriction(s)`,
        restrictions: globalRestrictions
      };
    }

    // Check for class-level restrictions
    const classRestrictions = applicableRestrictions.filter(r => 
      r.restrictionType === 'Class-Level' && 
      r.locationId === context.locationId
    );
    if (classRestrictions.length > 0) {
      return {
        allowed: false,
        reason: `Student has ${classRestrictions.length} active class-level restriction(s)`,
        restrictions: classRestrictions
      };
    }

    return {
      allowed: true,
      restrictions: applicableRestrictions
    };
  }

  /**
   * Evaluate group rules
   */
  private evaluateGroupRules(
    context: PolicyContext,
    student: User,
    groups: Group[]
  ): { allowed: boolean; reason?: string; applicableGroups: Group[] } {
    const studentGroups = groups.filter(group => 
      group.assignedStudents.includes(student.id)
    );

    // Check negative groups first (most restrictive)
    const negativeGroups = studentGroups.filter(group => group.groupType === 'Negative');
    if (negativeGroups.length > 0) {
      return {
        allowed: false,
        reason: `Student is in ${negativeGroups.length} negative group(s)`,
        applicableGroups: negativeGroups
      };
    }

    return {
      allowed: true,
      applicableGroups: studentGroups
    };
  }

  /**
   * Evaluate classroom and student-specific policies.
   * This replaces the old Autonomy Matrix evaluation.
   */
  private async evaluateClassroomPolicies(
    context: PolicyContext,
  ): Promise<{ 
    allowed: boolean; 
    reason?: string; 
    requiresApproval: boolean; 
    approvalRequiredBy?: string;
  }> {
    const { studentId, origin, destination } = context;

    // Fetch policies for both origin and destination
    const [
      originPolicy, 
      originOverrides,
      destinationPolicy,
      destinationOverrides
    ] = await Promise.all([
      getClassroomPolicy(origin),
      getStudentPolicyOverridesForStudent(origin, studentId),
      getClassroomPolicy(destination),
      getStudentPolicyOverridesForStudent(destination, studentId)
    ]);

    // Rule 1: Evaluate leaving the origin
    const leaveRule = originOverrides?.rules.studentLeave || originPolicy?.rules.studentLeave || 'Allow';
    
    // Rule 2: Evaluate arriving at the destination
    const arriveRule = destinationOverrides?.rules.studentArrive || destinationPolicy?.rules.studentArrive || 'Allow';

    // Combine results - the most restrictive rule wins
    if (leaveRule === 'Disallow' || arriveRule === 'Disallow') {
      return {
        allowed: false,
        requiresApproval: false,
        reason: leaveRule === 'Disallow' 
          ? `Leaving ${origin} is not allowed by classroom policy.`
          : `Arriving at ${destination} is not allowed by classroom policy.`
      };
    }

    if (leaveRule === 'Require Approval' || arriveRule === 'Require Approval') {
      return {
        allowed: false,
        requiresApproval: true,
        reason: `Approval is required by classroom policy.`,
        approvalRequiredBy: leaveRule === 'Require Approval' ? originPolicy?.ownerId : destinationPolicy?.ownerId
      };
    }

    return { allowed: true, requiresApproval: false };
  }

  /**
   * Update policy engine configuration
   */
  updateConfig(newConfig: Partial<PolicyEngineConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   */
  getConfig(): PolicyEngineConfig {
    return { ...this.config };
  }
} 