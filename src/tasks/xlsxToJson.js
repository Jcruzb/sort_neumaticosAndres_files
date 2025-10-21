// src/tasks/xlsxToJson.js
const path = require("path");
const fs = require("fs");
const XLSX = require("xlsx");
const { ensureDir, writeJSON, fileExists } = require("../utils/file");

async function xlsxToJson({ input, sheet, output }) {
  if (!(await fileExists(input))) {
    throw new Error(`No se encontró el Excel: ${input}`);
  }

  const workbook = XLSX.readFile(input, { cellDates: false });
  const ws = workbook.Sheets[sheet];
  if (!ws) {
    throw new Error(
      `Hoja "${sheet}" no encontrada. Hojas: ${workbook.SheetNames.join(", ")}`
    );
  }

  const data = XLSX.utils.sheet_to_json(ws, {
    defval: "",
    raw: false,
  });

  const outDir = path.resolve("./output");
  await ensureDir(outDir);

  const autoName = `${path.basename(input, path.extname(input))}__${sheet}.json`;
  const outPath = path.resolve(output || path.join(outDir, autoName));

  await writeJSON(outPath, data);
  return { rows: data.length, outPath };
}

const task = async ({ input, sheet, output }) => {
  const { rows, outPath } = await xlsxToJson({ input, sheet, output });
  return {
    message: `Convertido OK → filas: ${rows}. JSON: ${outPath}`,
  };
};

module.exports = { xlsxToJson, task };