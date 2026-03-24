import crypto from "node:crypto";
import { nowIso, randomId } from "../db/sql.js";
import { inviteCodeRepository } from "../repositories/inviteCodeRepository.js";
import { userRepository } from "../repositories/userRepository.js";

const TEMP_INVITES_AUTO_GENERATION_ENABLED = false;
const TEMP_INVITE_COUNT = 5;
const TEMP_INVITE_INTERVAL_MS = 48 * 60 * 60 * 1000;
const TEMP_INVITE_CHECK_INTERVAL_MS = 60 * 60 * 1000;

const generateTemporaryCode = () => {
  const random = crypto.randomBytes(5).toString("base64url").toUpperCase();
  return `TMP-${random}`;
};

const createTemporaryBatch = ({ creatorId, createdAt }) => {
  const expiresAt = new Date(
    new Date(createdAt).getTime() + TEMP_INVITE_INTERVAL_MS,
  ).toISOString();
  let created = 0;

  for (let i = 0; i < TEMP_INVITE_COUNT; i += 1) {
    let code = generateTemporaryCode();
    while (inviteCodeRepository.existsByCode(code)) {
      code = generateTemporaryCode();
    }
    inviteCodeRepository.create({
      id: randomId("invite"),
      code,
      createdBy: creatorId,
      expiresAt,
      isTemporary: true,
      createdAt,
    });
    created += 1;
  }

  return {
    created,
    expiresAt,
  };
};

export const ensureTemporaryInviteCodes = ({ reason = "manual" } = {}) => {
  if (!TEMP_INVITES_AUTO_GENERATION_ENABLED) {
    return {
      created: 0,
      skipped: true,
      reason,
      disabled: true,
      nextGenerateAt: null,
    };
  }

  const nowAt = nowIso();
  inviteCodeRepository.markExpiredTemporaryInactive(nowAt);

  const latestCreatedAt = inviteCodeRepository.findLatestTemporaryCreatedAt();
  if (latestCreatedAt) {
    const elapsed = Date.now() - new Date(latestCreatedAt).getTime();
    if (Number.isFinite(elapsed) && elapsed < TEMP_INVITE_INTERVAL_MS) {
      return {
        created: 0,
        skipped: true,
        reason,
        nextGenerateAt: new Date(
          new Date(latestCreatedAt).getTime() + TEMP_INVITE_INTERVAL_MS,
        ).toISOString(),
      };
    }
  }

  const creatorId = userRepository.findInviteCodeCreatorId();
  if (!creatorId) {
    return {
      created: 0,
      skipped: true,
      reason,
      error: "NO_CREATOR_USER",
    };
  }

  inviteCodeRepository.deactivateActiveTemporary();
  const result = createTemporaryBatch({
    creatorId,
    createdAt: nowAt,
  });

  return {
    created: result.created,
    skipped: false,
    reason,
    expiresAt: result.expiresAt,
    nextGenerateAt: result.expiresAt,
  };
};

export const startTemporaryInviteAutoJob = () => {
  if (!TEMP_INVITES_AUTO_GENERATION_ENABLED) {
    return;
  }

  const run = () => {
    try {
      const result = ensureTemporaryInviteCodes({ reason: "scheduler" });
      if (result.created > 0) {
        console.log(
          `[temporary-invite] generated ${result.created} codes, next=${result.nextGenerateAt}`,
        );
      }
    } catch (error) {
      console.error("[temporary-invite] scheduler failed:", error.message);
    }
  };

  run();
  const timer = setInterval(run, TEMP_INVITE_CHECK_INTERVAL_MS);
  if (typeof timer.unref === "function") {
    timer.unref();
  }
};
