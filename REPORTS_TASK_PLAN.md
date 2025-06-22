# Eagle Pass - Reporting Features Task Plan

This document outlines the development plan for implementing a new suite of reporting features for both teachers and administrators.

---

### Phase 1: Foundational Reports (Core Data & High-Value Insights)

These reports focus on providing immediate, actionable insights with the data we already have.

#### 1. Frequent Flyers Report (Teacher & Admin)
- **Goal**: Show teachers which of their students use passes most often, and provide a school-wide view for administrators.
- **New Requirement**: Add a time filter (Day, Week, Month, All Time) to allow for more granular analysis.
- **Tasks**:
    - [ ] **Backend**: Update the `getPassCountsByStudent(locationId?: string, timeframe?: 'day' | 'week' | 'month' | 'all')` function to filter passes based on the selected time period.
    - [ ] **Frontend (Shared)**:
        - [ ] Add a time-filter UI (e.g., button group) to both the admin and teacher dashboards.
        - [ ] Manage the state for the selected timeframe.
    - [ ] **Frontend (Teacher)**:
        - [ ] Add a "My Frequent Flyers" card to the teacher dashboard (`/teacher`).
        - [ ] Display the top 5 students based on the selected timeframe.
    - [ ] **Frontend (Admin)**:
        - [ ] Add a "School-Wide Frequent Flyers" card to the admin reports page (`/admin/reports`).
        - [ ] Display the top 10 students based on the selected timeframe.

#### 2. Stall Sitter Report (Admin/School-Wide)
- **Goal**: Identify students who spend the most time in the bathroom.
- **Tasks**:
    - [ ] **Backend**:
        - [ ] Ensure `durationMinutes` is accurately calculated and stored for all pass legs.
        - [ ] Create a function `getLongestBathroomPasses()` that queries for passes to bathroom locations and sorts by duration.
    - [ ] **Frontend**:
        - [ ] Add a "Stall Sitters" card to the admin reports page (`/admin/reports`).
        - [ ] Display a list of the top 5 longest bathroom visits, showing student name, duration, and date.
        - [ ] Link to the student's detailed report page.

#### 3. Common Destinations Report (Teacher-Specific)
- **Goal**: Show teachers the most common destinations for their students.
- **Tasks**:
    - [ ] **Backend**: Create a function `getCommonDestinations(teacherId)` that aggregates destination counts for a teacher's students.
    - [ ] **Frontend**:
        - [ ] Add a "Common Destinations" card to the teacher dashboard.
        - [ ] Display a simple bar chart or list of top 3-5 destinations and their counts.

---

### Phase 2: Analytical & School-Wide Reports

These reports provide broader overviews and require more complex data aggregation.

#### 4. Location Hotspot Analysis (Admin/School-Wide)
- **Goal**: Show which locations are most popular across the entire school.
- **Tasks**:
    - [ ] **Backend**: Create a function `getLocationUsage()` that aggregates pass counts for every location.
    - [ ] **Frontend**:
        - [ ] Add a "Location Hotspots" card to the admin reports page.
        - [ ] Display a bar chart or heat map of location usage.

#### 5. Peak Usage Times Report (Admin/School-Wide)
- **Goal**: Show when passes are most frequently used throughout the day.
- **Tasks**:
    - [ ] **Backend**: Create a function `getPassesByHour()` that groups pass creation times by hour.
    - [ ] **Frontend**:
        - [ ] Add a "Peak Usage Times" card to the admin reports page.
        - [ ] Display a line chart showing pass volume by hour.

#### 6. Overdue Pass Report (Admin/School-Wide)
- **Goal**: Provide a real-time list of all currently overdue passes.
- **Tasks**:
    - [ ] **Backend**:
        - [ ] Define what constitutes an "overdue" pass (e.g., exceeds a certain duration).
        - [ ] Create a function `getOverduePasses()` that queries for active passes exceeding the time limit.
    - [ ] **Frontend**:
        - [ ] Add a prominent "Overdue Passes" card to the admin reports page.
        - [ ] Display a live-updating list of overdue passes with student, location, and current duration.

---

### Phase 3: Advanced & Predictive Features

These features require more sophisticated logic and will be built on top of the foundational reports.

#### 7. Anomaly Detection
- **Goal**: Flag unusual pass activity automatically.
- **Tasks**:
    - [ ] **Backend**:
        - [ ] Establish baseline pass behavior for students.
        - [ ] Develop a scheduled function or real-time check to identify deviations (e.g., sudden increase in pass frequency).
    - [ ] **Frontend**:
        - [ ] Create a dedicated "Alerts" or "Flags" section on the admin dashboard.
        - [ ] Display clear, actionable alerts for administrators.

#### 8. Student "Risk" Score
- **Goal**: Gently notify teachers about students who may need a check-in.
- **Tasks**:
    - [ ] **Backend**: Develop an algorithm that combines pass frequency, duration, and overdue instances into a single score.
    - [ ] **Frontend**:
        - [ ] Add a subtle indicator next to student names on the teacher dashboard.
        - [ ] Provide a private, detailed view for teachers to understand the factors contributing to the score.

This plan gives us a clear path forward. We can start with the "Frequent Flyers" and "Stall Sitter" reports in Phase 1, as they'll provide immediate value.

What do you think? Are you ready to dive into the first report? 