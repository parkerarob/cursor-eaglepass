# Core Actions Architecture

**Owner:** System Architect
**Status:** Active & Enforced
**Last Updated:** [Current Date]

---

## 1. The Server Action Pattern

To ensure maximum security and data integrity, this project uses the **Server Action Pattern** for all critical, state-changing operations (e.g., creating, updating, or deleting data).

A Server Action is a single, asynchronous function that:
*   Is defined with the `'use server';` directive.
*   Is co-located with the component that calls it or in a central `actions.ts` file.
*   Executes exclusively on the server, never on the client.
*   Consolidates all business logic for a specific action into one place.

## 2. The `createPassAction` Example

The primary example of this pattern is the `createPassAction`, located in [`src/app/actions.ts`](./actions.ts). This single function is the **only way** a hall pass can be created in the system.

### Workflow of a Secure Server Action

The `createPassAction` follows a strict, sequential workflow:

1.  **Input Validation:** The incoming payload is first validated against a `zod` schema to ensure its shape and type are correct. Invalid requests fail immediately.
2.  **Policy Evaluation:** The action then calls the `PolicyEngine` to verify that the requested action is allowed according to all current school, group, and student policies.
3.  **Atomic Database Transaction:** The action initiates a `runTransaction` block with Firestore. This guarantees that all subsequent database operations within the block either succeed together or fail together, preventing race conditions and inconsistent states.
    *   **Inside the transaction**, it re-verifies that the student does not have another active pass.
    *   It then creates the new `Pass` document and writes it to the database.
4.  **Audit Logging:** After the transaction successfully commits, the action calls the `FERPAAuditLogger` to create an immutable log of the successful operation.
5.  **Cache Revalidation:** Finally, it calls Next.js's `revalidatePath` to tell the client to refetch data and display the new pass.

## 3. Benefits of this Architecture

*   **Security:** Business logic cannot be bypassed on the client. Since database writes are disallowed by `firestore.rules`, this server-side pathway is the only way to alter data.
*   **Maintainability:** All the logic for a single, complex action is located in one function, making it easy to find, understand, debug, and update.
*   **Reliability:** Atomic transactions prevent race conditions and ensure that the database is always in a consistent and valid state.
*   **Clarity:** It creates a clear distinction between "dumb" UI components that collect user input and "smart" server-side actions that securely execute business logic.

---

All future features that involve writing or updating data must follow this Server Action pattern. 