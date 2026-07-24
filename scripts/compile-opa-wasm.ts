#!/usr/bin/env tsx
/*
 * Compile OPA Rego policies to WASM bundles.
 * Requires the `opa` CLI in PATH: https://www.openpolicyagent.org/
 *
 * Usage:
 *   npm run build:opa:wasm            # compile all policies under policies/rego
 *   npm run build:opa:wasm -- p3_warn_high.rego  # compile a specific file
 */

import { execFile } from 'node:child_process'
import { mkdir, readdir, readFile } from 'node:fs/promises'
import { dirname, join, basename } from 'node:path'

function run(cmd: string, args: string[], cwd?: string): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const cp = execFile(cmd, args, { cwd }, (err, stdout, stderr) => {
      if (err) return reject(Object.assign(err, { stdout, stderr }))
      resolve({ stdout: String(stdout), stderr: String(stderr) })
    })
    cp.on('error', reject)
  })
}

async function detectPackage(regoPath: string): Promise<string | null> {
  const src = await readFile(regoPath, 'utf8')
  const m = src.match(/^\s*package\s+([A-Za-z0-9_\.]+)\s*$/m)
  return m ? m[1] : null
}

function ruleForFile(file: string): 'deny' | 'warn' | 'decision' {
  const name = basename(file).toLowerCase()
  if (name.includes('warn')) return 'warn'
  return 'deny'
}

async function compileOne(regoPath: string): Promise<{ wasmPath: string; entrypoint: string }> {
  const pkg = (await detectPackage(regoPath)) || 'policy'
  const rule = ruleForFile(regoPath)
  const outDir = join(process.cwd(), 'policies', 'wasm')
  await mkdir(outDir, { recursive: true })
  const base = basename(regoPath).replace(/\.rego$/, '')
  const wasmOut = join(outDir, `${base}.wasm`)

  // opa expects entrypoints in data.<package>.<rule> form
  const entryDataPath = `data.${pkg}.${rule}`
  const args = ['build', '-t', 'wasm', '-e', entryDataPath, '-o', wasmOut, regoPath]
  await run('opa', args)

  // Runtime entrypoint name is the slash form
  const runtimeEntrypoint = `${pkg.replace(/\./g, '/')}/${rule}`
  return { wasmPath: wasmOut, entrypoint: runtimeEntrypoint }
}

async function main() {
  const regoDir = join(process.cwd(), 'policies', 'rego')
  const only = process.argv.slice(process.argv.indexOf('--') + 1).filter(Boolean)
  const entries = (await readdir(regoDir)).filter(f => f.endsWith('.rego'))
  const files = only.length ? entries.filter(e => only.includes(e)) : entries

  if (files.length === 0) {
    console.log('No .rego files found to compile.')
    return
  }

  const results: Record<string, { wasmPath: string; entrypoint: string }> = {}
  for (const f of files) {
    const full = join(regoDir, f)
    try {
      const res = await compileOne(full)
      results[f] = res
      console.log(`✅ ${f} -> ${res.wasmPath} (entrypoint: ${res.entrypoint})`)
    } catch (e: any) {
      if (e?.code === 'ENOENT') {
        console.error('❌ `opa` CLI not found in PATH. Install from https://www.openpolicyagent.org/docs/latest/#running-opa')
        process.exit(1)
      }
      console.error(`❌ Failed to compile ${f}:`, e?.stderr || e?.message || e)
      process.exitCode = 1
    }
  }

  console.log('\nDefinition JSON you can use in PolicyTemplate.definition:')
  for (const [file, { wasmPath, entrypoint }] of Object.entries(results)) {
    console.log(JSON.stringify({ type: 'opa-wasm', wasmPath, entrypoint, mode: ruleForFile(file) === 'warn' ? 'warn' : 'deny' }))
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
