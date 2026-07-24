/**
 * The "verified deploy" artifact — the thing the one-time €29 purchase buys.
 *
 * Composing, checking and exporting a stack is free forever. What you pay for is
 * TRUST: a provenance-signed report attesting, by construction, that this exact
 * compose is deploy-safe — the VPN kill-switch confines every download client to
 * its gateway's network namespace (`status`/`findings`), AND the deploy safety
 * audit finds no exposed datastore, no data-losing datastore, no default secret,
 * and pinned images (`audit`). The report is deterministic (built from the compose
 * via the same `verifyComposeKillSwitch` + `auditCompose` the builder uses) and
 * cryptographically signed (ed25519), so anyone can verify it with the published
 * public key. We never hold your SSH keys and never boot your stack on our infra.
 */
import crypto from 'crypto'
import { parse as parseYaml } from 'yaml'
import { verifyComposeKillSwitch, type StructuralVerdict, type KillSwitchFinding } from './kill-switch-attestation'
import { auditCompose, type SafetyAuditVerdict } from './safety-audit'

export interface VerifiedDeployReport {
  version: 1
  reportId: string
  stackId: string
  stackName: string
  product: 'verified-deploy'
  /** sha256 of the exact compose the report attests. */
  composeSha256: string
  status: StructuralVerdict['status'] // 'leak-proof' | 'routed-no-killswitch' | 'leak' | 'no-download-client'
  findings: KillSwitchFinding[]
  summary: string
  /**
   * The deploy safety audit (exposed datastore ports, data-loss volumes, default
   * secrets, unpinned images). Optional + appended last in `canonicalReport` so
   * reports signed before it existed still verify. Present on all new reports.
   */
  audit?: SafetyAuditVerdict
  /** ISO timestamp the report was issued. */
  issuedAt: string
  issuer: 'Stapelwerk'
}

/**
 * A report has a BLOCKING failure when the kill-switch is a hard leak OR the
 * safety audit has any `fail` property — problems the user can fix and re-attest.
 * Advisory `warn`s (short secret, unpinned image) do not block. Used to decide
 * whether a paid credit is consumed (never burn €29 on a fixable failure).
 */
export function reportHasBlockingFailure(report: VerifiedDeployReport): boolean {
  return report.status === 'leak' || report.audit?.status === 'fail'
}

export function sha256Hex(s: string): string {
  return crypto.createHash('sha256').update(s).digest('hex')
}

/**
 * Deterministic canonical JSON — fixed key order — so the signature is stable
 * and reproducible by a verifier. NEVER change the field order without bumping
 * `version`, or existing signatures stop verifying.
 */
export function canonicalReport(r: VerifiedDeployReport): string {
  return JSON.stringify({
    version: r.version,
    reportId: r.reportId,
    stackId: r.stackId,
    stackName: r.stackName,
    product: r.product,
    composeSha256: r.composeSha256,
    status: r.status,
    findings: r.findings.map((f) => ({ service: f.service, verdict: f.verdict, detail: f.detail })),
    summary: r.summary,
    issuedAt: r.issuedAt,
    issuer: r.issuer,
    // Appended LAST and only when present: an undefined `audit` is dropped by
    // JSON.stringify, so reports signed before the audit existed still verify.
    // Sub-fields are projected explicitly so adding to the audit types later
    // cannot silently change what gets signed.
    audit: r.audit
      ? {
          status: r.audit.status,
          properties: r.audit.properties.map((p) => ({
            id: p.id,
            title: p.title,
            status: p.status,
            findings: p.findings.map((f) => ({ service: f.service, verdict: f.verdict, detail: f.detail })),
          })),
          summary: r.audit.summary,
        }
      : undefined,
  })
}

function safeParseCompose(yaml: string): unknown {
  try {
    return parseYaml(yaml)
  } catch {
    return {}
  }
}

/**
 * Build the report body from a stack's generated compose. Deterministic, no
 * signing, no IO — the structural kill-switch verdict + the compose hash.
 */
export function buildReport(input: {
  reportId: string
  stackId: string
  stackName: string
  composeYaml: string
  issuedAt: string
}): VerifiedDeployReport {
  const parsed = safeParseCompose(input.composeYaml)
  const verdict = verifyComposeKillSwitch(parsed)
  return {
    version: 1,
    reportId: input.reportId,
    stackId: input.stackId,
    stackName: input.stackName,
    product: 'verified-deploy',
    composeSha256: sha256Hex(input.composeYaml),
    status: verdict.status,
    findings: verdict.findings,
    summary: verdict.summary,
    audit: auditCompose(parsed),
    issuedAt: input.issuedAt,
    issuer: 'Stapelwerk',
  }
}

/** Sign the canonical report with an ed25519 PEM private key; base64 signature. */
export function signReport(report: VerifiedDeployReport, privateKeyPem: string): string {
  const key = crypto.createPrivateKey(privateKeyPem)
  // ed25519: the algorithm argument MUST be null (Node signs over the raw message).
  const sig = crypto.sign(null, Buffer.from(canonicalReport(report)), key)
  return sig.toString('base64')
}

/** Verify a report's signature with the ed25519 PEM public key. */
export function verifyReportSignature(
  report: VerifiedDeployReport,
  signatureB64: string,
  publicKeyPem: string,
): boolean {
  try {
    const key = crypto.createPublicKey(publicKeyPem)
    return crypto.verify(null, Buffer.from(canonicalReport(report)), key, Buffer.from(signatureB64, 'base64'))
  } catch {
    return false
  }
}

/** Derive the publishable ed25519 public key (SPKI PEM) from the private key. */
export function publicKeyFromPrivate(privateKeyPem: string): string {
  return crypto
    .createPublicKey(privateKeyPem)
    .export({ type: 'spki', format: 'pem' })
    .toString()
}

/** Generate a fresh ed25519 keypair (PEM) — used to mint the launch signing key. */
export function generateSigningKeypair(): { privateKeyPem: string; publicKeyPem: string } {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519')
  return {
    privateKeyPem: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
    publicKeyPem: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
  }
}
