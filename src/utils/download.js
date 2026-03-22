export const triggerBlobDownload = ({
  blob,
  fileName,
  appendToBody = true,
}) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;

  if (appendToBody) {
    document.body.appendChild(link);
  }

  link.click();

  if (appendToBody) {
    document.body.removeChild(link);
  }

  // 延后释放，避免部分浏览器尚未开始消费 blob URL。
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};
