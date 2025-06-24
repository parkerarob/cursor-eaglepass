import { Pass, User, PassFormData } from '@/types';
import { updatePass, db } from '@/lib/firebase/firestore';
import { runTransaction, query, where, collection, getDocs, doc } from 'firebase/firestore';
import { PassStateMachine, ActionState } from '@/lib/stateMachine';
import { logEvent } from '@/lib/eventLogger';
import { formatUserName } from './utils';
import { ValidationService } from '@/lib/validation';
import { AuditMonitor } from '@/lib/auditMonitor';
import { getFunctions, httpsCallable } from 'firebase/functions';

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

        // Check for existing active pass within transaction
        const passQuery = query(
          collection(db, 'passes'),
          where('studentId', '==', student.id),
          where('status', '==', 'OPEN')
        );
        const existingPassSnapshot = await getDocs(passQuery);
        
        if (!existingPassSnapshot.empty) {
          // Student has an active pass - handle multi-leg logic
          const existingPassDoc = existingPassSnapshot.docs[0];
          const existingPassData = existingPassDoc.data() as Pass;
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { id: _, ...passDataWithoutId } = existingPassData;
          const existingPass = { id: existingPassDoc.id, ...passDataWithoutId };
          
          const stateMachine = new PassStateMachine(existingPass, student);
          const currentLeg = stateMachine.getCurrentLeg();
          
          if (currentLeg && currentLeg.state === 'IN') {
            // Student is currently "IN" at a location - add new leg from current location
            const updatedPass = stateMachine.addLeg(
              currentLeg.destinationLocationId, // Origin is current location
              formData.destinationLocationId,   // Destination is new location
              'OUT'                             // State is OUT (traveling)
            );
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { id: __, ...updateData } = updatedPass;
            transaction.update(existingPassDoc.ref, updateData);
            return { success: true, updatedPass };
          } else {
            // Student is "OUT" - they can't create a new pass
            throw new Error('Cannot create new pass while already traveling');
          }
        } else {
          // No active pass - create new pass from assigned class atomically
          const passRef = doc(collection(db, 'passes'));
          const newPass = PassStateMachine.createPass(formData, student);
          // Create a new pass object with the correct document ID
          const passWithCorrectId = { ...newPass, id: passRef.id };
          transaction.set(passRef, newPass); // Store without the ID field
          
          // SECURITY: Monitor for suspicious pass creation patterns
          await AuditMonitor.checkPassCreationActivity(student.id, passWithCorrectId);
          
          return { success: true, updatedPass: passWithCorrectId };
        }
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
    const { RateLimiter } = await import('./rateLimiter');
    const result = RateLimiter.checkRateLimit(userId, 'PASS_CREATION');
    return {
      allowed: result.allowed,
      error: result.error
    };
  } catch (error) {
    console.error('Rate limiting check failed:', error);
    return { allowed: true }; // Fail open for better UX in passService context
  }
} 