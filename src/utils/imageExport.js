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

        downloadBlobAsImage(blob, filename);
      }, "image/png");
    } else {
      fallbackToDataURL(canvas, filename);
    }
  } catch (e) {
    console.error("导出图片出错:", e);
    fallbackToDataURL(canvas, filename);
  }
};

export const downloadBlobAsImage = (blob, filename) => {
  try {
    const safeBlob = blob instanceof Blob
      ? blob
      : new Blob([blob], { type: "image/png" });
    const type = safeBlob.type || "image/png";

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
      && typeof File === "function"
      && navigator.canShare({
        files: [new File([safeBlob], filename, { type })],
      })
    ) {
      const file = new File([safeBlob], filename, { type });
      navigator
        .share({
          files: [file],
          title: "分享图片",
          text: filename,
        })
        .catch((err) => {
          console.log("分享失败，尝试下载:", err);
          downloadBlob(safeBlob, filename);
        });
    } else {
      downloadBlob(safeBlob, filename);
    }
  } catch (e) {
    console.error("导出图片Blob失败:", e);
    alert("导出图片失败，请重试");
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

  let exportedPageCount = 0;
  for (let offsetY = 0; offsetY < height; offsetY += maxHeight) {
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

    if (isCanvasEffectivelyBlank(sliceCanvas)) {
      continue;
    }

    exportedPageCount += 1;
    downloadCanvasAsImage(sliceCanvas, `${filenameBase}_${exportedPageCount}.png`);
  }

  return exportedPageCount;
};

const isCanvasEffectivelyBlank = (canvas) => {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    return false;
  }

  const width = canvas.width;
  const height = canvas.height;
  if (!width || !height) {
    return true;
  }

  const sampleCols = Math.min(24, width);
  const sampleRows = Math.min(48, height);
  const stepX = Math.max(1, Math.floor(width / sampleCols));
  const stepY = Math.max(1, Math.floor(height / sampleRows));

  for (let y = 0; y < height; y += stepY) {
    for (let x = 0; x < width; x += stepX) {
      const data = ctx.getImageData(x, y, 1, 1).data;
      const [r, g, b, a] = data;
      if (a === 0) {
        continue;
      }
      if (r < 248 || g < 248 || b < 248) {
        return false;
      }
    }
  }

  return true;
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
