const fs = require("node:fs");
const { normalizeOptionalString } = require("../core/strings");

function parseStrictBoolean(raw, name) {
  const v = String(raw || "").trim().toLowerCase();
  if (v === "true") return true;
  if (v === "false") return false;
  throw new Error(`Invalid value for ${name}: expected true|false.`);
}

function readUtf8(filePath, label) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch (err) {
    throw new Error(`Error reading ${label}: ${err && err.message ? err.message : String(err)}`);
  }
}

function writeUtf8(filePath, text) {
  fs.writeFileSync(filePath, text, "utf8");
}

function arg(args, name) {
  const i = args.indexOf(name);
  if (i < 0 || i + 1 >= args.length) return null;
  return args[i + 1];
}

module.exports = {
  normalizeOptionalString,
  parseStrictBoolean,
  readUtf8,
  writeUtf8,
  arg,
};
