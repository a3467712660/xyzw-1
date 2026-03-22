import { h, ref } from "vue";
import { NInput, NRadioButton, NRadioGroup } from "naive-ui/es";
import api from "@/api";

const promptPasswordByDialog = ({
  dialog,
  message,
  title = "二次确认",
  prompt = "请输入当前密码以继续",
  placeholder = "请输入当前密码",
  mfaEnabled = false,
  preferMfa = false,
  methodLabelTotp = "动态验证码",
  methodLabelRecovery = "恢复码",
  methodLabelPassword = "当前密码（兜底）",
  totpPlaceholder = "请输入 6 位动态验证码",
  recoveryPlaceholder = "请输入一次性恢复码（例如 XXXX-XXXX）",
  mfaHint = "",
  positiveText = "确认",
  negativeText = "取消",
  emptyCredentialMessage = "请输入有效凭证",
}) =>
  new Promise((resolve) => {
    const password = ref("");
    const totpCode = ref("");
    const recoveryCode = ref("");
    const method = ref(mfaEnabled && preferMfa ? "totp" : "password");
    let settled = false;

    const finish = (value) => {
      if (settled) {
        return;
      }
      settled = true;
      resolve(value || null);
    };

    dialog.warning({
      title,
      positiveText,
      negativeText,
      content: () =>
        h("div", { style: "display:flex;flex-direction:column;gap:12px;" }, [
          h("div", { style: "line-height:1.5;" }, String(prompt || "")),
          ...(mfaEnabled
            ? [
                h(
                  NRadioGroup,
                  {
                    "value": method.value,
                    "onUpdate:value": (value) => {
                      method.value = String(value || "totp");
                    },
                  },
                  {
                    default: () => [
                      h(NRadioButton, { value: "totp" }, { default: () => methodLabelTotp }),
                      h(NRadioButton, { value: "recovery" }, { default: () => methodLabelRecovery }),
                      h(NRadioButton, { value: "password" }, { default: () => methodLabelPassword }),
                    ],
                  },
                ),
                mfaHint
                  ? h("div", { style: "font-size:12px;opacity:0.75;" }, mfaHint)
                  : null,
              ]
            : []),
          method.value === "totp"
            ? h(NInput, {
                "value": totpCode.value,
                "maxlength": 6,
                "placeholder": totpPlaceholder,
                "autofocus": true,
                "onUpdate:value": (value) => {
                  totpCode.value = String(value || "").replace(/\D/g, "");
                },
              })
            : null,
          method.value === "recovery"
            ? h(NInput, {
                "value": recoveryCode.value,
                "maxlength": 64,
                "placeholder": recoveryPlaceholder,
                "autofocus": true,
                "onUpdate:value": (value) => {
                  recoveryCode.value = String(value || "").trim();
                },
              })
            : null,
          method.value === "password"
            ? h(NInput, {
                "type": "password",
                "showPasswordOn": "click",
                "value": password.value,
                "placeholder": placeholder,
                "autofocus": true,
                "onUpdate:value": (value) => {
                  password.value = String(value || "");
                },
              })
            : null,
        ]),
      onPositiveClick: () => {
        const normalizedPassword = String(password.value || "").trim();
        const normalizedTotp = String(totpCode.value || "").replace(/\D/g, "");
        const normalizedRecovery = String(recoveryCode.value || "").trim();
        const credential = method.value === "totp"
          ? { totpCode: normalizedTotp }
          : method.value === "recovery"
            ? { recoveryCode: normalizedRecovery }
            : { password: normalizedPassword };
        const hasCredential = Boolean(
          credential.password || credential.totpCode || credential.recoveryCode,
        );
        if (!hasCredential) {
          message.warning(emptyCredentialMessage);
          return false;
        }
        finish(credential);
        return true;
      },
      onNegativeClick: () => {
        finish(null);
      },
      onClose: () => {
        finish(null);
      },
    });
  });

export const ensureUserSensitiveConfirmTokenByDialog = async ({
  dialog,
  message,
  title,
  prompt,
  placeholder,
  positiveText,
  negativeText,
  emptyCredentialMessage,
  cancelledMessage,
  failedMessage,
  successMessage,
  cacheMaxAgeMs,
  mfaEnabled,
  preferMfa,
  methodLabelTotp,
  methodLabelRecovery,
  methodLabelPassword,
  totpPlaceholder,
  recoveryPlaceholder,
  mfaHint,
}) => {
  const cached = api.user.getCachedSensitiveConfirmToken({
    maxAgeMs: cacheMaxAgeMs,
  });
  if (cached) {
    return cached;
  }

  const credential = await promptPasswordByDialog({
    dialog,
    message,
    title,
    prompt,
    placeholder,
    mfaEnabled,
    preferMfa,
    methodLabelTotp,
    methodLabelRecovery,
    methodLabelPassword,
    totpPlaceholder,
    recoveryPlaceholder,
    mfaHint,
    positiveText,
    negativeText,
    emptyCredentialMessage,
  });

  if (!credential) {
    if (cancelledMessage) {
      message.warning(cancelledMessage);
    }
    return "";
  }

  try {
    const res = await api.user.confirmSensitiveAction(credential);
    const token = String(res?.data?.token || "");
    if (!res?.success || !token) {
      message.error(failedMessage || res?.message || "二次确认失败");
      return "";
    }
    if (successMessage) {
      message.success(successMessage);
    }
    return token;
  } catch (error) {
    message.error(failedMessage || error.message || "二次确认失败");
    return "";
  }
};
