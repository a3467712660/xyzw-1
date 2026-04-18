import { z } from "zod";
import {
  ACCESS_SCOPE_FULL,
  ACCESS_SCOPE_TASK_CONTROL_ONLY,
} from "../constants/accessScope.js";
import { isAllowedActivationDurationMonths } from "../lib/activationCodeDuration.js";

export const HORTOR_DEVICE_UNIQUE_ID_PATTERN = /^[\w.:-]{1,128}$/;

const genericApiErrorSchema = z.object({
  code: z.string().optional(),
  message: z.string().optional(),
}).partial();

export const apiEnvelopeSchema = (dataSchema = z.unknown()) =>
  z.object({
    success: z.boolean(),
    message: z.string().optional(),
    data: dataSchema.optional(),
    error: genericApiErrorSchema.optional(),
  }).passthrough();

export const authUserPayloadSchema = z.object({
  id: z.string(),
  username: z.string(),
  email: z.union([z.string(), z.null()]).optional(),
  nickname: z.string().optional(),
  phone: z.string().optional(),
  isAdmin: z.boolean().optional(),
  accessScope: z.string().optional(),
  mfaEnabled: z.boolean().optional(),
  tokenVersion: z.number().optional(),
  lastLoginAt: z.string().optional(),
}).passthrough();

export const registerBodySchema = z.object({
  username: z.string().trim().min(1).max(64),
  email: z.union([z.string().trim().email(), z.literal(""), z.null()]).optional(),
  password: z.string().min(1).max(128),
  inviteCode: z.string().trim().min(1).max(64),
  referralCode: z.string().trim().max(32).optional().default(""),
}).strict();

export const loginBodySchema = z.object({
  username: z.string().trim().min(1).max(128),
  password: z.string().min(1).max(128),
  rememberMe: z.boolean().optional().default(false),
}).strict();

export const passwordResetBodySchema = z.object({
  identity: z.string().trim().min(1).max(128),
  shortCode: z.string().trim().min(1).max(64),
  newPassword: z.string().min(1).max(128),
}).strict();

export const mfaVerifyBodySchema = z.object({
  mfaChallengeToken: z.string().trim().min(1).max(2048),
  totpCode: z.string().trim().max(32).optional(),
  recoveryCode: z.string().trim().max(64).optional(),
}).strict();

export const mfaQrSessionCreateBodySchema = z.object({
  mfaChallengeToken: z.string().trim().min(1).max(2048),
}).strict();

export const mfaQrSessionIdBodySchema = z.object({
  sessionId: z.string().trim().min(1).max(128),
}).strict();

export const mfaQrApproveBodySchema = z.object({
  sessionId: z.string().trim().min(1).max(128),
  totpCode: z.string().trim().max(32).optional(),
  recoveryCode: z.string().trim().max(64).optional(),
}).strict();

export const mfaSetupBodySchema = z.object({
  password: z.string().min(1).max(128),
}).strict();

export const mfaEnableBodySchema = z.object({
  password: z.string().min(1).max(128),
  secret: z.string().trim().min(8).max(512),
  totpCode: z.string().trim().min(4).max(32),
}).strict();

export const mfaDisableBodySchema = z.object({
  password: z.string().min(1).max(128),
  totpCode: z.string().trim().max(32).optional(),
  recoveryCode: z.string().trim().max(64).optional(),
}).strict();

export const mfaResetLinkBodySchema = z.object({
  token: z.string().trim().min(1).max(4096),
}).strict();

export const confirmPasswordBodySchema = z.object({
  password: z.string().trim().max(128).optional(),
  totpCode: z.string().trim().max(32).optional(),
  recoveryCode: z.string().trim().max(64).optional(),
}).strict();

export const tokenImportProxyBodySchema = z.object({
  url: z.string().trim().min(1).max(2048),
}).strict();

export const QR_STATUS_BODY_SCHEMA = z.object({
  uuid: z.string().trim().min(1).max(256),
});

const wechatProxyQueryValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.array(z.union([z.string(), z.number(), z.boolean()])),
]);

