import { Router } from "express";
import crypto from "crypto";
import { z } from "zod";
import { authRequired } from "../middleware/auth.js";
import { validateRequest } from "../middleware/validate.js";
import { nowIso, randomId } from "../db/sql.js";
import { transaction } from "../db/client.js";
import { activationCodeRepository } from "../repositories/activationCodeRepository.js";
import { tokenActivationRepository } from "../repositories/tokenActivationRepository.js";
import { userRepository } from "../repositories/userRepository.js";

const router = Router();

const tokenIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(128)
  .regex(/^[a-zA-Z0-9_-]+$/);

const roleIdSchema = z
  .string()
  .trim()
  .regex(/^\d{6,12}$/, "roleId must be a 6-12 digit numeric id");

const roleIndexSchema = z.preprocess(
  (value) => {
    if (value === null || value === undefined) {
      return undefined;
    }
    const text = String(value).trim();
    return text === "" ? undefined : text;
  },
  z.coerce.number().int().min(0).max(9).optional(),
);

const bindActivationBodySchema = z.object({
  tokenId: tokenIdSchema,
  sessId: z.string().trim().max(256).optional().default(""),
  roleId: roleIdSchema.optional(),
  gameAccountId: roleIdSchema.optional(),
  roleName: z.string().trim().max(64).optional().default(""),
  region: z.string().trim().max(64).optional().default(""),
  server: z.string().trim().max(64).optional().default(""),
  roleIndex: roleIndexSchema,
  activationCode: z.string().trim().min(1).max(64),
}).strict().superRefine((data, ctx) => {
  const roleId = String(data.roleId || data.gameAccountId || "").trim();
  if (!/^\d{6,12}$/.test(roleId)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "roleId must be a 6-12 digit numeric id",
      path: ["roleId"],
    });
  }
});

const activationStatusQuerySchema = z.object({
  tokenId: tokenIdSchema.optional(),
  sessId: z.string().trim().max(256).optional().default(""),
  roleId: roleIdSchema.optional(),
  gameAccountId: roleIdSchema.optional(),
  roleName: z.string().trim().max(64).optional().default(""),
  region: z.string().trim().max(64).optional().default(""),
  server: z.string().trim().max(64).optional().default(""),
  roleIndex: roleIndexSchema,
}).superRefine((data, ctx) => {
  const roleId = String(data.roleId || data.gameAccountId || "").trim();
  if (!/^\d{6,12}$/.test(roleId)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "roleId must be a 6-12 digit numeric id",
      path: ["roleId"],
    });
  }
});

const allowedDurationMonths = new Set([1, 3, 6, 12]);

const addMonths = (baseDate, months) => {
  const safeMonths = Number(months) || 0;
  const date = new Date(baseDate);
  const day = date.getDate();
  date.setMonth(date.getMonth() + safeMonths);
  if (date.getDate() < day) {
    date.setDate(0);
  }
  return date;
};

const parseFutureDateOrNull = (value, nowTs) => {
  const text = String(value || "").trim();
  if (!text) return null;
  const parsed = new Date(text);
  const ts = parsed.getTime();
  if (!Number.isFinite(ts) || ts <= nowTs) return null;
  return parsed;
};

const DEFAULT_ROLE_NAME = "未命名角色";
const DEFAULT_REGION = "未知大区";

const normalizeRoleName = (value) => {
  const text = String(value || "").trim();
  return text || DEFAULT_ROLE_NAME;
};

const normalizeRegion = (value) => {
  const text = String(value || "").trim();
  return text || DEFAULT_REGION;
};

const normalizeSessId = (value) => String(value || "").trim().slice(0, 256);

const normalizeRoleIndex = (value) => {
  if (value === null || value === undefined || value === "") {
    return "";
  }
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return "";
  }
  const safe = Math.max(0, Math.floor(num));
  return String(safe);
};

const buildAccountIdentity = ({ sessId, roleId, region, roleName }) =>
  `${normalizeSessId(sessId)}|${String(roleId || "").trim()}|${normalizeRegion(region)}|${normalizeRoleName(roleName)}`;

const buildRoleCompositeLabel = ({ roleName, region, roleId, roleIndex }) => {
  const base = `${normalizeRoleName(roleName)}-${normalizeRegion(region)}-${String(roleId || "").trim()}`;
  const normalizedRoleIndex = normalizeRoleIndex(roleIndex);
  return normalizedRoleIndex ? `${base}-序号${normalizedRoleIndex}` : base;
};

const createAccountSeed = () => {
  const raw = crypto.randomBytes(8).toString("hex").toUpperCase();
  return raw.match(/.{1,4}/g)?.join("-") || raw;
};

const createAccountSignature = ({ accountIdentity, accountSeed }) =>
  crypto.createHash("sha256").update(`${accountIdentity}|${accountSeed}`).digest("hex");

router.use(authRequired);

