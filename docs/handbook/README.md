> ⚠️ DOCUMENTATION WARNING
>
> This documentation may not reflect the current implementation. Last verified: 2025-06-23
> Implementation status: PARTIAL/IN PROGRESS
> Reliability: Low
>
> Always verify claims against actual code and the remediation log before relying on this documentation.

# Eagle Pass Documentation Handbook

> **Note**: This is the canonical index for all living documentation. All status, progress, and issue tracking documents have been moved to [docs/archive/](../archive/).

Welcome to the Eagle Pass system documentation. This directory contains comprehensive documentation for developers, AI assistants, and system administrators.

## 📚 Documentation Index

### Getting Started
- **[AI Context Guide](./AI_CONTEXT_GUIDE.md)** - Essential context for AI assistants and new developers
- **[Product Requirements Document](./PRD.md)** - Complete product specification and requirements

### Development Guides
- **[Code Conventions](./CODE_CONVENTIONS.md)** - Coding standards and best practices
- **[Data Access Security Model](./DATA_ACCESS_SECURITY_MODEL.md)** - **[NEW]** Explains the Firestore security rules and data access patterns. **All developers should read this.**
- **[Core Actions Architecture](./CORE_ACTIONS_ARCHITECTURE.md)** - **[NEW]** Explains the Server Action pattern for all state-changing operations. **All developers should read this.**
- **[API Documentation](./API_DOCUMENTATION.md)** - Detailed API reference for all services
- **[Troubleshooting Guide](./TROUBLESHOOTING_GUIDE.md)** - Common issues and solutions

### FERPA Compliance
- **[FERPA Technical Implementation](./FERPA_TECHNICAL_IMPLEMENTATION.md)** - Technical details of FERPA compliance
- **[FERPA Administrative Requirements](./FERPA_ADMINISTRATIVE_REQUIREMENTS.md)** - Admin setup for FERPA
- **[FERPA Compliance Audit](./FERPA_COMPLIANCE_AUDIT.md)** - Compliance verification checklist
- **[FERPA Implementation Log](./FERPA_IMPLEMENTATION_LOG.md)** - Implementation progress tracking

### Testing & Security
- **[Testing Plan](./TESTING_PLAN.md)** - Comprehensive testing strategy
- **[Testing Checklist](./TESTING_CHECKLIST.md)** - Test coverage checklist
- **[Security Review](./SECURITY_REVIEW_AND_HARDENING.md)** - Security analysis and hardening guide

## 🚀 Quick Start for AI Assistants

1. **Read First**: [AI_CONTEXT_GUIDE.md](./AI_CONTEXT_GUIDE.md)
2. **Understand Patterns**: [CODE_CONVENTIONS.md](./CODE_CONVENTIONS.md)
3. **Check APIs**: [API_DOCUMENTATION.md](./API_DOCUMENTATION.md)
4. **Fix Issues**: [TROUBLESHOOTING_GUIDE.md](./TROUBLESHOOTING_GUIDE.md)

## 🏗️ Architecture Overview

```
Eagle Pass System
├── Frontend (Next.js + React)
│   ├── Server Components (default)
│   ├── Client Components (interactive)
│   └── Tailwind CSS styling
├── Backend (Firebase)
│   ├── Firestore (database)
│   ├── Authentication
│   └── Security Rules
└── Compliance Layer
    ├── FERPA Audit Logging
    ├── Data Retention
    └── Parent Access Portal
```

## 📋 Key Features

- **Digital Hall Passes** - Create and track student movements
- **Real-time Monitoring** - Live student location tracking
- **FERPA Compliance** - Full audit trails and parent access
- **Notification System** - Multi-channel alerts for extended passes
- **Role-based Access** - Student, Teacher, Admin, Parent roles
- **Security Hardened** - Comprehensive security measures

## 🔧 Development Workflow

1. **Setup Environment**
   ```bash
   npm install
   cp .env.example .env.local
   # Add Firebase credentials
   ```

2. **Run Development**
   ```bash
   npm run dev
   ```

3. **Before Committing**
   ```bash
   npm run build  # Check for errors
   npm test      # Run tests
   npm run lint  # Fix linting issues
   ```

4. **Deploy**
   ```bash
   vercel deploy
   ```

## 📞 Support

- **Codebase Issues**: Check [TROUBLESHOOTING_GUIDE.md](./TROUBLESHOOTING_GUIDE.md)
- **FERPA Questions**: Review FERPA documentation files
- **API Help**: See [API_DOCUMENTATION.md](./API_DOCUMENTATION.md)

## 🔄 Documentation Updates

When adding new features:
1. Update relevant API documentation
2. Add to troubleshooting guide if introducing new error scenarios
3. Update AI context guide with new patterns
4. Keep FERPA docs current with compliance changes

---

*For the most up-to-date information, always check the actual implementation in the codebase.* 

### Key Documentation

This handbook is organized into several key areas. New developers should start with the `AI Context Guide` and the `Data Access Security Model`.

*   **[AI Context Guide](./AI_CONTEXT_GUIDE.md)**: High-level overview for AI assistants and developers.
*   **[Code Conventions](./CODE_CONVENTIONS.md)**: Standards for writing consistent and maintainable code.
*   **[Data Access Security Model](./DATA_ACCESS_SECURITY_MODEL.md)**: Explains the Firestore security rules and data access patterns. **All developers should read this.**
*   **[Core Actions Architecture](./CORE_ACTIONS_ARCHITECTURE.md)**: **[NEW]** Explains the Server Action pattern for all state-changing operations. **All developers should read this.**
*   **[API Documentation](./API_DOCUMENTATION.md)**: Details on the service layer and core APIs.
*   **[CI/CD Pipeline](./CI_CD_PIPELINE.md)**: Information on the continuous integration and deployment process.
*   **[Troubleshooting Guide](./TROUBLESHOOTING_GUIDE.md)**: Solutions for common problems and errors.

### FERPA Compliance
