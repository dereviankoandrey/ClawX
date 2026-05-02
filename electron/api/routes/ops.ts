import type { IncomingMessage, ServerResponse } from 'http';
import { proxyAwareFetch } from '../../utils/proxy-fetch';
import { getSetting, setSetting } from '../../utils/store';
import {
  normalizeOpsServers,
  type OpsServerConfig,
  type OpsServerSnapshot,
  type OpsServiceKind,
  type OpsServiceState,
  type OpsServiceStatus,
  type OpsSnapshot,
} from '../../../shared/ops';
import type { HostApiContext } from '../context';
import { parseJsonBody, sendJson } from '../route-utils';

const PROBE_TIMEOUT_MS = 3_500;

interface ProbeResult {
  state: OpsServiceState;
  statusCode?: number;
  latencyMs?: number;
  detail?: string;
}

function serviceLabel(kind: OpsServiceKind): string {
  switch (kind) {
    case 'openclaw':
      return 'OpenClaw Gateway';
    case 'hermesApi':
      return 'Hermes API';
    case 'hermesDashboard':
      return 'Hermes Dashboard';
  }
}

function buildUrl(host: string, port: number, path = ''): string {
  const normalizedHost = host.includes(':') && !host.startsWith('[')
    ? `[${host}]`
    : host;
  return `http://${normalizedHost}:${port}${path}`;
}

function authHeaders(token?: string): Record<string, string> | undefined {
  return token ? { Authorization: `Bearer ${token}` } : undefined;
}

function classifyFetchError(error: unknown, latencyMs: number): ProbeResult {
  const message = error instanceof Error ? error.message : String(error);
  const timedOut = message.toLowerCase().includes('abort')
    || message.toLowerCase().includes('timeout');
  return {
    state: 'offline',
    latencyMs,
    detail: timedOut ? 'Probe timed out' : message,
  };
}

async function probeHttp(
  url: string,
  options?: { headers?: Record<string, string>; okStatuses?: number[] },
): Promise<ProbeResult> {
  const startedAt = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);

  try {
    const response = await proxyAwareFetch(url, {
      method: 'GET',
      headers: options?.headers,
      signal: controller.signal,
    });
    const latencyMs = Date.now() - startedAt;
    const okStatuses = options?.okStatuses ?? [];

    if (response.status === 401 || response.status === 403) {
      return {
        state: 'auth_required',
        statusCode: response.status,
        latencyMs,
        detail: 'Reachable, but authentication is required',
      };
    }

    if (response.ok || okStatuses.includes(response.status)) {
      return {
        state: 'online',
        statusCode: response.status,
        latencyMs,
      };
    }

    return {
      state: 'degraded',
      statusCode: response.status,
      latencyMs,
      detail: `HTTP ${response.status}`,
    };
  } catch (error) {
    return classifyFetchError(error, Date.now() - startedAt);
  } finally {
    clearTimeout(timer);
  }
}

function buildStatus(
  kind: OpsServiceKind,
  baseUrl: string,
  probePath: string,
  result: ProbeResult,
): OpsServiceStatus {
  return {
    kind,
    label: serviceLabel(kind),
    state: result.state,
    url: baseUrl,
    probePath,
    statusCode: result.statusCode,
    latencyMs: result.latencyMs,
    detail: result.detail,
    checkedAt: new Date().toISOString(),
  };
}

async function probeServer(config: OpsServerConfig): Promise<OpsServerSnapshot> {
  if (!config.enabled) {
    const checkedAt = new Date().toISOString();
    return {
      config,
      services: [
        {
          kind: 'openclaw',
          label: serviceLabel('openclaw'),
          state: 'disabled',
          url: buildUrl(config.host, config.openclawPort),
          probePath: '/v1/models',
          checkedAt,
        },
        {
          kind: 'hermesApi',
          label: serviceLabel('hermesApi'),
          state: 'disabled',
          url: buildUrl(config.host, config.hermesApiPort),
          probePath: '/health',
          checkedAt,
        },
        {
          kind: 'hermesDashboard',
          label: serviceLabel('hermesDashboard'),
          state: 'disabled',
          url: buildUrl(config.host, config.hermesDashboardPort),
          probePath: '/',
          checkedAt,
        },
      ],
    };
  }

  const openclawBaseUrl = buildUrl(config.host, config.openclawPort);
  const hermesApiBaseUrl = buildUrl(config.host, config.hermesApiPort);
  const hermesDashboardBaseUrl = buildUrl(config.host, config.hermesDashboardPort);

  const [openclaw, hermesApi, hermesDashboard] = await Promise.all([
    probeHttp(`${openclawBaseUrl}/v1/models`, {
      headers: authHeaders(config.openclawToken),
    }),
    probeHttp(`${hermesApiBaseUrl}/health`, {
      headers: authHeaders(config.hermesApiKey),
    }),
    probeHttp(`${hermesDashboardBaseUrl}/`, {
      okStatuses: [404],
    }),
  ]);

  return {
    config,
    services: [
      buildStatus('openclaw', openclawBaseUrl, '/v1/models', openclaw),
      buildStatus('hermesApi', hermesApiBaseUrl, '/health', hermesApi),
      buildStatus('hermesDashboard', hermesDashboardBaseUrl, '/', hermesDashboard),
    ],
  };
}

async function getOpsServers(): Promise<OpsServerConfig[]> {
  return normalizeOpsServers(await getSetting('opsServers'));
}

export async function handleOpsRoutes(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  _ctx: HostApiContext,
): Promise<boolean> {
  if (url.pathname === '/api/ops/servers' && req.method === 'GET') {
    sendJson(res, 200, { success: true, servers: await getOpsServers() });
    return true;
  }

  if (url.pathname === '/api/ops/servers' && req.method === 'PUT') {
    try {
      const body = await parseJsonBody<{ servers?: OpsServerConfig[] }>(req);
      const servers = normalizeOpsServers(body.servers);
      await setSetting('opsServers', servers);
      sendJson(res, 200, { success: true, servers });
    } catch (error) {
      sendJson(res, 500, { success: false, error: String(error) });
    }
    return true;
  }

  if (url.pathname === '/api/ops/snapshot' && req.method === 'GET') {
    const servers = await getOpsServers();
    const snapshots = await Promise.all(servers.map((server) => probeServer(server)));
    const snapshot: OpsSnapshot = {
      checkedAt: new Date().toISOString(),
      servers: snapshots,
    };
    sendJson(res, 200, { success: true, snapshot });
    return true;
  }

  return false;
}
