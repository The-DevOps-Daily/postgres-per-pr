// The Neon API calls the bench and cleanup scripts need. The key comes from the environment
// and only ever goes into a request header.
import { need } from './env.mjs';

const API = 'https://console.neon.tech/api/v2';

export async function api(method, path, body, { allow = [] } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${need('NEON_API_KEY')}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(60_000),
  });
  const text = await res.text();
  if (!res.ok && !allow.includes(res.status)) {
    const err = new Error(`Neon API ${method} ${path}: HTTP ${res.status} ${text.slice(0, 300)}`);
    err.status = res.status;
    err.body = text;
    throw err;
  }
  return { status: res.status, ...(text ? JSON.parse(text) : {}) };
}

export const project = () => need('NEON_PROJECT_ID');

export async function listBranches() {
  const { branches } = await api('GET', `/projects/${project()}/branches`);
  return branches;
}

export async function waitForOperations(operations, timeoutMs = 300_000) {
  const deadline = Date.now() + timeoutMs;
  for (const op of operations ?? []) {
    for (;;) {
      if (Date.now() > deadline) throw new Error(`operation ${op.action} did not finish in ${timeoutMs / 1000}s`);
      const { operation } = await api('GET', `/projects/${project()}/operations/${op.id}`);
      if (operation.status === 'finished') break;
      if (['failed', 'error', 'cancelled', 'skipped'].includes(operation.status)) {
        throw new Error(`operation ${operation.action} ${operation.status}: ${operation.error ?? ''}`);
      }
      await new Promise((r) => setTimeout(r, 250));
    }
  }
}

export async function connectionUri(branchId) {
  const params = new URLSearchParams({ branch_id: branchId, database_name: 'neondb', role_name: 'neondb_owner' });
  const { uri } = await api('GET', `/projects/${project()}/connection_uri?${params}`);
  return uri;
}

export async function deleteBranch(branchId) {
  const res = await api('DELETE', `/projects/${project()}/branches/${branchId}`, undefined, { allow: [404] });
  if (res.status === 404) return { deleted: false };
  await waitForOperations(res.operations);
  return { deleted: true };
}
