# Eagle Pass — PRD v3.1 (Core Product Requirements)

## 1. Problem Statement

Schools require a digital hall pass system to track student movement for safety and accountability without enforcing attendance or behavior monitoring. The system reflects actual student movement, providing staff with accurate, immutable data during both routine and emergency operations while minimizing administrative complexity.

## 2. Core Principles

* Binary pass lifecycle: **OPEN** or **CLOSED**.
* Binary movement state: **IN** or **OUT**.
* Immutable audit logging.
* Staff responsibility follows student location.
* **Hierarchical policy controls** enforce school rules with teacher autonomy.
* System only reflects actual student-declared or staff-verified locations.
* System assists staff; humans remain primary decision-makers in emergencies.

## 3. Roles & User Types

### Active Roles

* **Dev (System Owner):** Full system configuration, data management, impersonation, and emergency controls.
* **Students:** Declare movement, open/close passes.
* **Teachers:** Manage classroom policies, student groups, and monitor student movement.

### Passive Roles (Initially present, expanded functionality post-MVP)

* **Support Staff:** Counselors, nurses, other non-classroom staff.
* **Admins (School Admin):** School-level leadership, policy oversight, emergency controls, reporting.

## 4. Functional Requirements

### MVP Scope

* Google SSO login (OAuth 2.0) with domain restriction to `@nhcs.net` and `@student.nhcs.net`.
* Pre-loaded user and location database via Dev-managed upload.
* Dev UI includes CSV Importer with schema validation for initial data loads.
* Students declare origin and destination to open passes.
* One active pass per student (Firestore transactional writes ensure idempotency).
* Students close passes upon return to origin.
* Immutable event log for all state transitions.
* UI prevents invalid actions.
* Dev dashboard for full system config and user management.
* Emergency freeze mode with claim functionality.
* Emergency Freeze visual UI banner presented globally to all user dashboards.
* Duration timers with notifications at 10min (student/teacher) and 20min (admin escalation).
* Notification engine includes failure logging and undeliverable reporting.
* Teacher assist: manually close student passes.
* Basic teacher/admin reporting interfaces.
* Group rules enforcement for both Positive and Negative student groups.
* Student-specific lockouts (global and class-level).
* **Hierarchical Classroom Policy System**: Teachers can set classroom-specific rules and student overrides.
* **Teacher Dashboard**: Dedicated interface for classroom management and policy configuration.
* **Group Management**: Teachers can create and manage student groups.
* **[UPDATE 2024-12] Hierarchical Policy Engine implemented with Classroom Policy and Student Policy Overrides. Teachers have full autonomy to set classroom rules and student-specific exceptions.**
* **[UPDATE 2024-12] Teacher Dashboard implemented with classroom policy summary and group management.**
* **[UPDATE 2024-12] Event logging system is now implemented. All pass actions, policy decisions, and errors are logged to Firestore. Event log querying is available for admin reporting and audit.**
* **[UPDATE 2024-12] Duration timers and notification engine are now fully implemented and tested. All passes are tracked in real time, notifications escalate at 10min (teacher) and 20min (admin), and all notification events are logged.**

### Deferred Features (Post-MVP Roadmap)

* Microsoft SSO and email-based authentication with domain restrictions.
* SIS integrations for automated user and schedule population.
* Bell schedule with multiple schedule templates (half day, testing, etc.).
* Fully operational admin dashboards.
* Scheduled passes with automatic activation.
* Approval workflows (policy engine extensions).
* Expanded multi-leg passes.
* Emergency role pre-assignments.
* Parent visibility layers.
* Full reporting suite: semester/year filters, system-wide exports.

## 5. State Machine Architecture

### Pass Lifecycle:

* **OPEN:** Pass exists, actively tracking movement.
* **CLOSED:** Pass archived after completion.

### Movement State:

* **IN:** Student located at assigned destination or origin.
* **OUT:** Student actively in transit.

### Transitions:

* `IN ➔ OUT`: Pass created or re-opened.
* `OUT ➔ IN`: Student returns or staff assists.
* Emergency claims execute `OUT ➔ IN` transitions to claiming staff location.

### Policy Governors:

* **Hierarchical Classroom Policies** (per location with student overrides).
* Admin Global Override.
* Group Rule Enforcement.
* Student Restrictions.
* Emergency Freeze.
* Duration Timers.
* Scheduled Pass Activations.
* Notification Event Triggers.

---

# Eagle Pass — PRD v3.1 (Data Model Specification)

## 6. Data Model

### Users Table

* `studentId`, `teacherId`, `supportId`, `adminId`, `devId`, `name`, `role`, `assignment`, `email` (required, unique, domain-restricted), `restrictions`

### Locations Table

* `locationId`, `name`, `locationType`, `responsiblePartyId`

### Pass Table

* `passId`, `studentId`, `originLocationId`, `destinationLocationId`, `status (OPEN/CLOSED)`, `state (IN/OUT)`, `legId (future)`, `createdAt`, `lastUpdatedAt`

### Event Log Table

* `eventId`, `passId`, `studentId`, `actorId`, `timestamp`, `eventType (DEPARTED/RETURNED/CLAIMED/EMERGENCY_ACTIVATED/INVALID_TRANSITION)`

### Groups Table

* `groupId`, `name`, `groupType (Positive/Negative)`, `ownerId`, `assignedStudents`, `createdAt`, `lastUpdatedAt`

### Classroom Policy Table

* `locationId`, `ownerId`, `rules (studentLeave, studentArrive, teacherRequest)`, `lastUpdatedAt`

### Student Policy Override Table

* `overrideId`, `locationId`, `studentId`, `rules (partial ClassroomPolicyRule)`, `lastUpdatedAt`

### Restrictions Table

* `restrictionId`, `studentId`, `restrictionType (Global, Class-Level)`, `isActive`

### Bell Schedule Table (Future)

* `scheduleId`, `name`, `dayType`, `periods`, `startTimes`, `endTimes`

### SIS Import Staging Table (Future)

* `sourceFileId`, `importType`, `mappingRules`

**[UPDATE 2024-12] All policy-related data models (groups, restrictions, classroom policies, student overrides) are now implemented in code and Firestore, with full CRUD support.**

---

# Eagle Pass — PRD v3.1 (Non-Functional Requirements & Technology Stack)

## 7. Non-Functional Requirements

* Secure login with FERPA compliance.
* Domain-restricted authentication for Google SSO (MVP).
* 99.9% uptime.
* Immutable logging.
* Full test coverage for state transitions.
* Clean role-based permission enforcement.
* **Config-driven hierarchical policy architecture** for easy extensibility.
* Firestore Security Rules fully segmented for all roles.
* Firestore transactional writes ensure idempotency and prevent race conditions.
* Document schema versioning plan for long-term schema evolution.
* Firebase Crashlytics for frontend error monitoring.
* Firebase Cloud Logging and backend uptime monitoring.

## Environment Management Note

All deployments, tests, and build operations must target an explicitly specified environment (development, testing, or production), with separate Firebase projects, credentials, and audit trails for each.


## 11. Technology Stack

### Core Platform

* **Backend Language:** TypeScript / Node.js
* **API Layer:** REST (expandable to GraphQL)
* **Authentication:** Google SSO (OAuth 2.0) with domain restriction (`@nhcs.net`, `@student.nhcs.net`); future support for Microsoft SSO and email login
* **Database:** Firebase Firestore (NoSQL)
* **Hosting & Deployment:** Firebase Hosting + Functions
* **Server Environment:** Serverless Firebase Functions
* **CI/CD:** GitHub Actions (or Firebase-integrated pipeline)

### Frontend

* **Framework:** React (Next.js optional for SSR)
* **State Management:** React Query / Zustand
* **Styling:** TailwindCSS
* **Component Library:** ShadCN / Radix UI

