import { describe, it, expect, vi } from 'vitest'
import {
  evaluateKillSwitch,
  parseProbeOutput,
  attestKillSwitch,
  isDownloadClientImage,
  servicesFromCompose,
  composeHasDownloadClient,
  verifyComposeKillSwitch,
  isVpnImage,
  type KillSwitchProbe,
} from '../kill-switch-attestation'

const HOST_IP = '203.0.113.7'

function probe(p: Partial<KillSwitchProbe> & { service: string }): KillSwitchProbe {
  return { isDownloadClient: true, routedThroughVpn: true, reachedInternet: false, observedIp: null, ...p }
}

describe('evaluateKillSwitch', () => {
  it('verified: routed client blocked while the tunnel is down', () => {
    const a = evaluateKillSwitch([probe({ service: 'qbittorrent', reachedInternet: false })], HOST_IP)
    expect(a.status).toBe('verified')
    expect(a.findings[0].verdict).toBe('ok')
    expect(a.findings[0].detail).toMatch(/kill-switch holds/i)
  })

  it('verified: routed client reaches the internet with a different exit IP', () => {
    const a = evaluateKillSwitch(
      [probe({ service: 'qbittorrent', reachedInternet: true, observedIp: '185.65.1.2' })],
      HOST_IP,
    )
    expect(a.status).toBe('verified')
    expect(a.findings[0].verdict).toBe('ok')
  })

  it('LEAK: routed client exits with the host IP (kill-switch failed)', () => {
    const a = evaluateKillSwitch(
      [probe({ service: 'qbittorrent', reachedInternet: true, observedIp: HOST_IP })],
      HOST_IP,
    )
    expect(a.status).toBe('leak')
    expect(a.findings[0].verdict).toBe('leak')
    expect(a.summary).toMatch(/LEAK/)
  })

  it('LEAK: a download client not routed through any VPN reaches the internet', () => {
    const a = evaluateKillSwitch(
      [probe({ service: 'transmission', routedThroughVpn: false, reachedInternet: true, observedIp: HOST_IP })],
      HOST_IP,
    )
    expect(a.status).toBe('leak')
    expect(a.findings[0].detail).toMatch(/not routed through a VPN/i)
  })

  it('skips non-download-client services (jellyfin, sonarr)', () => {
    const a = evaluateKillSwitch(
      [
        probe({ service: 'jellyfin', isDownloadClient: false }),
        probe({ service: 'qbittorrent', reachedInternet: false }),
      ],
      HOST_IP,
    )
    expect(a.findings.find(f => f.service === 'jellyfin')?.verdict).toBe('skip')
    expect(a.status).toBe('verified')
  })

  it('inconclusive when nothing could be probed', () => {
    expect(evaluateKillSwitch([], HOST_IP).status).toBe('inconclusive')
  })
})

describe('parseProbeOutput', () => {
  it('reads an IP, treats BLOCKED/empty as no internet', () => {
    expect(parseProbeOutput('185.65.1.2\n')).toEqual({ reachedInternet: true, observedIp: '185.65.1.2' })
    expect(parseProbeOutput('__BLOCKED__')).toEqual({ reachedInternet: false, observedIp: null })
    expect(parseProbeOutput('   ')).toEqual({ reachedInternet: false, observedIp: null })
    expect(parseProbeOutput('garbage')).toEqual({ reachedInternet: false, observedIp: null })
  })
})

describe('isDownloadClientImage', () => {
  it('matches the known clients, not the players', () => {
    expect(isDownloadClientImage('lscr.io/linuxserver/qbittorrent:latest')).toBe(true)
    expect(isDownloadClientImage('transmission')).toBe(true)
    expect(isDownloadClientImage('jellyfin/jellyfin')).toBe(false)
  })
})

describe('servicesFromCompose', () => {
  const compose = {
    services: {
      gluetun: { image: 'qmcgaw/gluetun' },
      qbittorrent: { image: 'lscr.io/linuxserver/qbittorrent', network_mode: 'service:gluetun' },
      jellyfin: { image: 'jellyfin/jellyfin', networks: ['appnet'] },
    },
  }
  it('extracts name, image, and VPN-routing per service', () => {
    const svcs = servicesFromCompose(compose)
    expect(svcs.find(s => s.service === 'qbittorrent')).toEqual({
      service: 'qbittorrent', image: 'lscr.io/linuxserver/qbittorrent', routedThroughVpn: true,
    })
    expect(svcs.find(s => s.service === 'jellyfin')?.routedThroughVpn).toBe(false)
  })
  it('detects a download client in the project', () => {
    expect(composeHasDownloadClient(compose)).toBe(true)
    expect(composeHasDownloadClient({ services: { jellyfin: { image: 'jellyfin/jellyfin' } } })).toBe(false)
  })
})

describe('isVpnImage', () => {
  it('matches VPN gateways, not media apps or clients', () => {
    expect(isVpnImage('qmcgaw/gluetun:latest')).toBe(true)
    expect(isVpnImage('service:wireguard')).toBe(true)
    expect(isVpnImage('jellyfin/jellyfin')).toBe(false)
    expect(isVpnImage('lscr.io/linuxserver/qbittorrent')).toBe(false)
  })
})

