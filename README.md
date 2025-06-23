> ⚠️ **WARNING: NOT PRODUCTION READY**
> 
> Critical security vulnerabilities present.
> See /review/START_HERE.md for details.
>
# Eagle Pass - Digital Hall Pass System

Eagle Pass is a modern, web-based digital hall pass system designed for schools. It replaces traditional paper passes with an efficient, trackable, and easy-to-use application. Students can request passes from their devices, and staff can monitor student movements in real-time.

![Eagle Pass Screenshot](https://raw.githubusercontent.com/parkerarob/cursor-eaglepass/main/public/eagle-pass-screenshot.png) 
*Note: Add a real screenshot of the application to the `public` directory.*

## Features

### Core Functionality
- **Student Pass Management**: Students can create, manage, and close digital hall passes.
- **Real-time State Machine**: A robust state machine handles all pass logic, including multi-leg trips (e.g., library to bathroom) and special location rules.
- **Role-Based Access Control**: Different user roles (student, teacher, admin, dev) with appropriate permissions.
- **Google SSO**: Secure and easy login with Google accounts.

### Teacher Features
- **Teacher Dashboard**: Dedicated interface for classroom management and student monitoring.
- **Classroom Policy Management**: Teachers can set and view classroom rules for student movement.
- **Student-Specific Overrides**: Teachers can create exceptions for individual students.
- **Group Management**: Teachers can create and manage student groups (Positive/Negative).
- **Classroom Policy Summary**: Real-time view of current classroom policy settings.
- **Teacher Assist**: Teachers can manually close student passes and assist with pass management.

### Admin Features
- **Admin Dashboard**: A dedicated interface for administrators to view a live, human-readable log of all pass activity.
- **Advanced Reporting**: Comprehensive reporting system with analytics, student activity tracking, and location usage statistics.
- **CSV Export**: Export pass data and event logs for external analysis.
- **System Health Monitoring**: Real-time monitoring dashboard for system health, error tracking, and performance metrics.

### Safety & Emergency Features
- **Emergency Freeze Mode**: Global emergency banner and system freeze functionality for crisis situations.
- **Duration Timers & Escalation Notifications**: All active passes are tracked in real time. Automatic notifications escalate to teachers at 10 minutes and to admins at 20 minutes.
- **Real-time Monitoring**: Students see a live duration timer and escalation status on their dashboard.

### Policy System
- **Hierarchical Classroom Policies**: Teachers have full autonomy to set classroom-specific rules.
- **Student Policy Overrides**: Teachers can create exceptions for specific students.
- **Policy Hierarchy**: Student overrides → Classroom policy → Global defaults.
- **Real-time Policy Evaluation**: Policies are evaluated in real-time during pass creation.
- **Three Policy Types**: Student leaving, student arriving, teacher requests.

### User Experience
- **Dark/Light Mode**: A modern UI with theme toggling.
- **Responsive Design**: Works seamlessly on desktop and mobile devices.
- **Real-time Updates**: Live data updates with auto-refresh functionality.

### Security & Compliance
- **Policy Engine**: Configurable rules and restrictions for pass creation and management.
- **Event Logging**: Comprehensive audit trail for all system activities.
- **FERPA Compliance**: Secure data handling and privacy protection.

### Admin & Dev Tools

#### Bulk CSV Upload (Production Readiness)

- Upload CSV files for users, locations, groups, classroom policies, and restrictions via the /dev-tools page
- Schema validation before ingesting data
- Efficient Firestore batch writes for large data sets
- Audit logging and error reporting shown in the UI and stored in Firestore
- Extensible schema-driven design for future data types

See `src/lib/dataIngestionService.ts` for implementation details and supported schemas.

## Tech Stack

- **Framework**: [Next.js](https://nextjs.org/) (App Router)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Backend & DB**: [Firebase](https://firebase.google.com/) (Firestore, Authentication)
- **UI**: [Tailwind CSS](https://tailwindcss.com/) & [shadcn/ui](https://ui.shadcn.com/)
- **State Management**: React Hooks & Context API
- **Testing**: [Jest](https://jestjs.io/) & [React Testing Library](https://testing-library.com/)
- **Deployment**: [Vercel](https://vercel.com/)

## Project Status

**🎉 Eagle Pass v1.3.0 is now complete with hierarchical classroom policy system!**

### Completed Phases
- ✅ **Phase 1**: Foundation & "Hello World" - Project setup and deployment
- ✅ **Phase 2**: Understanding Data - Data models and mock data
- ✅ **Phase 3**: Real Data Storage - Firebase integration
- ✅ **Phase 4**: Authentication & Security - Google SSO and role-based access
- ✅ **Phase 5**: Core State Machine - Robust pass lifecycle management
- ✅ **Phase 7**: Policy Engine & Security - Policy enforcement and event logging
- ✅ **Phase 8**: Emergency Features - Emergency freeze mode and duration tracking
- ✅ **Phase 9**: Enhanced Admin Features - Teacher dashboard and advanced reporting
- ✅ **Phase 10**: Production Readiness - Monitoring, observability, and data management
- ✅ **Phase 11**: Hierarchical Policy System - Classroom policies, student overrides, and teacher autonomy

### Current Phase
- ✅ **Phase 11**: Hierarchical Policy System - Complete with teacher dashboard and group management

## Getting Started

### 1. Prerequisites
- [Node.js](https://nodejs.org/) (v18 or later)
- [npm](https://www.npmjs.com/) or [yarn](https://yarnpkg.com/)
- A Firebase project

### 2. Environment Variables
This project uses Firebase for its backend and authentication. Before you can run the application, you'll need to set up your environment variables.

1. Create a file named `.env.local` in the root of the project.
2. Copy the contents of the example below and replace the placeholders with your actual Firebase project credentials.

```sh
# .env.local

# Your Firebase project configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Run the Development Server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the application.

## Project Structure
Here is a high-level overview of the important files and directories:

- `/src/app/`: Main application routes (student view, teacher dashboard, admin dashboard, dev tools).
- `/src/components/`: Shared React components including UI components and specialized components.
- `/src/lib/`: Core application logic.
  - `/firebase/`: Firebase configuration and service functions.
  - `/stateMachine.ts`: The core logic for pass state transitions.
  - `/passService.ts`: Service layer for pass management.
  - `/notificationService.ts`: Duration tracking and escalation logic.
  - `/eventLogger.ts`: Event logging and audit trail functionality.
  - `/policyEngine.ts`: Hierarchical policy enforcement and rule management.
- `/src/types/`: TypeScript type definitions.
- `/src/lib/__tests__/`: Jest tests for the application logic.

## Key Features in Detail

### State Machine
The core state machine manages pass lifecycles with binary states:
- **Pass Status**: OPEN or CLOSED
- **Movement State**: IN or OUT
- **Multi-leg Support**: Complex movement patterns (e.g., classroom → library → bathroom → library → classroom)

### Hierarchical Policy System
- **Classroom Policies**: Teachers set default rules for their classroom
- **Student Overrides**: Teachers create exceptions for specific students
- **Policy Hierarchy**: Student overrides → Classroom policy → Global defaults
- **Three Policy Types**: Student leaving, student arriving, teacher requests
- **Real-time Evaluation**: Policies evaluated during pass creation

### Emergency Features
- **Emergency Freeze**: Global system freeze with real-time banner
- **Duration Tracking**: Real-time pass duration with escalation at 10min (teacher) and 20min (admin)
- **Notification System**: Automated escalation with failure logging

### Teacher Dashboard
- **Classroom Management**: View and manage students assigned to teacher's classroom
- **Policy Configuration**: Set and manage classroom policies and student overrides
- **Group Management**: Create and manage student groups
- **Pass Monitoring**: Real-time view of student passes with teacher responsibility
- **Policy Summary**: Quick view of current classroom policy settings

### Reporting System
- **Historical Analysis**: Date-range filtered reports
- **Student Activity**: Individual student movement patterns and statistics
- **Location Analytics**: Most popular destinations and usage patterns
- **Event Logs**: Comprehensive audit trail for all system activities
- **Data Export**: CSV export for external analysis

### Monitoring & Observability
- **System Health Dashboard**: Admins can view real-time system health, event queue size, and active performance traces.
- **Error Tracking**: Automatic logging of unhandled errors and promise rejections.
- **Performance Monitoring**: API call durations and performance traces tracked via Firebase Performance Monitoring (client-only).
- **User Action Logging**: All critical user actions are logged for audit and debugging.
- **Security Event Logging**: Security-related events are tracked and surfaced in the admin dashboard.

## Deployment

The easiest way to deploy this Next.js app is to use the [Vercel Platform](https://vercel.com/new).

- **Framework Preset**: `Next.js`
- **Build & Development Settings**: Should be automatically configured.
- **Environment Variables**: Make sure to add your Firebase environment variables to the Vercel project settings.

Check out the [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Contributing

This project follows a structured development approach with clear phases and milestones. See `TASK_PROGRESS.md` for detailed progress tracking and `docs/PRD.md` for product requirements.

## Documentation

Comprehensive documentation is available in the `/docs` directory:

- **[Documentation Index](./docs/README.md)** - Complete guide to all available documentation
- **[AI Context Guide](./docs/AI_CONTEXT_GUIDE.md)** - Essential context for AI assistants and developers
- **[API Documentation](./docs/API_DOCUMENTATION.md)** - Detailed API reference
- **[Code Conventions](./docs/CODE_CONVENTIONS.md)** - Coding standards and best practices
- **[Troubleshooting Guide](./docs/TROUBLESHOOTING_GUIDE.md)** - Common issues and solutions

For developers working on the codebase, start with the [Documentation Index](./docs/README.md).

## License

This project is designed for educational use and school safety. Please ensure compliance with local privacy and data protection regulations.
