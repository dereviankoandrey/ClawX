import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Lock,
  RefreshCw,
  Save,
  Server,
  Settings2,
  WifiOff,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { hostApiFetch } from '@/lib/host-api';
import { cn } from '@/lib/utils';
import type {
  OpsServerConfig,
  OpsServerSnapshot,
  OpsServiceState,
  OpsServiceStatus,
  OpsSnapshot,
} from '../../../shared/ops';

type OpsServersResponse = {
  success: boolean;
  servers: OpsServerConfig[];
  error?: string;
};

type OpsSnapshotResponse = {
  success: boolean;
  snapshot: OpsSnapshot;
  error?: string;
};

const statusClasses: Record<OpsServiceState, string> = {
  online: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  auth_required: 'border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  degraded: 'border-orange-500/25 bg-orange-500/10 text-orange-700 dark:text-orange-300',
  offline: 'border-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-300',
  disabled: 'border-black/10 bg-black/5 text-muted-foreground dark:border-white/10 dark:bg-white/5',
};

const inputClasses = 'h-9 rounded-md border-black/10 bg-surface-input text-sm dark:border-white/10';

function stateLabel(state: OpsServiceState): string {
  switch (state) {
    case 'online':
      return 'Online';
    case 'auth_required':
      return 'Auth';
    case 'degraded':
      return 'Degraded';
    case 'offline':
      return 'Offline';
    case 'disabled':
      return 'Disabled';
  }
}

function stateIcon(state: OpsServiceState) {
  switch (state) {
    case 'online':
      return <CheckCircle2 className="h-3.5 w-3.5" />;
    case 'auth_required':
      return <Lock className="h-3.5 w-3.5" />;
    case 'degraded':
      return <AlertTriangle className="h-3.5 w-3.5" />;
    case 'offline':
      return <WifiOff className="h-3.5 w-3.5" />;
    case 'disabled':
      return <X className="h-3.5 w-3.5" />;
  }
}

function formatLatency(status: OpsServiceStatus): string {
  return typeof status.latencyMs === 'number' ? `${status.latencyMs} ms` : '-';
}

function summarizeServer(snapshot: OpsServerSnapshot): OpsServiceState {
  if (!snapshot.config.enabled) return 'disabled';
  const states = snapshot.services.map((service) => service.state);
  if (states.every((state) => state === 'online')) return 'online';
  if (states.some((state) => state === 'online' || state === 'auth_required')) return 'degraded';
  return states.some((state) => state === 'disabled') ? 'disabled' : 'offline';
}

function normalizeDraftPort(value: string, fallback: number): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= 65535 ? parsed : fallback;
}

function cloneServers(servers: OpsServerConfig[]): OpsServerConfig[] {
  return servers.map((server) => ({ ...server }));
}

