import express from "express";
import { registerMiddleware } from "./registerMiddleware.js";
import { registerRoutes } from "./registerRoutes.js";
import { registerErrorHandler } from "./registerErrorHandler.js";

export function createApp() {
  const app = express();
  const { corsOriginSet } = registerMiddleware(app);
  registerRoutes(app);
  registerErrorHandler(app);
  return { app, corsOriginSet };
}
