# Eagle Pass Project Summary

**Status:** Stable & Secure
**Last Updated:** [Current Date]

---

## 1. Project Overview

Eagle Pass is a school safety system for managing student hall passes with a strong emphasis on security, reliability, and FERPA compliance.

Following a comprehensive architectural review and remediation, the system is now considered stable and secure. This document provides the primary entry point for all developers to understand the current state of the project.

## 2. "Get Started in 5 Minutes"

To get up to speed on this project, read the following two documents in order:

1.  **[Data Access Security Model](./handbook/DATA_ACCESS_SECURITY_MODEL.md)**
    *   This document explains the "default deny" security principle and the strict, role-based rules that govern all access to the database. Understanding this is critical to prevent security vulnerabilities.

2.  **[Core Actions Architecture](./handbook/CORE_ACTIONS_ARCHITECTURE.md)**
    *   This document explains the **Server Action Pattern**, which is the required method for all database write operations. It details how to securely and reliably change state in the application.

## 3. Key Architectural Principles

*   **Security by Default:** The database is locked down, and access is only granted explicitly via `firestore.rules`.
*   **Server-Only Writes:** All state-changing operations are performed in server-side logic, never on the client.
*   **Centralized Logic:** Business logic is consolidated into single, atomic Server Actions or services within `src/lib`, not fragmented across the codebase.
*   **Immutable Audit Trail:** All significant actions are logged to a `ferpaAuditLogs` collection that cannot be modified.

## 4. Additional Resources

*   **[Full Developer Handbook](./handbook/README.md)**: For a complete list of all development and compliance documentation.
*   **[AI Context Guide](./handbook/AI_CONTEXT_GUIDE.md)**: For a high-level technical overview suitable for AI assistants or a quick developer refresh.

---

Any previous documentation not linked here (e.g., in the `/docs/archive` folder) should be considered outdated and non-binding. 