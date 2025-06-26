# Eagle Pass – Active Feature Guide (MVP)

_Last updated: 2025-06-26_

This document is a quick reference for what is **currently implemented and live** in production.  It exists to reduce confusion when older screenshots, prototypes, or stories reference functionality that has since been postponed or changed.

---

## 1. Pass Lifecycle & Movement State

| Concept | Possible Values | Live? | Notes |
|---------|-----------------|-------|-------|
| **Pass Status** | `OPEN`, `CLOSED` | ✅ | Exactly one `OPEN` pass per student is allowed. |
| **Movement State** | `IN`, `OUT` | ✅ | Stored per leg; determines which UI actions are shown. |
| **Legs Array** | Arbitrary length | ✅ | Students can now add new destinations to an open pass as long as their last leg is `IN`. |

---

## 2. Multi-Leg Trips

Multi-destination support is now **active** and available to students.

| Capability | Status | Rationale |
|------------|--------|-----------|
| Start a new destination while an `OPEN` pass exists | ✅ Supported | Students can add destinations as long as their last leg is `IN`. |
| Auto-extend current pass by adding legs (UI) | ✅ Supported | UI and backend both support multi-leg journeys. |
| Teacher/admin manual add-leg | 🚫 Not exposed | Still deferred for staff, but student self-service is live. |

**Security:**
- All add-destination actions are validated by the `validateAddDestination` Cloud Function.
- Firestore rules enforce append-only writes to the `legs` array.
- All attempts (allowed or denied) are logged in `eventLogs` with `eventType: NEW_DESTINATION` or `PASS_VALIDATION`.

**Take-away:**  Students may add as many destinations as needed without returning to class, as long as they are physically at a location (`IN`).

---

## 3. Student Actions (Happy Path)

1. **Create Pass** – origin = scheduled classroom, destination = selected location.  Pass status becomes `OPEN`, leg #1 state = `OUT`.
2. **I've Arrived** – marks arrival (`IN`) at destination by appending leg #2.  Pass remains `OPEN`.
3. **Add Destination** – while at a location (`IN`), student may select a new destination, appending a new `OUT` leg.
4. **Repeat** – steps 2–3 as needed for additional stops.
5. **Return to Class** – starts journey back (`OUT`) to class (final leg).
6. **I'm Back in Class** – arrival (`IN`) at class closes the pass (`status = CLOSED`).

A single pass may now have many legs, reflecting a true multi-stop journey.

---

## 4. Deferred / Road-map Items

| Feature | PRD Section | Current ETA |
|---------|-------------|-------------|
| Teacher/admin manual add-leg | §4 (Deferred) | TBD |
| Scheduled passes | §4 (Deferred) | TBD |
| Parent portal visibility | §4 (Deferred) | TBD |

---

## 5. How to Update This Guide

Whenever a feature is promoted from _Deferred_ to _Active_ or vice-versa:

1. Update the table(s) above.
2. Adjust the _Pass Lifecycle_ or _Student Actions_ narratives as needed.
3. Commit using conventional-commit style, e.g. `docs: update ACTIVE_FEATURES_GUIDE for multi-leg v1`.

Please keep this file concise – detailed requirements live in the full PRD. 