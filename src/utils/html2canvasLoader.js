export async function captureWithHtml2canvas(...args) {
  const { default: html2canvas } = await import("html2canvas");
  return html2canvas(...args);
}
