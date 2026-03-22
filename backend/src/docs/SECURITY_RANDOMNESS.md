# Security Randomness Guide

## Scope
This document defines where cryptographically secure randomness is required in backend code and how to review it.

## Rules
- Use CSPRNG for any security credential:
  - bearer token
  - one-time ticket
  - reset code
  - secret key material
  - nonce used in auth/crypto protocol
- `Math.random()` is forbidden in security-sensitive paths.
- `randomId()` is allowed only for non-secret record IDs (audit/task/log/entity PK) where predictability does not grant access.
- Prefer `secureId(prefix)` when the ID itself is a credential or part of a credential.

## Approved APIs
- `crypto.randomBytes(...)`
- `crypto.randomInt(...)`
- `secureId(prefix)` from [sql.js](/Users/qian/Desktop/xyzw_web_helper-main/backend/src/db/sql.js)

## Current Mapping (2026-03-19)
- Download ticket ID: `secureId("bdt")`
  - [binFiles.js](/Users/qian/Desktop/xyzw_web_helper-main/backend/src/routes/binFiles.js)
  - [binDownloadRepository.js](/Users/qian/Desktop/xyzw_web_helper-main/backend/src/repositories/binDownloadRepository.js)
- Refresh token:
  - token ID: `secureId("rft")`
  - token secret segment: `crypto.randomBytes(...)`
  - [auth.js](/Users/qian/Desktop/xyzw_web_helper-main/backend/src/routes/auth.js)
- Password reset short code: `crypto.randomBytes(...)`
  - [admin.js](/Users/qian/Desktop/xyzw_web_helper-main/backend/src/routes/admin.js)
- Invite code: `crypto.randomBytes(...)`
  - [admin.js](/Users/qian/Desktop/xyzw_web_helper-main/backend/src/routes/admin.js)
  - [temporaryInviteService.js](/Users/qian/Desktop/xyzw_web_helper-main/backend/src/services/temporaryInviteService.js)
- MFA secret/recovery codes: `crypto.randomBytes(...)`
  - [mfaService.js](/Users/qian/Desktop/xyzw_web_helper-main/backend/src/services/mfaService.js)
- CSRF token/nonce: `crypto.randomBytes(...)`
  - [csrf.js](/Users/qian/Desktop/xyzw_web_helper-main/backend/src/lib/csrf.js)
- Task scheduler transient IDs (`sessId`, `connId`): `crypto.randomInt(...)`
  - [taskControlSchedulerService.js](/Users/qian/Desktop/xyzw_web_helper-main/backend/src/services/taskControlSchedulerService.js)

## Review Checklist (rg commands)
Run these checks in `backend/`:

```bash
rg -n "Math\\.random" src
rg -n "randomId\\(" src
rg -n "ticket|reset|invite|token|secret|nonce|code" src/routes src/services src/lib src/repositories
rg -n "randomBytes|randomInt|secureId\\(" src
```

Review results with these questions:
- Is the generated value ever used as a credential, verifier, or direct authorization handle?
- If leaked in logs, can it be replayed for access?
- Is TTL short enough and one-time semantics enforced where needed?
- Is the value masked/redacted from request logs and telemetry?

## Red Flags
- `Math.random()` used for token/ticket/code generation
- predictable IDs used directly as download/auth/reset credentials
- sensitive query params (`ticket`, `token`, `code`, etc.) not redacted
- mixing record IDs and credential IDs without explicit boundary

