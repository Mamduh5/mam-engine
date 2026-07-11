const fs = require("node:fs");
const args = process.argv.slice(3);
const mode = process.argv[2];
const value = (name) => args[args.indexOf(name) + 1];
const write = (file, data) => fs.writeFileSync(file, JSON.stringify(data));
const request = JSON.parse(fs.readFileSync(value("--request"), "utf8"));
const envelope = (commandId, status) => ({ schemaVersion: "mam.runtime/v1", commandId, fixtureId: "movement/basic-ground", correlationId: request.correlationId, status, metrics: {}, warnings: [], validationErrors: [], runtimeErrors: [], changedFiles: [], evidence: {} });
if (mode === "early") process.exit(7);
if (mode === "no-ready") {
  setTimeout(() => process.exit(0), 10000);
} else {
  if (mode === "large") process.stdout.write("x".repeat(10000));
  const complete = () => {
    write(value("--ready"), envelope("runtime.fixture.ready", "ready"));
    if (mode === "hang") setTimeout(() => process.exit(0), 10000);
    else if (mode === "no-response") process.exit(0);
    else if (mode === "delayed-ready") setTimeout(() => { write(value("--response"), envelope("runtime.fixture.run", "ok")); process.exit(0); }, 50);
    else { write(value("--response"), envelope("runtime.fixture.run", "ok")); process.exit(mode === "nonzero" ? 9 : 0); }
  };
  if (mode === "delayed-ready") setTimeout(complete, 300);
  else complete();
}
