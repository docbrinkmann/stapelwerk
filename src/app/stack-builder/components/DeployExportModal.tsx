'use client';

import { useMemo, useState } from 'react';
import {
  X,
  Copy,
  Check,
  Download,
  KeyRound,
  FileCode2,
  Container,
  Server,
  Cloud,
  Rocket,
  Ship,
  Cpu,
  Home,
  Globe,
  Terminal,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useT } from '@/lib/i18n/client';
import type { MessageKey } from '@/lib/i18n/messages';
import type { PersistedStack } from '@/lib/stack-persistence';
import {
  getDeployTargets,
  buildReadme,
  buildDeployScript,
  type DeployTargetInstructions,
} from '@/lib/deploy/handoff';
import {
  getDeploymentGuide,
  renderGuideMarkdown,
  DEPLOYMENT_ENVS,
  type DeploymentEnv,
} from '@/lib/deploy/guides';

interface DeployExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  stack: PersistedStack;
  composeYaml: string;
  envFile: string;
  secrets: Record<string, string>;
}

const TARGET_ICONS: Record<DeployTargetInstructions['id'], typeof Container> = {
  'docker-compose': Container,
  portainer: Server,
  coolify: Cloud,
  dokploy: Rocket,
  openship: Ship,
};

const GUIDE_ICONS: Record<DeploymentEnv, typeof Cpu> = {
  'raspberry-pi': Cpu,
  'home-server': Home,
  vps: Globe,
};

const ENV_LABEL_KEYS: Record<DeploymentEnv, MessageKey> = {
  'raspberry-pi': 'deploy.env.raspberryPi',
  'home-server': 'deploy.env.homeServer',
  vps: 'deploy.env.vps',
};

/**
 * Deploy / Export handoff modal. Turns a finished stack into portable
 * deliverables: a self-contained docker-compose.yml, a reference .env, a
 * README, and a key-sovereign deploy.sh — plus per-target instructions
 * (Portainer / Coolify / Dokploy / Openship / plain docker compose) and
 * environment guides (Raspberry Pi / Home Server / VPS).
 *
 * The compose/env/secrets are passed in already-generated so the modal shows
 * the exact same passwords as the live preview (no re-randomization). The
 * deploy.sh runs on the user's own machine and drives their server over their
 * own SSH — BuildMyStack never sees the host or holds the key.
 */
