// src/cli/index.js
const logger = require("../utils/logger");
const { TASKS } = require("../tasks");
const config = require("../config");

function printHelp() {
  const taskList = Object.keys(TASKS).map((k) => `  - ${k}`).join("\n");
  logger.info(
`Uso: node app.js <tarea> [opciones]

Tareas:
${taskList}

xlsx-to-json:
  --input=./pares_ordenados.xlsx
  --sheet="Pares-ordenados"
  --out=./output/archivo.json

json-split:
  --json=./output/source.json
  --fields="RazonSocial,Año,ComunidadAutonoma"
  --outDir=./output/splits

count-fichas:
  --json=./output/pares_ordenados__Pares-ordenados.json

mk-expedientes:
  --json=./output/pares_ordenados__Pares-ordenados.json
  --root=./output/expedientes
`
  );
}

async function run() {
  const taskName = process.argv[2];
  const args = parseArgs(process.argv);

  if (!taskName || !TASKS[taskName]) { printHelp(); process.exitCode = 1; return; }

  let options = {};
  if (taskName === "xlsx-to-json") {
    options = { input: args.input ?? config.input, sheet: args.sheet ?? config.sheet, output: args.out ?? config.output };
  } else if (taskName === "json-split") {
    options = { inputJson: args.json ?? config.inputJson, fields: args.fields ?? config.fields, outDir: args.outDir ?? config.outDir };
  } else if (taskName === "count-fichas") {
    options = { inputJson: args.json ?? config.inputJson };
  }

  const { message } = await TASKS[taskName](options);
  logger.success(message);
}

function parseArgs(argv) {
  const args = {};
  for (const raw of argv.slice(3)) {
    const [k, v] = raw.split("=");
    if (!k?.startsWith("--")) continue;
    args[k.replace(/^--/, "")] = v ?? true;
  }
  return args;
}

async function run() {
  const taskName = process.argv[2];
  const args = parseArgs(process.argv);

  if (!taskName || !TASKS[taskName]) {
    printHelp();
    process.exitCode = 1;
    return;
  }

  let options = {};
  if (taskName === "xlsx-to-json") {
    options = { input: args.input ?? config.input, sheet: args.sheet ?? config.sheet, output: args.out ?? config.output };
  } else if (taskName === "json-split") {
    options = { inputJson: args.json ?? config.inputJson, fields: args.fields ?? config.fields, outDir: args.outDir ?? config.outDir };
  } else if (taskName === "count-fichas") {
    options = { inputJson: args.json ?? config.inputJson };
  } else if (taskName === "mk-expedientes") {
    options = { inputJson: args.json ?? config.inputJson, rootDir: args.root ?? config.rootDir };
  }

  try {
    const { message } = await TASKS[taskName](options);
    logger.success(message);
  } catch (err) {
    logger.error(err.stack || err.message || String(err));
    process.exitCode = 1;
  }
}


module.exports = { run };