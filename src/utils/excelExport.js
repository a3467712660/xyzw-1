import { triggerBlobDownload } from "@/utils/download";

const XLSX_MIME
  = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

async function buildXlsxBufferInWorker(worksheets) {
  if (typeof Worker === "undefined") {
    throw new TypeError("Web Worker is not supported in this environment");
  }

  const worker = new Worker(
    new URL("./excelExport.worker.js", import.meta.url),
    {
      type: "module",
    },
  );

  return new Promise((resolve, reject) => {
    worker.onmessage = (event) => {
      const { ok, buffer, error } = event.data ?? {};
      worker.terminate();
      if (ok && buffer) {
        resolve(buffer);
      } else {
        reject(new Error(error || "Excel export worker failed"));
      }
    };

    worker.onerror = (event) => {
      worker.terminate();
      reject(new Error(event?.message || "Excel export worker error"));
    };

    worker.postMessage({ worksheets });
  });
}

export async function exportXlsxFile({
  worksheets = [],
  fileName = "export.xlsx",
}) {
  const buffer = await buildXlsxBufferInWorker(worksheets);

  const blob = new Blob([buffer], { type: XLSX_MIME });
  triggerBlobDownload({ blob, fileName });
}
