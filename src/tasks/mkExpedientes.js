// src/tasks/mkExpedientes.js
// Crea estructura de carpetas por CCAA/Año y expedientes E<x> por RazonSocial (orden alfabético)

const fs = require("fs/promises");
const path = require("path");
const logger = require("../utils/logger");
const { ensureDir, fileExists } = require("../utils/file");

// nombres: sin tildes, espacios -> guiones, caracteres no a-z0-9 -> guiones, colapsa guiones
function kebab(str) {
  return String(str || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function getYear(val) {
  const s = typeof val === "string" ? val.trim() : (val ?? "");
  if (!s) return "";
  const m4 = String(s).match(/\d{4}$/);
  if (m4) return m4[0];
  const m2 = String(s).match(/\d{2}$/);
  return m2 ? `20${m2[0]}` : String(s);
}

async function mkDirs(paths) {
  for (const p of paths) await ensureDir(p);
}

/**
 * @param {Object} options
 * @param {string} options.inputJson  Ruta al JSON plano con filas
 * @param {string} options.rootDir    Carpeta raíz donde crear expedientes (./output/expedientes)
 * @returns {Promise<{ccaas:number, yearsProcessed:number, expedientes:number}>}
 */
async function mkExpedientes({ inputJson, rootDir }) {
  if (!(await fileExists(inputJson))) {
    throw new Error(`No se encontró el JSON de entrada: ${inputJson}`);
  }
  const raw = await fs.readFile(inputJson, "utf8");
  const rows = JSON.parse(raw);
  if (!Array.isArray(rows)) throw new Error("El JSON debe ser un array.");

  // Filtra solo 2023-2025
  const allowedYears = new Set(["2023", "2024", "2025"]);

  // Map (ccaa -> Map(year -> Set(razonSocial)))
  const map = new Map();

  for (const r of rows) {
    const ca = (r.ComunidadAutonoma ?? "").toString().trim();
    const anyo = getYear(r["Año"] ?? r.Ano ?? r.ano);
    const razon = (r.RazonSocial ?? "").toString().trim();

    if (!ca || !anyo || !razon) continue;
    if (!allowedYears.has(anyo)) continue;

    if (!map.has(ca)) map.set(ca, new Map());
    const yearMap = map.get(ca);
    if (!yearMap.has(anyo)) yearMap.set(anyo, new Set());
    yearMap.get(anyo).add(razon);
  }

  // Crear estructura
  const root = path.resolve(rootDir);
  await ensureDir(root);

  let totalExpedientes = 0;
  let yearsTouched = new Set();

  for (const [ca, yearMap] of map.entries()) {
    const caDir = path.join(root, kebab(ca));
    await ensureDir(caDir);

    // Solo 2023, 2024, 2025 en orden
    for (const anyo of ["2023", "2024", "2025"]) {
      const razSet = yearMap.get(anyo);
      // Creamos año aunque no haya expedientes? — no: pediste “solo 2023/24/25” pero “todas las CCAA que aparezcan”.
      // Si no hay fichas en ese año, no creamos E<x>, pero sí la carpeta año para orden.
      const yearDir = path.join(caDir, anyo);
      await ensureDir(yearDir);
      yearsTouched.add(`${ca}::${anyo}`);

      if (!razSet || razSet.size === 0) continue;

      // Orden alfabético por RazonSocial (locale es-ES)
      const razList = [...razSet].sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));

      let idx = 1;
      for (const razon of razList) {
        const eLabel = `E${idx}`;
        const expedienteName = `${eLabel}-Cambio-de-neumaticos-${kebab(razon)}`;
        const expedienteDir = path.join(yearDir, expedienteName);

        // Crear árbol de subcarpetas
        const sub1 = path.join(expedienteDir, `${eLabel}-1-Convenio-Cae`);
        const sub2 = path.join(expedienteDir, `${eLabel}-2-Dictamen-Favorable`);
        const sub3 = path.join(expedienteDir, `${eLabel}-3-Documentacion-justificativa`);
        const sub31 = path.join(sub3, `${eLabel}-3-1-Ficha`);
        const sub32 = path.join(sub3, `${eLabel}-3-2-Facturas-justificativas`);
        const sub4 = path.join(expedienteDir, `${eLabel}-4-Otros`);
        const sub41 = path.join(sub4, `${eLabel}-4-1-Calculo-del-ahorro`);
        const sub42 = path.join(sub4, `${eLabel}-4-2-Facturas-justificativas-previas`);
        const sub43 = path.join(sub4, `${eLabel}-4-3-Convenios-de-sesion-de-ahorro`);

        await mkDirs([expedienteDir, sub1, sub2, sub3, sub31, sub32, sub4, sub41, sub42, sub43]);
        totalExpedientes++;
        idx++;
      }
    }
  }

  logger.success(`Estructura creada en: ${root}`);
  logger.info(`CCAA: ${map.size} | Años tocados: ${yearsTouched.size} | Expedientes: ${totalExpedientes}`);

  return { ccaas: map.size, yearsProcessed: yearsTouched.size, expedientes: totalExpedientes };
}

// Wrapper CLI
const task = async ({ inputJson, rootDir }) => {
  await mkExpedientes({ inputJson, rootDir });
  return { message: "Creación de carpetas completada." };
};

module.exports = { mkExpedientes, task };