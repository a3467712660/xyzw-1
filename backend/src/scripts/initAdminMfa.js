import { initDatabase } from "../db/database.js";
import { nowIso } from "../db/sql.js";
import { userRepository } from "../repositories/userRepository.js";
import { recordSecurityEvent } from "../services/securityEventService.js";
import { createMfaSetupPayload, encryptMfaSecret } from "../services/mfaService.js";

const username = String(process.env.ADMIN_USERNAME || "").trim();
const email = String(process.env.ADMIN_EMAIL || "").trim();

if (!username && !email) {
  // eslint-disable-next-line no-console
  console.error("ADMIN_USERNAME or ADMIN_EMAIL is required.");
  process.exit(1);
}

await initDatabase();

const userByUsername = username ? userRepository.findByIdentity(username) : null;
const userByEmail = email ? userRepository.findByIdentity(email) : null;

if (userByUsername && userByEmail && userByUsername.id !== userByEmail.id) {
  // eslint-disable-next-line no-console
  console.error("ADMIN_USERNAME and ADMIN_EMAIL point to different users.");
  process.exit(1);
}

const user = userByUsername || userByEmail;
if (!user) {
  // eslint-disable-next-line no-console
  console.error("Admin user not found by provided ADMIN_USERNAME/ADMIN_EMAIL.");
  process.exit(1);
}
if (!user.isAdmin) {
  // eslint-disable-next-line no-console
  console.error(`Target user is not admin: ${user.username}`);
  process.exit(1);
}

const setup = createMfaSetupPayload({ username: user.username });
const updatedAt = nowIso();

userRepository.updateMfaSettings({
  id: user.id,
  mfaEnabled: true,
  mfaTotpSecretEnc: encryptMfaSecret(setup.secret),
  mfaRecoveryCodesHash: JSON.stringify(setup.recoveryCodeHashes),
  updatedAt,
});

recordSecurityEvent({
  userId: user.id,
  eventType: "mfa_reset_by_cli",
  detail: {
    source: "init_admin_mfa_script",
    previousMfaEnabled: Boolean(user.mfaEnabled),
    matchedBy: {
      username: Boolean(username),
      email: Boolean(email),
    },
  },
  ip: "127.0.0.1",
  userAgent: "cli/initAdminMfa",
  createdAt: updatedAt,
});

// eslint-disable-next-line no-console
console.log(`Admin MFA initialized for: ${user.username} (${user.id})`);
// eslint-disable-next-line no-console
console.log("IMPORTANT: Secret and recovery codes are shown only now. Store them securely.");
// eslint-disable-next-line no-console
console.log(`Secret: ${setup.secret}`);
// eslint-disable-next-line no-console
console.log(`OTPAuth URL: ${setup.otpauthUrl}`);
// eslint-disable-next-line no-console
console.log("Recovery Codes:");
setup.recoveryCodes.forEach((code, idx) => {
  // eslint-disable-next-line no-console
  console.log(`${idx + 1}. ${code}`);
});
