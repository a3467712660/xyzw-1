import { createPassword } from "../lib/crypto.js";
import { nowIso, randomId } from "../db/sql.js";
import { validatePasswordStrength } from "../lib/passwordPolicy.js";
import { userRepository } from "../repositories/userRepository.js";

const getBootstrapAdminConfig = () => {
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  const username =
    process.env.BOOTSTRAP_ADMIN_USERNAME || process.env.BOOTSTRAP_ADMIN_EMAIL;
  const email =
    process.env.BOOTSTRAP_ADMIN_EMAIL || process.env.BOOTSTRAP_ADMIN_USERNAME;

  if (!password) {
    return null;
  }

  if (!username) {
    throw new Error(
      "BOOTSTRAP_ADMIN_USERNAME or BOOTSTRAP_ADMIN_EMAIL is required when BOOTSTRAP_ADMIN_PASSWORD is set.",
    );
  }

  if (String(password).length < 12) {
    throw new Error("BOOTSTRAP_ADMIN_PASSWORD must be at least 12 characters.");
  }
  const passwordCheck = validatePasswordStrength(password);
  if (!passwordCheck.valid) {
    throw new Error(`BOOTSTRAP_ADMIN_PASSWORD invalid: ${passwordCheck.message}`);
  }

  return {
    username,
    email: email || null,
    password,
  };
};

export const ensureBootstrapAdminFromEnv = () => {
  const bootstrapAdmin = getBootstrapAdminConfig();
  if (!bootstrapAdmin) {
    return false;
  }

  const existing = userRepository.findIdByUsernameOrEmail(
    bootstrapAdmin.username,
    bootstrapAdmin.email,
  );

  const ts = nowIso();
  const pass = createPassword(bootstrapAdmin.password);

  if (existing) {
    userRepository.updateBootstrapAdmin({
      id: existing.id,
      username: bootstrapAdmin.username,
      email: bootstrapAdmin.email,
      passwordSalt: pass.salt,
      passwordHash: pass.hash,
      updatedAt: ts,
    });
    return true;
  }

  userRepository.create({
    id: randomId("user"),
    username: bootstrapAdmin.username,
    email: bootstrapAdmin.email,
    passwordSalt: pass.salt,
    passwordHash: pass.hash,
    isAdmin: true,
    createdAt: ts,
    updatedAt: ts,
  });
  return true;
};
