import { Pass, User, PassFormData } from '@/types';
import { createPass, updatePass } from '@/lib/firebase/firestore';
import { PassStateMachine, ActionState } from '@/lib/stateMachine';

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
      const newPass = PassStateMachine.createPass(formData, student);
      await createPass(newPass);
      return { success: true, updatedPass: newPass };
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
   * Handle "Close Pass" action (return to class and close)
   */
  static async closePass(pass: Pass, student: User): Promise<PassServiceResult> {
    try {
      const stateMachine = new PassStateMachine(pass, student);
      const validation = stateMachine.validateTransition('close_pass');
      
      if (!validation.valid) {
        return { success: false, error: validation.error };
      }

      const updatedPass = stateMachine.closePass();
      await updatePass(updatedPass.id, updatedPass);
      return { success: true, updatedPass };
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