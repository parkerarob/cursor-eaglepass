# Eagle Pass - FERPA Technical Implementation Plan

## 🎯 **TECHNICAL FERPA REQUIREMENTS ONLY**

This document focuses exclusively on **system and code changes** required for FERPA compliance. All policy, legal, and administrative requirements are handled separately by school administration.

---

## 🔧 **REQUIRED TECHNICAL IMPLEMENTATIONS**

### **1. Data Retention & Lifecycle Management**
**Priority**: P0 - Critical
**Effort**: 2-3 weeks

```typescript
// Automated data retention system
interface DataRetentionPolicy {
  recordType: string;
  retentionPeriodMonths: number;
  destructionMethod: 'secure_delete' | 'anonymize';
  automatedCleanup: boolean;
}

const retentionPolicies: DataRetentionPolicy[] = [
  {
    recordType: 'passes',
    retentionPeriodMonths: 12, // 1 year after school year end
    destructionMethod: 'secure_delete',
    automatedCleanup: true
  },
  {
    recordType: 'eventLogs', 
    retentionPeriodMonths: 36, // 3 years for audit logs
    destructionMethod: 'secure_delete',
    automatedCleanup: true
  },
  {
    recordType: 'emergencyRecords',
    retentionPeriodMonths: 84, // 7 years for emergency documentation
    destructionMethod: 'anonymize',
    automatedCleanup: true
  }
];

class DataLifecycleManager {
  static async scheduleAutomatedCleanup(): Promise<void> {
    // Run monthly cleanup job
    cron.schedule('0 2 1 * *', async () => {
      for (const policy of retentionPolicies) {
        await this.processRetentionPolicy(policy);
      }
    });
  }
  
  static async processRetentionPolicy(policy: DataRetentionPolicy): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - policy.retentionPeriodMonths);
    
    const expiredRecords = await this.findExpiredRecords(policy.recordType, cutoffDate);
    
    for (const record of expiredRecords) {
      if (policy.destructionMethod === 'secure_delete') {
        await this.secureDelete(record);
      } else {
        await this.anonymizeRecord(record);
      }
      
      await this.logDestruction(record, policy);
    }
  }
}
```

### **2. Parent Data Access API**
**Priority**: P1 - High  
**Effort**: 2-3 weeks

```typescript
// API endpoints for parent access to student records
interface ParentAccessRequest {
  id: string;
  parentId: string;
  studentId: string;
  requestType: 'view' | 'download' | 'correction';
  requestedAt: Date;
  status: 'pending' | 'approved' | 'completed';
  records?: Pass[];
}

class ParentAccessAPI {
  // GET /api/parent/student-records/:studentId
  static async getStudentRecords(req: Request, res: Response): Promise<void> {
    const { studentId } = req.params;
    const parentId = req.user.id;
    
    // Verify parent-student relationship
    const isAuthorized = await this.verifyParentAccess(parentId, studentId);
    if (!isAuthorized) {
      return res.status(403).json({ error: 'Unauthorized access' });
    }
    
    // Get student pass records
    const passes = await getPassesByStudentId(studentId);
    
    // Log access for FERPA compliance
    await this.logParentAccess(parentId, studentId, 'view');
    
    res.json({
      student: await getUserById(studentId),
      passes: passes,
      ferpaNotice: 'These records are protected under FERPA',
      accessLogged: true
    });
  }
  
  // POST /api/parent/access-request
  static async requestRecordAccess(req: Request, res: Response): Promise<void> {
    const { studentId, requestType } = req.body;
    const parentId = req.user.id;
    
    const accessRequest: ParentAccessRequest = {
      id: generateUUID(),
      parentId,
      studentId,
      requestType,
      requestedAt: new Date(),
      status: 'approved' // Auto-approve for digital records
    };
    
    // Store request for audit trail
    await this.storeAccessRequest(accessRequest);
    
    res.json(accessRequest);
  }
}
```

### **3. FERPA Audit Logging Enhancement**
**Priority**: P1 - High
**Effort**: 1 week

```typescript
// Enhanced audit logging for FERPA compliance
interface FERPAAuditLog {
  id: string;
  eventType: 'record_access' | 'record_disclosure' | 'record_correction' | 'data_destruction';
  actorId: string;
  actorRole: 'parent' | 'teacher' | 'admin' | 'system';
  studentId: string;
  recordIds: string[];
  purpose: string;
  legalBasis: string; // FERPA exception or consent
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
}

class FERPAAuditLogger {
  static async logRecordAccess(
    actorId: string,
    studentId: string,
    recordIds: string[],
    purpose: string,
    legalBasis: string
  ): Promise<void> {
    const auditLog: FERPAAuditLog = {
      id: generateUUID(),
      eventType: 'record_access',
      actorId,
      actorRole: await this.getActorRole(actorId),
      studentId,
      recordIds,
      purpose,
      legalBasis,
      timestamp: new Date(),
      ipAddress: this.getCurrentIP(),
      userAgent: this.getCurrentUserAgent()
    };
    
    await this.storeAuditLog(auditLog);
  }
  
  static async logDataDestruction(
    recordIds: string[],
    retentionPolicy: string
  ): Promise<void> {
    const auditLog: FERPAAuditLog = {
      id: generateUUID(),
      eventType: 'data_destruction',
      actorId: 'system',
      actorRole: 'system',
      studentId: 'multiple',
      recordIds,
      purpose: 'automated_retention_policy',
      legalBasis: `Retention policy: ${retentionPolicy}`,
      timestamp: new Date()
    };
    
    await this.storeAuditLog(auditLog);
  }
}
```

