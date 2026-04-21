# Incident: Platform-locked direct dependency broke deployment install

## Symptom

Vercel deployment failed before build with `npm ERR! code EBADPLATFORM` for `@rolldown/binding-wasm32-wasi`.

## Root Cause

Local runtime/signing issues were worked around by adding a `wasm32`-only package directly to `devDependencies`.
That made the repository itself non-installable on normal x64/arm64 environments, so Vercel failed during `npm install`.

## Fix

- Removed `@rolldown/binding-wasm32-wasi` from direct `devDependencies`.
- Added an install compatibility check to `scripts/check-deploy-readiness.mjs`.
- Added a unit test that mutates `package.json` with the forbidden package and expects strict deploy readiness to fail.
- Moved the local Vitest workaround to a transient `--no-save` install path used only during local test execution.

## Prevent Recurrence

- Platform-locked packages must not be added as direct repository dependencies unless the target install platforms are explicitly compatible.
- Install-stage failures are reported as `install compatibility`, not hidden under later build status.
- `npm run check:deploy` must fail before deployment if a forbidden direct dependency is present.

## Verification

- local `npm install` no longer fails with `EBADPLATFORM`
- `npm run test:unit -- tests/unit/deploy-readiness.test.ts`
- `npm run check:deploy:strict`
