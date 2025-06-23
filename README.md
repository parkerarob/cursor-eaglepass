> ⚠️ **WARNING: NOT PRODUCTION READY**
> 
> Critical security vulnerabilities present.
> See /review/START_HERE.md for details.
>
# Eagle Pass - Digital Hall Pass System (IN DEVELOPMENT)

Eagle Pass is a digital hall pass system currently in development. While core functionality exists, the system has significant issues that must be resolved before deployment.

## What Works
- Basic pass creation and management
- Simple role-based access
- Basic UI for students and teachers

## What's Broken
- Firebase security (credentials exposed in client bundle)
- FERPA compliance (critical services disabled or commented out)
- Rate limiting (resets on server restart, not persistent)
- No session management
- Minimal test coverage
- See [KNOWN_ISSUES.md](./docs/KNOWN_ISSUES.md) for a complete list of current problems (if this file is missing, see DEPLOYMENT_BLOCKERS.md and review/CODEBASE_REVIEW_2024-12-19.md)

## Security & Compliance (Current State)
- **Policy Engine**: Configurable rules and restrictions for pass creation and management (partial, not fully enforced)
- **Event Logging**: Some audit trail functionality exists, but not comprehensive
- **FERPA Compliance**: ⚠️ NOT IMPLEMENTED — Core services are commented out or incomplete. Do not rely on this system for FERPA compliance.

## Project Status

> ⚠️ This project is NOT production ready. Many features listed below are incomplete, broken, or only partially implemented. Documentation may not reflect the current state. Always verify claims against the codebase and [KNOWN_ISSUES.md](./docs/KNOWN_ISSUES.md).

### Completed (Partial) Phases
- Project setup and deployment (basic)
- Data models and mock data
- Firebase integration (insecure)
- Google SSO and role-based access (basic)
- Pass lifecycle management (core logic only)
- Policy enforcement and event logging (partial)
- Emergency freeze mode and duration tracking (basic)
- Teacher dashboard and reporting (UI only, backend incomplete)

### Incomplete/Broken Phases
- Security hardening
- FERPA compliance
- Persistent rate limiting
- Session management
- Comprehensive testing
- Monitoring and observability

## Getting Started

### 1. Prerequisites
- [Node.js](https://nodejs.org/) (v18 or later)
- [npm](https://www.npmjs.com/) or [yarn](https://yarnpkg.com/)
- A Firebase project

### 2. Environment Variables
This project uses Firebase for its backend and authentication. **WARNING: Credentials are currently exposed in the client bundle.**

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

## Documentation
- See [DEPLOYMENT_BLOCKERS.md](./DEPLOYMENT_BLOCKERS.md) for critical blockers.
- See [review/CODEBASE_REVIEW_2024-12-19.md](./review/CODEBASE_REVIEW_2024-12-19.md) for a full technical audit.
- See [docs/KNOWN_ISSUES.md](./docs/KNOWN_ISSUES.md) for a list of all known issues (if present).

## Disclaimer
> ⚠️ This system is NOT production ready. Do not use in a live school environment. FERPA compliance is NOT implemented. Security vulnerabilities are present. See documentation for details.
