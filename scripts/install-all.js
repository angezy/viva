const { execSync } = require("child_process");
const path = require("path");

const root = path.join(__dirname, "..");
const targets = [
  { label: "root", dir: root },
  { label: "backend (bend)", dir: path.join(root, "bend") },
  { label: "frontend (fend)", dir: path.join(root, "fend") },
];

for (const { label, dir } of targets) {
  console.log(`\nInstalling ${label} dependencies...\n`);
  execSync("npm install", { cwd: dir, stdio: "inherit" });
}

console.log("\nAll dependencies installed.\n");
