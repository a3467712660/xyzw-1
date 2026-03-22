import { Router } from "express";
import { z } from "zod";
import { authRequired } from "../middleware/auth.js";
import { validateRequest } from "../middleware/validate.js";
import { nowIso, randomId } from "../db/sql.js";
import { aesDecrypt, aesEncrypt } from "../lib/crypto.js";
import { ensureRoleTasks, syncScheduledJobsForUser } from "../services/taskService.js";
import { roleRepository } from "../repositories/roleRepository.js";

const router = Router();
const roleIdParamSchema = z.object({
  roleId: z.string().trim().min(1).max(64),
});
const roleCreateBodySchema = z.object({
  name: z.string().trim().min(1).max(64),
  server: z.string().trim().min(1).max(64),
  profession: z.string().trim().min(1).max(64),
  level: z.coerce.number().int().min(1).max(999).optional().default(1),
  account: z.string().max(2048).optional().default(""),
  note: z.string().max(4096).optional().default(""),
  avatar: z.string().trim().max(512).optional().default("/icons/xiaoyugan.png"),
}).strict();
const roleUpdateBodySchema = z.object({
  name: z.string().trim().min(1).max(64).optional(),
  server: z.string().trim().min(1).max(64).optional(),
  profession: z.string().trim().min(1).max(64).optional(),
  level: z.coerce.number().int().min(1).max(999).optional(),
  account: z.string().max(2048).optional(),
  note: z.string().max(4096).optional(),
  avatar: z.string().trim().max(512).optional(),
  isActive: z.boolean().optional(),
  exp: z.coerce.number().int().min(0).max(10_000_000).optional(),
  gold: z.coerce.number().int().min(0).max(10_000_000_000).optional(),
  vip: z.boolean().optional(),
}).strict();

const mapRole = (row) => ({
  id: row.id,
  name: row.name,
  server: row.server,
  profession: row.profession,
  level: Number(row.level),
  account: aesDecrypt(row.accountEnc),
  note: aesDecrypt(row.noteEnc),
  avatar: row.avatar || "/icons/xiaoyugan.png",
  isActive: Number(row.isActive) === 1,
  exp: Number(row.exp || 0),
  gold: Number(row.gold || 0),
  vip: Number(row.vip) === 1,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

router.use(authRequired);

router.get("/gamerole_list", (req, res) => {
  const rows = roleRepository.listByUser(req.auth.user.id);

  return res.json({ success: true, data: rows.map(mapRole) });
});

router.post("/gameroles", validateRequest({ body: roleCreateBodySchema }), (req, res) => {
  const {
    name,
    server,
    profession,
    level,
    account,
    note,
    avatar,
  } = req.body;

  const ts = nowIso();
  const roleId = randomId("role");

  roleRepository.create({
    id: roleId,
    userId: req.auth.user.id,
    name,
    server,
    profession,
    level: Number(level) || 1,
    accountEnc: aesEncrypt(account),
    noteEnc: aesEncrypt(note),
    avatar,
    createdAt: ts,
    updatedAt: ts,
  });

  ensureRoleTasks(req.auth.user.id, roleId);
  syncScheduledJobsForUser(req.auth.user.id);

  const role = roleRepository.findById(roleId);

  return res.json({ success: true, data: mapRole(role), message: "添加角色成功" });
});

router.put(
  "/gameroles/:roleId",
  validateRequest({ params: roleIdParamSchema, body: roleUpdateBodySchema }),
  (req, res) => {
  const exists = roleRepository.existsByIdAndUser(req.params.roleId, req.auth.user.id);

  if (!exists) {
    return res.status(404).json({ success: false, message: "角色不存在" });
  }

  const patch = req.body;

  roleRepository.patchById({
    id: req.params.roleId,
    name: patch.name,
    server: patch.server,
    profession: patch.profession,
    level: patch.level,
    accountEnc: patch.account !== undefined ? aesEncrypt(patch.account) : null,
    noteEnc: patch.note !== undefined ? aesEncrypt(patch.note) : null,
    avatar: patch.avatar,
    isActive: patch.isActive !== undefined ? Number(Boolean(patch.isActive)) : null,
    exp: patch.exp,
    gold: patch.gold,
    vip: patch.vip !== undefined ? Number(Boolean(patch.vip)) : null,
    updatedAt: nowIso(),
  });

  const updated = roleRepository.findById(req.params.roleId);

  return res.json({ success: true, data: mapRole(updated), message: "更新角色成功" });
},
);

router.delete("/gameroles/:roleId", validateRequest({ params: roleIdParamSchema }), (req, res) => {
  const exists = roleRepository.existsByIdAndUser(req.params.roleId, req.auth.user.id);

  if (!exists) {
    return res.status(404).json({ success: false, message: "角色不存在" });
  }

  roleRepository.deleteById(req.params.roleId);
  syncScheduledJobsForUser(req.auth.user.id);

  return res.json({ success: true, message: "删除角色成功" });
});

router.get("/gameroles/:roleId", validateRequest({ params: roleIdParamSchema }), (req, res) => {
  const row = roleRepository.findByIdAndUser(req.params.roleId, req.auth.user.id);

  if (!row) {
    return res.status(404).json({ success: false, message: "角色不存在" });
  }

  return res.json({ success: true, data: mapRole(row) });
});

export default router;
