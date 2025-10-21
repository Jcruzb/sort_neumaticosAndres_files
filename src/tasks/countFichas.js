// src/tasks/countFichas.js
const fs = require("fs/promises");
const path = require("path");
const logger = require("../utils/logger");
const { fileExists } = require("../utils/file");
const { trimStr } = require("../utils/strings");

function getYear(val) {
  const s = trimStr(val);
  if (!s) return "";
  const m4 = String(s).match(/\d{4}$/);
  if (m4) return m4[0];
  const m2 = String(s).match(/\d{2}$/);
  return m2 ? `20${m2[0]}` : String(s);
}
function keyFicha(razon, anyo, ca) {
  return `${razon}||${anyo}||${ca}`;
}
function pad(str, len) {
  return String(str).padEnd(len, " ");
}

async function resolveInputJson(inputJson) {
  if (inputJson && await fileExists(inputJson)) return inputJson;

  // Intento automático en ./output
  const outDir = path.resolve("./output");
  try {
    const files = await fs.readdir(outDir);
    // Preferimos el que coincide con "__Pares-ordenados.json"
    const preferred = files.find(f => f.endsWith("__Pares-ordenados.json"));
    const anyJson   = files.find(f => f.toLowerCase().endsWith(".json"));
    const pick = preferred || anyJson;
    if (pick) return path.join(outDir, pick);
  } catch (_) {}
  throw new Error(
    `No se encontró el JSON de entrada: ${inputJson ?? "no especificado"}.\n` +
    `Pasa la ruta con --json=./output/archivo.json o genera primero con "npm run convert".`
  );
}

async function countFichas({ inputJson }) {
  const jsonPath = await resolveInputJson(inputJson);

  const raw = await fs.readFile(jsonPath, "utf8");
  const rows = JSON.parse(raw);
  if (!Array.isArray(rows)) throw new Error("El JSON debe ser un array.");

  const fichasSet = new Set();
  const byYear = new Map();
  const byCA = new Map();
  const byYearCA = new Map();
  let skipped = 0;

  for (const r of rows) {
    const razon = trimStr(r.RazonSocial);
    const anyo  = getYear(r["Año"] ?? r.Ano ?? r.ano);
    const ca    = trimStr(r.ComunidadAutonoma);

    if (!razon || !anyo || !ca) { skipped++; continue; }

    const k = keyFicha(razon, anyo, ca);
    fichasSet.add(k);

    if (!byYear.has(anyo)) byYear.set(anyo, new Set());
    byYear.get(anyo).add(k);

    if (!byCA.has(ca)) byCA.set(ca, new Set());
    byCA.get(ca).add(k);

    const yck = `${anyo}||${ca}`;
    if (!byYearCA.has(yck)) byYearCA.set(yck, new Set());
    byYearCA.get(yck).add(k);
  }

  const total = fichasSet.size;
  logger.info(`Total de fichas únicas: ${total}${skipped ? ` (saltadas ${skipped})` : ""}`);

  const yearRows = [...byYear.entries()]
    .map(([Año, set]) => ({ Año, Fichas: set.size }))
    .sort((a, b) => Number(a.Año) - Number(b.Año));
  console.log("\n=== Fichas por Año ===");
  console.table(yearRows);

  const caRows = [...byCA.entries()]
    .map(([ComunidadAutonoma, set]) => ({ ComunidadAutonoma, Fichas: set.size }))
    .sort((a, b) => b.Fichas - a.Fichas || a.ComunidadAutonoma.localeCompare(b.ComunidadAutonoma, "es"));
  console.log("\n=== Fichas por Comunidad ===");
  console.table(caRows);

  const years = [...byYear.keys()].sort((a, b) => Number(a) - Number(b));
  const cas   = [...byCA.keys()].sort((a, b) => a.localeCompare(b, "es"));

  console.log("\n=== Matriz Año × Comunidad (nº de fichas) ===");
  const header = ["Año", ...cas];
  console.log(header.map((h, i) => pad(i === 0 ? h : h.slice(0, 22), 24)).join(""));
  for (const y of years) {
    const row = [pad(y, 24)];
    for (const ca of cas) {
      const yck = `${y}||${ca}`;
      const n = byYearCA.get(yck)?.size ?? 0;
      row.push(pad(n, 24));
    }
    console.log(row.join(""));
  }

  return { total, yearRows, caRows };
}

const task = async ({ inputJson }) => {
  await countFichas({ inputJson });
  return { message: "Conteo de fichas mostrado en consola." };
};

module.exports = { countFichas, task };