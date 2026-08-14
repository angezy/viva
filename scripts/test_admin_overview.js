require('dotenv').config({ path: require('path').join(__dirname, '..', 'bend', '.env') });
const jwt = require('../bend/node_modules/jsonwebtoken');

async function main() {
  const token = jwt.sign({ sub: 'read-only-validation', role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '2m' });
  const started = Date.now();
  const response = await fetch('http://localhost:5000/api/admin/overview?range=last30&currency=USD', {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(120000)
  });
  const body = await response.text();
  console.log(JSON.stringify({ status: response.status, elapsedMs: Date.now() - started, body: body.slice(0, 2000) }, null, 2));
}

main().catch(error => {
  console.error(JSON.stringify({ error: error.message, name: error.name }));
  process.exitCode = 1;
});
