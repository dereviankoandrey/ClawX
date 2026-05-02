import type { BridgeConfig } from './config.js';
import { requestJson, type HttpResult } from './http.js';
import { codeBlock, redact, truncateDiscord } from './redact.js';

export interface ServiceProbe {
  name: string;
  ok: boolean;
  status?: number;
  latencyMs: number;
  detail: string;
}

export interface AgentSnapshot {
  checkedAt: string;
  hermes: {
    health: ServiceProbe;
    detailed?: unknown;
    models?: unknown;
    dashboard?: unknown;
    sessions?: unknown;
  };
  openclaw: {
    health: ServiceProbe;
    models?: unknown;
  };
}

function probeFromResult(name: string, result: HttpResult): ServiceProbe {
  if (result.ok) {
    return {
      name,
      ok: true,
      status: result.status,
      latencyMs: result.latencyMs,
      detail: `online (${result.status ?? 'ok'})`,
    };
  }

  if (result.status === 401 || result.status === 403) {
    return {
      name,
      ok: false,
      status: result.status,
      latencyMs: result.latencyMs,
      detail: 'auth required or token rejected',
    };
  }

  return {
    name,
    ok: false,
    status: result.status,
    latencyMs: result.latencyMs,
    detail: result.error ?? `HTTP ${result.status ?? 'failed'}`,
  };
}

function authHint(status?: number): string {
  return status === 401 || status === 403 ? ' Check the token/API key in .env.' : '';
}

function firstChoiceText(data: unknown): string | undefined {
  const candidate = data as {
    choices?: Array<{ message?: { content?: string }; text?: string }>;
    output_text?: string;
  };
  return candidate.output_text ?? candidate.choices?.[0]?.message?.content ?? candidate.choices?.[0]?.text;
}

export async function getSnapshot(config: BridgeConfig): Promise<AgentSnapshot> {
  const [hermesHealth, hermesDetailed, hermesModels, hermesStatus, hermesSessions, openclawModels] = await Promise.all([
    requestJson(`${config.hermesApiUrl}/health`, { token: config.hermesApiKey, timeoutMs: 5000 }),
    requestJson(`${config.hermesApiUrl}/health/detailed`, { token: config.hermesApiKey, timeoutMs: 5000 }),
    requestJson(`${config.hermesApiUrl}/v1/models`, { token: config.hermesApiKey, timeoutMs: 5000 }),
    requestJson(`${config.hermesDashboardUrl}/api/status`, { timeoutMs: 5000 }),
    requestJson(`${config.hermesDashboardUrl}/api/sessions`, { timeoutMs: 5000 }),
    requestJson(`${config.openclawGatewayUrl}/v1/models`, { token: config.openclawToken, timeoutMs: 5000 }),
  ]);

  return {
    checkedAt: new Date().toISOString(),
    hermes: {
      health: probeFromResult('Hermes API', hermesHealth),
      detailed: hermesDetailed.data ?? hermesDetailed.text,
      models: hermesModels.data ?? hermesModels.text,
      dashboard: hermesStatus.data ?? hermesStatus.text,
      sessions: hermesSessions.data ?? hermesSessions.text,
    },
    openclaw: {
      health: probeFromResult('OpenClaw Gateway', openclawModels),
      models: openclawModels.data ?? openclawModels.text,
    },
  };
}

export function formatStatus(snapshot: AgentSnapshot, nodeName: string): string {
  const hermes = snapshot.hermes.health;
  const openclaw = snapshot.openclaw.health;
  const lines = [
    `**${nodeName} status**`,
    `Hermes API: ${hermes.ok ? 'online' : 'offline'} (${hermes.latencyMs} ms) - ${hermes.detail}${authHint(hermes.status)}`,
    `OpenClaw Gateway: ${openclaw.ok ? 'online' : 'offline'} (${openclaw.latencyMs} ms) - ${openclaw.detail}${authHint(openclaw.status)}`,
    `Checked: ${snapshot.checkedAt}`,
  ];
  return lines.join('\n');
}

export function snapshotDigest(snapshot: AgentSnapshot): string {
  return JSON.stringify({
    hermes: {
      ok: snapshot.hermes.health.ok,
      status: snapshot.hermes.health.status,
      detail: snapshot.hermes.health.detail,
    },
    openclaw: {
      ok: snapshot.openclaw.health.ok,
      status: snapshot.openclaw.health.status,
      detail: snapshot.openclaw.health.detail,
    },
  });
}

export async function askHermes(config: BridgeConfig, message: string): Promise<string> {
  const response = await requestJson(`${config.hermesApiUrl}/v1/chat/completions`, {
    method: 'POST',
    token: config.hermesApiKey,
    timeoutMs: 120000,
    body: {
      model: config.hermesModel,
      messages: [{ role: 'user', content: message }],
      stream: false,
    },
  });

  if (!response.ok) {
    return `Hermes request failed: ${response.status ?? response.error}.${authHint(response.status)}`;
  }

  return truncateDiscord(redact(firstChoiceText(response.data) ?? response.data ?? response.text ?? 'Hermes returned no text.'));
}

export async function askOpenClaw(config: BridgeConfig, message: string): Promise<string> {
  const response = await requestJson(`${config.openclawGatewayUrl}/v1/chat/completions`, {
    method: 'POST',
    token: config.openclawToken,
    timeoutMs: 120000,
    body: {
      model: config.openclawModel,
      user: `discord:${config.nodeName}`,
      messages: [{ role: 'user', content: message }],
      stream: false,
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      return 'OpenClaw chat endpoint returned 404. The Gateway may be running but the OpenAI-compatible chat endpoint is not enabled.';
    }
    return `OpenClaw request failed: ${response.status ?? response.error}.${authHint(response.status)}`;
  }

  return truncateDiscord(redact(firstChoiceText(response.data) ?? response.data ?? response.text ?? 'OpenClaw returned no text.'));
}

export async function getLogs(config: BridgeConfig, system: string): Promise<string> {
  if (system === 'openclaw') {
    return 'OpenClaw Gateway does not expose an official logs endpoint through the documented OpenAI-compatible surface. Use `/status` and `/agents`, or add a local OpenClaw log adapter after confirming the log path on Node-02.';
  }

  const result = await requestJson(`${config.hermesDashboardUrl}/api/logs`, { timeoutMs: 10000 });
  if (!result.ok) {
    return `Hermes dashboard logs failed: ${result.status ?? result.error}.`;
  }
  return codeBlock(redact(result.data ?? result.text ?? 'No logs returned.'), 'json');
}

export async function getConfigView(config: BridgeConfig, system: string): Promise<string> {
  if (system === 'openclaw') {
    return 'OpenClaw configuration should remain managed through OpenClaw itself unless a specific official config endpoint is enabled on Node-02.';
  }

  const result = await requestJson(`${config.hermesDashboardUrl}/api/config`, { timeoutMs: 10000 });
  if (!result.ok) {
    return `Hermes dashboard config failed: ${result.status ?? result.error}.`;
  }
  return codeBlock(redact(result.data ?? result.text ?? 'No config returned.'), 'json');
}

export function formatAgents(snapshot: AgentSnapshot): string {
  return [
    '**Hermes models / detail**',
    codeBlock(redact(snapshot.hermes.models ?? snapshot.hermes.detailed ?? 'No Hermes model/detail data.'), 'json'),
    '**OpenClaw agent targets**',
    codeBlock(redact(snapshot.openclaw.models ?? 'No OpenClaw model data.'), 'json'),
  ].join('\n');
}
