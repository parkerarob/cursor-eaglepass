import { collection, doc, setDoc, getDocs, query, where, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase/firestore';
import { FERPAAuditLogger } from './ferpaAuditLogger';

export enum DirectoryInfoItem {
  NAME = 'name',
  GRADE_LEVEL = 'gradeLevel',
  DATES_OF_ATTENDANCE = 'datesOfAttendance',
  PARTICIPATION_IN_ACTIVITIES = 'activitiesParticipation',
  DEGREES_HONORS_AWARDS = 'degreesHonorsAwards',
  PHOTO = 'photo'
}

export interface DirectoryInfoOptOut {
  id: string;
  studentId: string;
  parentId: string;
  studentName: string;
  schoolYear: string;
  optedOutAt: Date;
  optedOutItems: DirectoryInfoItem[];
  active: boolean;
}

export class DirectoryInfoService {
  
  /**
   * Submit directory information opt-out
   */
  static async submitOptOut(
    parentId: string,
    studentId: string,
    studentName: string,
    optOutItems: DirectoryInfoItem[]
  ): Promise<DirectoryInfoOptOut> {
    try {
      const optOut: DirectoryInfoOptOut = {
        id: this.generateOptOutId(),
        studentId,
        parentId,
        studentName,
        schoolYear: this.getCurrentSchoolYear(),
        optedOutAt: new Date(),
        optedOutItems: optOutItems,
        active: true
      };

      await this.storeOptOut(optOut);
      
      // Log for FERPA compliance
      await FERPAAuditLogger.logConsentEvent(
        parentId,
        studentId,
        'directory_info_opt_out',
        'consent_revoked',
        `Directory information opt-out: ${optOutItems.join(', ')}`,
        optOutItems
      );

      console.log(`DirectoryInfoService: Created opt-out ${optOut.id} for student ${studentId}`);

      return optOut;

    } catch (error) {
      console.error('DirectoryInfoService: Error submitting opt-out:', error);
      throw error;
    }
  }

  /**
   * Check if disclosure of directory information is allowed
   */
  static async checkDisclosureAllowed(
    studentId: string,
    infoType: DirectoryInfoItem
  ): Promise<boolean> {
    try {
      const optOut = await this.getOptOutForStudent(studentId);
      
      if (!optOut || !optOut.active) {
        return true; // No opt-out, disclosure allowed
      }
      
      return !optOut.optedOutItems.includes(infoType);

    } catch (error) {
      console.error('DirectoryInfoService: Error checking disclosure permission:', error);
      return false; // Err on side of caution
    }
  }

  /**
   * Get opt-out status for a student
   */
  static async getOptOutForStudent(studentId: string): Promise<DirectoryInfoOptOut | null> {
    try {
      const optOutsRef = collection(db, 'directoryInfoOptOuts');
      const q = query(
        optOutsRef,
        where('studentId', '==', studentId),
        where('active', '==', true),
        where('schoolYear', '==', this.getCurrentSchoolYear())
      );
      
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        return null;
      }

      const data = querySnapshot.docs[0].data();
      return {
        ...data,
        optedOutAt: data.optedOutAt.toDate()
      } as DirectoryInfoOptOut;

    } catch (error) {
      console.error('DirectoryInfoService: Error getting opt-out for student:', error);
      return null;
    }
  }

  /**
   * Store opt-out in Firestore
   */
  private static async storeOptOut(optOut: DirectoryInfoOptOut): Promise<void> {
    try {
      const optOutRef = doc(collection(db, 'directoryInfoOptOuts'), optOut.id);
      
      const firestoreOptOut = {
        ...optOut,
        optedOutAt: Timestamp.fromDate(optOut.optedOutAt)
      };
      
      await setDoc(optOutRef, firestoreOptOut);

    } catch (error) {
      console.error('DirectoryInfoService: Error storing opt-out:', error);
      throw error;
    }
  }

  /**
   * Generate unique opt-out ID
   */
  private static generateOptOutId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    return `opt-${timestamp}-${random}`;
  }

  /**
   * Get current school year
   */
  private static getCurrentSchoolYear(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    
    if (month >= 8) {
      return `${year}-${year + 1}`;
    } else {
      return `${year - 1}-${year}`;
    }
  }
}