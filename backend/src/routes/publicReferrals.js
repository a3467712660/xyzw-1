import { Router } from "express";
import { z } from "zod";
import {
  clearReferralCookie,
  setReferralCookie,
} from "../lib/referralCookie.js";
import { validateRequest } from "../middleware/validate.js";
import { referralProfileRepository } from "../repositories/referralProfileRepository.js";
import { userRepository } from "../repositories/userRepository.js";
import {
  buildReferralShareUrl,
  maskReferrerDisplayName,
  normalizeReferralCode,
} from "../services/referralService.js";

const router = Router();
const referralCodeParamSchema = z.object({
  code: z.string().trim().min(1).max(32).regex(/^[A-Za-z0-9]+$/, "推广码格式无效"),
});

router.get(
  "/public/referrals/:code",
  validateRequest({ params: referralCodeParamSchema }),
  (req, res) => {
    const referralCode = normalizeReferralCode(req.params.code);
    const profile = referralProfileRepository.findByCode(referralCode);
    if (!profile) {
      clearReferralCookie(req, res);
      return res.status(404).json({
        success: false,
        message: "推广链接不存在",
      });
    }

    const referrer = userRepository.findById(profile.userId);
    if (!referrer) {
      clearReferralCookie(req, res);
      return res.status(404).json({
        success: false,
        message: "推广链接不存在",
      });
    }

    setReferralCookie(req, res, referralCode);

    return res.json({
      success: true,
      data: {
        referrerDisplayName: maskReferrerDisplayName(referrer.username),
        referralCode,
        registerPath: `/register?ref=${encodeURIComponent(referralCode)}`,
        shareUrl: buildReferralShareUrl(referralCode),
      },
    });
  },
);

export default router;
