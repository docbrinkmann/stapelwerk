#!/usr/bin/env tsx
import fs from 'node:fs'
import process from 'node:process'
import { PolicyEvaluator } from '@/lib/security/policy/evaluator'

async function main() {
  const inputPath = process.argv[2] || 'policy-input.json'
  if (!fs.existsSync(inputPath)) {
    console.error(`Input file not found: ${inputPath}`)
    process.exit(2)
  }
  const input = JSON.parse(fs.readFileSync(inputPath, 'utf8'))
  const result = await PolicyEvaluator.evaluate(input)
  console.log(JSON.stringify({ result }, null, 2))
  if (result.outcome === 'deny') process.exit(1)
}

main().catch((e) => { console.error(e); process.exit(2) })