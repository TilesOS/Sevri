const path = require("node:path");
const { spawnSync } = require("node:child_process");

const cliArgs = process.argv.slice(2);
const eslintBinPath = path.join(__dirname, "..", "node_modules", "eslint", "bin", "eslint.js");

const result = spawnSync(process.execPath, [eslintBinPath, ...(cliArgs.length > 0 ? cliArgs : ["."])], {
  stdio: "inherit",
  env: {
    ...process.env,
    ESLINT_USE_FLAT_CONFIG: "false",
  },
});

process.exit(result.status ?? 1);
