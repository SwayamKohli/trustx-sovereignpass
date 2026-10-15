// Canonical CLI runner: production HTTP routers, isolated in-memory fixture database.
process.env.DB_PATH = ':memory:';
async function main() {
  const { runLiveProbes } = await import('../packages/backend/src/services/live-probes');
  const { db } = await import('../packages/backend/src/db/index');
  try {
    const report = await runLiveProbes();
    console.log(JSON.stringify(report, null, 2));
    if (report.probes.some(probe => probe.status !== 'PASS')) process.exitCode = 1;
  } finally { db.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
