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
import { battleReportExportImageService } from "../services/battleReportExportImageService.js";
import { stripSensitiveGamePayload } from "../services/gameCommandService.js";

const tokenIdParamSchema = z.object({
  tokenId: z.string().trim().min(1).max(128).regex(/^[\w-]+$/),
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

const battleReportExportStatSchema = z.object({
  label: z.string().trim().min(1).max(24),
  value: z.string().trim().min(1).max(32),
}).strict();

const battleReportExportMetricSchema = z.object({
  label: z.string().trim().min(1).max(24),
  meta: z.string().trim().max(48).optional().default(""),
  value: z.string().trim().min(1).max(32),
}).strict();

const battleReportExportRankItemSchema = z.object({
  name: z.string().trim().min(1).max(80),
  value: z.string().trim().min(1).max(32),
}).strict();

const battleReportExportRankPanelSchema = z.object({
  key: z.string().trim().min(1).max(32),
  title: z.string().trim().min(1).max(32),
  items: z.array(battleReportExportRankItemSchema).max(3).optional().default([]),
}).strict();

const battleReportExportHeroSchema = z.object({
  name: z.string().trim().min(1).max(80),
  avatarText: z.string().trim().max(8).optional().default("?"),
  avatarDataUrl: z.string().trim().max(90000).optional().default(""),
  avatarUrl: z.string().trim().max(2048).optional().default(""),
  holyBeastText: z.string().trim().min(1).max(16),
  redQuenchText: z.string().trim().min(1).max(16),
}).strict();

const battleReportExportRowSchema = z.object({
  index: z.coerce.number().int().min(1).max(999),
  name: z.string().trim().min(1).max(80),
  roleId: z.string().trim().max(64).optional().default(""),
  avatarText: z.string().trim().max(8).optional().default("?"),
  avatarUrl: z.string().trim().max(2048).optional().default(""),
  avatarDataUrl: z.string().trim().max(90000).optional().default(""),
  killText: z.string().trim().min(1).max(32),
  metric2Text: z.string().trim().min(1).max(32),
  metric3Text: z.string().trim().min(1).max(32),
  kdText: z.string().trim().min(1).max(32),
  reviveText: z.string().trim().max(32).optional().default(""),
  noteText: z.string().trim().max(32).optional().default("-"),
  serverText: z.string().trim().max(32).optional().default("-"),
  redQuenchText: z.string().trim().max(32).optional().default("-"),
  powerText: z.string().trim().max(32).optional().default("-"),
  announcementText: z.string().trim().max(120).optional().default("-"),
  allianceText: z.string().trim().max(32).optional().default("-"),
  topHeroes: z.array(battleReportExportHeroSchema).max(3).optional().default([]),
}).strict();

const battleReportExportSectionSchema = z.object({
  title: z.string().trim().min(1).max(80),
  subtitle: z.string().trim().max(120).optional().default(""),
  tone: z.enum(["neutral", "opponent", "own", "salt"]).optional().default("neutral"),
  layout: z.enum(["standard", "warrank", "tactical"]).optional().default("standard"),
  statusLabel: z.string().trim().max(24).optional().default(""),
  statusValue: z.string().trim().max(32).optional().default(""),
  primaryLabel: z.string().trim().min(1).max(16).optional().default("击杀"),
  metric2Label: z.string().trim().min(1).max(16),
  metric3Label: z.string().trim().min(1).max(16),
  metrics: z.array(battleReportExportMetricSchema).max(4).optional().default([]),
  rankPanels: z.array(battleReportExportRankPanelSchema).max(4).optional().default([]),
  stats: z.array(battleReportExportStatSchema).max(8).optional().default([]),
  rows: z.array(battleReportExportRowSchema).max(220),
}).strict();

const battleReportExportBodySchema = z.object({
  reportType: z.enum(["salt-field", "peach-garden"]),
  title: z.string().trim().min(1).max(80),
  subtitle: z.string().trim().max(120).optional().default(""),
  badgeLabel: z.string().trim().max(24).optional().default(""),
  badgeValue: z.string().trim().max(32).optional().default(""),
  reportDate: z.string().trim().min(1).max(32),
  exportedAt: z.string().trim().min(1).max(64),
  sections: z.array(battleReportExportSectionSchema).min(1).max(2),
}).strict();

const sendSuccess = (res, data, message = undefined) =>
  res.json({
    success: true,
    ...(message ? { message } : {}),
    data: stripSensitiveGamePayload(data),
  });

const handleRouteError = (res, error, fallbackMessage) => {
  const normalized = normalizeBattleReportError(error, fallbackMessage);
  if (normalized.status === 200 && normalized.data) {
    return sendSuccess(res, normalized.data);
  }
  return errorResponse(res, normalized.status, normalized.code, normalized.message);
};

export const createBattleReportRoutes = ({
  battleService = battleReportService,
  exportImageService = battleReportExportImageService,
} = {}) => {
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

  router.post(
    "/battle-reports/:tokenId/export-image",
    validateRequest({ params: tokenIdParamSchema, body: battleReportExportBodySchema }),
    async (req, res) => {
      try {
        const png = await exportImageService.renderBattleReportImage(req.body);
        res.setHeader("Content-Type", "image/png");
        res.setHeader("Cache-Control", "no-store");
        return res.status(200).send(png);
      } catch (error) {
        return handleRouteError(res, error, "战报图片生成失败");
      }
    },
  );

  return router;
};

export default createBattleReportRoutes();
