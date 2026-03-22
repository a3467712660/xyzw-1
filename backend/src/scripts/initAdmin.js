import { initDatabase } from "../db/database.js";
import { createPassword } from "../lib/crypto.js";
import { nowIso, randomId } from "../db/sql.js";
import { validatePasswordStrength } from "../lib/passwordPolicy.js";
import { userRepository } from "../repositories/userRepository.js";

const username = process.env.ADMIN_USERNAME || "318265998@qq.com";
const password = process.env.ADMIN_PASSWORD;
const email = process.env.ADMIN_EMAIL || "318265998@qq.com";

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
