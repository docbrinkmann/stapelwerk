#!/usr/bin/env python3
"""
Comprehensive TypeScript Test File Fixer Script
Fixes all common TypeScript errors in test files systematically
"""

import re
import os
import glob
from pathlib import Path

def fix_category_creation_calls(content):
    """Fix category creation calls to include slug fields"""
    
    # Pattern for caller.categories.create calls without slug
    pattern1 = r'(caller\.categories\.create\(\s*{\s*)(.*?)(sortOrder:\s*\d+\s*)(}\s*\)\s*)'
    
    def replace_category_call(match):
        start = match.group(1)
        fields = match.group(2)
        sort_order = match.group(3)
        end = match.group(4)
        
        # Extract name from fields
        name_match = re.search(r"name:\s*[`'\"](.*?)[`'\"]", fields)
        if name_match:
            name = name_match.group(1)
            slug = name.lower().replace(' ', '-').replace('&', 'and').replace('<', '').replace('>', '').replace('(', '').replace(')', '').replace('"', '').replace("'", '').replace('/', '-').replace('\\', '-').replace('|', '-').replace('script', '').replace('alert', '').replace('img', '').replace('onerror', '').replace('src=x', '').replace('?', '').replace('!', '').replace('#', '').replace('%', '').replace('@', '').replace('$', '').replace('^', '').replace('*', '').replace('+', '').replace('=', '').replace('[', '').replace(']', '').replace('{', '').replace('}', '').replace('~', '').replace('`', '').replace(':', '').replace(';', '').replace(',', '').replace('.', '').replace('test-', '').replace('--', '-').strip('-')
            slug_field = f'slug: "{slug}", '
            
            # Check if slug is already present
            if 'slug:' not in fields:
                # Insert slug after name
                new_fields = re.sub(r"(name:\s*[`'\"](.*?)[`'\"],?\s*)", f"\\1{slug_field}", fields)
                return start + new_fields + sort_order + end
        
        return match.group(0)
    
    content = re.sub(pattern1, replace_category_call, content, flags=re.DOTALL)
    
    # Also fix Prisma direct calls like prisma.category.create
    pattern2 = r'(prisma\.category\.create\(\s*{\s*data:\s*{\s*)(.*?)(}\s*}\s*\)\s*)'
    content = re.sub(pattern2, replace_category_call, content, flags=re.DOTALL)
    
    return content

def fix_service_array_data(content):
    """Fix service array data to include slug fields"""
    
    # Pattern for service data arrays
    pattern = r'({\s*name:\s*[`\'\"](.*?)[`\'\"],\s*)(.*?)(categoryId:\s*.*?},?)'
    
    def add_slug(match):
        name_part = match.group(1)
        name = match.group(2)
        middle = match.group(3)
        category_part = match.group(4)
        
        # Generate slug from name
        slug = name.lower().replace(' ', '-').replace('&', 'and').replace('<', '').replace('>', '').replace('(', '').replace(')', '').replace('"', '').replace("'", '').replace('/', '-').replace('\\', '-').replace('|', '-').replace('script', '').replace('alert', '').replace('img', '').replace('onerror', '').replace('src=x', '').replace('?', '').replace('!', '').replace('#', '').replace('%', '').replace('@', '').replace('$', '').replace('^', '').replace('*', '').replace('+', '').replace('=', '').replace('[', '').replace(']', '').replace('{', '').replace('}', '').replace('~', '').replace('`', '').replace(':', '').replace(';', '').replace(',', '').replace('.', '').replace('test-', '').replace('--', '-').strip('-')
        
        # Check if slug is already present
        if 'slug:' not in middle:
            slug_part = f'slug: "{slug}", '
            return name_part + slug_part + middle + category_part
        
        return match.group(0)
    
    return re.sub(pattern, add_slug, content, flags=re.DOTALL)

def fix_json_stringified_arrays(content):
    """Fix JSON.stringify calls that should be actual arrays"""
    
    # Fix ports
    content = re.sub(
        r'ports:\s*JSON\.stringify\(\[(.*?)\]\)',
        r'ports: [\1]',
        content,
        flags=re.DOTALL
    )
    
    # Fix environmentVariables 
    content = re.sub(
        r'environmentVariables:\s*JSON\.stringify\(\[(.*?)\]\)',
        r'environmentVariables: [\1]',
        content,
        flags=re.DOTALL
    )
    
    return content

def fix_double_const_assertions(content):
    """Fix 'as const as const' double assertions"""
    content = re.sub(r'as const as const', 'as const', content)
    return content

