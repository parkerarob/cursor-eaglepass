# Eagle Pass Remediation Plan

**Objective:** To resolve critical security vulnerabilities and architectural inconsistencies identified during the comprehensive codebase review. This plan will be executed sequentially. Each task will conclude with a full documentation update to ensure the project state is always clear and stable for developers.

---

## Task List

### ✅ **Task 1: Implement Strict Firestore Security Rules**
*   **Status:** Complete
*   **Objective:** Replace the globally insecure Firestore rules with a strict, role-based security model. This is the highest priority action.
*   **Key Actions:**
    1.  Rewrite `firestore.rules` with a "default deny" policy.
    2.  Implement granular, role-based access controls for all data collections.
    3.  Ensure audit logs are immutable (create-only).
    4.  Create a new `DATA_ACCESS_SECURITY_MODEL.md` document explaining the rules.
    5.  Update `docs/handbook/README.md` to link to the new security model document.

### ✅ **Task 2: Refactor Pass Creation to a Centralized Server Action**
*   **Status:** Complete
*   **Objective:** Eliminate the fragmented and brittle pass creation logic and replace it with a single, atomic, secure server-side action.
*   **Key Actions:**
    1.  Identify the parent component of `CreatePassForm.tsx`.
    2.  Implement a new Server Action (`createPassAction`) in the parent component.
    3.  Consolidate all pass creation logic (validation, policy checks, transactional database writes) into this single action.
    4.  Delete the redundant `validatePassCreation` and `getPassValidationStatus` functions from `functions/src/index.ts`.
    5.  Create a new `CORE_ACTIONS_ARCHITECTURE.md` document explaining the new centralized pattern.
    6.  Update `docs/handbook/README.md` to link to the new architecture document.

### ✅ **Task 3: Rationalize and Finalize Project Documentation**
*   **Status:** Complete
*   **Objective:** Remove outdated and contradictory documentation to create a single, clear path for developer onboarding.
*   **Key Actions:**
    1.  Archive all outdated documents (e.g., `FERPA_COMPLIANCE_AUDIT.md`, `SECURITY_REVIEW_AND_HARDENING.md`) to the `docs/archive/` directory.
    2.  Create a new `docs/SUMMARY.md` to serve as the primary entry point for understanding the project's current, stable state.
    3.  Update the root `README.md` to point developers directly to `docs/SUMMARY.md`.
    4.  Review and update the `AI_CONTEXT_GUIDE.md` to reflect the new, secure architecture.
    5.  Mark this remediation plan as complete.

--- 