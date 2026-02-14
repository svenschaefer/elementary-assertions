const { validateElementaryAssertions } = require("../validate");
const { renderCompact } = require("./layouts/compact");
const { renderReadable } = require("./layouts/readable");
const { renderTable } = require("./layouts/table");
const { renderMeaning } = require("./layouts/meaning");

function rejectLegacySlots(doc) {
  const assertions = Array.isArray(doc && doc.assertions) ? doc.assertions : [];
  for (const assertion of assertions) {
    if (assertion && Object.prototype.hasOwnProperty.call(assertion, "slots")) {
      throw new Error("Invalid input: legacy assertions[*].slots is not supported.");
    }
  }
}

function renderElementaryAssertions(doc, options = {}) {
  rejectLegacySlots(doc);
  validateElementaryAssertions(doc);

  const format = String(options.format || "txt").toLowerCase();
  const layout = String(options.layout || "compact").toLowerCase();
  if (format !== "txt" && format !== "md") {
    throw new Error("Invalid format. Expected txt or md.");
  }

  if (layout === "compact") return renderCompact(doc);
  if (layout === "readable") return renderReadable(doc);
  if (layout === "table") return renderTable(doc);
  if (layout === "meaning") return renderMeaning(doc);
  throw new Error("Invalid layout. Expected compact/readable/table/meaning.");
}

module.exports = {
  renderElementaryAssertions,
};
