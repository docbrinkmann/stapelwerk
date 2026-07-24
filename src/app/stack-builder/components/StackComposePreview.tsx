'use client';

import { useMemo, useState } from 'react';
import { Copy, Check, KeyRound, FileCode2, Rocket } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useT } from '@/lib/i18n/client';
import { useStackBuilderStore } from '@/stores/stack-builder';
import { type PersistedStack } from '@/lib/stack-persistence';
import { buildComposeBundle } from '@/lib/deploy/handoff';
import { DeployExportModal } from './DeployExportModal';

/**
 * Live, deployable docker-compose preview for the stack builder. Reflects the
 * current stack (services + per-service configuration) and surfaces any secrets
 * the generator auto-filled for required secret env vars.
 *
 * Generation is memoized on a stable signature of the stack so the displayed
 * YAML/secrets stay stable while the stack is unchanged — a re-render (hover,
 * panel toggle, …) does not spam fresh random passwords.
 */
export function StackComposePreview() {
  const t = useT();
  const name = useStackBuilderStore(state => state.name);
  const description = useStackBuilderStore(state => state.description);
  const isPublic = useStackBuilderStore(state => state.isPublic);
  const services = useStackBuilderStore(state => state.services);

  const [showDeployModal, setShowDeployModal] = useState(false);

  const { stack, composeYaml, envFile, secrets } = useMemo(() => {
    const stack: PersistedStack = { name, description, isPublic, services };
    return { stack, ...buildComposeBundle(stack) };
    // Regenerate only when the stack content actually changes. `services` is a
    // content-stable reference (immer), so unrelated re-renders keep secrets steady.
  }, [name, description, isPublic, services]);

  const secretEntries = Object.entries(secrets);

  if (services.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center text-muted-foreground">
        <div>
          <FileCode2 className="mx-auto mb-3 h-8 w-8 opacity-50" />
          <p className="text-sm">{t('deploy.preview.empty')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-4 p-4">
      {secretEntries.length > 0 && (
        <GeneratedSecretsBox secrets={secretEntries} />
      )}

      <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-4 py-2">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <FileCode2 className="h-4 w-4" />
            docker-compose.yml
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="default"
              size="sm"
              onClick={() => setShowDeployModal(true)}
              data-testid="open-deploy-export"
            >
              <Rocket className="mr-1 h-3.5 w-3.5" />
              {t('deploy.title')}
            </Button>
            <CopyButton value={composeYaml} label={t('deploy.preview.copyYaml')} />
          </div>
        </div>
        <pre
          data-testid="compose-preview"
          className="min-h-0 flex-1 overflow-auto overflow-x-auto whitespace-pre p-4 font-mono text-xs leading-relaxed text-muted-foreground"
        >
          {composeYaml}
        </pre>
      </div>

      <DeployExportModal
        isOpen={showDeployModal}
        onClose={() => setShowDeployModal(false)}
        stack={stack}
        composeYaml={composeYaml}
        envFile={envFile}
        secrets={secrets}
      />
    </div>
  );
}

function GeneratedSecretsBox({ secrets }: { secrets: [string, string][] }) {
  const t = useT();
  const dotenv = secrets.map(([key, value]) => `${key.replace(/[.\-]/g, '_').toUpperCase()}=${value}`).join('\n');

  return (
    <div
      data-testid="generated-secrets"
      className="rounded-lg border border-warning/40 bg-warning/10 p-4"
    >
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <KeyRound className="h-4 w-4 text-warning" />
          {t('deploy.secrets.title')}
        </div>
        <CopyButton value={dotenv} label={t('deploy.secrets.copyAll')} />
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        {t('deploy.secrets.previewHint')}
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
            <CopyButton value={value} label={t('common.copy')} iconOnly />
          </li>
        ))}
      </ul>
    </div>
  );
}

function CopyButton({ value, label, iconOnly = false }: { value: string; label: string; iconOnly?: boolean }) {
  const t = useT();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard may be unavailable (e.g. insecure context) — fail silently.
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

export default StackComposePreview;
