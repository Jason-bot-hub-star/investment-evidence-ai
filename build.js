"use strict";
const fs = require("node:fs");
fs.mkdirSync("public", { recursive: true });
for (const f of ["index.html", "styles.css", "ths-theme.css", "data.js", "engine.js", "app.js"])
  fs.copyFileSync(f, "public/" + f);
console.log(
  "Static assets ready; backend sources and secrets are not included in public/.",
);
