import { 
  Group, 
  Restriction, 
  AutonomyMatrix, 
  PolicyEvaluationResult, 
  PolicyContext, 
  PolicyEngineConfig
} from '@/types/policy';
import { User } from '@/types';

export class PolicyEngine {
  private config: PolicyEngineConfig;

  constructor(config: PolicyEngineConfig = {
    enableGroupRules: true,
    enableRestrictions: true,
    enableAutonomyMatrix: true,
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
    autonomyMatrix: AutonomyMatrix[]
  ): Promise<PolicyEvaluationResult> {
    const result: PolicyEvaluationResult = {
      allowed: true,
      requiresApproval: false,
      restrictions: [],
      applicableGroups: [],
      applicableAutonomyRules: []
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

    // Check autonomy matrix
    if (this.config.enableAutonomyMatrix) {
      const autonomyResult = this.evaluateAutonomyMatrix(context, student, autonomyMatrix);
      if (!autonomyResult.allowed) {
        result.allowed = false;
        result.reason = autonomyResult.reason;
        result.requiresApproval = autonomyResult.requiresApproval;
        result.approvalRequiredBy = autonomyResult.approvalRequiredBy;
        result.applicableAutonomyRules = autonomyResult.applicableAutonomyRules;
        return result;
      }
      result.requiresApproval = autonomyResult.requiresApproval;
      result.approvalRequiredBy = autonomyResult.approvalRequiredBy;
      result.applicableAutonomyRules = autonomyResult.applicableAutonomyRules;
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
   * Evaluate autonomy matrix rules
   */
  private evaluateAutonomyMatrix(
    context: PolicyContext,
    student: User,
    autonomyMatrix: AutonomyMatrix[]
  ): { 
    allowed: boolean; 
    reason?: string; 
    requiresApproval: boolean; 
    approvalRequiredBy?: string;
    applicableAutonomyRules: AutonomyMatrix[];
  } {
    const applicableRules = autonomyMatrix.filter(rule => 
      rule.locationId === context.locationId
    );

    if (applicableRules.length === 0) {
      return {
        allowed: true,
        requiresApproval: false,
        applicableAutonomyRules: []
      };
    }

    // Check for group-specific rules first
    const groupSpecificRules = applicableRules.filter(rule => rule.groupId);
    if (groupSpecificRules.length > 0) {
      // TODO: Check if student is in the specified group
      // For now, we'll use the most restrictive rule
      const mostRestrictiveRule = this.getMostRestrictiveRule(groupSpecificRules);
      return this.evaluateAutonomyRule(mostRestrictiveRule, applicableRules);
    }

    // Use general location rules
    const generalRules = applicableRules.filter(rule => !rule.groupId);
    if (generalRules.length > 0) {
      const mostRestrictiveRule = this.getMostRestrictiveRule(generalRules);
      return this.evaluateAutonomyRule(mostRestrictiveRule, applicableRules);
    }

    return {
      allowed: true,
      requiresApproval: false,
      applicableAutonomyRules: applicableRules
    };
  }

  /**
   * Get the most restrictive autonomy rule
   */
  private getMostRestrictiveRule(rules: AutonomyMatrix[]): AutonomyMatrix {
    // Order: Disallow > Require Approval > Allow
    const disallowRule = rules.find(rule => rule.autonomyType === 'Disallow');
    if (disallowRule) return disallowRule;

    const requireApprovalRule = rules.find(rule => rule.autonomyType === 'Require Approval');
    if (requireApprovalRule) return requireApprovalRule;

    return rules[0]; // Default to first rule (should be Allow)
  }

  /**
   * Evaluate a single autonomy rule
   */
  private evaluateAutonomyRule(
    rule: AutonomyMatrix,
    allRules: AutonomyMatrix[]
  ): { 
    allowed: boolean; 
    reason?: string; 
    requiresApproval: boolean; 
    approvalRequiredBy?: string;
    applicableAutonomyRules: AutonomyMatrix[];
  } {
    switch (rule.autonomyType) {
      case 'Disallow':
        return {
          allowed: false,
          reason: `Action not allowed at this location: ${rule.description || 'No reason provided'}`,
          requiresApproval: false,
          applicableAutonomyRules: allRules
        };

      case 'Require Approval':
        return {
          allowed: false,
          reason: `Approval required for this action: ${rule.description || 'No reason provided'}`,
          requiresApproval: true,
          approvalRequiredBy: rule.locationId, // TODO: Get responsible party ID
          applicableAutonomyRules: allRules
        };

      case 'Allow':
      default:
        return {
          allowed: true,
          requiresApproval: false,
          applicableAutonomyRules: allRules
        };
    }
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