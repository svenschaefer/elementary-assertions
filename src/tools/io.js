const fs = require("node:fs");
const path = require("node:path");
const { normalizeOptionalString } = require("../core/strings");
const { sha256Hex } = require("../core/determinism");

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

function readUtf8WithFileSource(filePath, label, artifact) {
  const text = readUtf8(filePath, label);
  const stat = fs.statSync(filePath);
  return {
    text,
    sourceInput: {
      artifact,
      digest: sha256Hex(text),
      origin: {
        kind: "file",
        path: path.resolve(filePath),
        mtime_ms: Math.max(0, Math.trunc(stat.mtimeMs)),
      },
    },
  };
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
  readUtf8WithFileSource,
  writeUtf8,
  arg,
};
