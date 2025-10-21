// src/cli/index.js
const logger = require("../utils/logger");
const { TASKS } = require("../tasks");
const config = require("../config");

function printHelp() {
  const taskList = Object.keys(TASKS)
    .map((k) => `  - ${k}`)
    .join("\n");
  logger.info(
    `Uso: node app.js <tarea> [--input=./archivo.xlsx] [--sheet="Pares-ordenados"] [--out=./output/archivo.json]\n\nTareas disponibles:\n${taskList}`
  );
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

  // Mezcla args CLI con defaults del config
  const options = {
    input: args.input ?? config.input,
    sheet: args.sheet ?? config.sheet,
    output: args.out ?? config.output,
  };

  try {
    const { message } = await TASKS[taskName](options);
    logger.success(message);
  } catch (err) {
    logger.error(err.stack || err.message || String(err));
    process.exitCode = 1;
  }
}

module.exports = { run };