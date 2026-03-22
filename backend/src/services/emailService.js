const EMAIL_WEBHOOK_URL = String(process.env.EMAIL_WEBHOOK_URL || "").trim();
const EMAIL_WEBHOOK_TOKEN = String(process.env.EMAIL_WEBHOOK_TOKEN || "").trim();
const EMAIL_FROM = String(process.env.EMAIL_FROM || "noreply@xyzw.local").trim();
const EMAIL_WEBHOOK_TIMEOUT_MS = Number(process.env.EMAIL_WEBHOOK_TIMEOUT_MS || 8000);
const EMAIL_WEBHOOK_RETRY_COUNT = Number(process.env.EMAIL_WEBHOOK_RETRY_COUNT || 1);
const EMAIL_WEBHOOK_ALLOWLIST = String(process.env.EMAIL_WEBHOOK_ALLOWLIST || "")
  .split(",")
  .map((item) => item.trim().toLowerCase())
  .filter(Boolean);

const isRetryableStatus = (status) => status >= 500 || status === 408 || status === 429;

const isAllowedWebhookUrl = (urlString) => {
  if (process.env.NODE_ENV !== "production") {
    return true;
  }

  // No explicit allowlist in production keeps backward compatibility.
  if (!EMAIL_WEBHOOK_ALLOWLIST.length) {
    return true;
  }

  try {
    const { hostname } = new URL(urlString);
    const normalizedHost = hostname.toLowerCase();
    return EMAIL_WEBHOOK_ALLOWLIST.includes(normalizedHost);
  } catch {
    return false;
  }
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const postEmailWebhook = async (payload) => {
  if (!EMAIL_WEBHOOK_URL) {
    return { success: false, skipped: true, message: "email webhook not configured" };
  }

  if (!isAllowedWebhookUrl(EMAIL_WEBHOOK_URL)) {
    return {
      success: false,
      skipped: true,
      message: "email webhook host is not in allowlist",
    };
  }

  const timeoutMs = Number.isFinite(EMAIL_WEBHOOK_TIMEOUT_MS)
    ? Math.max(1000, EMAIL_WEBHOOK_TIMEOUT_MS)
    : 8000;
  const maxAttempts = Number.isFinite(EMAIL_WEBHOOK_RETRY_COUNT)
    ? Math.max(1, EMAIL_WEBHOOK_RETRY_COUNT + 1)
    : 2;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(EMAIL_WEBHOOK_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(EMAIL_WEBHOOK_TOKEN ? { Authorization: `Bearer ${EMAIL_WEBHOOK_TOKEN}` } : {}),
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (response.ok) {
        return { success: true, skipped: false };
      }

      const canRetry = attempt < maxAttempts && isRetryableStatus(response.status);
      if (canRetry) {
        await wait(300 * attempt);
        continue;
      }

      return {
        success: false,
        skipped: false,
        message: `email webhook failed: ${response.status}`,
      };
    } catch (error) {
      const canRetry = attempt < maxAttempts;
      if (canRetry) {
        await wait(300 * attempt);
        continue;
      }

      const isTimeout = error?.name === "AbortError";
      return {
        success: false,
        skipped: false,
        message: isTimeout
          ? `email webhook timeout after ${timeoutMs}ms`
          : error.message || "email webhook error",
      };
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    success: false,
    skipped: false,
    message: "email webhook failed after retries",
  };
};

export const sendFeedbackResolvedEmail = async ({
  to,
  username,
  feedbackTitle,
  adminNote,
}) => {
  const email = String(to || "").trim();
  if (!email) {
    return { success: false, skipped: true, message: "no recipient email" };
  }

  const subject = "[XYZW] 你的反馈已处理完成";
  const text = [
    `你好${username ? `，${username}` : ""}：`,
    "",
    "你提交的反馈已被管理员处理并标记为已完成。",
    `反馈标题：${feedbackTitle || "(无标题)"}`,
    adminNote ? `管理员备注：${adminNote}` : "管理员备注：无",
    "",
    "请登录系统查看详情。",
  ].join("\n");

  return postEmailWebhook({
    from: EMAIL_FROM,
    to: email,
    subject,
    text,
  });
};
