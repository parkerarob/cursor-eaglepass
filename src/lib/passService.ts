import { Pass, User, PassFormData } from '@/types';
import { createPass, updatePass, getActivePassByStudentId } from '@/lib/firebase/firestore';
import { PassStateMachine, ActionState } from '@/lib/stateMachine';
import { logEvent } from './eventLogger';
import { formatUserName } from './utils';

export interface PassServiceResult {
  success: boolean;
  updatedPass?: Pass;
  error?: string;
}

export class PassService {
  /**
   * Create a new pass
   */
  static async createPass(formData: PassFormData, student: User): Promise<PassServiceResult> {
    try {
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
          return { success: true, updatedPass };
        } else {
          // Student is "OUT" - they can't create a new pass
          return { 
            success: false, 
            error: 'Cannot create new pass while already traveling' 
          };
        }
      } else {
        // No active pass - create new pass from assigned class
        const newPass = PassStateMachine.createPass(formData, student);
        await createPass(newPass);
        return { success: true, updatedPass: newPass };
      }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to create pass' 
      };
    }
  }

  /**
   * Handle "I've Arrived" action
   */
  static async arriveAtDestination(pass: Pass, student: User): Promise<PassServiceResult> {
    try {
      const stateMachine = new PassStateMachine(pass, student);
      const validation = stateMachine.validateTransition('arrive');
      
      if (!validation.valid) {
        return { success: false, error: validation.error };
      }

      const updatedPass = stateMachine.arriveAtDestination();
      await updatePass(updatedPass.id, updatedPass);
      return { success: true, updatedPass };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to arrive at destination' 
      };
    }
  }

  /**
   * Handle "Return to Class" action
   */
  static async returnToClass(pass: Pass, student: User): Promise<PassServiceResult> {
    try {
      const stateMachine = new PassStateMachine(pass, student);
      const validation = stateMachine.validateTransition('return_to_class');
      
      if (!validation.valid) {
        return { success: false, error: validation.error };
      }

      const updatedPass = stateMachine.returnToClass();
      await updatePass(updatedPass.id, updatedPass);
      return { success: true, updatedPass };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to return to class' 
      };
    }
  }

  /**
   * Handle "Close Pass" action (administrative close)
   */
  static async closePass(pass: Pass, closer: User): Promise<PassServiceResult> {
    try {
      // This is an administrative action. We directly close the pass
      // without going through the state machine's normal flow.
      if (pass.status === 'CLOSED') {
        return { success: false, error: 'Pass is already closed.' };
      }
      
      const updatedPassData = {
        ...pass,
        status: 'CLOSED' as const,
        lastUpdatedAt: new Date(),
        closedBy: closer.id,
        closedAt: new Date()
      };

      await updatePass(updatedPassData.id, updatedPassData);
      return { success: true, updatedPass: updatedPassData };

    } catch (error) {
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
        return { success: false, error: validation.error };
      }

      const updatedPass = await stateMachine.handleRestroomReturn();
      await updatePass(updatedPass.id, updatedPass);
      return { success: true, updatedPass };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to handle restroom return' 
      };
    }
  }

  /**
   * Handle "Claim" action during an emergency
   */
  static async claimPass(pass: Pass, claimer: User): Promise<PassServiceResult> {
    try {
      if (pass.status !== 'OPEN') {
        return { success: false, error: 'Only open passes can be claimed.' };
      }
      if (pass.claimedBy) {
        return { success: false, error: `Pass already claimed by ${pass.claimedBy.userName}.` };
      }

      const updatedPassData = {
        ...pass,
        lastUpdatedAt: new Date(),
        claimedBy: {
          userId: claimer.id,
          userName: formatUserName(claimer),
          timestamp: new Date(),
        },
      };

      await updatePass(updatedPassData.id, updatedPassData);

      logEvent({
        eventType: 'STUDENT_CLAIMED',
        passId: pass.id,
        studentId: pass.studentId,
        actorId: claimer.id,
        timestamp: new Date(),
        details: JSON.stringify({
          claimedBy: formatUserName(claimer),
        })
      });

      return { success: true, updatedPass: updatedPassData };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to claim pass'
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
} 