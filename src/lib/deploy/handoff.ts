/**
 * Deployment HANDOFF — BuildMyStack's complementary value vs Coolify/Dokploy.
 *
 * BuildMyStack is the guided *composer*; it does not compete with a deploy
 * panel. The primary "deploy" path is therefore a HANDOFF: hand the user a
 * correct, portable `docker-compose.yml` plus clear, per-target instructions
 * so they can run the stack anywhere (Portainer / Coolify / Dokploy / Openship /
 * plain `docker compose`) — or, for a remote host, a key-sovereign `deploy.sh`
 * (see `buildDeployScript`) that runs on the user's own machine and drives their
 * server over their own SSH. We never see the host or hold the key.
 *
 * ── Artifact approach: INLINE compose, `.env` for reference ─────────────────
 * The compose generator (`generateComposeWithSecrets`) inlines every value —
 * including auto-generated passwords — directly into the YAML `environment`
 * blocks. We keep that as the single source of truth: the downloaded
 * `docker-compose.yml` is fully self-contained and runs on its own with no
 * `.env` required.
 *
 * We ALSO emit a `.env` file, but purely for REFERENCE — a record of the
 * generated passwords in `KEY=value` form the user can store safely. The
 * compose does NOT reference `${VAR}` placeholders, so the two artifacts can
 * never drift out of sync: the compose already carries the values, and the
 * `.env` just mirrors them. This is the simplest approach that guarantees the
 * downloaded artifacts work together.
 */

import { generateComposeWithSecrets, type PersistedStack } from '@/lib/stack-persistence';
import { buildStackDocs } from '@/lib/deploy/stack-docs';
import { makeT, type Translate } from '@/lib/i18n/messages';

/** A single ordered instruction within a deploy-target guide. */
export interface DeployStep {
  title: string;
  detail?: string;
}

/** Which artifact(s) the user pastes/uploads for a given target. */
export type DeployArtifact = 'compose' | 'compose+env';

/** Structured, ordered instructions for one handoff target. */
export interface DeployTargetInstructions {
  id: 'portainer' | 'coolify' | 'dokploy' | 'openship' | 'docker-compose';
  title: string;
  /** One-line description of the target. */
  summary: string;
  steps: DeployStep[];
  /** What the user needs on hand for this target. */
  artifact: DeployArtifact;
}

/** The deliverables produced from a finished stack. */
export interface ComposeBundle {
  /** Self-contained docker-compose.yml (secret values inlined). */
  composeYaml: string;
  /** A `.env` mirroring the generated secrets, for reference. */
  envFile: string;
  /**
   * Key-sovereign `deploy.sh` — runs on the USER's machine and drives THEIR
   * server over THEIR own SSH. BuildMyStack never sees the server or the key.
   */
  deployScript: string;
  /** Generated secrets keyed as `${slug}.${ENV_VAR}` → value. */
  secrets: Record<string, string>;
}

/**
 * Slugify a stack name into a safe compose-project / remote-dir name:
 * lowercased, non-alphanumerics → `-`, collapsed and trimmed. Falls back to
 * `stack` so the script is always valid even for an empty/symbol-only name.
 */
export function stackSlug(name: string): string {
  const s = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return s || 'stack';
}

/**
 * Build a portable POSIX `deploy.sh` that stands the stack up on a remote host
 * **from the user's own machine**. This is the Openship lesson at our scale: the
 * control plane is the operator's laptop, not our server. The script only uses
 * the `ssh`/`scp` already on that machine — the operator's own keys, agent, and
 * `~/.ssh/config` — so **no key ever leaves their machine and nothing is sent to
 * BuildMyStack**. It `scp`s the self-contained compose (next to the script) to
 * the host the operator names and runs `docker compose up -d` there.
 */
export function buildDeployScript(stack: PersistedStack): string {
  const slug = stackSlug(stack.name);
  const project = `bms-${slug}`;
  // ponytail: TARGET and REMOTE_DIR come from the operator's own argv on their
  // own machine — this is a user-run script, not a server endpoint, so there is
  // no privilege boundary to injection here; the generated `project` is
  // slug-restricted to [a-z0-9-] regardless.
  return `#!/usr/bin/env sh
# BuildMyStack — key-sovereign deploy.
#
# Runs on YOUR machine and drives YOUR server over YOUR own SSH. BuildMyStack
# never sees your server or your SSH key: this uses the ssh/scp already on this
# machine (your keys, your agent, your ~/.ssh/config), copies the self-contained
# docker-compose.yml sitting next to it, and runs \`docker compose up -d\` on the
# host you name. Nothing is sent anywhere but that host.
#
# Usage:  ./deploy.sh user@your-server [remote-dir]
#   e.g.  ./deploy.sh pi@192.168.1.20
#         ./deploy.sh root@vps.example.com /opt/stacks/${slug}
set -eu

TARGET="\${1:-}"
REMOTE_DIR="\${2:-${project}}"
PROJECT="${project}"

if [ -z "$TARGET" ]; then
  echo "usage: $0 user@host [remote-dir]" >&2
  echo "  deploys docker-compose.yml (next to this script) to host over your own SSH" >&2
  exit 2
fi

DIR="$(cd "$(dirname "$0")" && pwd)"
if [ ! -f "$DIR/docker-compose.yml" ]; then
  echo "error: docker-compose.yml not found next to this script ($DIR)" >&2
  exit 1
fi

echo "-> Creating $REMOTE_DIR on $TARGET"
ssh "$TARGET" "mkdir -p $REMOTE_DIR"

echo "-> Copying compose files"
scp "$DIR/docker-compose.yml" "$TARGET:$REMOTE_DIR/docker-compose.yml"
if [ -f "$DIR/.env" ]; then
  scp "$DIR/.env" "$TARGET:$REMOTE_DIR/.env"
fi

echo "-> Starting the stack (docker compose up -d)"
ssh "$TARGET" "cd $REMOTE_DIR && docker compose -p $PROJECT up -d"

echo "-> Status"
ssh "$TARGET" "cd $REMOTE_DIR && docker compose -p $PROJECT ps"

echo "OK. Live logs:  ssh $TARGET 'cd $REMOTE_DIR && docker compose -p $PROJECT logs -f'"
`;
}