export const wechatQrConnectQuerySchema = z.record(
  z.string(),
  wechatProxyQueryValueSchema,
);
export const wechatQrConnectRequestSchema = z.object({
  query: wechatQrConnectQuerySchema.optional().default({}),
}).strict();

export const wechatHortorLoginQuerySchema = z.record(
  z.string(),
  wechatProxyQueryValueSchema,
);

export const wechatHortorLoginHeaderSchema = z.object({
  "x-xyzw-device-unique-id": z.string().trim().regex(HORTOR_DEVICE_UNIQUE_ID_PATTERN).max(128),
}).strict();

export const wechatHortorLoginBodySchema = z.string().max(64 * 1024);
export const wechatHortorLoginRequestSchema = z.object({
  body: wechatHortorLoginBodySchema,
  deviceUniqueId: z.string().trim().regex(HORTOR_DEVICE_UNIQUE_ID_PATTERN).max(128),
  query: wechatHortorLoginQuerySchema.optional().default({}),
}).strict();

export const authLoginResponseDataSchema = z.object({
  token: z.string().optional(),
  user: authUserPayloadSchema.optional(),
  mfaRequired: z.boolean().optional(),
  mfaChallengeToken: z.string().optional(),
}).passthrough();

export const authLoginResponseEnvelopeSchema = apiEnvelopeSchema(
  authLoginResponseDataSchema,
);

export const authRegisterResponseEnvelopeSchema = apiEnvelopeSchema(
  z.object({
    isTemporaryInvite: z.boolean().optional(),
    trialExpiresAt: z.union([z.string(), z.null()]).optional(),
    referralAttributed: z.boolean().optional(),
  }).passthrough(),
);

export const authRefreshResponseEnvelopeSchema = apiEnvelopeSchema(
  z.object({
    token: z.string().optional(),
  }).passthrough(),
);

export const authCsrfResponseEnvelopeSchema = apiEnvelopeSchema(
  z.object({
    headerName: z.string(),
    token: z.union([z.string(), z.null()]),
    hasRefreshTokenCookie: z.boolean(),
  }).passthrough(),
);

export const mfaQrSessionResponseEnvelopeSchema = apiEnvelopeSchema(
  z.object({
    sessionId: z.string(),
    expiresAt: z.string(),
  }).passthrough(),
);
export const mfaQrPollResponseEnvelopeSchema = apiEnvelopeSchema(
  authLoginResponseDataSchema.extend({
    status: z.string().optional(),
  }).passthrough(),
);

export const mfaSetupResponseEnvelopeSchema = apiEnvelopeSchema(
  z.object({
    secret: z.string(),
    otpauthUrl: z.string(),
  }).passthrough(),
);

export const mfaEnableResponseEnvelopeSchema = apiEnvelopeSchema(
  z.object({
    recoveryCodes: z.array(z.string()),
  }).passthrough(),
);

export const sensitiveConfirmResponseEnvelopeSchema = apiEnvelopeSchema(
  z.object({
    token: z.string(),
    expiresAt: z.string(),
  }).passthrough(),
);

export const genericSuccessEnvelopeSchema = apiEnvelopeSchema(z.unknown());
export const tokenImportProxyRawResponseSchema = z.unknown();
export const wechatProxyRawTextResponseSchema = z.string();
export const frontendTextEnvelopeSchema = apiEnvelopeSchema(z.string());
export const frontendUnknownEnvelopeSchema = apiEnvelopeSchema(z.unknown());

export const createActivationCodesBodySchema = z.object({
  count: z.coerce.number().int().min(1).max(100).optional().default(1),
  featureScope: z.enum([ACCESS_SCOPE_FULL, ACCESS_SCOPE_TASK_CONTROL_ONLY]).optional().default(ACCESS_SCOPE_FULL),
  durationMonths: z.coerce.number().int().refine((value) => isAllowedActivationDurationMonths(value), {
    message: "durationMonths must be one of 0/1/3/6/12",
  }),
  saleAmountCents: z.coerce.number().int().min(0).max(10_000_000).optional().default(0),
}).strict();
