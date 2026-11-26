import { execFileSync } from "node:child_process";

for (const file of ["src/server.js", "src/config.js", "src/loan-finance.js", "prisma/seed.js"]) {
  execFileSync(process.execPath, ["--check", file], { stdio: "inherit" });
}
console.log("Backend JavaScript syntax check passed");
