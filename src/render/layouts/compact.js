function renderCompact(doc) {
  const lines = [];
  for (const a of doc.assertions || []) {
    const pred = (a.predicate && a.predicate.mention_id) || "<pred>";
    lines.push(`${a.id}: ${pred}`);
  }
  return lines.join("\n") + (lines.length > 0 ? "\n" : "");
}

module.exports = { renderCompact };