def fix_missing_category_id(content):
    """Fix missing categoryId in service imports"""
    
    # Pattern for service import data without categoryId
    pattern = r'(const\s+\w*[Ii]mport\w*\s*=\s*.*?{\s*)(sourceUrl:.*?submittedBy:.*?)(,?\s*tags:.*?})'
    
    def add_category_id(match):
        start = match.group(1)
        main_fields = match.group(2)
        extra_fields = match.group(3)
        
        if 'categoryId:' not in main_fields:
            # Add categoryId after submittedBy
            main_fields = re.sub(r'(submittedBy:\s*[`\'\"](.*?)[`\'\"])', r'\1, categoryId: 1', main_fields)
        
        return start + main_fields + extra_fields
    
    content = re.sub(pattern, add_category_id, content, flags=re.DOTALL)
    
    # Also fix direct caller.imports.create calls
    pattern2 = r'(caller\.imports\.create\(\s*{\s*)(sourceUrl:.*?submittedBy:.*?)(}\s*\)\s*)'
    content = re.sub(pattern2, add_category_id, content, flags=re.DOTALL)
    
    return content

def fix_service_slug_props(content):
    """Remove slug properties from service creation calls since services don't have slug in tRPC schema"""
    
    # Remove slug: 'something' from service creation calls
    content = re.sub(r',?\s*slug:\s*[`\'\"](.*?)[`\'\"],?\s*', '', content)
    
    return content

def fix_cursor_type_issues(content):
    """Fix cursor type issues (string vs number)"""
    
    # Fix cursor assignment
    content = re.sub(
        r'cursor\s*=\s*result\.nextCursor\s*\|\|\s*null',
        'cursor = TestDataFactory.normalizeCursor(result.nextCursor)',
        content
    )
    
    return content

def fix_missing_prisma_references(content):
    """Fix missing prisma variable references"""
    
    # Add prisma variable declaration in functions that use it but don't declare it
    if 'await prisma.' in content and 'let prisma:' not in content and 'const prisma' not in content:
        # Find the start of test functions and add prisma declaration
        content = re.sub(
            r'(async\s+function\s+\w+TestDatabase\s*\(\s*\)\s*{\s*)',
            r'\1const prisma = createTestPrismaClient()\n  ',
            content
        )
    
    return content

def fix_popularity_string_to_number(content):
    """Fix popularity filter being string instead of number"""
    
    content = re.sub(
        r'popularity:\s*[`\'\"](high|medium|low)[`\'\"]',
        lambda m: f'popularity: {{"high": 5, "medium": 3, "low": 1}}["{m.group(1)}"]',
        content
    )
    
    return content

def fix_service_mock_data_slug(content):
    """Fix service mock data to include slug field"""
    
    # Pattern for mockServices or similar arrays
    pattern = r'(const\s+\w*[Ss]ervice\w*\s*=\s*\[?\s*{\s*id:.*?name:\s*[`\'\"](.*?)[`\'\"])(.*?)(}\s*[,\]]?)'
    
    def add_slug_to_mock(match):
        start = match.group(1)
        name = match.group(2)
        middle = match.group(3)
        end = match.group(4)
        
        if 'slug:' not in middle:
            slug = name.lower().replace(' ', '-').replace('&', 'and').strip('-')
            slug_field = f', slug: "{slug}"'
            return start + slug_field + middle + end
        
        return match.group(0)
    
    content = re.sub(pattern, add_slug_to_mock, content, flags=re.DOTALL)
    
    return content

def fix_file(filepath):
    """Fix all TypeScript errors in a single test file"""
    print(f"Fixing {filepath}")
    
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original_content = content
    
    # Apply all fixes
    content = fix_category_creation_calls(content)
    content = fix_service_array_data(content)
    content = fix_json_stringified_arrays(content)
    content = fix_double_const_assertions(content)
    content = fix_missing_category_id(content)
    content = fix_service_slug_props(content)
    content = fix_cursor_type_issues(content)
    content = fix_missing_prisma_references(content)
    content = fix_popularity_string_to_number(content)
    content = fix_service_mock_data_slug(content)
    
    # Only write if content changed
    if content != original_content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"  ✅ Fixed {filepath}")
    else:
        print(f"  ⏭️  No changes needed in {filepath}")

def main():
    """Fix all test files with TypeScript errors"""
    
    # Find all test files
    test_patterns = [
        "src/__tests__/**/*.test.ts",
        "src/__tests__/**/*.test.tsx"
    ]
    
    test_files = []
    for pattern in test_patterns:
        test_files.extend(glob.glob(pattern, recursive=True))
    
    print(f"Found {len(test_files)} test files to process")
    
    for filepath in test_files:
        try:
            fix_file(filepath)
        except Exception as e:
            print(f"❌ Error processing {filepath}: {e}")
    
    print("✅ Test file fixes completed!")

if __name__ == "__main__":
    main()