export const OPENCLAW_DEFAULT_GATEWAY_PORT = 18789;
export const HERMES_DEFAULT_API_PORT = 8642;
export const HERMES_DEFAULT_DASHBOARD_PORT = 9119;

export type OpsServiceKind = 'openclaw' | 'hermesApi' | 'hermesDashboard';

export type OpsServiceState =
  | 'online'
  | 'auth_required'
  | 'degraded'
  | 'offline'
  | 'disabled';

export interface OpsServerConfig {
  id: string;
  name: string;
  host: string;
  enabled: boolean;
  openclawPort: number;
  openclawToken?: string;
  hermesApiPort: number;
  hermesApiKey?: string;
  hermesDashboardPort: number;
}

export interface OpsServiceStatus {
  kind: OpsServiceKind;
  label: string;
  state: OpsServiceState;
  url: string;
  probePath: string;
  statusCode?: number;
  latencyMs?: number;
  detail?: string;
  checkedAt: string;
}

export interface OpsServerSnapshot {
  config: OpsServerConfig;
  services: OpsServiceStatus[];
}

export interface OpsSnapshot {
  checkedAt: string;
  servers: OpsServerSnapshot[];
}

export const DEFAULT_OPS_SERVERS: OpsServerConfig[] = [
  {
    id: 'luminary-70',
    name: 'Luminary 70',
    host: '192.168.1.70',
    enabled: true,
    openclawPort: OPENCLAW_DEFAULT_GATEWAY_PORT,
    hermesApiPort: HERMES_DEFAULT_API_PORT,
    hermesDashboardPort: HERMES_DEFAULT_DASHBOARD_PORT,
  },
  {
    id: 'luminary-78',
    name: 'Luminary 78',
    host: '192.168.1.78',
    enabled: true,
    openclawPort: OPENCLAW_DEFAULT_GATEWAY_PORT,
    hermesApiPort: HERMES_DEFAULT_API_PORT,
    hermesDashboardPort: HERMES_DEFAULT_DASHBOARD_PORT,
  },
  {
    id: 'luminary-80',
    name: 'Luminary 80',
    host: '192.168.1.80',
    enabled: true,
    openclawPort: OPENCLAW_DEFAULT_GATEWAY_PORT,
    hermesApiPort: HERMES_DEFAULT_API_PORT,
    hermesDashboardPort: HERMES_DEFAULT_DASHBOARD_PORT,
  },
];

function normalizePort(value: unknown, fallback: number): number {
  const parsed = typeof value === 'number'
    ? value
    : typeof value === 'string'
      ? Number.parseInt(value, 10)
      : Number.NaN;
  return Number.isInteger(parsed) && parsed > 0 && parsed <= 65535
    ? parsed
    : fallback;
}

function normalizeString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function normalizeSecret(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export function createDefaultOpsServers(): OpsServerConfig[] {
  return DEFAULT_OPS_SERVERS.map((server) => ({ ...server }));
}

export function normalizeOpsServers(value: unknown): OpsServerConfig[] {
  const input = Array.isArray(value) ? value : DEFAULT_OPS_SERVERS;
  const fallbackByIndex = createDefaultOpsServers();

  return input.map((raw, index) => {
    const item = raw && typeof raw === 'object'
      ? raw as Partial<OpsServerConfig>
      : {};
    const fallback = fallbackByIndex[index] ?? {
      id: `server-${index + 1}`,
      name: `Server ${index + 1}`,
      host: '127.0.0.1',
      enabled: true,
      openclawPort: OPENCLAW_DEFAULT_GATEWAY_PORT,
      hermesApiPort: HERMES_DEFAULT_API_PORT,
      hermesDashboardPort: HERMES_DEFAULT_DASHBOARD_PORT,
    };

    return {
      id: normalizeString(item.id, fallback.id),
      name: normalizeString(item.name, fallback.name),
      host: normalizeString(item.host, fallback.host),
      enabled: item.enabled !== false,
      openclawPort: normalizePort(item.openclawPort, fallback.openclawPort),
      openclawToken: normalizeSecret(item.openclawToken),
      hermesApiPort: normalizePort(item.hermesApiPort, fallback.hermesApiPort),
      hermesApiKey: normalizeSecret(item.hermesApiKey),
      hermesDashboardPort: normalizePort(item.hermesDashboardPort, fallback.hermesDashboardPort),
    };
  });
}
