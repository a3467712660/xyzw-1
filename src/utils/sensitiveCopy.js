import { h, ref } from "vue";
import { NInput } from "naive-ui/es";
import { maskToken } from "@/utils/securitySanitizer";

export const FULL_COPY_CONFIRM_KEYWORD = "COPY";

export const copyTextToClipboard = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    const copied = document.execCommand("copy");
    document.body.removeChild(textArea);
    return copied;
  }
};

export const copyMaskedToken = async ({
  token,
  message,
  successMessage,
  failureMessage,
}) => {
  const masked = maskToken(token, 4, 4) || "***";
  const copied = await copyTextToClipboard(masked);
  if (copied) {
    message.success(successMessage);
    return true;
  }
  message.error(failureMessage);
  return false;
};

export const confirmAndCopyFullToken = ({
  token,
  dialog,
  message,
  title,
  content,
  placeholder,
  positiveText,
  negativeText,
  successMessage,
  failureMessage,
  missingConfirmMessage,
  confirmKeyword = FULL_COPY_CONFIRM_KEYWORD,
}) => {
  const confirmValue = ref("");

  dialog.warning({
    title,
    positiveText,
    negativeText,
    content: () =>
      h("div", { style: "display:flex;flex-direction:column;gap:10px;" }, [
        h("div", { style: "line-height:1.5;color:#d03050;" }, content),
        h(NInput, {
          "value": confirmValue.value,
          placeholder,
          "onUpdate:value": (value) => {
            confirmValue.value = String(value || "");
          },
        }),
      ]),
    onPositiveClick: async () => {
      if (String(confirmValue.value || "").trim() !== confirmKeyword) {
        message.warning(missingConfirmMessage);
        return false;
      }
      const copied = await copyTextToClipboard(String(token || ""));
      if (copied) {
        message.success(successMessage);
        return true;
      }
      message.error(failureMessage);
      return false;
    },
  });
};