### **4. Directory Information Management**
**Priority**: P2 - Medium
**Effort**: 1 week

```typescript
// Directory information opt-out system
interface DirectoryInfoOptOut {
  studentId: string;
  parentId: string;
  schoolYear: string;
  optedOutAt: Date;
  optedOutItems: DirectoryInfoItem[];
}

enum DirectoryInfoItem {
  NAME = 'name',
  GRADE_LEVEL = 'gradeLevel', 
  DATES_OF_ATTENDANCE = 'datesOfAttendance'
}

class DirectoryInfoManager {
  static async checkDisclosureAllowed(
    studentId: string,
    infoType: DirectoryInfoItem
  ): Promise<boolean> {
    const optOut = await this.getOptOutStatus(studentId);
    
    if (!optOut) {
      return true; // No opt-out, disclosure allowed
    }
    
    return !optOut.optedOutItems.includes(infoType);
  }
  
  static async recordOptOut(
    studentId: string,
    parentId: string,
    optOutItems: DirectoryInfoItem[]
  ): Promise<void> {
    const optOut: DirectoryInfoOptOut = {
      studentId,
      parentId,
      schoolYear: this.getCurrentSchoolYear(),
      optedOutAt: new Date(),
      optedOutItems: optOutItems
    };
    
    await this.storeOptOut(optOut);
    await this.auditOptOut(optOut);
  }
}
```

### **5. Emergency Disclosure Documentation**
**Priority**: P2 - Medium
**Effort**: 1 week

```typescript
// Enhanced emergency disclosure tracking
interface EmergencyDisclosure {
  id: string;
  studentIds: string[];
  disclosedTo: string[];
  disclosureReason: string;
  emergencyType: 'health' | 'safety' | 'security';
  disclosedAt: Date;
  disclosedBy: string;
  dataCategories: string[];
  postEmergencyNotificationSent: boolean;
}

class EmergencyDisclosureManager {
  static async recordEmergencyDisclosure(
    studentIds: string[],
    disclosedTo: string[],
    reason: string,
    emergencyType: EmergencyDisclosure['emergencyType'],
    disclosedBy: string
  ): Promise<EmergencyDisclosure> {
    
    const disclosure: EmergencyDisclosure = {
      id: generateUUID(),
      studentIds,
      disclosedTo,
      disclosureReason: reason,
      emergencyType,
      disclosedAt: new Date(),
      disclosedBy,
      dataCategories: ['pass_records', 'location_data'],
      postEmergencyNotificationSent: false
    };
    
    await this.storeDisclosure(disclosure);
    
    // Schedule post-emergency notification
    await this.schedulePostEmergencyNotification(disclosure);
    
    return disclosure;
  }
  
  static async sendPostEmergencyNotifications(
    disclosure: EmergencyDisclosure
  ): Promise<void> {
    for (const studentId of disclosure.studentIds) {
      const student = await getUserById(studentId);
      if (student?.parentEmail) {
        await NotificationService.sendEmail({
          to: student.parentEmail,
          subject: 'Emergency Disclosure Notification',
          template: 'emergency-disclosure-notice',
          data: {
            studentName: this.getStudentName(student),
            disclosureDate: disclosure.disclosedAt,
            reason: disclosure.disclosureReason,
            dataShared: disclosure.dataCategories
          }
        });
      }
    }
    
    // Mark notifications as sent
    disclosure.postEmergencyNotificationSent = true;
    await this.updateDisclosure(disclosure);
  }
}
```

---

## 🚀 **IMPLEMENTATION PRIORITY**

### **Phase 1: Core Compliance (Weeks 1-4)**
1. ✅ **Data Retention System** - Automated cleanup and destruction
2. ✅ **FERPA Audit Logging** - Enhanced tracking for compliance
3. ✅ **Emergency Disclosure Documentation** - Proper record keeping

### **Phase 2: Parent Access (Weeks 5-8)**  
4. ✅ **Parent Access API** - Endpoints for record access
5. ✅ **Directory Info Management** - Opt-out system

### **Total Effort**: 6-8 weeks of development time

---

## 📋 **TECHNICAL CHECKLIST**

### **Database Schema Updates**
- [ ] Add `retentionPolicy` field to all record types
- [ ] Create `ferpaAuditLogs` collection
- [ ] Create `parentAccessRequests` collection  
- [ ] Create `directoryInfoOptOuts` collection
- [ ] Create `emergencyDisclosures` collection

### **API Endpoints**
- [ ] `GET /api/parent/student-records/:studentId`
- [ ] `POST /api/parent/access-request`
- [ ] `POST /api/parent/record-correction`
- [ ] `GET /api/admin/ferpa-audit-logs`

### **Background Jobs**
- [ ] Monthly data retention cleanup
- [ ] Emergency disclosure notifications
- [ ] FERPA audit log archival

### **Security Enhancements**
- [ ] Parent-student relationship verification
- [ ] Enhanced access logging
- [ ] Secure data destruction methods

---

## 📝 **NON-TECHNICAL REQUIREMENTS**

**These items require school administration/legal handling:**
- Annual FERPA notification letters to parents
- FERPA policy documentation  
- Staff training on FERPA procedures
- Parent complaint handling procedures
- Legal review of directory information designations

---

**Implementation Lead**: Development Team  
**Estimated Timeline**: 6-8 weeks  
**Dependencies**: School administration policy decisions  
**Testing Required**: Parent access workflows, data retention automation 