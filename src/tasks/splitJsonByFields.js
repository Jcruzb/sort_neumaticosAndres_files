// src/tasks/splitJsonByFields.js
const fs = require("fs/promises");
const path = require("path");
const { ensureDir, fileExists, writeJSON } = require("../utils/file");
const { slugify, trimStr } = require("../utils/strings");

/**
 * @param {Object} options
 * @param {string} options.inputJson   Ruta del JSON plano (array de objetos)
 * @param {string[]} options.fields    Campos por los que agrupar (en orden)
 * @param {string} options.outDir      Carpeta de salida para los JSON agrupados
 * @returns {Promise<{groups:number, files:string[]}>}
 */
async function splitJsonByFields({ inputJson, fields, outDir }) {
  if (!Array.isArray(fields) || fields.length === 0) {
    throw new Error("Debes indicar al menos un campo en 'fields'.");
  }

  if (!(await fileExists(inputJson))) {
    throw new Error(`No se encontró el JSON de entrada: ${inputJson}`);
  }

  const raw = await fs.readFile(inputJson, "utf8");
  let rows;
  try {
    rows = JSON.parse(raw);
  } catch (e) {
    throw new Error(`El archivo no es un JSON válido: ${inputJson}`);
  }
  if (!Array.isArray(rows)) {
    throw new Error("El JSON de entrada debe ser un array de objetos.");
  }

  // Grouping
  const map = new Map();
  for (const item of rows) {
    // Tomamos los valores de los campos, con trims y casteo a string donde convenga
    const keyParts = fields.map((f) => {
      const v = item[f];
      // Para Año lo dejamos en string; para los demás también, pero limpiando
      return v === null || v === undefined ? "" : trimStr(String(v));
    });
    const key = JSON.stringify(keyParts); // clave robusta

    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  }

  await ensureDir(outDir);

  // Escribimos un archivo por grupo
  const files = [];
  for (const [key, arr] of map.entries()) {
    const keyParts = JSON.parse(key);
    // Construimos nombre de archivo: <field1>__<field2>__<field3>.json en slug
    const slugParts = keyParts.map((p) => slugify(p));
    const filename = `${slugParts.join("__") || "grupo_sin_valor"}.json`;

    const outPath = path.resolve(outDir, filename);
    await writeJSON(outPath, arr);
    files.push(outPath);
  }

  return { groups: files.length, files };
}

// Task wrapper para el CLI
const task = async ({ inputJson, fields, outDir }) => {
  // Si 'fields' viene como string "a,b,c", lo partimos
  const fieldList = Array.isArray(fields) ? fields : String(fields).split(",").map((s) => s.trim()).filter(Boolean);

  const { groups, files } = await splitJsonByFields({ inputJson, fields: fieldList, outDir });
  return {
    message: `Partición OK → grupos: ${groups}. Ejemplo:\n- ${files.slice(0, 3).join("\n- ")}${files.length > 3 ? "\n..." : ""}`
  };
};

module.exports = { splitJsonByFields, task };