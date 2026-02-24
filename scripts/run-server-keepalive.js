const { startServer } = require('../server/index.js');

startServer().catch((err) => {
  console.error('[run-server-keepalive] failed to start server:', err);
  process.exit(1);
});

setInterval(() => {}, 1 << 30);

