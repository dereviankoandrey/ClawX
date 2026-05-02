import 'dotenv/config';

export interface BridgeConfig {
  discordToken: string;
  discordClientId: string;
  discordGuildId: string;
  allowedUserIds: Set<string>;
  nodeName: string;
  pollIntervalMs: number;
  autoSetupChannels: boolean;
  categoryName: string;
  openclawGatewayUrl: string;
  openclawToken?: string;
  openclawModel: string;
  hermesApiUrl: string;
  hermesApiKey?: string;
  hermesModel: string;
  hermesDashboardUrl: string;
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optionalEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function boolEnv(name: string, fallback: boolean): boolean {
  const value = process.env[name]?.trim().toLowerCase();
  if (!value) {
    return fallback;
  }
  return ['1', 'true', 'yes', 'on'].includes(value);
}

function intEnv(name: string, fallback: number): number {
  const parsed = Number.parseInt(process.env[name] ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function trimTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

export function loadConfig(): BridgeConfig {
  return {
    discordToken: requireEnv('DISCORD_TOKEN'),
    discordClientId: requireEnv('DISCORD_CLIENT_ID'),
    discordGuildId: requireEnv('DISCORD_GUILD_ID'),
    allowedUserIds: new Set(
      (process.env.DISCORD_ALLOWED_USER_IDS ?? '')
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean),
    ),
    nodeName: optionalEnv('NODE_NAME') ?? 'Node-02',
    pollIntervalMs: intEnv('POLL_INTERVAL_SECONDS', 30) * 1000,
    autoSetupChannels: boolEnv('AUTO_SETUP_CHANNELS', true),
    categoryName: optionalEnv('DISCORD_CATEGORY_NAME') ?? 'Luminary Node-02',
    openclawGatewayUrl: trimTrailingSlash(optionalEnv('OPENCLAW_GATEWAY_URL') ?? 'http://127.0.0.1:18789'),
    openclawToken: optionalEnv('OPENCLAW_TOKEN'),
    openclawModel: optionalEnv('OPENCLAW_MODEL') ?? 'openclaw/default',
    hermesApiUrl: trimTrailingSlash(optionalEnv('HERMES_API_URL') ?? 'http://127.0.0.1:8642'),
    hermesApiKey: optionalEnv('HERMES_API_KEY'),
    hermesModel: optionalEnv('HERMES_MODEL') ?? 'hermes-agent',
    hermesDashboardUrl: trimTrailingSlash(optionalEnv('HERMES_DASHBOARD_URL') ?? 'http://127.0.0.1:9119'),
  };
}
