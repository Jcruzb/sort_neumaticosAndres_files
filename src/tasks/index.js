// src/tasks/index.js
const { task: xlsxToJsonTask } = require("./xlsxToJson");

const TASKS = {
  "xlsx-to-json": xlsxToJsonTask,
};

module.exports = { TASKS };