router.post(
  "/token-activations/bind",
  validateRequest({ body: bindActivationBodySchema }),
  (req, res) => {
    const tokenId = String(req.body?.tokenId || "").trim();
    const sessId = normalizeSessId(req.body?.sessId);
    const roleId = String(req.body?.roleId || req.body?.gameAccountId || "").trim();
    const roleName = String(req.body?.roleName || "").trim();
    const region = String(req.body?.region || req.body?.server || "").trim();
    const roleIndex = normalizeRoleIndex(req.body?.roleIndex);
    const normalizedRoleName = normalizeRoleName(roleName);
    const normalizedRegion = normalizeRegion(region);
    const accountIdentity = buildAccountIdentity({
      sessId,
      roleName: normalizedRoleName,
      region: normalizedRegion,
      roleId,
    });
    const roleCompositeLabel = buildRoleCompositeLabel({
      roleName: normalizedRoleName,
      region: normalizedRegion,
      roleId,
      roleIndex,
    });
    const activationCode = String(req.body?.activationCode || "").trim().toUpperCase();
    const userId = String(req.auth?.user?.id || "").trim();

    const now = new Date();
    const nowAt = nowIso();

    const result = transaction(() => {
      const tokenBinding = tokenActivationRepository.findByTokenId({ tokenId });
      if (tokenBinding && String(tokenBinding.userId || "") !== userId) {
        return {
          status: 403,
          payload: { success: false, message: "该Token已绑定到其他用户，无法重复绑定" },
        };
      }
      if (
        tokenBinding
        && String(tokenBinding.accountIdentity || "").trim() !== accountIdentity
      ) {
        return {
          status: 400,
          payload: {
            success: false,
            message: "该Token已绑定其他账号标识（sessid-RoleID-大区-角色名），请使用对应账号激活",
          },
        };
      }
      if (
        tokenActivationRepository.existsByAccountIdentityForOtherUser({
          accountIdentity,
          userId,
        })
      ) {
        return {
          status: 403,
          payload: { success: false, message: "该账号标识已绑定到其他用户，无法重复绑定" },
        };
      }

      const bindingByTokenAndIdentity = tokenActivationRepository.findByTokenAndAccountIdentity({
        tokenId,
        accountIdentity,
      });
      const bindingByIdentity = tokenActivationRepository.findByAccountIdentity({
        accountIdentity,
      });
      if (
        bindingByIdentity
        && String(bindingByIdentity.userId || "").trim() === userId
        && String(bindingByIdentity.tokenId || "").trim() !== tokenId
      ) {
        return {
          status: 400,
          payload: {
            success: false,
            message: "该账号标识已绑定其他Token，请使用对应账号激活",
          },
        };
      }
      const binding = bindingByTokenAndIdentity || null;

      const codeRow = activationCodeRepository.findByCode(activationCode);
      if (!codeRow) {
        return {
          status: 400,
          payload: { success: false, message: "激活码无效" },
        };
      }
      if (!codeRow.isActive) {
        return {
          status: 400,
          payload: { success: false, message: "激活码已失效" },
        };
      }
      if (codeRow.usedAt) {
        return {
          status: 400,
          payload: { success: false, message: "激活码已使用" },
        };
      }

      const durationMonths = Math.max(1, Number(codeRow.durationMonths) || 1);
      if (!allowedDurationMonths.has(durationMonths)) {
        return {
          status: 400,
          payload: { success: false, message: "激活码时长配置无效" },
        };
      }

      const previousExpiresAt = String(binding?.expiresAt || tokenBinding?.expiresAt || "").trim();
      const activeExpiresAt = parseFutureDateOrNull(previousExpiresAt, now.getTime());
      const baseStartAt = activeExpiresAt || now;
      const expiresAt = addMonths(baseStartAt, durationMonths).toISOString();
      const extendedFromActive = Boolean(activeExpiresAt);
      const accountSeed = String(
        tokenBinding?.accountSeed || bindingByIdentity?.accountSeed || createAccountSeed(),
      ).trim();
      const accountSignature = createAccountSignature({
        accountIdentity,
        accountSeed,
      });

      if (binding) {
        tokenActivationRepository.updateById({
          id: binding.id,
          tokenId,
          userId,
          roleName: normalizedRoleName,
          region: normalizedRegion,
          roleIndex,
          accountIdentity,
          accountSeed,
          accountSignature,
          activationCodeId: codeRow.id,
          boundAt: nowAt,
          expiresAt,
        });
      } else {
        tokenActivationRepository.create({
          id: randomId("tact"),
          tokenId,
          roleId,
          roleName: normalizedRoleName,
          region: normalizedRegion,
          roleIndex,
          accountIdentity,
          accountSeed,
          accountSignature,
          userId,
          activationCodeId: codeRow.id,
          boundAt: nowAt,
          expiresAt,
          createdAt: nowAt,
        });
      }

      userRepository.updateAccessScope({
        id: userId,
        accessScope: codeRow.featureScope,
        updatedAt: nowAt,
      });

      activationCodeRepository.consumeById({
        id: codeRow.id,
        usedBy: userId,
        usedAt: nowAt,
        boundTokenId: "",
        boundGameAccountId: roleCompositeLabel,
      });

      return {
        status: 200,
        payload: {
          success: true,
          message: extendedFromActive ? "Token 续期成功" : "Token 激活成功",
          data: {
            tokenId: binding?.tokenId || tokenId,
            roleId,
            roleName: normalizedRoleName,
            region: normalizedRegion,
            roleIndex,
            accountIdentity,
            roleCompositeLabel,
            gameAccountId: roleId,
            boundAt: nowAt,
            expiresAt,
            previousExpiresAt: previousExpiresAt || null,
            extendedFromActive,
            durationMonths,
          },
        },
      };
    });

    return res.status(result.status).json(result.payload);
  },
);

