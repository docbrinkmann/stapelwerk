import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { runComposeViaBridge } from '../deploy-bridge'

/** Build a web ReadableStream that emits the given raw chunks (as bytes). */
function ndjsonStream(chunks: string[]): ReadableStream<Uint8Array> {
  const enc = new TextEncoder()
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const c of chunks) controller.enqueue(enc.encode(c))
      controller.close()
    },
  })
}

function mockFetch(chunks: string[], init?: { ok?: boolean; status?: number }): void {
  global.fetch = vi.fn(async () => ({
    ok: init?.ok ?? true,
    status: init?.status ?? 200,
    statusText: 'OK',
    body: ndjsonStream(chunks),
    text: async () => chunks.join(''),
  })) as unknown as typeof fetch
}

describe('runComposeViaBridge', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    process.env.DEPLOY_BRIDGE_TOKEN = 'test-secret'
  })
  afterEach(() => {
    global.fetch = originalFetch
    delete process.env.DEPLOY_BRIDGE_TOKEN
    delete process.env.DEPLOY_BRIDGE_URL
    vi.restoreAllMocks()
  })

  it('parses the NDJSON stream, calls onLog per line, and returns the exitCode', async () => {
    // Deliberately split JSON objects across chunk boundaries to prove buffering.
    mockFetch([
      '{"log":"$ docker compose -p bms-abc up -d"}\n{"log":"Con',
      'tainer web-1  Started"}\n',
      '{"exitCode":0}\n',
    ])

    const lines: string[] = []
    const result = await runComposeViaBridge({
      project: 'bms-abc',
      composeYaml: 'services:\n  web:\n    image: nginx\n',
      action: 'up',
      onLog: (l) => lines.push(l),
      baseUrl: 'http://ws.test:3001',
    })

    expect(result.exitCode).toBe(0)
    expect(lines).toEqual([
      '$ docker compose -p bms-abc up -d',
      'Container web-1  Started',
    ])

    // POSTs to /deploy with the bearer token and JSON body.
    const call = (global.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(call[0]).toBe('http://ws.test:3001/deploy')
    expect(call[1].method).toBe('POST')
    expect(call[1].headers.Authorization).toBe('Bearer test-secret')
    const sent = JSON.parse(call[1].body)
    expect(sent).toMatchObject({ project: 'bms-abc', action: 'up' })
    expect(sent.composeYaml).toContain('nginx')
  })

  it('surfaces a bridge error line and returns the reported non-zero exitCode', async () => {
    mockFetch([
      '{"log":"Error response from daemon: boom"}\n',
      '{"exitCode":1,"error":"docker compose failed"}\n',
    ])

    const lines: string[] = []
    const result = await runComposeViaBridge({
      project: 'bms-xyz',
      composeYaml: 'services: {}\n',
      action: 'up',
      onLog: (l) => lines.push(l),
      baseUrl: 'http://ws.test:3001',
    })

    expect(result.exitCode).toBe(1)
    expect(lines).toContain('Error response from daemon: boom')
    expect(lines.some((l) => l.includes('docker compose failed'))).toBe(true)
  })

  it('defaults to exitCode 1 when the stream ends without an exitCode line', async () => {
    mockFetch(['{"log":"partial output"}\n'])
    const result = await runComposeViaBridge({
      project: 'bms-abc',
      composeYaml: '',
      action: 'down',
      onLog: () => undefined,
      baseUrl: 'http://ws.test:3001',
    })
    expect(result.exitCode).toBe(1)
  })

  it('throws when the bridge responds non-2xx', async () => {
    mockFetch(['Unauthorized'], { ok: false, status: 401 })
    await expect(
      runComposeViaBridge({
        project: 'bms-abc',
        composeYaml: '',
        action: 'up',
        onLog: () => undefined,
        baseUrl: 'http://ws.test:3001',
      }),
    ).rejects.toThrow(/401/)
  })

  it('throws (without calling fetch) when the token is not configured', async () => {
    delete process.env.DEPLOY_BRIDGE_TOKEN
    const fetchSpy = vi.fn()
    global.fetch = fetchSpy as unknown as typeof fetch
    await expect(
      runComposeViaBridge({
        project: 'bms-abc',
        composeYaml: '',
        action: 'up',
        onLog: () => undefined,
        baseUrl: 'http://ws.test:3001',
      }),
    ).rejects.toThrow(/DEPLOY_BRIDGE_TOKEN/)
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
