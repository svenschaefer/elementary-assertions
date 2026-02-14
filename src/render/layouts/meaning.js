const { renderCompact } = require("./compact");

function renderMeaning(doc) {
  return renderCompact(doc);
}

module.exports = { renderMeaning };
