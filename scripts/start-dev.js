const path = require("path");
const concurrently = require("concurrently");

const root = path.join(__dirname, "..");

concurrently(
  [
    {
      command: "npm run dev",
      name: "backend",
      cwd: path.join(root, "bend"),
    },
    {
      command: "npm run dev",
      name: "frontend",
      cwd: path.join(root, "fend"),
    },
  ],
  {
    prefix: "name",
    prefixColors: ["cyan", "magenta"],
    killOthersOn: ["failure"],
  }
).result.catch(() => process.exit(1));
