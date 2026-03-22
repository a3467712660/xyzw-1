/**
 * 将Canvas导出为图片并下载
 * 兼容处理移动端大图导出问题
 * @param {HTMLCanvasElement} canvas - canvas元素
 * @param {string} filename - 文件名
 */
export const downloadCanvasAsImage = (canvas, filename) => {
  try {
    // 优先尝试使用 toBlob，因为它处理大文件更有效率且不容易崩溃
    if (canvas.toBlob) {
      canvas.toBlob((blob) => {
        if (!blob) {
          console.error("Canvas转换Blob失败");
          fallbackToDataURL(canvas, filename);
          return;
        }

        // 仅在移动端尝试分享，桌面端强制下载，避免弹出分享面板
        const isMobileDevice
          = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
            navigator.userAgent || "",
          )
          || (typeof navigator.maxTouchPoints === "number"
            && navigator.maxTouchPoints > 1
            && window.innerWidth <= 1024);

        if (
          isMobileDevice
          && navigator.share
          && navigator.canShare
          && navigator.canShare({
            files: [new File([blob], filename, { type: blob.type })],
          })
        ) {
          const file = new File([blob], filename, { type: blob.type });
          navigator
            .share({
              files: [file],
              title: "分享图片",
              text: filename,
            })
            .catch((err) => {
              console.log("分享失败，尝试下载:", err);
              downloadBlob(blob, filename);
            });
        } else {
          downloadBlob(blob, filename);
        }
      }, "image/png");
    } else {
      fallbackToDataURL(canvas, filename);
    }
  } catch (e) {
    console.error("导出图片出错:", e);
    fallbackToDataURL(canvas, filename);
  }
};

/**
 * 将超长Canvas按高度切片，导出多张图片
 * @param {HTMLCanvasElement} canvas - 原始canvas
 * @param {string} filenameBase - 基础文件名（不含扩展名）
 * @param {{ maxHeight?: number }} options
 * @returns {number} 导出的图片张数
 */
export const downloadCanvasAsPagedImages = (
  canvas,
  filenameBase,
  options = {},
) => {
  const maxHeight = Number(options.maxHeight) || 4200;
  const width = canvas.width;
  const height = canvas.height;

  if (!width || !height) {
    return 0;
  }

  // 高度不超过阈值，按单图导出
  if (height <= maxHeight) {
    downloadCanvasAsImage(canvas, `${filenameBase}.png`);
    return 1;
  }

  let page = 0;
  for (let offsetY = 0; offsetY < height; offsetY += maxHeight) {
    page += 1;
    const sliceHeight = Math.min(maxHeight, height - offsetY);
    const sliceCanvas = document.createElement("canvas");
    sliceCanvas.width = width;
    sliceCanvas.height = sliceHeight;

    const ctx = sliceCanvas.getContext("2d");
    if (!ctx) {
      continue;
    }

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, sliceHeight);
    ctx.drawImage(
      canvas,
      0,
      offsetY,
      width,
      sliceHeight,
      0,
      0,
      width,
      sliceHeight,
    );

    downloadCanvasAsImage(sliceCanvas, `${filenameBase}_${page}.png`);
  }

  return page;
};

const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;

  // 兼容某些移动端浏览器，添加到body
  document.body.appendChild(link);

  try {
    link.click();
  } catch (e) {
    console.error("Link click failed", e);
  }

  // 清理
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 100);
};

const fallbackToDataURL = (canvas, filename) => {
  try {
    const imgUrl = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = imgUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (e) {
    console.error("DataURL导出失败:", e);
    alert("导出图片失败，图片可能过大");
  }
};
