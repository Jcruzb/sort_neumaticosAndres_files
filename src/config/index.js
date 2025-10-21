// src/config/index.js
const path = require("path");

const input =
  process.env.XLSX_INPUT || path.resolve("./pares_ordenados.xlsx");
const sheet = process.env.XLSX_SHEET || "Pares-ordenados";
const output =
  process.env.JSON_OUTPUT || ""; // si vacío, se autogenera ./output/<archivo>__<sheet>.json

module.exports = { input, sheet, output };