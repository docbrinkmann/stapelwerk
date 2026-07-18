const fs = require('fs');
const path = require('path');

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

function generateSlug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove invalid characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
}

// Process a single file
function processFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  let newContent = content;

  // Fix category.create calls missing slug field
  const categoryPattern = /caller\.categories\.create\(\s*\{\s*name:\s*['"`]([^'"`]*)['"`][\s\S]*?\}\s*\)/g;
  newContent = newContent.replace(categoryPattern, (match, name) => {
    if (match.includes('slug:')) {
      return match; // Already has slug
    }
    
    const slug = generateSlug(name);
    // Add slug after name
    const updated = match.replace(
      /(name:\s*['"`][^'"`]*['"`])/,
      `$1,\n        slug: '${slug}'`
    );
    
    if (updated !== match) {
      console.log(`  Fixed category slug in ${path.basename(filePath)}`);
      modified = true;
    }
    return updated;
  });

  // Fix ports: JSON.stringify([...]) -> [...]
  newContent = newContent.replace(
    /ports:\s*JSON\.stringify\((\[[\s\S]*?\])\)/g,
    (match, arrayContent) => {
      console.log(`  Fixed ports array in ${path.basename(filePath)}`);
      modified = true;
      return `ports: ${arrayContent}`;
    }
  );

  // Fix environmentVariables: JSON.stringify([...]) -> [...]
  newContent = newContent.replace(
    /environmentVariables:\s*JSON\.stringify\((\[[\s\S]*?\])\)/g,
    (match, arrayContent) => {
      console.log(`  Fixed environmentVariables array in ${path.basename(filePath)}`);
      modified = true;
      return `environmentVariables: ${arrayContent}`;
    }
  );

  // Fix resourceRequirements: JSON.stringify({...}) -> {...}
  newContent = newContent.replace(
    /resourceRequirements:\s*JSON\.stringify\((\{[\s\S]*?\})\)/g,
    (match, objectContent) => {
      console.log(`  Fixed resourceRequirements object in ${path.basename(filePath)}`);
      modified = true;
      return `resourceRequirements: ${objectContent}`;
    }
  );

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
  
  let filesModified = 0;
  
  console.log(`Found ${testFiles.length} test files to process...`);
  
  for (const filePath of testFiles) {
    const relativePath = path.relative(__dirname, filePath);
    
    try {
      const wasModified = processFile(filePath);
      if (wasModified) {
        filesModified++;
        console.log(`✓ Fixed schema issues in: ${relativePath}`);
      }
    } catch (error) {
      console.error(`✗ Error processing ${relativePath}:`, error.message);
    }
  }
  
  console.log(`\nSummary:`);
  console.log(`- Files processed: ${testFiles.length}`);
  console.log(`- Files modified: ${filesModified}`);
}

if (require.main === module) {
  main();
}