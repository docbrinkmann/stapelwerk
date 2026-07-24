import { describe, it, expect } from 'vitest'
import {
  buildReport,
  canonicalReport,
  signReport,
  verifyReportSignature,
  publicKeyFromPrivate,
  generateSigningKeypair,
  reportHasBlockingFailure,
  sha256Hex,
} from '../verified-deploy-report'

const LEAK_PROOF_COMPOSE = `services:
  gluetun:
    image: qmcgaw/gluetun:latest
    cap_add: [NET_ADMIN]
  qbittorrent:
    image: lscr.io/linuxserver/qbittorrent:latest
    network_mode: service:gluetun
`

const LEAKING_COMPOSE = `services:
  qbittorrent:
    image: lscr.io/linuxserver/qbittorrent:latest
    networks: [appnet]
`

// No download client, but a datastore published to the host with no volume —
// the safety audit fails even though the kill-switch is n/a.
const UNSAFE_DB_COMPOSE = `services:
  db:
    image: postgres:18-alpine
    ports: ["5432:5432"]
`

const base = { reportId: 'rep-1', stackId: 'stack-1', stackName: 'My Media Server', issuedAt: '2026-07-20T00:00:00.000Z' }

describe('buildReport', () => {
  it('attests leak-proof for a compose that confines the client to the VPN', () => {
    const r = buildReport({ ...base, composeYaml: LEAK_PROOF_COMPOSE })
    expect(r.status).toBe('leak-proof')
    expect(r.findings.find((f) => f.service === 'qbittorrent')?.verdict).toBe('ok')
    expect(r.composeSha256).toBe(sha256Hex(LEAK_PROOF_COMPOSE))
    expect(r.issuer).toBe('BuildMyStack')
  })

  it('attests leak for a compose that does not confine the client', () => {
    const r = buildReport({ ...base, composeYaml: LEAKING_COMPOSE })
    expect(r.status).toBe('leak')
    expect(r.summary).toMatch(/LEAK by construction/)
  })

  it('is deterministic: same compose → same canonical report', () => {
    const a = buildReport({ ...base, composeYaml: LEAK_PROOF_COMPOSE })
    const b = buildReport({ ...base, composeYaml: LEAK_PROOF_COMPOSE })
    expect(canonicalReport(a)).toBe(canonicalReport(b))
  })

  it('attaches the safety audit and blocks on a fixable failure', () => {
    const r = buildReport({ ...base, composeYaml: UNSAFE_DB_COMPOSE })
    // Kill-switch is n/a (no download client) but the audit fails.
    expect(r.status).toBe('no-download-client')
    expect(r.audit?.status).toBe('fail')
    const exposed = r.audit?.properties.find((p) => p.id === 'exposed-datastore-port')
    expect(exposed?.status).toBe('fail')
    // A fixable failure must NOT let the €29 credit be consumed.
    expect(reportHasBlockingFailure(r)).toBe(true)
  })

  it('reportHasBlockingFailure: kill-switch leak blocks; a clean/advisory report does not', () => {
    expect(reportHasBlockingFailure(buildReport({ ...base, composeYaml: LEAKING_COMPOSE }))).toBe(true)
    // LEAK_PROOF_COMPOSE: kill-switch ok, audit only warns (unpinned :latest) → not blocking.
    const clean = buildReport({ ...base, composeYaml: LEAK_PROOF_COMPOSE })
    expect(clean.audit?.status).not.toBe('fail')
    expect(reportHasBlockingFailure(clean)).toBe(false)
  })
})

describe('signReport / verifyReportSignature (ed25519)', () => {
  it('signs and verifies a report round-trip with the derived public key', () => {
    const { privateKeyPem } = generateSigningKeypair()
    const publicKeyPem = publicKeyFromPrivate(privateKeyPem)
    const r = buildReport({ ...base, composeYaml: LEAK_PROOF_COMPOSE })
    const sig = signReport(r, privateKeyPem)
    expect(sig).toMatch(/^[A-Za-z0-9+/]+=*$/) // base64
    expect(verifyReportSignature(r, sig, publicKeyPem)).toBe(true)
  })

  it('rejects a tampered report (findings flipped after signing)', () => {
    const { privateKeyPem, publicKeyPem } = generateSigningKeypair()
    const r = buildReport({ ...base, composeYaml: LEAK_PROOF_COMPOSE })
    const sig = signReport(r, privateKeyPem)
    const tampered = { ...r, status: 'leak-proof' as const, summary: 'forged — actually leaks' }
    expect(verifyReportSignature(tampered, sig, publicKeyPem)).toBe(false)
  })

  it('signs the audit too: flipping an audit field fails verification', () => {
    const { privateKeyPem, publicKeyPem } = generateSigningKeypair()
    const r = buildReport({ ...base, composeYaml: UNSAFE_DB_COMPOSE })
    const sig = signReport(r, privateKeyPem)
    expect(verifyReportSignature(r, sig, publicKeyPem)).toBe(true)
    const forged = { ...r, audit: { ...r.audit!, status: 'pass' as const } }
    expect(verifyReportSignature(forged, sig, publicKeyPem)).toBe(false)
  })

  it('backward-compat: a report signed WITHOUT an audit still verifies (undefined drops out of canonical form)', () => {
    const { privateKeyPem, publicKeyPem } = generateSigningKeypair()
    const withAudit = buildReport({ ...base, composeYaml: LEAK_PROOF_COMPOSE })
    // Simulate a report row from before the audit field existed.
    const legacy = { ...withAudit, audit: undefined }
    expect(canonicalReport(legacy)).not.toContain('audit')
    const sig = signReport(legacy, privateKeyPem)
    expect(verifyReportSignature(legacy, sig, publicKeyPem)).toBe(true)
  })

  it('rejects a signature from a different key', () => {
    const a = generateSigningKeypair()
    const b = generateSigningKeypair()
    const r = buildReport({ ...base, composeYaml: LEAK_PROOF_COMPOSE })
    const sig = signReport(r, a.privateKeyPem)
    expect(verifyReportSignature(r, sig, b.publicKeyPem)).toBe(false)
  })

  it('verify returns false (never throws) on a malformed key', () => {
    const r = buildReport({ ...base, composeYaml: LEAK_PROOF_COMPOSE })
    expect(verifyReportSignature(r, 'AAAA', 'not-a-key')).toBe(false)
  })
})
