#!/usr/bin/env tsx

/**
 * Bundle Size Analysis Script
 *
 * Analyzes Next.js build output and reports bundle sizes.
 * Ensures bundle sizes stay within performance budgets.
 *
 * Usage:
 * ```bash
 * npm run build && tsx scripts/analyze-bundle.ts
 * ```
 *
 * Performance Budgets:
 * - Initial JS: ≤ 150KB (gzipped)
 * - Initial CSS: ≤ 30KB (gzipped)
 * - Total First Load: ≤ 200KB (gzipped)
 * - Individual chunks: ≤ 50KB (gzipped)
 */

import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { gzipSync } from 'zlib'

interface BundleInfo {
  path: string
  size: number
  gzipSize: number
}

interface BundleAnalysis {
  js: BundleInfo[]
  css: BundleInfo[]
  totalJsSize: number
  totalCssSize: number
  totalJsGzip: number
  totalCssGzip: number
  largestBundle: BundleInfo | null
  withinBudget: boolean
  warnings: string[]
}

// Performance budgets (in KB)
const BUDGETS = {
  initialJs: 150,
  initialCss: 30,
  totalFirstLoad: 200,
  individualChunk: 50,
}

function getFileSize(filePath: string): { size: number; gzipSize: number } {
  try {
    const content = readFileSync(filePath)
    const size = content.length
    const gzipSize = gzipSync(content).length

    return {
      size,
      gzipSize,
    }
  } catch (error) {
    return { size: 0, gzipSize: 0 }
  }
}

function formatBytes(bytes: number): string {
  return `${(bytes / 1024).toFixed(2)} KB`
}

function analyzeBundles(): BundleAnalysis {
  const buildDir = join(process.cwd(), '.next')

  if (!existsSync(buildDir)) {
    console.error('❌ Build directory not found. Run `npm run build` first.')
    process.exit(1)
  }

  const buildManifestPath = join(buildDir, 'build-manifest.json')

  if (!existsSync(buildManifestPath)) {
    console.error('❌ Build manifest not found.')
    process.exit(1)
  }

  const buildManifest = JSON.parse(readFileSync(buildManifestPath, 'utf-8'))

  const analysis: BundleAnalysis = {
    js: [],
    css: [],
    totalJsSize: 0,
    totalCssSize: 0,
    totalJsGzip: 0,
    totalCssGzip: 0,
    largestBundle: null,
    withinBudget: true,
    warnings: [],
  }

  // Analyze all pages
  const pages = Object.keys(buildManifest.pages)

  for (const page of pages) {
    const assets = buildManifest.pages[page] as string[]

    for (const asset of assets) {
      const assetPath = join(buildDir, asset)

      if (existsSync(assetPath)) {
        const { size, gzipSize } = getFileSize(assetPath)

        const bundleInfo: BundleInfo = {
          path: asset,
          size,
          gzipSize,
        }

        if (asset.endsWith('.js')) {
          analysis.js.push(bundleInfo)
          analysis.totalJsSize += size
          analysis.totalJsGzip += gzipSize
        } else if (asset.endsWith('.css')) {
          analysis.css.push(bundleInfo)
          analysis.totalCssSize += size
          analysis.totalCssGzip += gzipSize
        }

        // Track largest bundle
        if (!analysis.largestBundle || gzipSize > analysis.largestBundle.gzipSize) {
          analysis.largestBundle = bundleInfo
        }

        // Check individual chunk budget
        if (gzipSize / 1024 > BUDGETS.individualChunk) {
          analysis.warnings.push(
            `⚠️  Large chunk: ${asset} (${formatBytes(gzipSize)} gzipped)`
          )
          analysis.withinBudget = false
        }
      }
    }
  }

  // Check budgets
  const totalFirstLoadGzip = analysis.totalJsGzip + analysis.totalCssGzip

  if (analysis.totalJsGzip / 1024 > BUDGETS.initialJs) {
    analysis.warnings.push(
      `⚠️  JS budget exceeded: ${formatBytes(analysis.totalJsGzip)} > ${BUDGETS.initialJs} KB`
    )
    analysis.withinBudget = false
  }

  if (analysis.totalCssGzip / 1024 > BUDGETS.initialCss) {
    analysis.warnings.push(
      `⚠️  CSS budget exceeded: ${formatBytes(analysis.totalCssGzip)} > ${BUDGETS.initialCss} KB`
    )
    analysis.withinBudget = false
  }

  if (totalFirstLoadGzip / 1024 > BUDGETS.totalFirstLoad) {
    analysis.warnings.push(
      `⚠️  Total first load budget exceeded: ${formatBytes(totalFirstLoadGzip)} > ${BUDGETS.totalFirstLoad} KB`
    )
    analysis.withinBudget = false
  }

  return analysis
}

function printReport(analysis: BundleAnalysis): void {
  console.log('\n📦 Bundle Size Analysis\n')
  console.log('=' .repeat(60))

  // Summary
  console.log('\n📊 Summary:')
  console.log(`Total JS: ${formatBytes(analysis.totalJsSize)} (${formatBytes(analysis.totalJsGzip)} gzipped)`)
  console.log(`Total CSS: ${formatBytes(analysis.totalCssSize)} (${formatBytes(analysis.totalCssGzip)} gzipped)`)
  console.log(
    `Total First Load: ${formatBytes(analysis.totalJsGzip + analysis.totalCssGzip)} gzipped`
  )

  if (analysis.largestBundle) {
    console.log(
      `\nLargest Bundle: ${analysis.largestBundle.path} (${formatBytes(analysis.largestBundle.gzipSize)} gzipped)`
    )
  }

  // Budgets
  console.log('\n💰 Budget Status:')
  console.log(
    `JS: ${formatBytes(analysis.totalJsGzip)} / ${BUDGETS.initialJs} KB ${analysis.totalJsGzip / 1024 <= BUDGETS.initialJs ? '✅' : '❌'}`
  )
  console.log(
    `CSS: ${formatBytes(analysis.totalCssGzip)} / ${BUDGETS.initialCss} KB ${analysis.totalCssGzip / 1024 <= BUDGETS.initialCss ? '✅' : '❌'}`
  )
  console.log(
    `Total: ${formatBytes(analysis.totalJsGzip + analysis.totalCssGzip)} / ${BUDGETS.totalFirstLoad} KB ${(analysis.totalJsGzip + analysis.totalCssGzip) / 1024 <= BUDGETS.totalFirstLoad ? '✅' : '❌'}`
  )

  // Top 5 largest bundles
  const sortedBundles = [...analysis.js, ...analysis.css].sort(
    (a, b) => b.gzipSize - a.gzipSize
  )

  console.log('\n📦 Top 5 Largest Bundles:')
  sortedBundles.slice(0, 5).forEach((bundle, index) => {
    console.log(
      `${index + 1}. ${bundle.path} - ${formatBytes(bundle.size)} (${formatBytes(bundle.gzipSize)} gzipped)`
    )
  })

  // Warnings
  if (analysis.warnings.length > 0) {
    console.log('\n⚠️  Warnings:')
    analysis.warnings.forEach((warning) => console.log(warning))
  }

  // Final status
  console.log('\n' + '='.repeat(60))
  if (analysis.withinBudget) {
    console.log('✅ All bundles within budget!')
  } else {
    console.log('❌ Some bundles exceed budget. Consider code splitting or optimization.')
  }
  console.log('=' + '='.repeat(59) + '\n')

  // Exit with error if over budget
  if (!analysis.withinBudget) {
    process.exit(1)
  }
}

// Run analysis
const analysis = analyzeBundles()
printReport(analysis)
