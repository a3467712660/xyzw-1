import { Router } from "express";
import { z } from "zod";
import { authRequired } from "../middleware/auth.js";
import { validateRequest } from "../middleware/validate.js";
import { errorResponse } from "../lib/httpResponse.js";
import {
  BATTLE_REPORT_TYPE_IDS,
  battleReportService,
  normalizeBattleReportError,
} from "../services/battleReportService.js";
import { stripSensitiveGamePayload } from "../services/gameCommandService.js";

const tokenIdParamSchema = z.object({
  tokenId: z.string().trim().min(1).max(128).regex(/^[a-zA-Z0-9_-]+$/),
});

const queryBodySchema = z.object({
  reportType: z.enum(BATTLE_REPORT_TYPE_IDS),
  date: z.string().trim().max(32).optional().default(""),
});

const parseBodySchema = z.object({
  rawText: z.string().trim().min(2).max(500_000).refine((value) => {
    try {
      const parsed = JSON.parse(value);
      return Boolean(parsed && typeof parsed === "object");
    } catch {
      return false;
    }
  }, "战报格式不支持"),
});

const sendSuccess = (res, data, message = undefined) =>
  res.json({
    success: true,
    ...(message ? { message } : {}),
    data: stripSensitiveGamePayload(data),
  });

const handleRouteError = (res, error, fallbackMessage) => {
  const normalized = normalizeBattleReportError(error, fallbackMessage);
  return errorResponse(res, normalized.status, normalized.code, normalized.message);
};

export const createBattleReportRoutes = ({ battleService = battleReportService } = {}) => {
  const router = Router();

  router.use(authRequired);

  router.get("/battle-reports/catalog", (_req, res) =>
    sendSuccess(res, battleService.getCatalog()));

  router.post(
    "/battle-reports/:tokenId/query",
    validateRequest({ params: tokenIdParamSchema, body: queryBodySchema }),
    async (req, res) => {
      try {
        const data = await battleService.queryReports({
          user: req.auth.user,
          tokenId: req.params.tokenId,
          reportType: req.body.reportType,
          date: req.body.date,
        });
        return sendSuccess(res, data);
      } catch (error) {
        return handleRouteError(res, error, "战报查询失败");
      }
    },
  );

  router.post(
    "/battle-reports/parse",
    validateRequest({ body: parseBodySchema }),
    async (req, res) => {
      try {
        const data = await battleService.parseReport({
          user: req.auth.user,
          rawText: req.body.rawText,
        });
        return sendSuccess(res, data);
      } catch (error) {
        return handleRouteError(res, error, "战报解析失败");
      }
    },
  );

  return router;
};

export default createBattleReportRoutes();
