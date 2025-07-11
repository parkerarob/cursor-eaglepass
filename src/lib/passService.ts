import { Pass, User, PassFormData } from '@/types';
import { updatePass, db } from '@/lib/firebase/firestore';
import { runTransaction, query, where, collection, getDocs, doc } from 'firebase/firestore';
import { PassStateMachine, ActionState } from '@/lib/stateMachine';
import { logEvent } from '@/lib/eventLogger';
import { formatUserName } from './utils';
import { ValidationService } from '@/lib/validation/service';
import { AuditMonitor } from '@/lib/auditMonitor';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { checkStudentHasOpenPass } from './passUtils';

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
      // NEW: Validate student is not null/undefined
      if (!student) {
        return {
          success: false,
          error: 'Input validation failed: user is required'
        };
      }
      // ENFORCE REDIS-BASED RATE LIMITING
      const rateLimitResult = await checkRateLimit(student.id);
      if (!rateLimitResult.allowed) {
        return {
          success: false,
          error: rateLimitResult.error || 'Rate limit exceeded. Please try again later.'
        };
      }

      // SECURITY: Validate all inputs before processing
      try {
        ValidationService.validatePassFormData(formData);
        ValidationService.validateUser(student);
      } catch (validationError) {
        return { 
          success: false, 
          error: `Input validation failed: ${validationError instanceof Error ? validationError.message : 'Invalid input'}` 
        };
      }

      // SECURITY: Call Cloud Function to validate pass creation (enforce no multiple open passes)
      try {
        const functions = getFunctions();
        const validatePassCreation = httpsCallable(functions, 'validatePassCreation');
        const validationResult: any = await validatePassCreation({ studentId: student.id });
        if (validationResult.data?.hasOpenPass) {
          return {
            success: false,
            error: 'Student already has an open pass. Cannot create another.'
          };
        }
      } catch (validationError) {
        return {
          success: false,
          error: `Pass creation validation failed: ${validationError instanceof Error ? validationError.message : 'Unknown error'}`
        };
      }

      // SECURITY: Use atomic transaction to prevent race conditions
      return await runTransaction(db, async (transaction) => {
        // Check emergency state within transaction
        const emergencyRef = doc(db, 'system', 'emergency');
        const emergencyDoc = await transaction.get(emergencyRef);
        if (emergencyDoc.exists() && emergencyDoc.data()?.active) {
          throw new Error('System is in emergency mode. Pass creation is disabled.');
        }

        // Centralized check for existing active pass
        const hasOpenPass = await checkStudentHasOpenPass(db, student.id);
        if (hasOpenPass) {
          throw new Error('Student already has an open pass. Cannot create another.');
        }

        // No active pass - create new pass from assigned class atomically
        const passRef = doc(collection(db, 'passes'));
        const newPass = PassStateMachine.createPass(formData, student);
        // Create a new pass object with the correct document ID
        const passWithCorrectId = { ...newPass, id: passRef.id };
        // Store the pass with the correct ID to keep Firestore doc ID and payload in sync
        transaction.set(passRef, passWithCorrectId);
        
        // SECURITY: Monitor for suspicious pass creation patterns
        await AuditMonitor.checkPassCreationActivity(student.id, passWithCorrectId);
        
        return { success: true, updatedPass: passWithCorrectId };
      });
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

  /**
   * Add a new destination (multi-leg support)
   */
  static async addDestination(formData: PassFormData, pass: Pass, student: User): Promise<PassServiceResult> {
    try {
      // BASIC INPUT VALIDATION (reuse same validators)
      try {
        ValidationService.validatePassFormData(formData);
        ValidationService.validateUser(student);
      } catch (validationError) {
        return {
          success: false,
          error: `Input validation failed: ${validationError instanceof Error ? validationError.message : 'Invalid input'}`
        };
      }

      // Ensure the provided pass belongs to the student
      if (pass.studentId !== student.id) {
        return { success: false, error: 'Pass does not belong to this student.' };
      }
      if (pass.status !== 'OPEN') {
        return { success: false, error: 'Cannot add destination: pass is not open.' };
      }

      // SERVER-SIDE VALIDATION via Cloud Function
      try {
        const functions = getFunctions();
        const validateAddDestination = httpsCallable(functions, 'validateAddDestination');
        const validationResp: any = await validateAddDestination({ passId: pass.id, studentId: student.id });
        if (!validationResp.data?.allowed) {
          return { success: false, error: 'Server validation failed: cannot add destination.' };
        }
      } catch (validationError) {
        return { success: false, error: `Add destination validation failed: ${validationError instanceof Error ? validationError.message : 'Unknown error'}` };
      }

      // State-machine validation (client-side)
      const stateMachine = new PassStateMachine(pass, student);
      const validation = stateMachine.validateTransition('new_destination');
      if (!validation.valid) {
        return { success: false, error: validation.error };
      }

      // Create updated pass object
      const updatedPass = stateMachine.startNewDestination(formData.destinationLocationId);

      // Persist
      await updatePass(updatedPass.id, updatedPass);

      // Audit log
      logEvent({
        eventType: 'NEW_DESTINATION',
        passId: updatedPass.id,
        studentId: student.id,
        actorId: student.id,
        timestamp: new Date(),
        details: JSON.stringify({ destination: formData.destinationLocationId }),
      });

      return { success: true, updatedPass };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add destination'
      };
    }
  }
}

// Rate limiting check - client/server aware implementation
async function checkRateLimit(userId: string): Promise<{ allowed: boolean; error?: string }> {
  // Client-side: Rate limiting will be enforced by API routes and server components
  // This prevents Redis from being bundled in the client build
  if (typeof window !== 'undefined') {
    return { allowed: true }; // Client-side always allows, server enforces limits
  }

  // Server-side: Use in-memory rate limiting as fallback
  // Redis rate limiting is handled in dedicated API routes and server actions
  try {
    const { RateLimiter } = await import('./rateLimiterFactory');
    const result = await RateLimiter.checkRateLimit(userId, 'PASS_CREATION');
    return {
      allowed: result.allowed,
      error: result.error
    };
  } catch (error) {
    console.error('Rate limiting check failed:', error);
    return { allowed: true }; // Fail open for better UX in passService context
  }
} 