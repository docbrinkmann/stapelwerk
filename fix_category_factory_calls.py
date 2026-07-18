#!/usr/bin/env python3

import re
import os
import glob

def fix_test_data_factory_calls(content):
    """
    Fix TestDataFactory.createCategory calls to pass objects instead of strings
    """
    # Pattern to match TestDataFactory.createCategory(STRING) calls
    pattern = r'TestDataFactory\.createCategory\(([\'"])((?:[^\1]|\\.)+)\1\)'
    
    def replace_call(match):
        quote_char = match.group(1)
        name_value = match.group(2)
        return f'TestDataFactory.createCategory({{ name: {quote_char}{name_value}{quote_char} }})'
    
    # Apply the replacement
    content = re.sub(pattern, replace_call, content)
    return content

def process_file(filepath):
    """Process a single TypeScript test file"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Fix TestDataFactory calls
        updated_content = fix_test_data_factory_calls(content)
        
        # Write back if changed
        if updated_content != content:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(updated_content)
            print(f"Fixed TestDataFactory calls in {filepath}")
        else:
            print(f"No TestDataFactory call fixes needed in {filepath}")
            
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