// src/tasks/copyFacturas.js
// Copia facturas de cada cliente (por CCAA/año) a su expediente correspondiente,
// según los matches exactos en N_Factura_P1 / N_Factura_P2 del JSON plano.

const fs = require("fs/promises");
const fssync = require("fs");
const path = require("path");
const chalk = require("chalk"); // 👈 DEBE ESTAR AQUÍ

import("chalk").then(chalk => {
  // tu código aquí dentro
});
const { ensureDir, fileExists } = require("../utils/file");
const logger = require("../utils/logger");

// === Helpers ===
const removeDiacritics = s => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const equalsFold = (a, b) => removeDiacritics(a).toLowerCase().trim() === removeDiacritics(b).toLowerCase().trim();
const kebab = s => removeDiacritics(String(s || "")).replace(/[^a-zA-Z0-9]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
const stripLeadingZeros = s => String(s || "").replace(/^0+/, "");
const sameClientCode = (a, b) => stripLeadingZeros(a) === stripLeadingZeros(b);

function parsePdfName(filename) {
    const m = filename.match(/factura[_\s-]*(\d{4})[_\s-]*A[_\s-]*(\d+)\.pdf$/i);
    if (!m) return null;
    return { year: m[1], facturaCode: m[2] };
}

async function buildExpedienteIndex(rows) {
    const allowedYears = new Set(["2023", "2024", "2025"]);
    const map = new Map();
    for (const r of rows) {
        const ca = (r.ComunidadAutonoma ?? "").toString().trim();
        const anyo = String(r["Año"] ?? r.Ano ?? "").trim();
        const razon = (r.RazonSocial ?? "").toString().trim();
        if (!ca || !anyo || !razon) continue;
        if (!allowedYears.has(anyo)) continue;
        if (!map.has(ca)) map.set(ca, new Map());
        const mYear = map.get(ca);
        if (!mYear.has(anyo)) mYear.set(anyo, new Set());
        mYear.get(anyo).add(razon);
    }
    const index = new Map();
    for (const [ca, mYear] of map.entries()) {
        const inner = new Map();
        for (const [year, razSet] of mYear.entries()) {
            const razList = [...razSet].sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));
            const idxMap = new Map();
            razList.forEach((razon, i) => idxMap.set(razon, i + 1));
            inner.set(year, idxMap);
        }
        index.set(ca, inner);
    }
    return index;
}

async function copyIfNotExists(src, dest) {
    await ensureDir(path.dirname(dest));
    if (fssync.existsSync(dest)) return false;
    await fs.copyFile(src, dest);
    return true;
}

