# Data Access Security Model

**Owner:** System Architect
**Status:** Active & Enforced
**Last Updated:** 2024-07-29

---

## 1. Core Security Principle: Default Deny

The entire Firestore database operates on a **default deny** principle. All read and write operations are denied unless explicitly granted by a specific rule. This is the most critical concept for developers to understand.

**Reference:** See the `match /{document=**}` rule in [`firestore.rules`](../../../firestore.rules).

## 2. Security Layers

Security is enforced at two primary layers:

1.  **Data Layer (Firestore Rules):** This is the ultimate source of truth for security. These rules are enforced on the Firebase servers and cannot be bypassed by client-side code. They primarily handle **authorization** (i.e., *who* can access *what*).
2.  **Application Layer (Server Actions):** All database write operations (`create`, `update`, `delete`) are executed through secure, server-side logic (e.g., Next.js Server Actions). This layer handles complex **business logic, validation, and policy enforcement** before writing to the database.

**Clients (browsers) are not permitted to write directly to the database.** This is enforced by the `allow write: if false;` rules on all critical collections.

## 3. Role-Based Access Control (RBAC)

The ruleset defines four primary roles, which are determined by the `role` field on a user's document in the `/users` collection.

*   `student`: Can view their own data.
*   `teacher`: Can view data related to students they are responsible for.
*   `parent`: Can view data related to their verified children.
*   `admin` / `dev`: Have elevated read access for administrative and debugging purposes.

Helper functions like `isStudent()`, `isTeacher()`, and `isAdmin()` are used throughout the ruleset to enforce this logic.

## 4. Collection-Specific Rule Summary

| Collection | Read Access | Write Access | Rationale |
| :--- | :--- | :--- | :--- |
| `/users/{userId}` | **Owner** or **Admin** | **Owner** (limited fields) or **Admin** | Users can view their own profile and edit non-critical info. Admins manage all profiles. |
| `/passes/{passId}` | **Student (Owner)**, **Teacher**, **Admin** | **Denied** (Server Action only) | Passes contain sensitive location data. Writes are complex transactions handled by the server. |
| `/eventLogs/{logId}` | **Teacher**, **Admin** | **Denied** (Server Action only) | Logs are for reporting and are immutable from the client. |
| `/ferpaAuditLogs/{logId}` | **Admin** | **Denied** (Server Action only) | The most sensitive logs, read-only for top-level admins. **Immutable.** |
| `/parentStudentRelationships/{relId}` | **Parent (Owner)**, **Admin** | **Denied** (Server Action only) | Parents can see their own relationship records. Admins manage them. |
| `/locations/{locationId}` | **Authenticated Users** | **Denied** (Admin-managed) | All users need to see locations to create passes, but only admins can add/edit them. |

---

This centralized, "deny-by-default" model, combined with server-only writes, ensures that data access is strictly controlled and that all business logic and policy checks are enforced without exception. 