describe('verifyComposeKillSwitch (static, by-construction)', () => {
  it('leak-proof: a download client confined to a VPN gateway via network_mode', () => {
    const v = verifyComposeKillSwitch({
      services: {
        gluetun: { image: 'qmcgaw/gluetun' },
        qbittorrent: { image: 'lscr.io/linuxserver/qbittorrent', network_mode: 'service:gluetun' },
        jellyfin: { image: 'jellyfin/jellyfin', networks: ['appnet'] },
      },
    })
    expect(v.status).toBe('leak-proof')
    expect(v.findings.find((f) => f.service === 'qbittorrent')?.verdict).toBe('ok')
    expect(v.summary).toMatch(/leak-proof by construction/i)
  })

  it('LEAK: a download client with no network_mode (uses the real IP)', () => {
    const v = verifyComposeKillSwitch({
      services: { qbittorrent: { image: 'lscr.io/linuxserver/qbittorrent', networks: ['appnet'] } },
    })
    expect(v.status).toBe('leak')
    expect(v.findings[0].detail).toMatch(/not routed through a VPN/i)
    expect(v.summary).toMatch(/LEAK by construction/)
  })

  it('LEAK: a download client routed into a NON-VPN service (network_mode: service:jellyfin)', () => {
    const v = verifyComposeKillSwitch({
      services: {
        jellyfin: { image: 'jellyfin/jellyfin' },
        transmission: { image: 'transmission', network_mode: 'service:jellyfin' },
      },
    })
    expect(v.status).toBe('leak')
    expect(v.findings[0].detail).toMatch(/not a VPN gateway/i)
  })

  it('no-download-client: nothing to confine (jellyfin + sonarr only)', () => {
    const v = verifyComposeKillSwitch({
      services: { jellyfin: { image: 'jellyfin/jellyfin' }, sonarr: { image: 'lscr.io/linuxserver/sonarr' } },
    })
    expect(v.status).toBe('no-download-client')
    expect(v.findings).toHaveLength(0)
  })

  it('routed-no-killswitch: gluetun with FIREWALL=off (the kill-switch is disabled)', () => {
    const v = verifyComposeKillSwitch({
      services: {
        gluetun: { image: 'qmcgaw/gluetun', environment: { FIREWALL: 'off' } },
        qbittorrent: { image: 'lscr.io/linuxserver/qbittorrent', network_mode: 'service:gluetun' },
      },
    })
    expect(v.status).toBe('routed-no-killswitch')
    expect(v.findings[0].verdict).toBe('warn')
    expect(v.findings[0].detail).toMatch(/FIREWALL=off/)
  })

  it('routed-no-killswitch: a bare wireguard gateway has no built-in kill-switch', () => {
    const v = verifyComposeKillSwitch({
      services: {
        wg: { image: 'linuxserver/wireguard' },
        transmission: { image: 'transmission', network_mode: 'service:wg' },
      },
    })
    expect(v.status).toBe('routed-no-killswitch')
    expect(v.findings[0].detail).toMatch(/no built-in kill-switch/i)
  })

  it('leak-proof: gluetun with the firewall on (env as a list, no FIREWALL=off)', () => {
    const v = verifyComposeKillSwitch({
      services: {
        gluetun: { image: 'qmcgaw/gluetun', environment: ['VPN_TYPE=wireguard'] },
        qbittorrent: { image: 'qbittorrent', network_mode: 'service:gluetun' },
      },
    })
    expect(v.status).toBe('leak-proof')
    expect(v.findings[0].verdict).toBe('ok')
  })

  it('recognises newer clients too (slskd), not just the classic six', () => {
    expect(isDownloadClientImage('slskd/slskd')).toBe(true)
    const v = verifyComposeKillSwitch({ services: { slskd: { image: 'slskd/slskd', networks: ['appnet'] } } })
    expect(v.status).toBe('leak')
  })
})

describe('attestKillSwitch (docker IO wired to a mock)', () => {
  it('probes each download client container and attests verified when blocked', async () => {
    const exec = vi.fn(async (args: string[]) => {
      // qbittorrent is routed through a down tunnel → wget fails → BLOCKED.
      expect(args[0]).toBe('exec')
      expect(args[1]).toBe('bms-abc-qbittorrent-1')
      return { stdout: '__BLOCKED__', exitCode: 0 }
    })
    const a = await attestKillSwitch({
      project: 'bms-abc',
      services: [
        { service: 'gluetun', image: 'qmcgaw/gluetun', routedThroughVpn: false },
        { service: 'qbittorrent', image: 'lscr.io/linuxserver/qbittorrent', routedThroughVpn: true },
        { service: 'jellyfin', image: 'jellyfin/jellyfin', routedThroughVpn: false },
      ],
      exec,
      fetchHostIp: async () => HOST_IP,
    })
    expect(a.status).toBe('verified')
    // Only the download client was exec-probed (gluetun + jellyfin skipped).
    expect(exec).toHaveBeenCalledTimes(1)
  })

  it('flags a leak when a routed client returns the host IP', async () => {
    const exec = vi.fn(async () => ({ stdout: `${HOST_IP}\n`, exitCode: 0 }))
    const a = await attestKillSwitch({
      project: 'bms-abc',
      services: [{ service: 'qbittorrent', image: 'qbittorrent', routedThroughVpn: true }],
      exec,
      fetchHostIp: async () => HOST_IP,
    })
    expect(a.status).toBe('leak')
  })

  it('throws (never false-verifies) when docker exec fails — no socket', async () => {
    const exec = vi.fn(async () => ({ stdout: '', exitCode: 127 }))
    await expect(attestKillSwitch({
      project: 'bms-abc',
      services: [{ service: 'qbittorrent', image: 'qbittorrent', routedThroughVpn: true }],
      exec,
      fetchHostIp: async () => HOST_IP,
    })).rejects.toThrow(/could not probe/)
  })
})
