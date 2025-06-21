# Eagle Pass - Digital Hall Pass System

Eagle Pass is a modern, web-based digital hall pass system designed for schools. It replaces traditional paper passes with an efficient, trackable, and easy-to-use application. Students can request passes from their devices, and staff can monitor student movements in real-time.

![Eagle Pass Screenshot](https://raw.githubusercontent.com/parkerarob/cursor-eaglepass/main/public/eagle-pass-screenshot.png) 
*Note: Add a real screenshot of the application to the `public` directory.*

## Features

- **Student Pass Management**: Students can create, manage, and close digital hall passes.
- **Real-time State Machine**: A robust state machine handles all pass logic, including multi-leg trips (e.g., library to bathroom) and special location rules.
- **Admin Dashboard**: A dedicated interface for teachers and administrators to view a live, human-readable log of all pass activity.
- **Role-Based Access Control**: Different user roles (student, teacher, admin, dev) with appropriate permissions.
- **Google SSO**: Secure and easy login with Google accounts.
- **Dark/Light Mode**: A modern UI with theme toggling.
- **Vercel Analytics**: Built-in analytics to monitor application usage.

## Tech Stack

- **Framework**: [Next.js](https://nextjs.org/) (App Router)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Backend & DB**: [Firebase](https://firebase.google.com/) (Firestore, Authentication)
- **UI**: [Tailwind CSS](https://tailwindcss.com/) & [shadcn/ui](https://ui.shadcn.com/)
- **State Management**: React Hooks & Context API
- **Testing**: [Jest](https://jestjs.io/) & [React Testing Library](https://testing-library.com/)
- **Deployment**: [Vercel](https://vercel.com/)

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

- `/src/app/`: Main application routes (student view, admin dashboard).
- `/src/components/`: Shared React components.
- `/src/lib/`: Core application logic.
  - `/firebase/`: Firebase configuration and service functions.
  - `/stateMachine.ts`: The core logic for pass state transitions.
  - `/passService.ts`: Service layer for pass management.
- `/src/types/`: TypeScript type definitions.
- `/src/lib/__tests__/`: Jest tests for the application logic.

## Deployment

The easiest way to deploy this Next.js app is to use the [Vercel Platform](https://vercel.com/new).

- **Framework Preset**: `Next.js`
- **Build & Development Settings**: Should be automatically configured.
- **Environment Variables**: Make sure to add your Firebase environment variables to the Vercel project settings.

Check out the [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