### Testing

* **Unit Testing:** Jest
* **Integration Testing:** Playwright or Cypress
* **Security Testing:** Role-based access tests

### AI Build Support

* **AI Platform:** Cursor AI
* **Prompt Management:** AI Build Feed Templates + Sequencer Map

## 12. Open Questions

* None. System architecture, state machine, and build blueprint fully locked.

---

# Eagle Pass — PRD v3.1 (Implementation Readiness Appendix)

## 13. Implementation Readiness

### 1. Race Condition Safeguards

#### Pass Creation Idempotency

* Prevent multiple active passes per student.
* Use Firestore transactions to validate student has no open pass before allowing new pass creation.
* Use server-generated pass IDs to prevent client-side duplication.

#### State Transition Safety

* Enforce legal state transitions within atomic Firestore transactions.
* Reject transitions if current state conflicts with requested action (e.g. OUT -> OUT).
* Log rejected transitions to Event Log with `eventType: INVALID_TRANSITION` for auditability.

### 2. Firestore Security Rule Scaffold

#### Collections Covered:

* users
* locations
* passes
* eventLogs
* groups
* classroomPolicies
* studentPolicyOverrides
* restrictions

#### Role-Based Access Control

##### Students

* Read/write only their own pass documents.
* Cannot modify eventLogs directly.
* Read-only access to own restrictions.
* Read-only access to assigned locations.

##### Teachers

* Read/write passes for assigned students (teacher assist).
* Read locations and classroom policies.
* Cannot edit users directly.
* Read reporting data via controlled API endpoints.

##### Admins

* Full read/write access to passes, eventLogs, restrictions, classroom policies, student policy overrides, and groups.
* Read/write permissions on users (school scope only).
* Emergency Freeze toggle permission.

##### Dev (System Owner)

* Full system-level access across all collections.
* Manage ingestion tasks.
* Global system configuration.

#### General Rules

* All write operations via validated Cloud Functions.
* Client SDK has read-only access where permitted.
* Strict Firestore rules enforce UID matching for role enforcement.

### 3. Monitoring & Observability

#### Backend

* Enable Firebase Cloud Logging for Functions.
* Set up Google Cloud Monitoring dashboards for:

  * Function error rates
  * API latencies
  * Firestore write conflicts
  * Notification delivery failures

#### Frontend

* Integrate Firebase Crashlytics for React frontend.
* Log UI exceptions and failed API calls.
* Capture event breadcrumbs for debugging.

#### Alerting

* Cloud Monitoring alerts for Function failures.
* Notification failure logs reviewed daily by Dev.

### 4. Data Ingestion Tooling

#### Initial User/Location Data Load

* Build Dev-facing CLI or web admin panel for bulk CSV upload.
* Validate CSV schema prior to ingest.
* Use batch writes with Firestore batch API.
* Log ingestion summary:

  * Total records
  * Success/failure counts
  * Timestamped audit record

#### Future SIS Integration (Post-MVP)

* Deferred to Phase 2 integration scope.

### 5. Open Questions

* None Remaining. System architecture remains fully locked.

### 6. Implementation Readiness Status

> **[UPDATE 2024-12] Hierarchical Policy Engine implemented with Classroom Policy and Student Policy Overrides. Teachers have full autonomy to set classroom rules and student-specific exceptions.**
> **[UPDATE 2024-12] Teacher Dashboard implemented with classroom policy summary and group management.**
> **[UPDATE 2024-12] Event logging system is now implemented. All pass actions, policy decisions, and errors are logged to Firestore. Event log querying is available for admin reporting and audit.**
> **[UPDATE 2024-12] Duration timers and notification engine are now fully implemented and tested. All passes are tracked in real time, notifications escalate at 10min (teacher) and 20min (admin), and all notification events are logged.**

> This system is now considered fully defined for one-shot MVP build initiation.
