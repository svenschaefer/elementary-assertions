const { execSync } = require("node:child_process");

function main() {
  const output = execSync("git status --porcelain", { encoding: "utf8" }).trim();
  if (output.length > 0) {
    process.stderr.write("Release blocked: working tree is not clean.\n");
    process.stderr.write("Commit, stash, or discard changes before releasing.\n");
    process.exit(1);
  }
}

main();
