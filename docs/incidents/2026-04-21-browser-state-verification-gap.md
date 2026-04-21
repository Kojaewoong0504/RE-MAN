# Incident: Browser state verification gap after UI fix

## Symptom

The user still saw the home header login pill after a reported fix, even though targeted tests had passed.

## Root Cause

The fix was verified with tests and a restarted dev server, but not re-checked against the current browser-visible server state before reporting completion.

## Fix

- Re-opened the currently running local server with Playwright and inspected the actual header DOM.
- Confirmed the current server rendered no login pill for signed-out home state.
- Promoted a rule that user-reported current browser state must be re-verified directly before claiming completion.

## Prevent Recurrence

- When the user reports "still visible" or "still broken", direct browser verification of the current server state takes priority over previous test results.
- UI completion claims require either a fresh DOM inspection or a fresh screenshot from the current running server.

## Verification

- Playwright direct-open against `http://127.0.0.1:3001`
- header DOM showed only `RE:MAN`
- `loginCount=0`, `pillCount=0`
