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

// Process a single file
function processFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  let newContent = content;

  // Fix ports: JSON.stringify([...]) -> [...]
  const portsPattern = /ports:\s*JSON\.stringify\(\s*(\[[\s\S]*?\])\s*\)/g;
  newContent = newContent.replace(portsPattern, (match, arrayContent) => {
    console.log(`  Fixed ports array in ${path.basename(filePath)}`);
    modified = true;
    return `ports: ${arrayContent}`;
  });

  // Fix environmentVariables: JSON.stringify([...]) -> [...]
  const envVarsPattern = /environmentVariables:\s*JSON\.stringify\(\s*(\[[\s\S]*?\])\s*\)/g;
  newContent = newContent.replace(envVarsPattern, (match, arrayContent) => {
    console.log(`  Fixed environmentVariables array in ${path.basename(filePath)}`);
    modified = true;
    return `environmentVariables: ${arrayContent}`;
  });

  // Fix resourceRequirements: JSON.stringify({...}) -> {...}
  const resourcePattern = /resourceRequirements:\s*JSON\.stringify\(\s*(\{[\s\S]*?\})\s*\)/g;
  newContent = newContent.replace(resourcePattern, (match, objectContent) => {
    console.log(`  Fixed resourceRequirements object in ${path.basename(filePath)}`);
    modified = true;
    return `resourceRequirements: ${objectContent}`;
  });

  // Fix extractedMetadata in imports - remove unsupported field
  const metadataPattern = /extractedMetadata:\s*[^,}]+,?\s*/g;
  newContent = newContent.replace(metadataPattern, (match) => {
    console.log(`  Removed extractedMetadata field in ${path.basename(filePath)}`);
    modified = true;
    return '';
  });

  // Fix slug fields that shouldn't exist in service creation
  const serviceSlugPattern = /(caller\.services\.create\([^)]*?)slug:\s*[^,}]+,?\s*/g;
  newContent = newContent.replace(serviceSlugPattern, (match, prefix) => {
    console.log(`  Removed invalid slug field from service creation in ${path.basename(filePath)}`);
    modified = true;
    return prefix;
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
  
  let filesModified = 0;
  
  console.log(`Found ${testFiles.length} test files to process...`);
  
  for (const filePath of testFiles) {
    const relativePath = path.relative(__dirname, filePath);
    
    try {
      const wasModified = processFile(filePath);
      if (wasModified) {
        filesModified++;
        console.log(`✓ Fixed service schema issues in: ${relativePath}`);
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