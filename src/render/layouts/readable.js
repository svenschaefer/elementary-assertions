const { renderCompact } = require("./compact");

function renderReadable(doc) {
  return renderCompact(doc);
}

module.exports = { renderReadable };
