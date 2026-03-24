import { createPassword } from "../lib/crypto.js";
import { nowIso, randomId } from "../db/sql.js";
import { validatePasswordStrength } from "../lib/passwordPolicy.js";
import { userRepository } from "../repositories/userRepository.js";
import { env } from "../config/env.js";

export const getBootstrapAdminEnvConfig = () => {
  const password = String(process.env.BOOTSTRAP_ADMIN_PASSWORD || "").trim();
  const username =
    String(process.env.BOOTSTRAP_ADMIN_USERNAME || process.env.BOOTSTRAP_ADMIN_EMAIL || "").trim();
  const email =
    String(process.env.BOOTSTRAP_ADMIN_EMAIL || process.env.BOOTSTRAP_ADMIN_USERNAME || "").trim();

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

export const assertNoBootstrapAdminEnvInProduction = () => {
  const bootstrapAdmin = getBootstrapAdminEnvConfig();
  if (!bootstrapAdmin) return;
  if (env.nodeEnv !== "production") return;
  throw new Error(
    "BOOTSTRAP_ADMIN_* environment variables are one-time init secrets and must not be present in production runtime. Use `npm --prefix backend run init-admin` instead.",
  );
};

export const ensureBootstrapAdminFromEnv = () => {
  const bootstrapAdmin = getBootstrapAdminEnvConfig();
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
