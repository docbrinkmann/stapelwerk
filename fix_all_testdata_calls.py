#!/usr/bin/env python3

import re
import sys
import os

def fix_testdata_category_calls(content):
    """
    Fix TestDataFactory.createCategory calls that pass strings instead of objects
    """
    
    # Convert TestDataFactory.createCategory('string') to TestDataFactory.createCategory({ name: 'string' })
    pattern = r'TestDataFactory\.createCategory\((["\'][^"\']*["\'])\)'
    def replacement(match):
        string_value = match.group(1)
        return f'TestDataFactory.createCategory({{ name: {string_value} }})'
    
    content = re.sub(pattern, replacement, content)
    return content

def fix_category_creation_with_slug(content):
    """
    Fix category.create calls to include slug field where missing
    """
    
    # Pattern to match category.create calls with object literals that need slug field
    pattern = r'(await caller\.categories\.create\(\s*)(\{[^}]*?\})'
    
    def replacement(match):
        prefix = match.group(1)
        body = match.group(2)
        
        # Check if slug is already present
        if 'slug:' in body:
            return match.group(0)  # Already has slug
        
        # Extract the name value to generate slug
        name_match = re.search(r'name:\s*([^,\n}]+)', body)
        if name_match:
            name_value = name_match.group(1).strip()
            # Add slug field after name
            updated_body = re.sub(
                r'(\{[^}]*?name:\s*[^,\n}]+)',
                r'\1,\n        slug: TestDataFactory.generateSlug(' + name_value + ')',
                body,
                count=1
            )
            return f"{prefix}{updated_body}"
        
        return match.group(0)  # Return original if no name match
    
    content = re.sub(pattern, replacement, content, flags=re.MULTILINE | re.DOTALL)
    return content

def process_file(file_path):
    """Process a single file to fix TestDataFactory calls"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Apply fixes
        fixed_content = fix_testdata_category_calls(content)
        fixed_content = fix_category_creation_with_slug(fixed_content)
        
        # Write back only if content changed
        if fixed_content != content:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(fixed_content)
            print(f"Fixed {file_path}")
            return True
        else:
            print(f"No changes needed for {file_path}")
            return False
            
    except Exception as e:
        print(f"Error processing {file_path}: {e}")
        return False

def main():
    # Files to process
    files = [
        '/Users/sebastian/projects/stapelwerk/src/__tests__/security/input-validation-boundaries.test.ts',
        '/Users/sebastian/projects/stapelwerk/src/__tests__/security/security-middleware-validation.test.ts',
        '/Users/sebastian/projects/stapelwerk/src/__tests__/security/security-performance.test.ts',
        '/Users/sebastian/projects/stapelwerk/src/__tests__/security/sql-injection-prevention.test.ts',
    ]
    
    changes_made = False
    for file_path in files:
        if os.path.exists(file_path):
            if process_file(file_path):
                changes_made = True
        else:
            print(f"File not found: {file_path}")
    
    if changes_made:
        print("All specified files have been processed and fixed.")
    else:
        print("No changes were needed.")

if __name__ == '__main__':
    main()