import pg from 'pg';
import '../scripts/lib/env.mjs';

// Neon connection strings carry sslmode=require; ask for verify-full so pg checks the certificate.
// A local container (CI) uses no TLS, so leave its URL alone.
export function connectionConfig(uri = process.env.DATABASE_URL) {
  if (!uri) throw new Error('DATABASE_URL is not set (see .env.example)');
  const url = new URL(uri);
  if (url.searchParams.get('sslmode') === 'require') url.searchParams.set('sslmode', 'verify-full');
  url.searchParams.delete('channel_binding');
  return { connectionString: url.toString(), connectionTimeoutMillis: 30_000 };
}

export function pool(uri) {
  const p = new pg.Pool({ ...connectionConfig(uri), max: 5 });
  p.on('error', () => {});
  return p;
}

export async function client(uri) {
  const c = new pg.Client(connectionConfig(uri));
  c.on('error', () => {});
  await c.connect();
  return c;
}
