const fs = require('fs');
const path = require('path');

// Generate slug from name
function generateSlug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove invalid characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
}

// Find all TypeScript test files
function findTestFiles(dir) {
  const files = [];
  const items = fs.readdirSync(dir);
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory() && !item.includes('node_modules') && !item.includes('.git')) {
      files.push(...findTestFiles(fullPath));
    } else if (item.endsWith('.test.ts') || item.endsWith('.test.tsx')) {
      files.push(fullPath);
    }
  }
  
  return files;
}

// Process a single file
function processFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  let newContent = content;

  // Pattern 1: caller.categories.create({ with named parameters
  const callerPattern = /caller\.categories\.create\(\s*\{\s*([\s\S]*?)\}\s*\)/g;
  newContent = newContent.replace(callerPattern, (match, params) => {
    // Check if slug is already present
    if (params.includes('slug:')) {
      return match; // Already has slug, don't modify
    }
    
    // Extract name value
    const nameMatch = params.match(/name:\s*['"`]([^'"`]*)['"`]/);
    if (!nameMatch) {
      return match; // No name found, can't generate slug
    }
    
    const name = nameMatch[1];
    const slug = generateSlug(name);
    
    // Add slug after name
    const updatedParams = params.replace(
      /name:\s*['"`][^'"`]*['"`]/,
      `$&,\n        slug: '${slug}'`
    );
    
    modified = true;
    return `caller.categories.create({\n        ${updatedParams}\n      })`;
  });

  // Pattern 2: Direct category creation patterns
  const directPattern = /(?:await\s+)?(?:\w+\.)?categories\.create\s*\(\s*\{\s*([\s\S]*?)\}\s*\)/g;
  newContent = newContent.replace(directPattern, (match, params) => {
    // Skip if this is already the caller pattern we processed above
    if (match.includes('caller.categories.create')) {
      return match;
    }
    
    // Check if slug is already present
    if (params.includes('slug:')) {
      return match;
    }
    
    // Extract name value
    const nameMatch = params.match(/name:\s*['"`]([^'"`]*)['"`]/);
    if (!nameMatch) {
      return match;
    }
    
    const name = nameMatch[1];
    const slug = generateSlug(name);
    
    // Add slug after name
    const updatedParams = params.replace(
      /name:\s*['"`][^'"`]*['"`]/,
      `$&,\n        slug: '${slug}'`
    );
    
    modified = true;
    return match.replace(params, updatedParams);
  });

  // Pattern 3: Inline object creation for category
  const inlinePattern = /\{\s*name:\s*['"`]([^'"`]*)['"`]\s*,\s*description:\s*['"`][^'"`]*['"`]\s*,\s*sortOrder:\s*\d+\s*(?:,\s*icon:\s*[^}]*)?\s*\}/g;
  newContent = newContent.replace(inlinePattern, (match) => {
    // Skip if slug is already present
    if (match.includes('slug:')) {
      return match;
    }
    
    const nameMatch = match.match(/name:\s*['"`]([^'"`]*)['"`]/);
    if (!nameMatch) {
      return match;
    }
    
    const name = nameMatch[1];
    const slug = generateSlug(name);
    
    // Insert slug after name
    const updated = match.replace(
      /name:\s*['"`][^'"`]*['"`]/,
      `$&,\n        slug: '${slug}'`
    );
    
    modified = true;
    return updated;
  });

  if (modified) {
    fs.writeFileSync(filePath, newContent);
    return true;
  }
  
  return false;
}

// Main execution
function main() {
  const srcDir = path.join(__dirname, 'src');
  const testFiles = findTestFiles(srcDir);
  
  let totalFixed = 0;
  let filesModified = 0;
  
  console.log(`Found ${testFiles.length} test files to process...`);
  
  for (const filePath of testFiles) {
    const relativePath = path.relative(__dirname, filePath);
    
    try {
      const wasModified = processFile(filePath);
      if (wasModified) {
        filesModified++;
        console.log(`✓ Fixed slugs in: ${relativePath}`);
      } else {
        console.log(`- No changes needed: ${relativePath}`);
      }
    } catch (error) {
      console.error(`✗ Error processing ${relativePath}:`, error.message);
    }
  }
  
  console.log(`\nSummary:`);
  console.log(`- Files processed: ${testFiles.length}`);
  console.log(`- Files modified: ${filesModified}`);
  console.log(`- Total fixes applied: ${totalFixed}`);
}

if (require.main === module) {
  main();
}