// === MAIN FUNCTION ===
async function copyFacturas({ inputJson, rootDir, sourceRoot, verbose = true }) {
    console.log(chalk.cyanBright("=== INICIO copyFacturas ==="));
    console.log(chalk.gray(`JSON: ${inputJson}`));
    console.log(chalk.gray(`Origen (sourceRoot): ${sourceRoot}`));
    console.log(chalk.gray(`Destino (rootDir): ${rootDir}`));

    if (!(await fileExists(inputJson))) throw new Error(`No se encontró el JSON de entrada: ${inputJson}`);
    const raw = await fs.readFile(inputJson, "utf8");
    const rows = JSON.parse(raw);
    console.log(chalk.green(`Filas cargadas desde JSON: ${rows.length}`));

    const expedienteIndex = await buildExpedienteIndex(rows);

    const logRows = [];
    const startedAt = new Date().toISOString().replace(/[:.]/g, "-");
    const logDir = path.resolve("./output/logs");
    await ensureDir(logDir);
    const jsonLogPath = path.join(logDir, `copy-facturas_${startedAt}.json`);
    const csvLogPath = path.join(logDir, `copy-facturas_${startedAt}.csv`);

    let scanned = 0, matched = 0, copied = 0, omitted = 0, errors = 0;

    const ccaas = await fs.readdir(sourceRoot, { withFileTypes: true });
    const ccaasOnly = ccaas.filter(d => d.isDirectory());

    for (let ccIdx = 0; ccIdx < ccaasOnly.length; ccIdx++) {
        const ccDirent = ccaasOnly[ccIdx];
        const ccaaNameFS = ccDirent.name;
        const ccaaFSPath = path.join(sourceRoot, ccaaNameFS);

        console.log(chalk.yellowBright(`[${ccIdx + 1}/${ccaasOnly.length}] CCAA: ${ccaaNameFS}`));

        const autonomosPath = path.join(ccaaFSPath, "Autonomos");
        if (!fssync.existsSync(autonomosPath)) {
            console.log(chalk.redBright(`   ⚠️ No existe carpeta "Autonomos" en ${ccaaFSPath}`));
            continue;
        }

        const clientes = await fs.readdir(autonomosPath, { withFileTypes: true });
        const clienteDirs = clientes.filter(d => d.isDirectory());

        for (let clIdx = 0; clIdx < clienteDirs.length; clIdx++) {
            const clDirent = clienteDirs[clIdx];
            const codigoClienteFS = clDirent.name;
            const clientePath = path.join(autonomosPath, codigoClienteFS);

            const years = (await fs.readdir(clientePath, { withFileTypes: true }))
                .filter(d => d.isDirectory() && /^\d{4}$/.test(d.name))
                .map(d => d.name);

            console.log(chalk.white(`   (${clIdx + 1}/${clienteDirs.length}) Cliente ${codigoClienteFS} → años: ${years.join(", ")}`));

            for (const folderYear of years) {
                const yearPath = path.join(clientePath, folderYear);
                const pdfs = (await fs.readdir(yearPath, { withFileTypes: true }))
                    .filter(d => d.isFile() && /\.pdf$/i.test(d.name))
                    .map(d => d.name);

                console.log(chalk.gray(`     Año ${folderYear}: ${pdfs.length} PDFs`));

                for (const fname of pdfs) {
                    scanned++;
                    const parsed = parsePdfName(fname);
                    if (!parsed) {
                        console.log(chalk.dim(`       - Omitido: ${fname} (nombre no cumple patrón)`));
                        omitted++;
                        continue;
                    }

                    const { facturaCode } = parsed;
                    const subset = rows.filter(r =>
                        equalsFold(r.ComunidadAutonoma ?? "", ccaaNameFS) &&
                        sameClientCode(r.CodigoCliente5 ?? "", codigoClienteFS)
                    );

                    const matchP2 = subset.find(r => String(r.N_Factura_P2 ?? "").replace(/^A/i, "") === facturaCode);
                    const matchP1 = subset.find(r => String(r.N_Factura_P1 ?? "").replace(/^A/i, "") === facturaCode);

                    let match = null, tipo = "", matchField = "";

                    if (matchP2) {
                        match = matchP2;
                        tipo = "P2";
                        matchField = "N_Factura_P2";
                    } else if (matchP1) {
                        match = matchP1;
                        tipo = "P1";
                        matchField = "N_Factura_P1";
                    }

                    if (!match) {
                        console.log(chalk.red(`       ✗ Sin match en JSON para código ${facturaCode}`));
                        omitted++;
                        logRows.push({
                            origen: path.join(yearPath, fname),
                            destino: "",
                            matchField: "",
                            valor: facturaCode,
                            resultado: "omitido",
                            motivo: "sin_match_en_json"
                        });
                        continue;
                    }

                    matched++;
                    const projectYear = String(match["Año"] ?? match.Ano ?? "").trim();
                    const ca = (match.ComunidadAutonoma ?? "").toString().trim();
                    const razon = (match.RazonSocial ?? "").toString().trim();

                    const idxMap = expedienteIndex.get(ca)?.get(projectYear);
                    if (!idxMap) {
                        console.log(chalk.red(`       ⚠️ No hay índice de expediente para ${ca}/${projectYear}`));
                        errors++;
                        continue;
                    }

                    const eIndex = idxMap.get(razon);
                    if (!eIndex) {
                        console.log(chalk.red(`       ⚠️ Razón social sin índice: ${razon}`));
                        errors++;
                        continue;
                    }

                    const eLabel = `E${eIndex}`;
                    const destBase = path.join(path.resolve(rootDir), kebab(ca), projectYear, `${eLabel}-Cambio-de-neumaticos-${kebab(razon)}`);
                    const destFolder =
                        tipo === "P2"
                            ? path.join(destBase, `${eLabel}-3-Documentacion-justificativa`, `${eLabel}-3-2-Facturas-justificativas`)
                            : path.join(destBase, `${eLabel}-4-Otros`, `${eLabel}-4-2-Facturas-justificativas-previas`);

                    const srcPath = path.join(yearPath, fname);
                    const destPath = path.join(destFolder, fname);

                    console.log(chalk.blueBright(`       [MATCH ${tipo}] ${matchField}=${facturaCode}`));
                    console.log(chalk.gray(`          → Origen: ${srcPath}`));
                    console.log(chalk.gray(`          → Destino: ${destPath}`));

                    try {
                        const didCopy = await copyIfNotExists(srcPath, destPath);
                        if (didCopy) {
                            copied++;
                            console.log(chalk.greenBright(`          ✓ Copiado correctamente`));
                        } else {
                            omitted++;
                            console.log(chalk.yellow(`          ⚠️ Ya existía, omitido`));
                        }
                        logRows.push({
                            origen: srcPath,
                            destino: destPath,
                            matchField,
                            valor: facturaCode,
                            resultado: didCopy ? "copiado" : "omitido",
                            motivo: didCopy ? "" : "ya_existe_destino"
                        });
                    } catch (e) {
                        errors++;
                        console.log(chalk.redBright(`          ✗ Error copiando: ${e.message}`));
                        logRows.push({
                            origen: srcPath,
                            destino: destPath,
                            matchField,
                            valor: facturaCode,
                            resultado: "error",
                            motivo: e.message
                        });
                    }
                }
            }
        }
    }

    await fs.writeFile(jsonLogPath, JSON.stringify(logRows, null, 2), "utf8");
    const csv = [
        "origen,destino,matchField,valor,resultado,motivo",
        ...logRows.map(r =>
            [r.origen, r.destino, r.matchField, r.valor, r.resultado, r.motivo]
                .map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")
        ),
    ].join("\n");
    await fs.writeFile(csvLogPath, csv, "utf8");

    console.log(chalk.magentaBright(`\n=== RESUMEN FINAL ===`));
    console.log(chalk.cyan(`PDFs revisados: ${scanned}`));
    console.log(chalk.green(`Copiados: ${copied}`));
    console.log(chalk.yellow(`Omitidos: ${omitted}`));
    console.log(chalk.red(`Errores: ${errors}`));
    console.log(chalk.gray(`Logs guardados en:\n  ${jsonLogPath}\n  ${csvLogPath}`));
}

// === Export para CLI ===
const task = async (args) => {
  const inputJson = args.json || args.inputJson;
  const rootDir = args.root || args.rootDir;
  const sourceRoot = args.src || args.sourceRoot;

  await copyFacturas({
    inputJson,
    rootDir,
    sourceRoot,
    verbose: true,
  });
  return { message: "Copia de facturas finalizada." };
};

module.exports = { copyFacturas, task };