export function DeployExportModal({
  isOpen,
  onClose,
  stack,
  composeYaml,
  envFile,
  secrets,
}: DeployExportModalProps) {
  const t = useT();
  const targets = useMemo(() => getDeployTargets(t), [t]);
  const [guideEnv, setGuideEnv] = useState<DeploymentEnv>('raspberry-pi');
  const guide = useMemo(() => getDeploymentGuide(guideEnv, stack, t), [guideEnv, stack, t]);
  const secretEntries = Object.entries(secrets);

  if (!isOpen) return null;

  // The downloadable README is a deliberate EN artifact — build its guide with
  // the default (EN) translator, independent of the on-screen locale.
  const readme = buildReadme(stack, renderGuideMarkdown(getDeploymentGuide(guideEnv, stack)), secrets);
  const deployScript = buildDeployScript(stack);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={t('deploy.modal.ariaLabel')}
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg border border-border bg-background text-foreground shadow-lg"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <Rocket className="h-5 w-5 text-primary" />
              {t('deploy.title')}
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {t('deploy.modal.subtitle')}
            </p>
          </div>
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label={t('common.close')}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Scrollable body */}
        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-6">
          {secretEntries.length > 0 && (
            <GeneratedSecretsBox secrets={secretEntries} envFile={envFile} />
          )}

          {/* Targets */}
          <Tabs defaultValue={targets[0]?.id} className="w-full">
            <TabsList className="flex w-full flex-wrap gap-1">
              {targets.map(target => {
                const Icon = TARGET_ICONS[target.id];
                return (
                  <TabsTrigger key={target.id} value={target.id} className="flex items-center gap-1.5">
                    <Icon className="h-4 w-4" />
                    {target.title}
                  </TabsTrigger>
                );
              })}
            </TabsList>

            {targets.map(target => (
              <TabsContent key={target.id} value={target.id} className="space-y-4">
                <p className="text-sm text-muted-foreground">{target.summary}</p>

                <OrderedSteps steps={target.steps} />

                {target.id === 'docker-compose' ? (
                  <DownloadPanel
                    composeYaml={composeYaml}
                    envFile={envFile}
                    readme={readme}
                    deployScript={deployScript}
                  />
                ) : (
                  <CodeBox
                    label="docker-compose.yml"
                    value={composeYaml}
                    icon={<FileCode2 className="h-4 w-4" />}
                  />
                )}
              </TabsContent>
            ))}
          </Tabs>

          {/* Environment guide */}
          <div className="rounded-lg border border-border bg-card">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
              <div className="text-sm font-medium">{t('deploy.guide.heading')}</div>
              <div className="flex flex-wrap gap-1">
                {DEPLOYMENT_ENVS.map(({ id }) => {
                  const Icon = GUIDE_ICONS[id];
                  return (
                    <Button
                      key={id}
                      variant={guideEnv === id ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setGuideEnv(id)}
                    >
                      <Icon className="mr-1 h-4 w-4" />
                      {t(ENV_LABEL_KEYS[id])}
                    </Button>
                  );
                })}
              </div>
            </div>
            <div className="space-y-4 p-4">
              <p className="text-sm text-muted-foreground">{guide.intro}</p>
              <OrderedSteps
                steps={guide.steps.map(s => ({ title: s.title, detail: s.body }))}
                code={guide.steps.map(s => s.code)}
              />
              {guide.notes.length > 0 && (
                <ul className="space-y-1.5 rounded-md border border-info/30 bg-info/10 p-3 text-sm text-muted-foreground">
                  {guide.notes.map((note, i) => (
                    <li key={i} className="flex gap-2">
                      <span aria-hidden className="text-info">•</span>
                      <span>{note}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DownloadPanel({
  composeYaml,
  envFile,
  readme,
  deployScript,
}: {
  composeYaml: string;
  envFile: string;
  readme: string;
  deployScript: string;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <DownloadButton filename="docker-compose.yml" content={composeYaml} mime="text/yaml" />
        <DownloadButton filename=".env" content={envFile} mime="text/plain" />
        <DownloadButton filename="README.md" content={readme} mime="text/markdown" />
        <DownloadButton filename="deploy.sh" content={deployScript} mime="text/x-shellscript" />
      </div>
      <p className="text-xs text-muted-foreground">
        <span className="font-medium text-foreground">deploy.sh</span> is optional: run{' '}
        <code className="rounded bg-muted px-1 py-0.5 font-mono">./deploy.sh user@your-server</code>{' '}
        to stand the stack up on a remote host over your own SSH. Your machine drives your
        server — we never see the host or your key.
      </p>
      <CodeBox label="docker-compose.yml" value={composeYaml} icon={<FileCode2 className="h-4 w-4" />} />
      <CodeBox label=".env" value={envFile} icon={<KeyRound className="h-4 w-4" />} />
      <CodeBox label="deploy.sh" value={deployScript} icon={<Terminal className="h-4 w-4" />} />
    </div>
  );
}

function OrderedSteps({
  steps,
  code,
}: {
  steps: { title: string; detail?: string }[];
  code?: (string | undefined)[];
}) {
  return (
    <ol className="space-y-3">
      {steps.map((step, i) => (
        <li key={i} className="flex gap-3">
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
            {i + 1}
          </span>
          <div className="min-w-0 flex-1 space-y-1.5">
            <p className="text-sm font-medium text-foreground">{step.title}</p>
            {step.detail && <p className="text-sm text-muted-foreground">{step.detail}</p>}
            {code?.[i] && <InlineCode value={code[i] as string} />}
          </div>
        </li>
      ))}
    </ol>
  );
}

function InlineCode({ value }: { value: string }) {
  const t = useT();
  return (
    <div className="flex items-start justify-between gap-2 rounded-md border border-border bg-muted/50 px-3 py-2">
      <pre className="min-w-0 flex-1 overflow-x-auto whitespace-pre font-mono text-xs leading-relaxed text-foreground">
        {value}
      </pre>
      <CopyButton value={value} label={t('deploy.copyCommand')} iconOnly />
    </div>
  );
}

function CodeBox({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  const t = useT();
  return (
    <div className="flex flex-col rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          {icon}
          {label}
        </div>
        <CopyButton value={value} label={t('deploy.copyFile', { file: label })} />
      </div>
      <pre className="max-h-72 overflow-auto overflow-x-auto whitespace-pre p-4 font-mono text-xs leading-relaxed text-muted-foreground">
        {value}
      </pre>
    </div>
  );
}

function GeneratedSecretsBox({
  secrets,
  envFile,
}: {
  secrets: [string, string][];
  envFile: string;
}) {
  const t = useT();
  return (
    <div className="rounded-lg border border-warning/40 bg-warning/10 p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <KeyRound className="h-4 w-4 text-warning" />
          {t('deploy.secrets.title')}
        </div>
        <CopyButton value={envFile} label={t('deploy.secrets.copyEnv')} />
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        {t('deploy.secrets.modalHint')}
      </p>
      <ul className="space-y-1.5">
        {secrets.map(([key, value]) => (
          <li
            key={key}
            className="flex items-center justify-between gap-3 rounded-md bg-card/60 px-3 py-1.5 font-mono text-xs"
          >
            <span className="truncate text-muted-foreground">
              <span className="text-foreground">{key}</span> = {value}
            </span>
            <CopyButton value={value} label={t('deploy.secrets.copyValue')} iconOnly />
          </li>
        ))}
      </ul>
    </div>
  );
}

function DownloadButton({
  filename,
  content,
  mime,
}: {
  filename: string;
  content: string;
  mime: string;
}) {
  const handleDownload = () => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Button variant="outline" size="sm" onClick={handleDownload}>
      <Download className="mr-1.5 h-4 w-4" />
      {filename}
    </Button>
  );
}

function CopyButton({
  value,
  label,
  iconOnly = false,
}: {
  value: string;
  label: string;
  iconOnly?: boolean;
}) {
  const t = useT();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard may be unavailable (insecure context) — fail silently.
    }
  };

  return (
    <Button
      variant="outline"
      size={iconOnly ? 'icon-sm' : 'sm'}
      onClick={handleCopy}
      aria-label={label}
      title={label}
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {!iconOnly && <span className="ml-1">{copied ? t('common.copied') : label}</span>}
    </Button>
  );
}

export default DeployExportModal;
