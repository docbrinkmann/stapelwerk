#!/usr/bin/env tsx
/**
 * Documentation Build Script
 * Converts markdown files to static HTML for GitLab Pages
 */

import fs from 'fs/promises';
import path from 'path';
import { marked } from 'marked';

const DOCS_DIR = path.join(process.cwd(), 'docs');
const OUTPUT_DIR = path.join(process.cwd(), 'public', 'docs');

// HTML template
const createTemplate = (title: string, content: string, nav: string) => `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} - Stapelwerk Documentation</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            background: #f5f5f5;
        }
        .container {
            display: flex;
            max-width: 1400px;
            margin: 0 auto;
        }
        .sidebar {
            width: 250px;
            background: #fff;
            padding: 2rem 1rem;
            box-shadow: 2px 0 5px rgba(0,0,0,0.1);
            position: sticky;
            top: 0;
            height: 100vh;
            overflow-y: auto;
        }
        .sidebar h2 {
            font-size: 1.2rem;
            margin-bottom: 1rem;
            color: #0066cc;
        }
        .sidebar ul {
            list-style: none;
        }
        .sidebar li {
            margin-bottom: 0.5rem;
        }
        .sidebar a {
            color: #333;
            text-decoration: none;
            display: block;
            padding: 0.5rem;
            border-radius: 4px;
            transition: all 0.2s;
        }
        .sidebar a:hover {
            background: #f0f0f0;
            color: #0066cc;
        }
        .content {
            flex: 1;
            padding: 2rem;
            background: #fff;
            margin: 2rem;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .content h1 {
            color: #0066cc;
            margin-bottom: 1rem;
            padding-bottom: 0.5rem;
            border-bottom: 2px solid #0066cc;
        }
        .content h2 {
            margin-top: 2rem;
            margin-bottom: 1rem;
            color: #333;
        }
        .content h3 {
            margin-top: 1.5rem;
            margin-bottom: 0.75rem;
            color: #666;
        }
        .content pre {
            background: #f4f4f4;
            padding: 1rem;
            border-radius: 4px;
            overflow-x: auto;
            margin: 1rem 0;
        }
        .content code {
            background: #f4f4f4;
            padding: 0.2rem 0.4rem;
            border-radius: 3px;
            font-family: 'Courier New', monospace;
        }
        .content pre code {
            background: none;
            padding: 0;
        }
        .content a {
            color: #0066cc;
            text-decoration: none;
        }
        .content a:hover {
            text-decoration: underline;
        }
        .content ul, .content ol {
            margin-left: 2rem;
            margin-bottom: 1rem;
        }
        .content li {
            margin-bottom: 0.5rem;
        }
        .content table {
            width: 100%;
            border-collapse: collapse;
            margin: 1rem 0;
        }
        .content th, .content td {
            padding: 0.75rem;
            border: 1px solid #ddd;
            text-align: left;
        }
        .content th {
            background: #f4f4f4;
            font-weight: 600;
        }
    </style>
</head>
<body>
    <div class="container">
        <nav class="sidebar">
            <h2>📚 Documentation</h2>
            ${nav}
        </nav>
        <main class="content">
            ${content}
        </main>
    </div>
</body>
</html>
`;

// Build navigation from markdown files
async function buildNavigation(docsDir: string): Promise<string> {
    const files = await fs.readdir(docsDir);
    const mdFiles = files.filter(file => file.endsWith('.md'));
    
    const navItems = mdFiles.map(file => {
        const name = file.replace('.md', '');
        const title = name.replace(/-/g, ' ').replace(/_/g, ' ');
        return `<li><a href="${name}.html">${title}</a></li>`;
    });
    
    return `<ul>${navItems.join('\n')}</ul>`;
}

// Convert markdown file to HTML
async function convertMarkdownToHTML(
    mdFile: string,
    docsDir: string,
    outputDir: string,
    nav: string
): Promise<void> {
    const mdContent = await fs.readFile(path.join(docsDir, mdFile), 'utf-8');
    const htmlContent = await marked(mdContent);
    
    const title = mdFile.replace('.md', '').replace(/-/g, ' ').replace(/_/g, ' ');
    const html = createTemplate(title, htmlContent, nav);
    
    const outputFile = mdFile.replace('.md', '.html');
    await fs.writeFile(path.join(outputDir, outputFile), html);
    
    console.log(`✓ Generated: ${outputFile}`);
}

// Main build function
async function buildDocs(): Promise<void> {
    try {
        console.log('📚 Building documentation...\n');
        
        // Ensure output directory exists
        await fs.mkdir(OUTPUT_DIR, { recursive: true });
        
        // Build navigation
        const nav = await buildNavigation(DOCS_DIR);
        
        // Get all markdown files
        const files = await fs.readdir(DOCS_DIR);
        const mdFiles = files.filter(file => file.endsWith('.md'));
        
        if (mdFiles.length === 0) {
            console.log('⚠️  No markdown files found in docs directory');
            
            // Create placeholder index
            const placeholder = createTemplate(
                'Documentation',
                '<h1>Stapelwerk Documentation</h1><p>Documentation coming soon...</p>',
                '<ul><li><a href="index.html">Home</a></li></ul>'
            );
            await fs.writeFile(path.join(OUTPUT_DIR, 'index.html'), placeholder);
            console.log('✓ Created placeholder index.html');
            return;
        }
        
        // Convert all markdown files
        await Promise.all(
            mdFiles.map(file => convertMarkdownToHTML(file, DOCS_DIR, OUTPUT_DIR, nav))
        );
        
        // Create index.html (copy from README or first file)
        const indexSource = mdFiles.includes('README.md') ? 'README.md' : mdFiles[0];
        const indexMd = await fs.readFile(path.join(DOCS_DIR, indexSource), 'utf-8');
        const indexHtml = createTemplate('Home', await marked(indexMd), nav);
        await fs.writeFile(path.join(OUTPUT_DIR, 'index.html'), indexHtml);
        
        console.log(`\n✅ Documentation build complete!`);
        console.log(`   Generated ${mdFiles.length + 1} HTML files in ${OUTPUT_DIR}`);
    } catch (error) {
        console.error('❌ Build failed:', error);
        process.exit(1);
    }
}

// Run build
buildDocs();
