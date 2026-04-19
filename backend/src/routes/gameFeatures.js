import { Router } from "express";
import { z } from "zod";
import { authRequired } from "../middleware/auth.js";
import { validateRequest } from "../middleware/validate.js";
import { errorResponse } from "../lib/httpResponse.js";
import {
  GAME_FEATURE_ACTION_IDS,
  gameCommandService,
  normalizeGameCommandError,
  stripSensitiveGamePayload,
} from "../services/gameCommandService.js";

const tokenIdParamSchema = z.object({
  tokenId: z.string().trim().min(1).max(128).regex(/^[a-zA-Z0-9_-]+$/),
});

const actionBodySchema = z.object({
  actionId: z.enum(GAME_FEATURE_ACTION_IDS),
});

const lineupSlotSchema = z.object({
  position: z.coerce.number().int().min(1).max(12),
  heroId: z.string().trim().max(64).optional().default(""),
  heroName: z.string().trim().max(80).optional().default(""),
  artifactId: z.string().trim().max(64).optional().default(""),
  pearlId: z.string().trim().max(64).optional().default(""),
});

const lineupSchema = z.object({
  id: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(80),
  teamId: z.coerce.number().int().min(1).max(6).nullable().optional(),
  slots: z.array(lineupSlotSchema).max(12).optional().default([]),
  updatedAt: z.string().trim().max(64).optional(),
});

const saveLineupsBodySchema = z.object({
  saved: z.array(lineupSchema).max(30),
});

const applyLineupBodySchema = z.object({
  lineupId: z.string().trim().min(1).max(80),
});

const sendSuccess = (res, data, message = undefined) =>
  res.json({
    success: true,
    ...(message ? { message } : {}),
    data: stripSensitiveGamePayload(data),
  });

const handleRouteError = (res, error, fallbackMessage) => {
  const normalized = normalizeGameCommandError(error, fallbackMessage);
  return errorResponse(res, normalized.status, normalized.code, normalized.message);
};

export const createGameFeatureRoutes = ({ gameService = gameCommandService } = {}) => {
  const router = Router();

  router.use(authRequired);

  router.get("/game-features/catalog", (_req, res) =>
    sendSuccess(res, gameService.getCatalog()));

  router.post(
    "/game-features/:tokenId/summary",
    validateRequest({ params: tokenIdParamSchema }),
    async (req, res) => {
      try {
        const data = await gameService.getSummary({
          user: req.auth.user,
          tokenId: req.params.tokenId,
        });
        return sendSuccess(res, data);
      } catch (error) {
        return handleRouteError(res, error, "游戏摘要获取失败");
      }
    },
  );

  router.post(
    "/game-features/:tokenId/action",
    validateRequest({ params: tokenIdParamSchema, body: actionBodySchema }),
    async (req, res) => {
      try {
        const data = await gameService.runAction({
          user: req.auth.user,
          tokenId: req.params.tokenId,
          actionId: req.body.actionId,
        });
        return sendSuccess(res, data, "游戏功能已执行");
      } catch (error) {
        return handleRouteError(res, error, "游戏功能执行失败");
      }
    },
  );

  router.post(
    "/game-features/:tokenId/legion-war/snapshot",
    validateRequest({ params: tokenIdParamSchema }),
    async (req, res) => {
      try {
        const data = await gameService.getLegionWarSnapshot({
          user: req.auth.user,
          tokenId: req.params.tokenId,
        });
        return sendSuccess(res, data);
      } catch (error) {
        return handleRouteError(res, error, "军团战数据获取失败");
      }
    },
  );

  router.get(
    "/game-features/:tokenId/lineups",
    validateRequest({ params: tokenIdParamSchema }),
    async (req, res) => {
      try {
        const data = await gameService.getLineups({
          user: req.auth.user,
          tokenId: req.params.tokenId,
        });
        return sendSuccess(res, data);
      } catch (error) {
        return handleRouteError(res, error, "阵容读取失败");
      }
    },
  );

  router.put(
    "/game-features/:tokenId/lineups",
    validateRequest({ params: tokenIdParamSchema, body: saveLineupsBodySchema }),
    async (req, res) => {
      try {
        const data = await gameService.saveLineups({
          user: req.auth.user,
          tokenId: req.params.tokenId,
          saved: req.body.saved,
        });
        return sendSuccess(res, data, "阵容已保存");
      } catch (error) {
        return handleRouteError(res, error, "阵容保存失败");
      }
    },
  );

  router.post(
    "/game-features/:tokenId/lineups/apply",
    validateRequest({ params: tokenIdParamSchema, body: applyLineupBodySchema }),
    async (req, res) => {
      try {
        const data = await gameService.applyLineup({
          user: req.auth.user,
          tokenId: req.params.tokenId,
          lineupId: req.body.lineupId,
        });
        return sendSuccess(res, data, "阵容应用流程已完成");
      } catch (error) {
        return handleRouteError(res, error, "阵容应用失败");
      }
    },
  );

  return router;
};

export default createGameFeatureRoutes();
