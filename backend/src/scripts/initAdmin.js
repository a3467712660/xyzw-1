import { initDatabase } from "../db/database.js";
import { createPassword } from "../lib/crypto.js";
import { nowIso, randomId } from "../db/sql.js";
import { validatePasswordStrength } from "../lib/passwordPolicy.js";
import { userRepository } from "../repositories/userRepository.js";

const username = String(process.env.ADMIN_USERNAME || "").trim();
const password = process.env.ADMIN_PASSWORD;
const email = String(process.env.ADMIN_EMAIL || "").trim();

if (!username) {
  // eslint-disable-next-line no-console
  console.error("ADMIN_USERNAME is required.");
  process.exit(1);
}

if (!email) {
  // eslint-disable-next-line no-console
  console.error("ADMIN_EMAIL is required.");
  process.exit(1);
}

if (!password) {
  // eslint-disable-next-line no-console
  console.error("ADMIN_PASSWORD is required.");
  process.exit(1);
}

const passwordCheck = validatePasswordStrength(password);
if (!passwordCheck.valid) {
  // eslint-disable-next-line no-console
  console.error(`ADMIN_PASSWORD invalid: ${passwordCheck.message}`);
  process.exit(1);
}

await initDatabase();

const existing = userRepository.findIdByUsernameOrEmail(username, email);

const ts = nowIso();
const meta = createPassword(password);

if (existing) {
  userRepository.updateBootstrapAdmin({
    id: existing.id,
    username,
    email,
    passwordSalt: meta.salt,
    passwordHash: meta.hash,
    updatedAt: ts,
  });
  // eslint-disable-next-line no-console
  console.log(`Admin user updated: ${username}`);
} else {
  userRepository.create({
    id: randomId("user"),
    username,
    email,
    passwordSalt: meta.salt,
    passwordHash: meta.hash,
    isAdmin: true,
    createdAt: ts,
    updatedAt: ts,
  });
  // eslint-disable-next-line no-console
  console.log(`Admin user created: ${username}`);
}
