# CI/CD Pipeline Documentation

## Overview

The Eagle Pass CI/CD pipeline ensures code quality, security, and compliance through automated checks and quality gates. The pipeline runs on every push and pull request to maintain high standards.

## Pipeline Jobs

### 1. Security Audit
**Purpose**: Identify security vulnerabilities and exposed secrets
**Triggers**: Every push and pull request
**Checks**:
- `npm audit --audit-level=moderate`
- Git secrets scan (if available)
- Basic secret pattern detection

**Failure Conditions**:
- Moderate or higher security vulnerabilities
- Exposed secrets in code

### 2. Code Quality
**Purpose**: Ensure code meets quality standards
**Triggers**: Every push and pull request
**Checks**:
- TypeScript type checking
- ESLint linting
- TODO/FIXME comment detection
- @ts-ignore comment detection

**Failure Conditions**:
- Type errors
- Linting errors
- TODO/FIXME comments in source code
- @ts-ignore comments (should fix types instead)

### 3. Test Suite
**Purpose**: Verify functionality and maintain test coverage
**Triggers**: Every push and pull request
**Checks**:
- Full test suite execution
- Coverage reporting
- Coverage threshold validation (80% minimum)

**Failure Conditions**:
- Test failures
- Coverage below 80%

### 4. Build Verification
**Purpose**: Ensure application builds successfully
**Triggers**: Every push and pull request
**Checks**:
- Production build
- Bundle size monitoring

**Failure Conditions**:
- Build errors
- Excessive bundle size

### 5. FERPA Compliance Check
**Purpose**: Ensure FERPA compliance features are working
**Triggers**: Every push and pull request
**Checks**:
- FERPA-related test execution
- Compliance marker detection

**Failure Conditions**:
- FERPA test failures
- Missing compliance implementation

### 6. Documentation Check
**Purpose**: Ensure documentation accuracy and completeness
**Triggers**: Every push and pull request
**Checks**:
- Production warning presence
- KNOWN_ISSUES.md existence
- False claim detection

**Failure Conditions**:
- Missing production warnings
- False claims in documentation

### 7. Integration Tests
**Purpose**: Verify system integration (future)
**Triggers**: After test and build success
**Status**: Not yet implemented

### 8. Deploy to Staging
**Purpose**: Deploy to staging environment
**Triggers**: Main branch only, after all other jobs pass
**Status**: Not yet configured

## Pre-commit Hooks

### Pre-commit Hook
Runs before every commit:
- Tests (without coverage)
- Linting
- Type checking
- TODO/FIXME detection
- @ts-ignore detection
- Console.log detection
- Large file detection
- Basic secret detection

### Pre-push Hook
Runs before pushing to remote:
- Full test suite with coverage
- Coverage threshold check (80%)
- Build verification
- Security audit
- Documentation check

## Quality Gates

### Coverage Thresholds
- **Statements**: 80%
- **Branches**: 80%
- **Functions**: 80%
- **Lines**: 80%

### Security Standards
- No moderate or higher vulnerabilities
- No exposed secrets
- No hardcoded credentials

### Code Quality Standards
- No TypeScript errors
- No ESLint errors
- No TODO/FIXME comments
- No @ts-ignore comments
- No console.log in production code

### Documentation Standards
- Production warnings in README
- KNOWN_ISSUES.md exists
- No false claims about compliance or readiness

## Local Development

### Running Quality Checks Locally

```bash
# Run all quality checks
npm run quality:full

# Run specific checks
npm run quality:check    # Lint + type-check + tests
npm run security:scan    # Security audit
npm run test:coverage    # Tests with coverage
npm run test:ferpa       # FERPA-specific tests
npm run test:security    # Security-specific tests
```

### Bypassing Hooks (Emergency Only)

```bash
# Skip pre-commit hook
git commit --no-verify

# Skip pre-push hook
git push --no-verify
```

**⚠️ Warning**: Only use these in emergencies. Quality gates exist for a reason.

## Troubleshooting

### Common Issues

#### Coverage Below Threshold
```bash
# Check current coverage
npm run test:coverage

# Focus on specific modules
npm test -- --testPathPattern="moduleName"
```

#### Linting Errors
```bash
# Auto-fix linting issues
npm run lint -- --fix
```

#### Type Errors
```bash
# Check types
npm run type-check

# Fix type issues instead of using @ts-ignore
```

#### Security Vulnerabilities
```bash
# Check vulnerabilities
npm audit

# Fix vulnerabilities
npm audit fix
```

### Pipeline Debugging

#### Local Pipeline Simulation
```bash
# Simulate CI locally
npm ci
npm run quality:full
npm run build
```

#### GitHub Actions Debugging
- Check Actions tab in GitHub repository
- Review job logs for specific failures
- Use `act` for local GitHub Actions testing

## Configuration Files

### GitHub Actions
- `.github/workflows/ci.yml` - Main CI pipeline

### Pre-commit Hooks
- `.husky/pre-commit` - Pre-commit quality gates
- `.husky/pre-push` - Pre-push quality gates

### Package Configuration
- `package.json` - Scripts and lint-staged configuration
- `jest.config.js` - Test configuration
- `eslint.config.mjs` - Linting configuration

## Best Practices

### Before Committing
1. Run `npm run quality:check` locally
2. Ensure all tests pass
3. Check coverage meets thresholds
4. Review for TODO/FIXME comments

### Before Pushing
1. Run `npm run quality:full` locally
2. Ensure build succeeds
3. Check security audit passes
4. Verify documentation is accurate

### When Pipeline Fails
1. Check the specific job that failed
2. Fix the issue locally
3. Re-run the failing check
4. Push again only when all checks pass

## Future Enhancements

### Planned Features
- [ ] Integration test suite
- [ ] E2E test automation
- [ ] Performance testing
- [ ] Automated dependency updates
- [ ] Staging deployment automation
- [ ] Production deployment pipeline
- [ ] Slack/email notifications
- [ ] Code coverage badges
- [ ] Security scanning integration

### Monitoring and Alerting
- [ ] Pipeline failure notifications
- [ ] Coverage trend monitoring
- [ ] Security vulnerability alerts
- [ ] Performance regression detection

## Support

For pipeline issues:
1. Check this documentation
2. Review GitHub Actions logs
3. Consult the troubleshooting section
4. Contact the development team

Remember: The pipeline exists to maintain quality and prevent regressions. Work with it, not around it. 