'use server';

import {
  Timestamp,
  getFirestore,
} from 'firebase-admin/firestore';
import { adminApp } from '@/lib/firebase/config.server';
import { Pass, PassFormData, User } from '@/types';
import { Group, Restriction } from '@/types/policy';
import { passFormDataSchema } from '@/lib/validation/schemas';
import { PolicyEngine } from '@/lib/policyEngine';
import { FERPAAuditLogger } from '@/lib/ferpaAuditLogger';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { SessionManager } from '@/lib/auth/sessionManager';
import { getUserById } from '@/lib/firebase/firestore';

// Use the Admin SDK Firestore instance
const adminDb = getFirestore(adminApp);

// This is the new, secure Server Action for creating a pass.
export async function createPassAction(
  formData: PassFormData
): Promise<{ success: boolean; error?: string }> {
  const headersList = headers();
  const token = headersList.get('Authorization')?.split('Bearer ')[1];

  if (!token) {
    return { success: false, error: 'Authorization token not provided.' };
  }
  
  const sessionResult = await SessionManager.validateSession(token);
  if (!sessionResult.valid || !sessionResult.session) {
    return { success: false, error: sessionResult.error || 'Invalid session.' };
  }
  
  const student = await getUserById(sessionResult.session.userId);

  if (!student) {
      return { success: false, error: 'Student profile not found.' };
  }

  try {
    // 1. Validate input payload
    const validatedFormData = passFormDataSchema.parse(formData);
    const { destinationLocationId } = validatedFormData;

    if (!student.assignedLocationId) {
      throw new Error('Student has no assigned location and cannot create a pass.');
    }

    // 2. Evaluate Policy
    const policyEngine = new PolicyEngine();
    const policyContext = {
      studentId: student.id,
      origin: student.assignedLocationId,
      destination: destinationLocationId,
      locationId: student.assignedLocationId,
      passType: 'Immediate' as const,
    };
    
    // TODO: [TICKET-582] Fetch student's groups and any active restrictions for accurate policy enforcement.
    // Currently using placeholders.
    const studentGroups: Group[] = [];
    const activeRestrictions: Restriction[] = [];
    const policyResult = await policyEngine.evaluatePolicy(policyContext, student, studentGroups, activeRestrictions);

    if (!policyResult.allowed) {
      await FERPAAuditLogger.logRecordAccess(
        student.id,
        'student',
        student.id,
        [],
        `Pass creation denied by policy: ${policyResult.reason}`,
        'Policy Engine Evaluation'
      );
      return { success: false, error: policyResult.reason || 'Action denied by school policy.' };
    }

    // 3. Run as an atomic transaction
    let newPassId: string | null = null;
    await adminDb.runTransaction(async (transaction) => {
      const passesRef = adminDb.collection('passes');

      // Re-verify no active pass exists within the transaction
      const openPassQuery = passesRef
        .where('studentId', '==', student.id)
        .where('status', '==', 'OPEN');
        
      const openPassSnapshot = await transaction.get(openPassQuery);

      if (!openPassSnapshot.empty) {
        throw new Error('An active pass already exists for this student.');
      }

      // 4. Create the new pass object
      const now = Timestamp.now();
      newPassId = passesRef.doc().id;
      const newPass: Pass = {
        id: newPassId,
        studentId: student.id,
        status: 'OPEN',
        createdAt: now.toDate(),
        lastUpdatedAt: now.toDate(),
        legs: [
          {
            id: adminDb.collection('legs').doc().id,
            legNumber: 1,
            originLocationId: student.assignedLocationId!,
            destinationLocationId: destinationLocationId,
            state: 'OUT',
            timestamp: now.toDate(),
          },
        ],
      };
      
      const passDocRef = passesRef.doc(newPass.id);
      transaction.set(passDocRef, newPass);
    });

    if (!newPassId) {
        throw new Error('Failed to create pass ID during transaction.');
    }

    // 5. Audit the successful creation
    await FERPAAuditLogger.logRecordAccess(
      student.id,
      'student',
      student.id,
      [newPassId],
      `Pass created to destination ${destinationLocationId}`,
      'Student pass creation'
    );

    // 6. Revalidate the page to show the new pass
    revalidatePath('/');
    return { success: true };

  } catch (error) {
    console.error('createPassAction failed:', error);
    // Log the error to the audit service for monitoring
    await FERPAAuditLogger.logRecordAccess(
        student?.id || 'unknown',
        'student',
        student?.id || 'unknown',
        [],
        `Pass creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'System Error'
      );
    return {
      success: false,
      error: error instanceof Error ? error.message : 'An unexpected error occurred.',
    };
  }
} 