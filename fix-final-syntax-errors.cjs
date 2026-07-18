#!/usr/bin/env node

const fs = require('fs')

// Track fixes applied
let totalFixes = 0

// Fix specific syntax errors by file
const fileFixes = {
  'src/__tests__/database/service-catalog-schema.test.ts': [
    // Fix expect statement line breaks
    {
      pattern: /expect\(foundService\)\.toBeDefined\(\)\s*expect\(foundService!/g,
      replacement: 'expect(foundService).toBeDefined()\n      expect(foundService!',
      description: 'Fix broken expect statement'
    },
    {
      pattern: /expect\(endTime - startTime\)\.toBeLessThan\(100\)\s*\/\/ Less than 100ms/g,
      replacement: 'expect(endTime - startTime).toBeLessThan(100) // Less than 100ms',
      description: 'Fix broken performance assertion'
    }
  ],
  
  'src/__tests__/security/comprehensive-injection-prevention.test.ts': [
    // Fix double categoryId lines
    {
      pattern: /categoryId:\s*category\.id,\s*submittedBy:\s*'security-test@example\.com',\s*categoryId:\s*category\.id/g,
      replacement: 'categoryId: category.id,\n          submittedBy: \'security-test@example.com\'',
      description: 'Fix duplicate categoryId field'
    }
  ],
  
  'src/__tests__/security/security-middleware-validation.test.ts': [
    // Fix broken test structure
    {
      pattern: /}\)\s*it\(/g,
      replacement: '})\n\n  it(',
      description: 'Fix broken test structure'
    }
  ],
  
  'src/__tests__/security/sql-injection-prevention.test.ts': [
    // Fix duplicate categoryId
    {
      pattern: /categoryId:\s*1,\s*submittedBy:\s*'test@example\.com'\s*categoryId:\s*category\.id/g,
      replacement: 'categoryId: category.id,\n          submittedBy: \'test@example.com\'',
      description: 'Fix duplicate categoryId in sql injection test'
    }
  ],
  
  'src/__tests__/trpc/categories.test.ts': [
    // Fix broken getBySlug call
    {
      pattern: /await expect\(caller\.categories\.getBySlug\(\{\s*\.rejects\.toThrow/g,
      replacement: 'await expect(caller.categories.getBySlug({ slug: \'non-existent\' })).rejects.toThrow',
      description: 'Fix broken getBySlug call'
    },
    // Fix broken try-catch structure
    {
      pattern: /try\s*\{\s*await caller\.categories\.getBySlug\(\{\s*\}\s*catch\s*\(error\)/g,
      replacement: 'try {\n        await caller.categories.getBySlug({ slug: \'non-existent\' })\n      } catch (error)',
      description: 'Fix broken try-catch'
    },
    // Fix broken test expectations
    {
      pattern: /await expect\(caller\.categories\.create\(\{\s*name:\s*'Duplicate\s*Category',\s*description:\s*'Test',\s*sortOrder:\s*1\s*\}\)\)\.rejects\.toThrow/g,
      replacement: 'await expect(caller.categories.create({\n        name: \'Duplicate Category\',\n        slug: \'duplicate-category\',\n        description: \'Test\',\n        sortOrder: 1\n      })).rejects.toThrow',
      description: 'Fix broken category create expectation'
    }
  ],
  
  'src/__tests__/trpc/services.test.ts': [
    // Fix broken expect statements
    {
      pattern: /expect\(result\)\.toEqual\(\s*expect\(/g,
      replacement: 'expect(result).toEqual(\n        expect(',
      description: 'Fix broken expect chaining'
    },
    // Fix broken getBySlug calls
    {
      pattern: /await expect\(caller\.services\.getBySlug\(\{\s*\.rejects\.toThrow/g,
      replacement: 'await expect(caller.services.getBySlug({ slug: \'non-existent\' })).rejects.toThrow',
      description: 'Fix broken getBySlug call'
    }
  ],
  
  'src/__tests__/validation/service-catalog-schemas.test.ts': [
    // Fix const declarations
    {
      pattern: /const resultWithId = ServiceUpdateSchema\.safeParse\(updateWithId\)\s*const resultWithSlug/g,
      replacement: 'const resultWithId = ServiceUpdateSchema.safeParse(updateWithId)\n      const resultWithSlug',
      description: 'Fix broken const declarations'
    },
    // Fix expect statements
    {
      pattern: /expect\(resultWithId\.success\)\.toBe\(false\)\s*expect\(resultWithSlug\.success\)/g,
      replacement: 'expect(resultWithId.success).toBe(false)\n      expect(resultWithSlug.success)',
      description: 'Fix broken expect statements'
    }
  ]
}

function fixFile(filePath) {
  const fixes = fileFixes[filePath]
  if (!fixes) return false
  
  let content = fs.readFileSync(filePath, 'utf8')
  let modified = false
  let localFixes = 0
  
  for (const fix of fixes) {
    const originalContent = content
    content = content.replace(fix.pattern, fix.replacement)
    
    if (content !== originalContent) {
      modified = true
      localFixes++
      console.log(`  ✓ Applied: ${fix.description}`)
    }
  }
  
  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8')
    totalFixes += localFixes
    return true
  }
  
  return false
}

// Apply common fixes to all remaining problematic patterns
function applyGlobalFixes() {
  console.log('🔧 Applying global syntax fixes...\n')
  
  const files = Object.keys(fileFixes)
  
  for (const filePath of files) {
    if (!fs.existsSync(filePath)) {
      console.log(`⚠️  File not found: ${filePath}`)
      continue
    }
    
    console.log(`Processing: ${filePath}`)
    
    const wasModified = fixFile(filePath)
    
    if (wasModified) {
      console.log(`  ✅ Applied fixes\n`)
    } else {
      console.log(`  ⏭️  No changes needed\n`)
    }
  }
  
  console.log(`\n📊 Summary: ${totalFixes} total fixes applied`)
  console.log('✨ Done!')
}

// Run the script
if (require.main === module) {
  applyGlobalFixes()
}