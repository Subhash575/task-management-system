import mongoose from 'mongoose';

const DB_STATES = {
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting',
};

export function getHealth(_req, res) {
  const db = DB_STATES[mongoose.connection.readyState] ?? 'unknown';
  const healthy = db === 'connected';

  // 503 tells load balancers / Docker the app is up but not ready to serve traffic.
  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'ok' : 'degraded',
    db,
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
}
