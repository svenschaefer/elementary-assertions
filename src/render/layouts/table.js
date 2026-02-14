const { renderCompact } = require("./compact");

function renderTable(doc) {
  return renderCompact(doc);
}

module.exports = { renderTable };
