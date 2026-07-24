#!/usr/bin/env python3

import re
import sys

def fix_category_creation(content):
    """
    Fix category.create calls to include slug field
    """
    
    # Pattern to match category.create calls with object literals
    # This matches calls like:
    # const category = await caller.categories.create({
    #   name: `Test ${payload} Category`,
    #   description: `Description with ${payload} command`,
    #   sortOrder: 1
    # })
    pattern = r'(await caller\.categories\.create\(\s*\{\s*)(name:\s*[^,\n]+)(,?\s*description:\s*[^,\n]+)(,?\s*sortOrder:\s*[^,\n}]+)(\s*\}\s*\))'
    
    def replacement(match):
        prefix = match.group(1)
        name_part = match.group(2)
        desc_part = match.group(3)
        sort_part = match.group(4)
        suffix = match.group(5)
        
        # Extract the name value to generate slug
        name_match = re.search(r'name:\s*(.+)', name_part)
        if name_match:
            name_value = name_match.group(1).strip()
            # Add slug field
            slug_part = f",\n          slug: TestDataFactory.generateSlug({name_value})"
            return f"{prefix}{name_part}{slug_part}{desc_part}{sort_part}{suffix}"
        
        return match.group(0)  # Return original if no match
    
    content = re.sub(pattern, replacement, content, flags=re.MULTILINE | re.DOTALL)
    
    # Also handle TestDataFactory.createCategory calls that pass strings instead of objects
    # Convert TestDataFactory.createCategory('string') to TestDataFactory.createCategory({ name: 'string' })
    pattern2 = r'TestDataFactory\.createCategory\((["\'][^"\']*["\'])\)'
    def replacement2(match):
        string_value = match.group(1)
        return f'TestDataFactory.createCategory({{ name: {string_value} }})'
    
    content = re.sub(pattern2, replacement2, content)
    
    return content

def main():
    file_path = '/Users/sebastian/projects/stapelwerk/src/__tests__/security/comprehensive-injection-prevention.test.ts'
    
    # Read the file
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Fix the content
    fixed_content = fix_category_creation(content)
    
    # Write back the file
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(fixed_content)
    
    print("Fixed comprehensive-injection-prevention.test.ts")

if __name__ == '__main__':
    main()