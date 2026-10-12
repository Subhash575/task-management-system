import dns from 'node:dns';
import mongoose from 'mongoose';
import { env } from './env.js';

// Reject query filters on fields that are not in the schema instead of silently ignoring them.
mongoose.set('strictQuery', true);

export async function connectDatabase() {
  // mongodb+srv:// URIs need a DNS SRV lookup, which Node does with its own resolver.
  // If the OS points it at a broken DNS server (e.g. 127.0.0.1 left by a VPN/ad-blocker),
  // that lookup fails with "querySrv ECONNREFUSED". DNS_SERVERS lets us override it.
  if (env.DNS_SERVERS.length > 0) {
    dns.setServers(env.DNS_SERVERS);
    console.log(`Using custom DNS servers: ${env.DNS_SERVERS.join(', ')}`);
  }

  await mongoose.connect(env.MONGODB_URI, {
    serverSelectionTimeoutMS: 10_000,
  });
  console.log(`MongoDB connected (${mongoose.connection.host}/${mongoose.connection.name})`);
}

export async function disconnectDatabase() {
  await mongoose.disconnect();
  console.log('MongoDB disconnected');
}
