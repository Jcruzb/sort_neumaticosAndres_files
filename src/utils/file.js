// src/utils/file.js
const fs = require("fs");
const fsPromises = require("fs/promises");
const path = require("path");

async function ensureDir(dirPath) {
  await fsPromises.mkdir(dirPath, { recursive: true });
}

async function writeJSON(filePath, data) {
  await ensureDir(path.dirname(filePath));
  await fsPromises.writeFile(filePath, JSON.stringify(data, null, 2), "utf8");
}

async function fileExists(p) {
  try {
    await fsPromises.access(p, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

module.exports = { ensureDir, writeJSON, fileExists };