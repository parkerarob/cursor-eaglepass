import { Pass, User, PassFormData } from '@/types';
import { createPass, updatePass, getActivePassByStudentId, getGroups, getActiveRestrictionsByStudentId, getAutonomyMatrix } from '@/lib/firebase/firestore';
import { PassStateMachine, ActionState } from '@/lib/stateMachine';
import { PolicyEngine } from '@/lib/policyEngine';
import { PolicyContext } from '@/types/policy';
import { logEvent } from '@/lib/eventLogger';
import { NotificationService } from '@/lib/notificationService';
import { measureApiCall, logError, logUserAction } from '@/lib/monitoringService';

export interface PassServiceResult {
  success: boolean;
  updatedPass?: Pass;
  error?: string;
  requiresApproval?: boolean;
  approvalRequiredBy?: string;
}

export class PassService {
  private static policyEngine = new PolicyEngine();

  /**
   * Create a new pass
   */
  static async createPass(formData: PassFormData, student: User): Promise<PassServiceResult> {
    return measureApiCall('createPass', async () => {
      try {
        // Log user action
        logUserAction('create_pass', {
          destinationLocationId: formData.destinationLocationId,
          studentId: student.id,
          studentRole: student.role,
        }, student.id, student.role);

        // Policy check for pass creation
        const policyResult = await this.checkPolicy(student, 'create_pass', student.assignedLocationId!, formData.destinationLocationId);
        if (!policyResult.allowed) {
          await logEvent({
            passId: undefined,
            studentId: student.id,
            actorId: student.id,
            timestamp: new Date(),
            eventType: 'POLICY_DENIED',
            details: policyResult.reason,
            policyContext: policyResult,
          });
          return { 
            success: false, 
            error: policyResult.reason || 'Policy check failed',
            requiresApproval: policyResult.requiresApproval,
            approvalRequiredBy: policyResult.approvalRequiredBy
          };
        }

        // Check if student already has an active pass
        const existingPass = await getActivePassByStudentId(student.id);
        
        if (existingPass) {
          // Student has an active pass - add a new leg to it
          const stateMachine = new PassStateMachine(existingPass, student);
          const currentLeg = stateMachine.getCurrentLeg();
          
          if (currentLeg && currentLeg.state === 'IN') {
            // Student is currently "IN" at a location - add new leg from current location
            const updatedPass = stateMachine.addLeg(
              currentLeg.destinationLocationId, // Origin is current location
              formData.destinationLocationId,   // Destination is new location
              'OUT'                             // State is OUT (traveling)
            );
            await updatePass(updatedPass.id, updatedPass);
            await logEvent({
              passId: updatedPass.id,
              studentId: student.id,
              actorId: student.id,
              timestamp: new Date(),
              eventType: 'DEPARTED',
              details: `Added new leg to existing pass: ${updatedPass.id}`,
            });
            return { success: true, updatedPass };
          } else {
            // Student is "OUT" - they can't create a new pass
            await logEvent({
              passId: existingPass.id,
              studentId: student.id,
              actorId: student.id,
              timestamp: new Date(),
              eventType: 'INVALID_TRANSITION',
              details: 'Attempted to create new pass while already traveling',
            });
            return { 
              success: false, 
              error: 'Cannot create new pass while already traveling' 
            };
          }
        } else {
          // No active pass - create new pass from assigned class
          const newPass = PassStateMachine.createPass(formData, student);
          await createPass(newPass);
          await logEvent({
            passId: newPass.id,
            studentId: student.id,
            actorId: student.id,
            timestamp: new Date(),
            eventType: 'PASS_CREATED',
            details: `Created new pass: ${newPass.id}`,
          });
          return { success: true, updatedPass: newPass };
        }
      } catch (error) {
        logError('Failed to create pass', {
          studentId: student.id,
          destinationLocationId: formData.destinationLocationId,
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
        }, 'high');

        await logEvent({
          passId: undefined,
          studentId: student.id,
          actorId: student.id,
          timestamp: new Date(),
          eventType: 'ERROR',
          details: error instanceof Error ? error.message : 'Failed to create pass',
        });
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Failed to create pass' 
        };
      }
    }, { studentId: student.id, action: 'create_pass' });
  }

  /**
   * Check policy for a specific action
   */
  private static async checkPolicy(
    student: User, 
    action: PolicyContext['action'], 
    locationId: string, 
    destinationLocationId?: string
  ) {
    const context: PolicyContext = {
      studentId: student.id,
      locationId,
      action,
      destinationLocationId,
      timestamp: new Date()
    };

    // Load policy data
    const [groups, restrictions, autonomyMatrix] = await Promise.all([
      getGroups(),
      getActiveRestrictionsByStudentId(student.id),
      getAutonomyMatrix()
    ]);

    return await this.policyEngine.evaluatePolicy(context, student, groups, restrictions, autonomyMatrix);
  }

  /**
   * Handle "I've Arrived" action
   */
  static async arriveAtDestination(pass: Pass, student: User): Promise<PassServiceResult> {
    return measureApiCall('arriveAtDestination', async () => {
      try {
        // Log user action
        logUserAction('arrive_at_destination', {
          passId: pass.id,
          studentId: student.id,
          studentRole: student.role,
        }, student.id, student.role);

        const stateMachine = new PassStateMachine(pass, student);
        const validation = stateMachine.validateTransition('arrive');
        
        if (!validation.valid) {
          await logEvent({
            passId: pass.id,
            studentId: student.id,
            actorId: student.id,
            timestamp: new Date(),
            eventType: 'INVALID_TRANSITION',
            details: validation.error,
          });
          return { success: false, error: validation.error };
        }

        const updatedPass = stateMachine.arriveAtDestination();
        
        // Check for notifications before updating
        const passWithNotifications = await this.checkAndSendNotifications(updatedPass, student);
        
        await updatePass(passWithNotifications.id, passWithNotifications);
        await logEvent({
          passId: passWithNotifications.id,
          studentId: student.id,
          actorId: student.id,
          timestamp: new Date(),
          eventType: 'ARRIVED',
          details: `Arrived at destination for pass: ${passWithNotifications.id}`,
        });
        return { success: true, updatedPass: passWithNotifications };
      } catch (error) {
        logError('Failed to arrive at destination', {
          passId: pass.id,
          studentId: student.id,
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
        }, 'high');

        await logEvent({
          passId: pass.id,
          studentId: student.id,
          actorId: student.id,
          timestamp: new Date(),
          eventType: 'ERROR',
          details: error instanceof Error ? error.message : 'Failed to arrive at destination',
        });
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Failed to arrive at destination' 
        };
      }
    }, { studentId: student.id, action: 'arrive_at_destination', passId: pass.id });
  }

  /**
   * Handle "Return to Class" action
   */
  static async returnToClass(pass: Pass, student: User): Promise<PassServiceResult> {
    try {
      const stateMachine = new PassStateMachine(pass, student);
      const validation = stateMachine.validateTransition('return_to_class');
      
      if (!validation.valid) {
        await logEvent({
          passId: pass.id,
          studentId: student.id,
          actorId: student.id,
          timestamp: new Date(),
          eventType: 'INVALID_TRANSITION',
          details: validation.error,
        });
        return { success: false, error: validation.error };
      }

      const updatedPass = stateMachine.returnToClass();
      
      // Check for notifications before updating
      const passWithNotifications = await this.checkAndSendNotifications(updatedPass, student);
      
      await updatePass(passWithNotifications.id, passWithNotifications);
      await logEvent({
        passId: passWithNotifications.id,
        studentId: student.id,
        actorId: student.id,
        timestamp: new Date(),
        eventType: 'RETURNED',
        details: `Returned to class for pass: ${passWithNotifications.id}`,
      });
      return { success: true, updatedPass: passWithNotifications };
    } catch (error) {
      await logEvent({
        passId: pass.id,
        studentId: student.id,
        actorId: student.id,
        timestamp: new Date(),
        eventType: 'ERROR',
        details: error instanceof Error ? error.message : 'Failed to return to class',
      });
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to return to class' 
      };
    }
  }

  /**
   * Handle "Close Pass" action (return to class and close)
   */
  static async closePass(pass: Pass, student: User): Promise<PassServiceResult> {
    try {
      const stateMachine = new PassStateMachine(pass, student);
      const validation = stateMachine.validateTransition('close_pass');
      
      if (!validation.valid) {
        await logEvent({
          passId: pass.id,
          studentId: student.id,
          actorId: student.id,
          timestamp: new Date(),
          eventType: 'INVALID_TRANSITION',
          details: validation.error,
        });
        return { success: false, error: validation.error };
      }

      const updatedPass = stateMachine.closePass();
      
      // Check for notifications before updating (even though pass is closing)
      const passWithNotifications = await this.checkAndSendNotifications(updatedPass, student);
      
      await updatePass(passWithNotifications.id, passWithNotifications);
      await logEvent({
        passId: passWithNotifications.id,
        studentId: student.id,
        actorId: student.id,
        timestamp: new Date(),
        eventType: 'PASS_CLOSED',
        details: `Closed pass: ${passWithNotifications.id}`,
      });
      return { success: true, updatedPass: passWithNotifications };
    } catch (error) {
      await logEvent({
        passId: pass.id,
        studentId: student.id,
        actorId: student.id,
        timestamp: new Date(),
        eventType: 'ERROR',
        details: error instanceof Error ? error.message : 'Failed to close pass',
      });
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to close pass' 
      };
    }
  }

  /**
   * Handle restroom return logic
   */
  static async handleRestroomReturn(pass: Pass, student: User): Promise<PassServiceResult> {
    try {
      const stateMachine = new PassStateMachine(pass, student);
      const validation = stateMachine.validateTransition('restroom_return');
      
      if (!validation.valid) {
        await logEvent({
          passId: pass.id,
          studentId: student.id,
          actorId: student.id,
          timestamp: new Date(),
          eventType: 'INVALID_TRANSITION',
          details: validation.error,
        });
        return { success: false, error: validation.error };
      }

      const updatedPass = await stateMachine.handleRestroomReturn();
      
      // Check for notifications before updating
      const passWithNotifications = await this.checkAndSendNotifications(updatedPass, student);
      
      await updatePass(passWithNotifications.id, passWithNotifications);
      await logEvent({
        passId: passWithNotifications.id,
        studentId: student.id,
        actorId: student.id,
        timestamp: new Date(),
        eventType: passWithNotifications.status === 'CLOSED' ? 'PASS_CLOSED' : 'ARRIVED',
        details: `Restroom return for pass: ${passWithNotifications.id}`,
      });
      return { success: true, updatedPass: passWithNotifications };
    } catch (error) {
      await logEvent({
        passId: pass.id,
        studentId: student.id,
        actorId: student.id,
        timestamp: new Date(),
        eventType: 'ERROR',
        details: error instanceof Error ? error.message : 'Failed to handle restroom return',
      });
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to handle restroom return' 
      };
    }
  }

  /**
   * Get action state for the current pass
   */
  static async getActionState(pass: Pass, student: User): Promise<ActionState> {
    const stateMachine = new PassStateMachine(pass, student);
    return await stateMachine.determineActionState();
  }

  /**
   * Get current state information
   */
  static getCurrentState(pass: Pass, student: User) {
    const stateMachine = new PassStateMachine(pass, student);
    return stateMachine.getCurrentState();
  }

  /**
   * Validate if a pass can be created (no active pass exists)
   */
  static canCreatePass(currentPass: Pass | null): boolean {
    return currentPass === null || currentPass.status === 'CLOSED';
  }

  /**
   * Check if pass is in a state where it can be closed
   */
  static canClosePass(pass: Pass): boolean {
    if (pass.status === 'CLOSED') return false;
    const stateMachine = new PassStateMachine(pass, {} as User); // We only need the pass for this check
    const currentLeg = stateMachine.getCurrentLeg();
    return currentLeg?.state === 'OUT';
  }

  /**
   * Check if pass is in a state where student can arrive
   */
  static canArriveAtDestination(pass: Pass): boolean {
    if (pass.status === 'CLOSED') return false;
    const stateMachine = new PassStateMachine(pass, {} as User);
    const currentLeg = stateMachine.getCurrentLeg();
    return currentLeg?.state === 'OUT';
  }

  /**
   * Check if pass is in a state where student can return to class
   */
  static canReturnToClass(pass: Pass): boolean {
    if (pass.status === 'CLOSED') return false;
    const stateMachine = new PassStateMachine(pass, {} as User);
    const currentLeg = stateMachine.getCurrentLeg();
    return currentLeg?.state === 'IN';
  }

  /**
   * Check and send notifications for a pass
   */
  private static async checkAndSendNotifications(pass: Pass, student: User): Promise<Pass> {
    try {
      const notificationCheck = NotificationService.shouldSendNotification(pass);
      
      if (notificationCheck.success && notificationCheck.notificationSent && notificationCheck.notificationLevel) {
        const notificationResult = await NotificationService.sendNotification(pass, student, notificationCheck.notificationLevel);
        
        if (notificationResult.success) {
          // Update pass with notification information
          return NotificationService.updatePassWithNotification(pass, notificationCheck.notificationLevel);
        }
      }
      
      // Update duration even if no notification was sent
      return {
        ...pass,
        durationMinutes: NotificationService.calculateDuration(pass),
        lastUpdatedAt: new Date()
      };
    } catch (error) {
      // Log error but don't fail the pass operation
      await logEvent({
        passId: pass.id,
        studentId: student.id,
        actorId: 'system',
        timestamp: new Date(),
        eventType: 'ERROR',
        details: `Failed to check notifications: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
      
      return pass;
    }
  }
} 