export function Ops() {
  const [snapshot, setSnapshot] = useState<OpsSnapshot | null>(null);
  const [servers, setServers] = useState<OpsServerConfig[]>([]);
  const [draftServers, setDraftServers] = useState<OpsServerConfig[]>([]);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSnapshot = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    setError(null);
    try {
      const response = await hostApiFetch<OpsSnapshotResponse>('/api/ops/snapshot');
      if (!response.success) {
        throw new Error(response.error || 'Failed to load operations snapshot');
      }
      const nextServers = response.snapshot.servers.map((server) => server.config);
      setSnapshot(response.snapshot);
      setServers(nextServers);
      if (!editing) {
        setDraftServers(cloneServers(nextServers));
      }
    } catch (err) {
      setError(String(err));
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [editing]);

  useEffect(() => {
    void loadSnapshot();
  }, [loadSnapshot]);

  useEffect(() => {
    if (editing) return;
    const timer = window.setInterval(() => {
      void loadSnapshot(true);
    }, 20_000);
    return () => window.clearInterval(timer);
  }, [editing, loadSnapshot]);

  const totals = useMemo(() => {
    const snapshots = snapshot?.servers ?? [];
    const online = snapshots.reduce(
      (count, item) => count + item.services.filter((service) => service.state === 'online').length,
      0,
    );
    const total = snapshots.reduce((count, item) => count + item.services.length, 0);
    return { online, total };
  }, [snapshot]);

  const updateDraft = <K extends keyof OpsServerConfig>(
    id: string,
    key: K,
    value: OpsServerConfig[K],
  ) => {
    setDraftServers((current) => current.map((server) => (
      server.id === id ? { ...server, [key]: value } : server
    )));
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const response = await hostApiFetch<OpsServersResponse>('/api/ops/servers', {
        method: 'PUT',
        body: JSON.stringify({ servers: draftServers }),
      });
      if (!response.success) {
        throw new Error(response.error || 'Failed to save server configuration');
      }
      setServers(response.servers);
      setDraftServers(cloneServers(response.servers));
      setEditing(false);
      await loadSnapshot(true);
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  };

  const snapshots = snapshot?.servers ?? servers.map((config) => ({ config, services: [] }));

  return (
    <div data-testid="ops-page" className="flex h-[calc(100vh-2.5rem)] flex-col -m-6 bg-background">
      <div className="mx-auto flex h-full w-full max-w-6xl flex-col px-8 py-8">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-4xl font-serif font-normal tracking-tight text-foreground">
              Operations
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span>OpenClaw 18789</span>
              <span className="h-1 w-1 rounded-full bg-muted-foreground/40" />
              <span>Hermes API 8642</span>
              <span className="h-1 w-1 rounded-full bg-muted-foreground/40" />
              <span>Hermes Dashboard 9119</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className={cn(
              'hidden items-center gap-2 rounded-md border px-3 py-2 text-sm md:flex',
              totals.online === totals.total && totals.total > 0
                ? statusClasses.online
                : totals.online > 0
                  ? statusClasses.degraded
                  : statusClasses.offline,
            )}>
              <Activity className="h-4 w-4" />
              <span>{totals.online}/{totals.total || 9}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void loadSnapshot()}
              disabled={loading || saving}
            >
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Refresh
            </Button>
            <Button
              variant={editing ? 'secondary' : 'outline'}
              size="sm"
              onClick={() => {
                setEditing((value) => !value);
                setDraftServers(cloneServers(servers));
              }}
              disabled={saving}
            >
              <Settings2 className="mr-2 h-4 w-4" />
              Configure
            </Button>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-md border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {editing && (
          <div className="mb-5 rounded-lg border border-black/10 bg-black/[0.02] p-4 dark:border-white/10 dark:bg-white/[0.03]">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-foreground">Server Configuration</h2>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setDraftServers(cloneServers(servers));
                    setEditing(false);
                  }}
                  disabled={saving}
                >
                  Cancel
                </Button>
                <Button size="sm" onClick={() => void handleSave()} disabled={saving}>
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Save
                </Button>
              </div>
            </div>
            <div className="grid gap-4">
              {draftServers.map((server) => (
                <div key={server.id} className="grid gap-3 rounded-md border border-black/10 bg-background p-3 dark:border-white/10 md:grid-cols-[1.1fr_1fr_0.8fr_0.8fr_0.8fr]">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Name</Label>
                    <Input
                      value={server.name}
                      onChange={(event) => updateDraft(server.id, 'name', event.target.value)}
                      className={inputClasses}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Host</Label>
                    <Input
                      value={server.host}
                      onChange={(event) => updateDraft(server.id, 'host', event.target.value)}
                      className={inputClasses}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">OpenClaw</Label>
                    <Input
                      value={String(server.openclawPort)}
                      onChange={(event) => updateDraft(server.id, 'openclawPort', normalizeDraftPort(event.target.value, server.openclawPort))}
                      className={inputClasses}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Hermes API</Label>
                    <Input
                      value={String(server.hermesApiPort)}
                      onChange={(event) => updateDraft(server.id, 'hermesApiPort', normalizeDraftPort(event.target.value, server.hermesApiPort))}
                      className={inputClasses}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Hermes UI</Label>
                    <Input
                      value={String(server.hermesDashboardPort)}
                      onChange={(event) => updateDraft(server.id, 'hermesDashboardPort', normalizeDraftPort(event.target.value, server.hermesDashboardPort))}
                      className={inputClasses}
                    />
                  </div>
                  <div className="space-y-1.5 md:col-span-2">
                    <Label className="text-xs text-muted-foreground">OpenClaw Token</Label>
                    <Input
                      type="password"
                      value={server.openclawToken ?? ''}
                      onChange={(event) => updateDraft(server.id, 'openclawToken', event.target.value || undefined)}
                      className={inputClasses}
                    />
                  </div>
                  <div className="space-y-1.5 md:col-span-2">
                    <Label className="text-xs text-muted-foreground">Hermes API Key</Label>
                    <Input
                      type="password"
                      value={server.hermesApiKey ?? ''}
                      onChange={(event) => updateDraft(server.id, 'hermesApiKey', event.target.value || undefined)}
                      className={inputClasses}
                    />
                  </div>
                  <label className="flex items-end gap-2 pb-2 text-sm text-foreground">
                    <input
                      type="checkbox"
                      checked={server.enabled}
                      onChange={(event) => updateDraft(server.id, 'enabled', event.target.checked)}
                      className="h-4 w-4 rounded border-black/20 text-primary focus:ring-primary"
                    />
                    Enabled
                  </label>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          <div className="grid gap-4">
            {snapshots.map((item) => (
              <ServerPanel key={item.config.id} snapshot={item} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ServerPanel({ snapshot }: { snapshot: OpsServerSnapshot }) {
  const summary = summarizeServer(snapshot);
  const lastChecked = snapshot.services[0]?.checkedAt
    ? new Date(snapshot.services[0].checkedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '-';

  return (
    <section className="rounded-lg border border-black/10 bg-background p-4 shadow-sm dark:border-white/10">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-black/5 text-foreground dark:bg-white/8">
            <Server className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold text-foreground">{snapshot.config.name}</h2>
            <p className="text-sm text-muted-foreground">{snapshot.config.host}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn('inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium', statusClasses[summary])}>
            {stateIcon(summary)}
            {stateLabel(summary)}
          </span>
          <span className="text-xs text-muted-foreground">Checked {lastChecked}</span>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {snapshot.services.map((service) => (
          <ServiceTile key={service.kind} service={service} />
        ))}
      </div>
    </section>
  );
}

function ServiceTile({ service }: { service: OpsServiceStatus }) {
  return (
    <div className="rounded-md border border-black/10 bg-black/[0.02] p-3 dark:border-white/10 dark:bg-white/[0.03]">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-foreground">{service.label}</p>
          <p className="mt-0.5 text-xs font-mono text-muted-foreground">{service.probePath}</p>
        </div>
        <span className={cn('inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium', statusClasses[service.state])}>
          {stateIcon(service.state)}
          {stateLabel(service.state)}
        </span>
      </div>
      <div className="space-y-1 text-xs text-muted-foreground">
        <div className="flex justify-between gap-3">
          <span>Status</span>
          <span className="font-mono">{service.statusCode ?? '-'}</span>
        </div>
        <div className="flex justify-between gap-3">
          <span>Latency</span>
          <span className="font-mono">{formatLatency(service)}</span>
        </div>
      </div>
      {service.detail && (
        <p className="mt-2 line-clamp-2 text-xs text-muted-foreground" title={service.detail}>
          {service.detail}
        </p>
      )}
      <Button
        variant="outline"
        size="sm"
        className="mt-3 h-8 w-full justify-between text-xs"
        onClick={() => void window.electron.openExternal(service.url)}
        disabled={service.state === 'disabled'}
      >
        Open
        <ExternalLink className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

export default Ops;
