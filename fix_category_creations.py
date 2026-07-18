#!/usr/bin/env python3

import re
import os
import glob

def fix_category_creations(content):
    """
    Replace category.create({...}) calls with TestDataFactory.createCategory() calls
    """
    # Pattern to match category creation calls with their complete object definitions
    pattern = r'(\s+)(?:const\s+\w+\s+=\s+)?await\s+caller\.categories\.create\(\{\s*([^}]+)\s*\}\)'
    
    def replace_category_creation(match):
        indent = match.group(1)
        fields_content = match.group(2)
        
        # Extract name field if present
        name_match = re.search(r'name:\s*([^,\n]+)', fields_content)
        name = name_match.group(1).strip() if name_match else "'Test Category'"
        
        # Check if it's a variable assignment
        full_match = match.group(0)
        const_match = re.search(r'const\s+(\w+)\s+=', full_match)
        
        if const_match:
            var_name = const_match.group(1)
            return f"{indent}const {var_name} = await caller.categories.create(TestDataFactory.createCategory({name}))"
        else:
            return f"{indent}await caller.categories.create(TestDataFactory.createCategory({name}))"
    
    # Apply the replacement
    content = re.sub(pattern, replace_category_creation, content, flags=re.DOTALL)
    return content

def process_file(filepath):
    """Process a single TypeScript test file"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Fix category creations
        updated_content = fix_category_creations(content)
        
        # Write back if changed
        if updated_content != content:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(updated_content)
            print(f"Fixed category creations in {filepath}")
        else:
            print(f"No category creation fixes needed in {filepath}")
            
    except Exception as e:
        print(f"Error processing {filepath}: {e}")

def main():
    # Find all TypeScript test files
    test_patterns = [
        'src/__tests__/**/*.test.ts',
        'src/__tests__/**/*.spec.ts'
    ]
    
    for pattern in test_patterns:
        for filepath in glob.glob(pattern, recursive=True):
            process_file(filepath)

if __name__ == '__main__':
    main()