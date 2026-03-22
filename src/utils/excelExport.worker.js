import ExcelJS from "exceljs";

globalThis.onmessage = async (event) => {
  const { worksheets = [] } = event.data ?? {};

  try {
    const workbook = new ExcelJS.Workbook();

    worksheets.forEach((sheetDef) => {
      const sheet = workbook.addWorksheet(sheetDef.name || "Sheet1");
      const rows = Array.isArray(sheetDef.rows) ? sheetDef.rows : [];
      if (rows.length > 0) {
        sheet.addRows(rows);
      }
      if (
        Array.isArray(sheetDef.columnWidths)
        && sheetDef.columnWidths.length > 0
      ) {
        sheet.columns = sheetDef.columnWidths.map((width) => ({ width }));
      }
    });

    const buffer = await workbook.xlsx.writeBuffer();
    globalThis.postMessage({ ok: true, buffer }, [buffer]);
  } catch (error) {
    globalThis.postMessage({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
