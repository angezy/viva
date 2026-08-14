require('dotenv').config({ path: require('path').join(__dirname, '..', 'bend', '.env') });
const express = require('../bend/node_modules/express');
const jwt = require('../bend/node_modules/jsonwebtoken');
const router = require('../bend/routes/adminOverviewRoute');

async function main() {
  const app = express();
  app.use('/', router);
  const server = await new Promise(resolve => {
    const listener = app.listen(5001, () => resolve(listener));
  });
  try {
    const token = jwt.sign({ sub: 'read-only-debug', role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '2m' });
    const started = Date.now();
    const response = await fetch('http://localhost:5001/api/admin/overview?range=last30&currency=USD', {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(120000)
    });
    console.log(JSON.stringify({ status: response.status, elapsedMs: Date.now() - started, body: await response.text() }, null, 2));
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

main().catch(error => {
  console.error(JSON.stringify({ error: error.message, number: error.number || null, lineNumber: error.lineNumber || null }, null, 2));
  process.exitCode = 1;
});
