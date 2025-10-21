// src/tasks/index.js
const { task: xlsxToJsonTask } = require("./xlsxToJson");
const { task: splitJsonTask } = require("./splitJsonByFields");
const { task: countFichasTask } = require("./countFichas");

const TASKS = {
  "xlsx-to-json": xlsxToJsonTask,
  "json-split": splitJsonTask,
  "count-fichas": countFichasTask,
};

module.exports = { TASKS };