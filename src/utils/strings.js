// src/utils/strings.js
function slugify(input) {
  return String(input || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // quita acentos
    .replace(/[^a-zA-Z0-9]+/g, "_")                  // no alfanum => _
    .replace(/^_+|_+$/g, "")                         // recorta _
    .toLowerCase();
}

function trimStr(x) {
  return typeof x === "string" ? x.trim() : x;
}

module.exports = { slugify, trimStr };