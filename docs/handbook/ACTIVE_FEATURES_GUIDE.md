# Eagle Pass – Active Feature Guide (MVP)

_Last updated: 2025-06-26_

This document is a quick reference for what is **currently implemented and live** in production.  It exists to reduce confusion when older screenshots, prototypes, or stories reference functionality that has since been postponed or changed.

---

## 1. Pass Lifecycle & Movement State

| Concept | Possible Values | Live? | Notes |
|---------|-----------------|-------|-------|
| **Pass Status** | `OPEN`, `CLOSED` | ✅ | Exactly one `OPEN` pass per student is allowed. |
| **Movement State** | `IN`, `OUT` | ✅ | Stored per leg; determines which UI actions are shown. |
| **Legs Array** | Arbitrary length | ⚠️ _Read-only_ | The backend stores each state transition as a new leg, but **students cannot initiate an additional destination while the pass is still OPEN** (see §2). |

---

## 2. Multi-Leg Trips

Multi-destination support appeared in early prototypes but was moved to the _Deferred_ column of the PRD (v3.1 §4: "Expanded multi-leg passes").

| Capability | Status | Rationale |
|------------|--------|-----------|
| Start a new destination while an `OPEN` pass exists | 🚫 Blocked by validation | Keeps the MVP logic simple and aligns with "one active pass per student". |
| Auto-extend current pass by adding legs (UI) | 🚫 Hidden in production UI | The backend still supports `addLeg()` (used by arrive/return actions), but the **extra _Create Pass_ form is now suppressed**. |
| Teacher/admin manual add-leg | 🚫 Not exposed | Will be revisited post-MVP. |

**Take-away:**  Students must _return to their scheduled classroom and close the pass_ before starting a new trip.

---

## 3. Student Actions (Happy Path)

1. **Create Pass** – origin = scheduled classroom, destination = selected location.  Pass status becomes `OPEN`, leg #1 state = `OUT`.
2. **I've Arrived** – marks arrival (`IN`) at destination by appending leg #2.  Pass remains `OPEN`.
3. **Return to Class** – starts journey back (`OUT`) to class (leg #3).
4. **I'm Back in Class** – arrival (`IN`) at class closes the pass (`status = CLOSED`, leg #4).

A single pass therefore has four legs in the common restroom scenario.

---

## 4. Deferred / Road-map Items

| Feature | PRD Section | Current ETA |
|---------|-------------|-------------|
| Multi-leg passes without returning to class | §4 (Deferred) | TBD – requires policy & UI work |
| Scheduled passes | §4 (Deferred) | TBD |
| Parent portal visibility | §4 (Deferred) | TBD |

---

## 5. How to Update This Guide

Whenever a feature is promoted from _Deferred_ to _Active_ or vice-versa:

1. Update the table(s) above.
2. Adjust the _Pass Lifecycle_ or _Student Actions_ narratives as needed.
3. Commit using conventional-commit style, e.g. `docs: update ACTIVE_FEATURES_GUIDE for multi-leg v1`.

Please keep this file concise – detailed requirements live in the full PRD. 