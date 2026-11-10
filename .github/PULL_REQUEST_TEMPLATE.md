## Description
Briefly describe the change and the motivation behind it.

## Type of Change
- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Documentation update
- [ ] Refactoring / performance improvement

## Ethos & Safeguards Checklist
- [ ] **No Transcript Surveillance**: Does not expose child conversation text to parent dashboards or external logs.
- [ ] **Zero Telemetry**: Does not introduce external tracking pixels, analytics, or remote third-party scripts.
- [ ] **Data Locality**: Preserves local-first SQLite persistence and transient in-memory session bounds.

## Verification Checklist
- [ ] `npm test` passes (all automated tests pass)
- [ ] `npx tsc --noEmit` passes with no TypeScript errors
- [ ] `npm run build` succeeds cleanly
- [ ] Added unit or integration tests for new features or bug fixes (in `tests/`)
