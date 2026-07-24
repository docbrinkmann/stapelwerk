#!/usr/bin/env python3

import re
import sys

def fix_category_creation(content):
    """
    Fix category.create calls to include slug field and fix TestDataFactory calls
    """
    
    # Pattern to match category.create calls with object literals that need slug field
    pattern1 = r'(await caller\.categories\.create\(\s*)(\{[^}]+?)(\s*\})'
    
    def replacement1(match):
        prefix = match.group(1)
        body = match.group(2)
        suffix = match.group(3)
        
        # Check if slug is already present
        if 'slug:' in body:
            return match.group(0)  # Already has slug
        
        # Extract the name value to generate slug
        name_match = re.search(r'name:\s*([^,\n]+)', body)
        if name_match:
            name_value = name_match.group(1).strip()
            # Add slug field after name
            updated_body = re.sub(
                r'(name:\s*[^,\n]+)',
                r'\1,\n          slug: TestDataFactory.generateSlug(' + name_value + ')',
                body,
                count=1
            )
            return f"{prefix}{updated_body}{suffix}"
        
        return match.group(0)  # Return original if no name match
    
    content = re.sub(pattern1, replacement1, content, flags=re.MULTILINE | re.DOTALL)
    
    # Also handle TestDataFactory.createCategory calls that pass strings instead of objects
    # Convert TestDataFactory.createCategory('string') to TestDataFactory.createCategory({ name: 'string' })
    pattern2 = r'TestDataFactory\.createCategory\((["\'][^"\']*["\'])\)'
    def replacement2(match):
        string_value = match.group(1)
        return f'TestDataFactory.createCategory({{ name: {string_value} }})'
    
    content = re.sub(pattern2, replacement2, content)
    
    return content

def main():
    file_path = '/Users/sebastian/projects/stapelwerk/src/__tests__/security/input-sanitization.test.ts'
    
    # Read the file
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Fix the content
    fixed_content = fix_category_creation(content)
    
    # Write back the file
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(fixed_content)
    
    print("Fixed input-sanitization.test.ts")

if __name__ == '__main__':
    main()