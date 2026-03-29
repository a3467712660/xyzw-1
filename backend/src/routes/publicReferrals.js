import { Router } from "express";
import { z } from "zod";
import { validateRequest } from "../middleware/validate.js";
import { referralProfileRepository } from "../repositories/referralProfileRepository.js";
import { userRepository } from "../repositories/userRepository.js";
import { buildReferralShareUrl, normalizeReferralCode } from "../services/referralService.js";

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
      return res.status(404).json({
        success: false,
        message: "推广链接不存在",
      });
    }

    const referrer = userRepository.findById(profile.userId);
    if (!referrer) {
      return res.status(404).json({
        success: false,
        message: "推广链接不存在",
      });
    }

    return res.json({
      success: true,
      data: {
        referrerUsername: referrer.username,
        referralCode,
        registerPath: `/register?ref=${encodeURIComponent(referralCode)}`,
        shareUrl: buildReferralShareUrl(referralCode),
      },
    });
  },
);

export default router;