/**
 * Normalize a `slug.ENV_VAR` secret key into a valid, collision-safe `.env`
 * variable name: non-word characters become `_`, and the whole thing is
 * uppercased (e.g. `postgresql.POSTGRES_PASSWORD` → `POSTGRESQL_POSTGRES_PASSWORD`).
 * Matches the transform used by the live preview's "generated passwords" box.
 */
export function normalizeEnvKey(secretKey: string): string {
  return secretKey.replace(/[^A-Za-z0-9_]+/g, '_').replace(/^_+|_+$/g, '').toUpperCase();
}

/**
 * Build a `.env` file body from generated secrets. Keys are normalized and
 * uppercased; the values are the generated passwords. Includes a short header
 * clarifying that the values are already inlined in the compose.
 */
export function buildEnvFile(secrets: Record<string, string>): string {
  const lines = [
    '# Generated by BuildMyStack — auto-generated passwords for your stack.',
    '# These values are ALSO inlined in docker-compose.yml, so the compose runs',
    '# on its own. Keep this file safe as a record of the generated secrets.',
  ];
  for (const [key, value] of Object.entries(secrets)) {
    lines.push(`${normalizeEnvKey(key)}=${value}`);
  }
  // Trailing newline so the file is a well-formed POSIX text file.
  return `${lines.join('\n')}\n`;
}

/**
 * Prepare the three deliverables from a finished stack: the self-contained
 * compose YAML, a reference `.env`, and the raw generated secrets map.
 */
export function buildComposeBundle(stack: PersistedStack): ComposeBundle {
  const { yaml, secrets } = generateComposeWithSecrets(stack);
  return {
    composeYaml: yaml,
    envFile: buildEnvFile(secrets),
    deployScript: buildDeployScript(stack),
    secrets,
  };
}

/**
 * Per-target handoff instructions. Static content — the artifacts themselves
 * carry the stack-specific values, so the steps only need to explain where to
 * paste/upload them. `t` localizes the UI steps (default EN); commands and
 * target names (Portainer/Coolify/Dokploy) stay literal.
 */
export function getDeployTargets(t: Translate = makeT('en')): DeployTargetInstructions[] {
  return [
    {
      id: 'docker-compose',
      title: t('deploy.target.compose.title'),
      summary: t('deploy.target.compose.summary'),
      artifact: 'compose+env',
      steps: [
        { title: t('deploy.target.compose.step1') },
        { title: t('deploy.target.compose.step2') },
        {
          title: t('deploy.target.compose.step3'),
          detail: 'docker compose up -d',
        },
        {
          title: t('deploy.target.compose.step4'),
          detail: 'docker compose ps  •  docker compose logs -f',
        },
        {
          title: t('deploy.target.compose.step5'),
          detail: t('deploy.target.compose.step5Detail'),
        },
      ],
    },
    {
      id: 'portainer',
      title: 'Portainer',
      summary: t('deploy.target.portainer.summary'),
      artifact: 'compose',
      steps: [
        { title: t('deploy.target.portainer.step1') },
        { title: t('deploy.target.portainer.step2') },
        {
          title: t('deploy.target.portainer.step3'),
          detail: t('deploy.target.portainer.step3Detail'),
        },
        { title: t('deploy.target.portainer.step4') },
      ],
    },
    {
      id: 'coolify',
      title: 'Coolify',
      summary: t('deploy.target.coolify.summary'),
      artifact: 'compose',
      steps: [
        { title: t('deploy.target.coolify.step1') },
        { title: t('deploy.target.coolify.step2') },
        {
          title: t('deploy.target.coolify.step3'),
          detail: t('deploy.target.coolify.step3Detail'),
        },
        { title: t('deploy.target.coolify.step4') },
      ],
    },
    {
      id: 'dokploy',
      title: 'Dokploy',
      summary: t('deploy.target.dokploy.summary'),
      artifact: 'compose',
      steps: [
        { title: t('deploy.target.dokploy.step1') },
        { title: t('deploy.target.dokploy.step2') },
        { title: t('deploy.target.dokploy.step3') },
        { title: t('deploy.target.dokploy.step4') },
      ],
    },
    {
      id: 'openship',
      title: 'Openship',
      summary: t('deploy.target.openship.summary'),
      artifact: 'compose',
      steps: [
        { title: t('deploy.target.openship.step1') },
        { title: t('deploy.target.openship.step2') },
        { title: t('deploy.target.openship.step3') },
        { title: t('deploy.target.openship.step4') },
      ],
    },
  ];
}

/**
 * Build a README.md a user can drop next to the compose. Thin wrapper over the
 * canonical per-stack docs generator (`buildStackDocs`) — kept for its existing
 * callers/signature so there is a single README, not two competing ones. It
 * produces the full doc (overview, services, ports, volumes, secrets,
 * start/stop, troubleshooting) and optionally appends an environment guide.
 */
export function buildReadme(
  stack: PersistedStack,
  guideMarkdown?: string,
  secrets?: Record<string, string>,
): string {
  return buildStackDocs(stack, { guideMarkdown, secrets });
}
