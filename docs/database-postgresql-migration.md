# SQLite Baseline and PostgreSQL Migration Design

## Summary

- Current production baseline is **SQLite via `better-sqlite3`**, not `sql.js`.
- Runtime safety baseline in this repo is:
  - `foreign_keys = ON`
  - `journal_mode = WAL`
  - `synchronous = NORMAL`
  - `busy_timeout = 5000`
- Current stable DB contract is the repository layer plus the DB facade methods:
  - `query`
  - `run`
  - `transaction`
  - `persist`
  - `backup`
  - `scheduleDailyBackup`
- This document defines the target PostgreSQL migration path without changing current REST/WS contracts or business semantics.

## Current SQLite Baseline

- Runtime database file is controlled by `DB_PATH`; binary storage is controlled by `BIN_STORAGE_PATH`.
- SQLite backup files live under `dirname(DB_PATH)/backups`.
- On POSIX, runtime paths are expected to be owner-only:
  - directories: `0700`
  - files: `0600`
- App-level backup strategy remains:
  - one startup snapshot
  - one rolling 24h snapshot cadence
- Repositories already exist under `backend/src/repositories/`, but the runtime adapter is currently SQLite-only.

## Schema Mapping

### Identity, auth, activation

Real tables:
- `users`
- `roles`
- `refresh_tokens`
- `password_reset_codes`
- `invite_codes`
- `activation_codes`
- `token_activation_bindings`

Mapping rules:
- `id` and foreign-key identity fields stay `text` in PostgreSQL to avoid rewriting current string id generation.
- current SQLite integer booleans map to PostgreSQL `boolean`.
- ISO timestamp text columns map to `timestamptz`.
- hash / code / token storage fields remain `text`.

### Tasks, preferences, notifications

Real tables:
- `task_configs`
- `task_runs`
- `task_control_states`
- `task_control_logs`
- `user_preferences`
- `resource_change_logs`
- `user_notifications`

Mapping rules:
- task and control state keys remain `text`.
- counters, retry counts, status flags, and interval values map to `integer`.
- time columns move from SQLite `TEXT` to PostgreSQL `timestamptz`.
- any opaque structured payloads that are already serialized JSON can move to `jsonb` only if the repository contract stays unchanged; otherwise keep `text` for the first migration.

### Security, audit, support, downloads

Real tables:
- `admin_audit_logs`
- `security_rate_limits`
- `security_event_logs`
- `feedback_items`
- `bin_download_tickets`
- `bin_download_audits`
- `wechat_contacts`

Mapping rules:
- audit/security ids remain `text`.
- IPs, route labels, actor ids, and masked payload fragments remain `text`.
- counters and limits map to `integer`.
- expiry / created / updated timestamps move to `timestamptz`.

### Referral program

Real tables:
- `referral_profiles`
- `referral_attributions`
- `referral_conversions`
- `referral_settlements`

Mapping rules:
- keep all ids as `text`.
- monetary `*_cents` and bps fields can stay `integer` in the first PostgreSQL cutover because current business semantics use JS safe integer ranges.
- settlement / conversion timestamps move to `timestamptz`.
- existing foreign key semantics (`RESTRICT`, `SET NULL`) must be preserved exactly.

## Migration Path

Recommended path is **single-write cutover**, not dual-write.

1. Complete the adapter boundary.
   - Keep repositories consuming only the stable facade methods.
   - Add a future `postgresAdapter` behind the same contract, but do not expose runtime selection until parity tests exist.
2. Freeze schema churn during migration preparation.
   - New DB-facing business work must go through repositories.
   - Avoid new route/service-local SQL.
3. Export SQLite source data.
   - Take a startup-style cold snapshot of `DB_PATH`.
   - Run a deterministic export/import script from the frozen snapshot into PostgreSQL staging.
4. Validate staging parity.
   - Repository integration tests must pass against the staging adapter.
   - Spot-check high-risk domains: auth, activation, referrals, admin audit, task control, security rate limits.
5. Schedule a short maintenance window.
   - Temporarily freeze writes.
   - Take a final SQLite snapshot.
   - Run the last export/import.
   - Switch runtime config to PostgreSQL only after validation succeeds.
6. Keep rollback-ready artifacts for at least one release cycle.

Explicitly rejected for this repo:
- dual-write between SQLite and PostgreSQL
- partial table-by-table live cutover
- app-layer cross-database distributed transaction logic

## Backup/Restore

### Before migration

- Take a final owner-only SQLite snapshot from `DB_PATH`.
- Preserve the matching `BIN_STORAGE_PATH` tree.
- Record the app build id and schema/export tool version used for the migration.

### During migration

- Import from the frozen SQLite snapshot into PostgreSQL staging/cutover target.
- Run repository-level smoke tests before reopening writes.

### Restore

- If PostgreSQL validation fails before cutover completes:
  - discard imported PostgreSQL data
  - keep SQLite as the live source
- If failure happens after config cutover:
  - stop writers
  - restore the final SQLite snapshot and matching binary storage snapshot
  - switch runtime config back to SQLite

## Rollback

Standard rollback path is:

1. Freeze writes.
2. Stop app instances.
3. Restore the final pre-cutover SQLite snapshot to `DB_PATH`.
4. Restore the matching `BIN_STORAGE_PATH` snapshot.
5. Re-enable SQLite runtime configuration.
6. Re-run health checks and repository smoke tests.

Rollback success criteria:
- auth login/refresh works
- task control routes work
- activation/referral/admin audit reads are intact
- no schema migration is required to reopen SQLite

## Concurrency/Transaction Strategy

### SQLite now

- SQLite remains a single-writer model.
- WAL stays enabled for concurrent readers.
- `busy_timeout = 5000` is the baseline retry window for transient file lock contention.
- multi-table writes continue to use explicit `transaction(...)`.

### PostgreSQL target

- Default isolation level: `READ COMMITTED`.
- Preserve explicit transactions for:
  - auth session/token writes
  - admin high-risk writes
  - activation binding flows
  - referral attribution/conversion/settlement flows
  - task control state + log pairs
- Do not introduce cross-service or cross-database distributed transactions.
- Prefer idempotent retries at repository/service boundaries over long-held transactions.

## Adapter Boundary

- Current stable import surface remains `backend/src/db/client.js` and `backend/src/db/index.js`.
- `client.js` should remain the long-lived facade entry.
- SQLite-specific implementation lives behind `sqliteAdapter`.
- Future `postgresAdapter` must match the same behavior-level contract before runtime selection is introduced.

## Operational Notes

- `DB_PATH`, `BIN_STORAGE_PATH`, the SQLite backup directory, and database/backup files should remain owner-only on POSIX.
- Development may auto-tighten unsafe permissions; production should fail closed on over-permissive paths.
- This document is the authoritative migration design. Older drafts under `backend/src/docs/` are compatibility stubs only.