router.get(
  "/token-activations/status",
  validateRequest({ query: activationStatusQuerySchema }),
  (req, res) => {
    const tokenId = String(req.query?.tokenId || "").trim();
    const sessId = normalizeSessId(req.query?.sessId);
    const roleId = String(req.query?.roleId || req.query?.gameAccountId || "").trim();
    const roleName = String(req.query?.roleName || "").trim();
    const region = String(req.query?.region || req.query?.server || "").trim();
    const roleIndex = normalizeRoleIndex(req.query?.roleIndex);
    const normalizedRoleName = normalizeRoleName(roleName);
    const normalizedRegion = normalizeRegion(region);
    const accountIdentity = buildAccountIdentity({
      sessId,
      roleName: normalizedRoleName,
      region: normalizedRegion,
      roleId,
    });
    const userId = String(req.auth?.user?.id || "").trim();

    let binding = tokenId
      ? tokenActivationRepository.findByTokenId({ tokenId })
      : null;
    if (tokenId && !binding) {
      return res.json({
        success: true,
        data: {
          tokenId,
          roleId,
          roleName: normalizedRoleName,
          region: normalizedRegion,
          roleIndex,
          accountIdentity,
          sessId,
          gameAccountId: roleId,
          active: false,
          bound: false,
          expiresAt: null,
          boundAt: null,
        },
      });
    }
    if (binding && String(binding.accountIdentity || "").trim() !== accountIdentity) {
      return res.status(403).json({
        success: false,
        message: "该Token未绑定当前账号标识，请使用已绑定账号",
      });
    }
    if (!binding) {
      binding = tokenActivationRepository.findByAccountIdentity({
        accountIdentity,
      });
    }
    if (!binding) {
      return res.json({
        success: true,
        data: {
          tokenId: tokenId || null,
          roleId,
          roleName: normalizedRoleName,
          region: normalizedRegion,
          roleIndex,
          accountIdentity,
          sessId,
          gameAccountId: roleId,
          active: false,
          bound: false,
          expiresAt: null,
          boundAt: null,
        },
      });
    }

    if (String(binding.userId || "") !== userId) {
      return res.status(403).json({
        success: false,
        message: "该账号标识已绑定到其他用户",
      });
    }
    if (tokenId && String(binding.tokenId || "").trim() && String(binding.tokenId || "").trim() !== tokenId) {
      return res.status(403).json({
        success: false,
        message: "该Token未绑定当前账号标识，请使用已绑定账号",
      });
    }

    const expiresAt = String(binding.expiresAt || "");
    const active = Boolean(binding.isActive) && new Date(expiresAt).getTime() > Date.now();

    return res.json({
      success: true,
      data: {
        tokenId: tokenId || binding.tokenId || null,
        roleId: String(binding.roleId || roleId || "").trim(),
        roleName: binding.roleName || normalizedRoleName,
        region: binding.region || normalizedRegion,
        roleIndex: String(binding.roleIndex ?? roleIndex).trim(),
        accountIdentity: buildAccountIdentity({
          sessId,
          roleName: binding.roleName || normalizedRoleName,
          region: binding.region || normalizedRegion,
          roleId: String(binding.roleId || roleId || "").trim(),
        }),
        roleCompositeLabel: buildRoleCompositeLabel({
          roleName: binding.roleName || normalizedRoleName,
          region: binding.region || normalizedRegion,
          roleId: String(binding.roleId || roleId || "").trim(),
          roleIndex: String(binding.roleIndex ?? roleIndex).trim(),
        }),
        sessId,
        gameAccountId: String(binding.roleId || roleId || "").trim(),
        active,
        bound: true,
        expiresAt,
        boundAt: binding.boundAt || null,
      },
    });
  },
);

router.get("/token-activations/my", (_req, res) => {
  const userId = String(_req.auth?.user?.id || "").trim();
  const rows = tokenActivationRepository.listByUser(userId);
  const nowTs = Date.now();

  return res.json({
    success: true,
    data: rows.map((row) => {
      const safeRow = { ...row };
      delete safeRow.accountSeed;
      delete safeRow.accountSignature;
      return {
        ...safeRow,
        active: Boolean(row.isActive) && new Date(row.expiresAt).getTime() > nowTs,
      };
    }),
  });
});

export default router;
