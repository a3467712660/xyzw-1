# Database Migration Plan (Draft)

## 1. Current Baseline (2026-03-10)
- Current runtime DB engine: `sql.js` (file-based binary export).
- A unified DB facade is available at `backend/src/db/client.js`:
  - `query`
  - `run`
  - `transaction`
  - `persist`
  - `backup`
- Repository layer introduced at `backend/src/repositories/`:
  - `userRepository`
  - `inviteCodeRepository`
  - `ticketRepository`
  - `taskRepository`
  - `notificationRepository`

## 2. Immediate Risk Controls
- Startup backup: create backup once during process bootstrap.
- Daily backup: scheduled every 24 hours.
- Write safety log: append a pre-write intent log before each `run`; append failure entries when write fails.

## 3. Migration Target
- Candidate engines:
  - SQLite (native driver)
  - PostgreSQL
- Goal: keep service/route contracts unchanged while swapping repository/db implementation.

## 4. Recommended Migration Steps
1. Freeze SQL spreading
- New business code must access DB via repositories only.
- Keep SQL out of routes/services unless a repository method does not exist yet.

2. Define repository contracts
- For each repository, document method signatures and return types.
- Add integration tests at repository boundary.

3. Introduce adapter implementation
- Add `sqljs` adapter (current), `sqlite` adapter, and `postgres` adapter behind the same facade.
- Keep `query/run/transaction/persist/backup` behavior compatible.

4. Data model compatibility check
- Verify type mapping differences (`INTEGER`/`BOOLEAN`, date strings, upsert syntax).
- Replace SQL dialect-specific syntax with portable SQL where possible.

5. Dual-run validation (optional but recommended)
- In staging: write to new DB and compare read results for key entities (`users`, `invite_codes`, `feedback_items`, `task_*`).

6. Cutover and rollback
- Cutover by environment switch.
- Keep startup backup + rollback script for at least one release cycle.

## 5. Acceptance Criteria
- No direct SQL in user/invite/ticket business flows outside repositories.
- Repository tests pass under both current and target adapters.
- Cutover can be reverted by config and backup restore.
