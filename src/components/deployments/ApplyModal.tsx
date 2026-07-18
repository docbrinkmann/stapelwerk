'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ApplyPanel } from './ApplyPanel';
import { api } from '@/trpc/client';

interface ApplyModalProps {
  isOpen: boolean;
  onClose: () => void;
  stackId?: string;
  targetId?: string;
  artifactId?: string;
}

export const ApplyModal: React.FC<ApplyModalProps> = ({
  isOpen,
  onClose,
  stackId: initialStackId,
  targetId: initialTargetId,
  artifactId,
}) => {
  const [selectedTargetId, setSelectedTargetId] = useState<string | undefined>(initialTargetId);
  const [selectedStackId, setSelectedStackId] = useState<string | undefined>(initialStackId);

  // Target creation UI state
  const [showCreateTarget, setShowCreateTarget] = useState(false);
  const [newTargetName, setNewTargetName] = useState('');
  const [newTargetProvider, setNewTargetProvider] = useState('self-managed');
  const [newTargetType, setNewTargetType] = useState<'kubernetes' | 'docker'>('kubernetes');
  const [newTargetConfig, setNewTargetConfig] = useState('');
  // Direct-deploy location: local Docker socket (default) or a remote SSH host.
  const [newTargetLocation, setNewTargetLocation] = useState<'local' | 'remote'>('local');
  const [newTargetHost, setNewTargetHost] = useState('');
  const [newTargetSshUser, setNewTargetSshUser] = useState('');
  const [newTargetSshPort, setNewTargetSshPort] = useState('22');
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Deploy server's SSH public key — shown so the operator can authorize it on a
  // remote host. Only fetched when the remote option is actually chosen.
  const { data: deployKey } = useQuery({
    queryKey: ['deployments', 'deployPublicKey'],
    queryFn: () => api.deployments.getDeployPublicKey.query(),
    enabled: newTargetLocation === 'remote',
    staleTime: 5 * 60 * 1000,
  });

  // CI YAML rendering state
  const [showCiPanel, setShowCiPanel] = useState(false);
  const [ciManifestPath, setCiManifestPath] = useState('k8s/deploy.yaml');
  const [ciLoading, setCiLoading] = useState(false);
  const [ciError, setCiError] = useState<string | null>(null);
  const [ciYaml, setCiYaml] = useState<string | null>(null);

  const queryClient = useQueryClient();

  // Generate the server deploy key on demand so the public key can be shown +
  // authorized without hand-configuring DEPLOY_SSH_KEY_FILE on the server.
  const [genKeyLoading, setGenKeyLoading] = useState(false);
  const [genKeyError, setGenKeyError] = useState<string | null>(null);
  const handleGenerateDeployKey = async () => {
    setGenKeyError(null);
    setGenKeyLoading(true);
    try {
      await api.deployments.generateDeployKey.mutate({});
      await queryClient.invalidateQueries({ queryKey: ['deployments', 'deployPublicKey'] });
    } catch (err: any) {
      setGenKeyError(err?.message || 'Failed to generate deploy key');
    } finally {
      setGenKeyLoading(false);
    }
  };

  // Fetch deployment targets
  const { data: targetsData, isLoading: targetsLoading } = useQuery({
    queryKey: ['deployments', 'targets', { limit: 50 }],
    queryFn: async () => {
      const res = await api.deployments.listTargets.query({ limit: 50 });
      return res.targets ?? [];
    },
  });

  // Fetch user's stacks (recent)
  const { data: stacksData, isLoading: stacksLoading } = useQuery({
    queryKey: ['stacks', 'list', { limit: 20 }],
    queryFn: async () => {
      const res = await api.stacks.list.query({ limit: 20 });
      return res.stacks ?? [];
    },
  });

  const targets = targetsData ?? [];
  const stacks = stacksData ?? [];

  // Create target handler
  const handleCreateTarget = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    // Basic validation
    if (!newTargetName.trim()) {
      setCreateError('Target name is required');
      return;
    }
    const isRemote = newTargetLocation === 'remote';
    if (isRemote && (!newTargetHost.trim() || !newTargetSshUser.trim())) {
      setCreateError('Remote targets need a host and SSH user');
      return;
    }
    const sshPort = Number(newTargetSshPort);
    if (isRemote && (!Number.isInteger(sshPort) || sshPort < 1 || sshPort > 65535)) {
      setCreateError('SSH port must be a number between 1 and 65535');
      return;
    }
    try {
      setIsCreating(true);
      let config: Record<string, any> | undefined = undefined;
      if (newTargetConfig.trim().length > 0) {
        try {
          config = JSON.parse(newTargetConfig);
        } catch (err) {
          setCreateError('Config must be valid JSON');
          setIsCreating(false);
          return;
        }
      }
      const created = await api.deployments.createTarget.mutate({
        name: newTargetName.trim(),
        // Direct compose deploy (local socket or remote SSH) requires a docker target.
        type: isRemote ? 'docker' : newTargetType,
        provider: newTargetProvider.trim() || 'self-managed',
        config,
        location: newTargetLocation,
        ...(isRemote
          ? { host: newTargetHost.trim(), sshUser: newTargetSshUser.trim(), sshPort }
          : {}),
      });
      // Refresh targets and select the new one
      await queryClient.invalidateQueries({ queryKey: ['deployments', 'targets'] });
      setSelectedTargetId(created.id);
      setShowCreateTarget(false);
      setNewTargetName('');
      setNewTargetProvider('self-managed');
      setNewTargetType('kubernetes');
      setNewTargetConfig('');
      setNewTargetLocation('local');
      setNewTargetHost('');
      setNewTargetSshUser('');
      setNewTargetSshPort('22');
    } catch (err: any) {
      setCreateError(err?.message || 'Failed to create target');
    } finally {
      setIsCreating(false);
    }
  };

  // Auto-select the first available item if none selected
  useEffect(() => {
    if (!selectedTargetId && targets.length === 1) setSelectedTargetId(targets[0].id);
  }, [targets, selectedTargetId]);

  useEffect(() => {
    if (!selectedStackId && stacks.length === 1) setSelectedStackId(stacks[0].id);
  }, [stacks, selectedStackId]);

  const disabled = targetsLoading || stacksLoading;

  // Render CI YAML
  const handleRenderCi = async () => {
    setCiError(null);
    setCiYaml(null);
    if (!selectedTargetId) {
      setCiError('Select a target to render CI YAML.');
      return;
    }
    if (!ciManifestPath.trim()) {
      setCiError('Manifest path is required.');
      return;
    }
    try {
      setCiLoading(true);
      const res = await api.deployments.renderApplyCi.query({
        targetId: selectedTargetId,
        manifestPath: ciManifestPath.trim(),
      });
      setCiYaml(res.yaml);
    } catch (err: any) {
      setCiError(err?.message || 'Failed to render CI YAML');
    } finally {
      setCiLoading(false);
    }
  };

  const targetOptions = useMemo(() => targets.map((t: any) => ({ id: t.id, label: `${t.name} · ${t.provider}` })), [targets]);
  const stackOptions = useMemo(() => stacks.map((s: any) => ({ id: s.id, label: s.name })), [stacks]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-3xl" data-testid="apply-modal">
        <DialogHeader>
          <DialogTitle>Direct Apply</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Empty-state and quick target creation */}
          {targetsLoading ? (
            <div className="p-3 text-sm text-muted-foreground">Loading deployment targets…</div>
          ) : targets.length === 0 ? (
            <div className="p-4 border rounded border-border bg-muted/40">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium text-warning">No deployment targets found</div>
                  <div className="text-sm text-muted-foreground mt-1">Create a target to enable Direct Apply.</div>
                </div>
                <button
                  type="button"
                  className="px-3 py-1.5 text-sm border rounded bg-card hover:bg-muted"
                  onClick={() => setShowCreateTarget(!showCreateTarget)}
                  data-testid="apply-create-target-toggle"
                >
                  {showCreateTarget ? 'Hide' : 'Create Target'}
                </button>
              </div>
              {showCreateTarget && (
                <form onSubmit={handleCreateTarget} className="mt-3 space-y-3" data-testid="apply-create-target-form">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1">
<label className="text-sm font-medium" htmlFor="apply-target-name">Name</label>
                      <input
                        id="apply-target-name"
                        name="apply-target-name"
                        type="text"
                        className="border border-input bg-background text-foreground rounded px-3 py-2 w-full"
                        value={newTargetName}
                        onChange={(e) => setNewTargetName(e.target.value)}
                        placeholder="e.g., Local K3s"
                      />
                    </div>
                    <div className="space-y-1">
<label className="text-sm font-medium" htmlFor="apply-target-provider">Provider</label>
                      <input
                        id="apply-target-provider"
                        name="apply-target-provider"
                        type="text"
                        className="border border-input bg-background text-foreground rounded px-3 py-2 w-full"
                        value={newTargetProvider}
                        onChange={(e) => setNewTargetProvider(e.target.value)}
                        placeholder="e.g., self-managed, EKS, GKE"
                      />
                    </div>
                    <div className="space-y-1">
<label className="text-sm font-medium" htmlFor="apply-target-type">Type</label>
                      <select
                        id="apply-target-type"
                        name="apply-target-type"
                        className="border border-input bg-background text-foreground rounded px-3 py-2 w-full"
                        value={newTargetType}
                        onChange={(e) => setNewTargetType(e.target.value as 'kubernetes' | 'docker')}
                      >
                        <option value="kubernetes">Kubernetes</option>
                        <option value="docker">Docker</option>
                      </select>
                    </div>
                    <div className="space-y-1">
<label className="text-sm font-medium" htmlFor="apply-target-location">Deploy location</label>
                      <select
                        id="apply-target-location"
                        name="apply-target-location"
                        data-testid="apply-target-location"
                        className="border border-input bg-background text-foreground rounded px-3 py-2 w-full"
                        value={newTargetLocation}
                        onChange={(e) => setNewTargetLocation(e.target.value as 'local' | 'remote')}
                      >
                        <option value="local">This server (local Docker socket)</option>
                        <option value="remote">Remote host (SSH, key-based)</option>
                      </select>
                    </div>
                    {newTargetLocation === 'local' && (
                    <div className="space-y-1 md:col-span-1">
<label className="text-sm font-medium" htmlFor="apply-target-config">Config (JSON, optional)</label>
                      <textarea
                        id="apply-target-config"
                        name="apply-target-config"
                        className="border border-input bg-background text-foreground rounded px-3 py-2 w-full h-24"
                        value={newTargetConfig}
                        onChange={(e) => setNewTargetConfig(e.target.value)}
                        placeholder='{"apply": {"method": "gitlab-agent", "kubeContext": "my/cluster"}}'
                      />
                    </div>
                    )}
                  </div>

                  {newTargetLocation === 'remote' && (
                    <div className="space-y-3 border rounded p-3 bg-muted/40" data-testid="apply-remote-fields">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="space-y-1 md:col-span-2">
                          <label className="text-sm font-medium" htmlFor="apply-target-host">Host</label>
                          <input
                            id="apply-target-host"
                            name="apply-target-host"
                            type="text"
                            className="border border-input bg-background text-foreground rounded px-3 py-2 w-full"
                            value={newTargetHost}
                            onChange={(e) => setNewTargetHost(e.target.value)}
                            placeholder="e.g., 192.168.1.20 or server.example.com"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-sm font-medium" htmlFor="apply-target-ssh-port">SSH port</label>
                          <input
                            id="apply-target-ssh-port"
                            name="apply-target-ssh-port"
                            type="number"
                            className="border border-input bg-background text-foreground rounded px-3 py-2 w-full"
                            value={newTargetSshPort}
                            onChange={(e) => setNewTargetSshPort(e.target.value)}
                            placeholder="22"
                          />
                        </div>
                        <div className="space-y-1 md:col-span-2">
                          <label className="text-sm font-medium" htmlFor="apply-target-ssh-user">SSH user</label>
                          <input
                            id="apply-target-ssh-user"
                            name="apply-target-ssh-user"
                            type="text"
                            className="border border-input bg-background text-foreground rounded px-3 py-2 w-full"
                            value={newTargetSshUser}
                            onChange={(e) => setNewTargetSshUser(e.target.value)}
                            placeholder="e.g., deploy"
                          />
                        </div>
                      </div>

                      {/* Authorize the deploy server's public key on the target host. */}
                      <div className="text-sm">
                        <div className="font-medium">Authorize BuildMyStack on your host</div>
                        <p className="text-muted-foreground mt-0.5">
                          Deploys use key-based SSH — no passwords. Add this public key to the
                          host&apos;s <code>~/.ssh/authorized_keys</code> for user{' '}
                          <code>{newTargetSshUser.trim() || 'deploy'}</code>:
                        </p>
                        {deployKey?.configured && deployKey.publicKey ? (
                          <div className="mt-2 space-y-2">
                            <pre className="bg-card border rounded p-2 overflow-x-auto text-xs" data-testid="apply-deploy-pubkey">
                              <code>{deployKey.publicKey}</code>
                            </pre>
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                className="px-2 py-1 text-xs border rounded"
                                onClick={() => {
                                  const k = deployKey?.publicKey;
                                  if (k) navigator.clipboard?.writeText(k).catch(() => {/* noop */});
                                }}
                              >
                                Copy key
                              </button>
                              <button
                                type="button"
                                className="px-2 py-1 text-xs border rounded"
                                onClick={() => {
                                  const k = deployKey?.publicKey;
                                  if (k) navigator.clipboard?.writeText(`echo '${k}' >> ~/.ssh/authorized_keys`).catch(() => {/* noop */});
                                }}
                              >
                                Copy install command
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="mt-2 space-y-2" data-testid="apply-deploy-pubkey-missing">
                            <p className="text-xs text-muted-foreground">
                              No deploy key is configured yet. Generate one here — the private key
                              stays on the server; you authorize the public key on your host.
                            </p>
                            <button
                              type="button"
                              className="px-3 py-1.5 text-sm border border-input rounded bg-primary text-primary-foreground disabled:opacity-60"
                              onClick={handleGenerateDeployKey}
                              disabled={genKeyLoading}
                              data-testid="apply-generate-deploy-key"
                            >
                              {genKeyLoading ? 'Generating…' : 'Generate deploy key'}
                            </button>
                            {genKeyError && (
                              <p className="text-xs text-destructive">{genKeyError}</p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  {createError && <div className="text-sm text-destructive" data-testid="apply-create-target-error">{createError}</div>}
                  <div className="flex gap-2">
                    <button type="submit" className="px-3 py-1.5 text-sm border rounded bg-primary text-primary-foreground disabled:opacity-60" disabled={isCreating}>
                      {isCreating ? 'Creating…' : 'Create Target'}
                    </button>
                    <button type="button" className="px-3 py-1.5 text-sm border rounded" onClick={() => setShowCreateTarget(false)}>
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>
          ) : null}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium">Target</label>
              <select
                data-testid="apply-target-select"
                className="border border-input bg-background text-foreground rounded px-3 py-2 w-full"
                value={selectedTargetId ?? ''}
                onChange={(e) => setSelectedTargetId(e.target.value || undefined)}
                disabled={disabled}
              >
                <option value="">Select a target (optional)</option>
                {targetOptions.map((opt: { id: string; label: string }) => (
                  <option key={opt.id} value={opt.id}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Stack</label>
              <select
                data-testid="apply-stack-select"
                className="border border-input bg-background text-foreground rounded px-3 py-2 w-full"
                value={selectedStackId ?? ''}
                onChange={(e) => setSelectedStackId(e.target.value || undefined)}
                disabled={disabled}
              >
                <option value="">Select a saved stack (optional)</option>
                {stackOptions.map((opt: { id: string; label: string }) => (
                  <option key={opt.id} value={opt.id}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* CI YAML rendering */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">CI YAML (optional)</div>
              <button
                type="button"
                className="px-3 py-1.5 text-sm border rounded"
                onClick={() => setShowCiPanel(!showCiPanel)}
                data-testid="apply-toggle-ci"
              >
                {showCiPanel ? 'Hide' : 'Generate CI YAML'}
              </button>
            </div>
            {showCiPanel && (
              <div className="border rounded p-3 space-y-2" data-testid="apply-ci-panel">
                <div className="space-y-1">
                  <label className="text-sm">Manifest path</label>
                  <input
                    type="text"
                    className="border border-input bg-background text-foreground rounded px-3 py-2 w-full"
                    value={ciManifestPath}
                    onChange={(e) => setCiManifestPath(e.target.value)}
                    placeholder="k8s/deploy.yaml"
                  />
                </div>
                {ciError && <div className="text-sm text-destructive" data-testid="apply-ci-error">{ciError}</div>}
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="px-3 py-1.5 text-sm border rounded bg-muted"
                    onClick={handleRenderCi}
                    disabled={ciLoading}
                    data-testid="apply-render-ci"
                  >
                    {ciLoading ? 'Rendering…' : 'Render CI YAML'}
                  </button>
                </div>
                {ciYaml && (
                  <div className="space-y-2">
                    <textarea
                      readOnly
                      className="w-full h-40 border border-input bg-background text-foreground rounded p-2 font-mono text-xs"
                      value={ciYaml}
                      data-testid="apply-ci-yaml"
                    />
                    <button
                      type="button"
                      className="px-2 py-1 text-sm border rounded"
                      onClick={() => {
                        navigator.clipboard?.writeText(ciYaml).catch(() => {/* noop */})
                      }}
                    >
                      Copy
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <ApplyPanel stackId={selectedStackId} targetId={selectedTargetId} artifactId={artifactId} onViewCi={() => setShowCiPanel(true)} />
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ApplyModal;
