# Current Issues and Blockers

## Active Development Issues

### ReportingDashboard Component - JSDOM Compatibility (HIGH PRIORITY)
**Status**: Ready for complete rewrite  
**Impact**: 18 test failures, blocks CI/testing pipeline  
**Root Cause**: Deep JSDOM `appendChild` compatibility issue in legacy component

#### Investigation Results:
- ✅ Browser-gating export functionality implemented
- ✅ Simplified metrics calculations (removed `flatMap().flat()`)
- ✅ All UI components properly mocked in tests
- ✅ Basic React rendering works in same test environment
- 🚫 **Core JSDOM appendChild error persists** even with stub components

#### Resolution Plan:
**Complete component rewrite** rather than debugging legacy implementation.
- Comprehensive prompt created for clean rebuild
- Focus on JSDOM-safe patterns from ground up
- Maintain API compatibility with existing props interface
- Target: ~40+ test failure reduction upon completion

#### Next Steps:
1. Execute rewrite following detailed prompt specifications
2. Implement clean React patterns with proper browser-gating
3. Create new test suite with accessibility-first queries
4. Remove/rename legacy component after validation

---

## Tool-chain & Infrastructure Issues

### ESLint Warnings (LOW PRIORITY)
**Count**: 16 warnings tracked  
**Status**: Documented as technical debt  
- Prefer-const violations
- No-explicit-any usage in test files
- Import order inconsistencies

### Type Coverage Gaps
- Some test files use liberal `any` typing
- Legacy components missing proper TypeScript interfaces

## Performance & Optimization

### Test Suite Performance
- Current runtime: ~30s for full suite
- 90 failing tests remaining after RoleSwitcher fixes
- Target: <20s runtime with <10 failing tests

### Build Performance
- Clean production builds functioning
- FERPA service build-time checks implemented

## Next Priority Components
1. **PassStatus/DurationTimer**: Duplicate badge testids
2. **SessionTimeoutWarning**: Jest.mocked pattern issues  
3. **API Routes**: Session logout 500 errors

# Current Issues

**Last Updated**: December 19, 2024

## 🔴 **BLOCKING ISSUES**

### 1. Build Failing - Linter Errors
- **Count**: 18 errors
- **Type**: require() imports in test files
- **Impact**: Cannot create production build
- **Fix**: Replace with ES6 imports
- **Time**: 2-3 hours
- **Files**: Various test files in `/src/lib/__tests__/`

## 🟡 **IMPROVEMENT OPPORTUNITIES**

### 1. Test Coverage Below Target
- **Current**: 23.95% overall
- **Target**: 80%
- **Core Logic**: 44.18% (good)
- **Missing**: UI component tests, integration tests
- **Priority**: Medium (after build fix)

### 2. No Integration Tests
- **Missing**: End-to-end workflow tests
- **Impact**: Medium (manual testing covers for now)
- **Priority**: Medium

### 3. Performance Not Optimized
- **Status**: No performance testing done
- **Impact**: Low (system responsive in testing)
- **Priority**: Low

## 🟢 **WORKING WELL**

- Core business logic (206 tests passing)
- Security (all vulnerabilities fixed)
- FERPA compliance (98% score)
- User interface (functional and responsive)
- Documentation (honest and accurate)

## 🚧 High Priority (Blocking Release)

### 1. Test Failures
- **24 failed test suites** - mostly component-level issues
- **100 failed tests** - duplicate test IDs, jest.mocked API usage
- Focus areas: RoleSwitcher, ReportingDashboard, rate-limiter

### 2. Component Testing
- Missing UI component test coverage
- Multiple elements with same test IDs
- Jest mocking patterns need updating

## 📋 Tech Debt (Post-Release Cleanup)

### ESLint Warnings (16 total)
Track these unused variables/imports for cleanup:
- Unused imports: `getFirestore`, `User`, `getFirebaseApp`
- Unused parameters: `_context`, `_event`, `disclosure`, `request`
- Unused variables: `subject`, `body`, `message`, `title`, `alert`, `result`

**Action**: Create tickets to either use these variables or remove dead code

## ✅ Recent Fixes (Tool-chain Cleanup)
- ✅ ESLint flat config working (0 errors)
- ✅ TypeScript 5.8 compatibility
- ✅ FERPA build-time initialization fixed
- ✅ Node 20 LTS locked (.nvmrc)
- ✅ CI smoke tests added
- ✅ Clean npm audit (0 vulnerabilities)

## 🎯 Next Steps
1. Fix duplicate test IDs in components
2. Update jest.mocked API usage
3. Add missing UI component tests
4. Clean up ESLint warnings
5. Integration testing

---

**Focus**: Fix the build first, everything else is enhancement. 