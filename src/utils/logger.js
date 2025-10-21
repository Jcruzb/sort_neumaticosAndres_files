// src/utils/logger.js
const c = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
};

function time() {
  return new Date().toISOString().replace("T", " ").replace("Z", "");
}

function info(msg) {
  console.log(`${c.cyan}[INFO ${time()}]${c.reset} ${msg}`);
}
function success(msg) {
  console.log(`${c.green}[OK   ${time()}]${c.reset} ${msg}`);
}
function warn(msg) {
  console.warn(`${c.yellow}[WARN ${time()}]${c.reset} ${msg}`);
}
function error(msg) {
  console.error(`${c.red}[ERR  ${time()}]${c.reset} ${msg}`);
}

module.exports = { info, success, warn, error };