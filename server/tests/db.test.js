import { afterEach, describe, expect, it, vi } from 'vitest';
import dns from 'node:dns';
import mongoose from 'mongoose';

/** Re-imports db.js so env.js re-reads process.env after vi.stubEnv(). */
async function loadDb() {
  vi.resetModules();
  return import('../src/config/db.js');
}

describe('connectDatabase', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('uses the system DNS when DNS_SERVERS is not set', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const setServers = vi.spyOn(dns, 'setServers').mockImplementation(() => {});
    const connect = vi.spyOn(mongoose, 'connect').mockResolvedValue(mongoose);

    const { connectDatabase } = await loadDb();
    await connectDatabase();

    expect(setServers).not.toHaveBeenCalled();
    expect(connect).toHaveBeenCalledOnce();
  });

  it('applies DNS_SERVERS before connecting', async () => {
    vi.stubEnv('DNS_SERVERS', ' 8.8.8.8, 1.1.1.1 ');
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const setServers = vi.spyOn(dns, 'setServers').mockImplementation(() => {});
    const connect = vi.spyOn(mongoose, 'connect').mockResolvedValue(mongoose);

    const { connectDatabase } = await loadDb();
    await connectDatabase();

    expect(setServers).toHaveBeenCalledWith(['8.8.8.8', '1.1.1.1']);
    expect(setServers.mock.invocationCallOrder[0]).toBeLessThan(connect.mock.invocationCallOrder[0]);
  });

  it('rejects DNS_SERVERS values that are not IP addresses', async () => {
    vi.stubEnv('DNS_SERVERS', 'dns.google');
    const exit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit');
    });
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(loadDb()).rejects.toThrow('process.exit');
    expect(exit).toHaveBeenCalledWith(1);
    expect(error.mock.calls[0][0]).toContain('DNS_SERVERS');
  });
});
