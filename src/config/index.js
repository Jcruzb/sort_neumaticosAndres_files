// src/config/index.js
const path = require("path");

const input  = process.env.XLSX_INPUT || path.resolve("./pares_ordenados.xlsx");
const sheet  = process.env.XLSX_SHEET || "Pares-ordenados";
const output = process.env.JSON_OUTPUT || "";

// ← nombre que genera xlsx-to-json: <nombreExcel>__<sheet>.json
const defaultJsonCandidate = path.resolve(
  "./output",
  `${path.basename(input, path.extname(input))}__${sheet}.json`
);

// Para split y count
const inputJson = (
  process.env.COUNT_INPUT_JSON ||
  process.env.SPLIT_INPUT_JSON ||
  defaultJsonCandidate
);

const fields = (
  process.env.SPLIT_FIELDS
    ? process.env.SPLIT_FIELDS.split(",").map(s => s.trim())
    : ["RazonSocial", "Año", "ComunidadAutonoma"]
);

const outDir = process.env.SPLIT_OUT_DIR || path.resolve("./output/splits");

const rootDir = process.env.MKEXP_ROOT || path.resolve("./output/expedientes");

module.exports = {
  // xlsx-to-json
  input, sheet, output,
  // split & count
  inputJson, fields, outDir,
  //  mk-expedientes
  rootDir,
};