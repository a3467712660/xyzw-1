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

const workbenchSectionBodySchema = z.object({
  sectionId: z.string().trim().min(1).max(80),
});

const workbenchActionBodySchema = z.object({
  sectionId: z.string().trim().max(80).optional().default(""),
  cardId: z.string().trim().max(120).optional().default(""),
  actionId: z.enum(GAME_FEATURE_ACTION_IDS),
  payload: z.any().optional().default({}),
});

const replayRenderBodySchema = z.object({
  payload: z.any().optional().default({}),
});

const renderImageParamSchema = z.object({
  renderId: z.string().trim().min(1).max(128).regex(/^[a-zA-Z0-9_-]+$/),
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

  router.get("/game-features/workbench/catalog", (_req, res) =>
    sendSuccess(res, gameService.getWorkbenchCatalog()));

  router.get(
    "/game-features/rendered-replays/:renderId/image",
    validateRequest({ params: renderImageParamSchema }),
    async (req, res) => {
      try {
        const image = await gameService.getRenderedReplayImage({
          user: req.auth.user,
          renderId: req.params.renderId,
        });
        if (!image) {
          return errorResponse(res, 404, "REPLAY_RENDER_NOT_FOUND", "回放渲染结果不存在或已过期");
        }
        res.setHeader("Content-Type", image.contentType || "image/svg+xml");
        res.setHeader("Cache-Control", "private, max-age=60");
        return res.send(image.body);
      } catch (error) {
        return handleRouteError(res, error, "回放渲染图读取失败");
      }
    },
  );

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
    "/game-features/:tokenId/workbench/bootstrap",
    validateRequest({ params: tokenIdParamSchema }),
    async (req, res) => {
      try {
        const data = await gameService.getWorkbenchBootstrap({
          user: req.auth.user,
          tokenId: req.params.tokenId,
        });
        return sendSuccess(res, data);
      } catch (error) {
        return handleRouteError(res, error, "游戏工作台初始化失败");
      }
    },
  );

  router.post(
    "/game-features/:tokenId/workbench/section",
    validateRequest({ params: tokenIdParamSchema, body: workbenchSectionBodySchema }),
    async (req, res) => {
      try {
        const data = await gameService.getWorkbenchSection({
          user: req.auth.user,
          tokenId: req.params.tokenId,
          sectionId: req.body.sectionId,
        });
        return sendSuccess(res, data);
      } catch (error) {
        return handleRouteError(res, error, "游戏工作台分区读取失败");
      }
    },
  );

  router.post(
    "/game-features/:tokenId/workbench/action",
    validateRequest({ params: tokenIdParamSchema, body: workbenchActionBodySchema }),
    async (req, res) => {
      try {
        const data = await gameService.runWorkbenchAction({
          user: req.auth.user,
          tokenId: req.params.tokenId,
          sectionId: req.body.sectionId,
          cardId: req.body.cardId,
          actionId: req.body.actionId,
          payload: req.body.payload,
        });
        return sendSuccess(res, data, "游戏工作台动作已执行");
      } catch (error) {
        return handleRouteError(res, error, "游戏工作台动作执行失败");
      }
    },
  );

  router.post(
    "/game-features/:tokenId/workbench/replay-render",
    validateRequest({ params: tokenIdParamSchema, body: replayRenderBodySchema }),
    async (req, res) => {
      try {
        const data = await gameService.renderWorkbenchReplay({
          user: req.auth.user,
          tokenId: req.params.tokenId,
          payload: req.body.payload,
        });
        return sendSuccess(res, data, "回放渲染已生成");
      } catch (error) {
        return handleRouteError(res, error, "回放渲染失败");
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
