#!/usr/bin/env python3
"""
Fix common syntax errors in test files
"""

import re
import glob

def fix_malformed_object_fields(content):
    """Fix malformed object fields that are missing commas"""
    
    # Fix cases where slug: field is missing comma
    content = re.sub(
        r'(slug:\s*[\'"`].*?[\'"`])\s+(name:)',
        r'\1, \2',
        content
    )
    
    # Fix cases where multiple consecutive fields are missing commas
    patterns = [
        (r'(name:\s*[\'"`].*?[\'"`])\s+(slug:)', r'\1, \2'),
        (r'(slug:\s*[\'"`].*?[\'"`])\s+(description:)', r'\1, \2'),
        (r'(description:\s*[\'"`].*?[\'"`])\s+(sortOrder:)', r'\1, \2'),
        (r'(sortOrder:\s*\d+)\s+(})', r'\1\n    \2'),
        (r'(name:\s*[\'"`].*?[\'"`])\s+(description:)', r'\1, \2'),
        (r'(description:\s*[\'"`].*?[\'"`])\s+(dockerImage:)', r'\1, \2'),
        (r'(dockerImage:\s*[\'"`].*?[\'"`])\s+(categoryId:)', r'\1, \2'),
        (r'(categoryId:\s*\d+)\s+(submittedBy:)', r'\1, \2'),
        (r'(submittedBy:\s*[\'"`].*?[\'"`])\s+(tags:)', r'\1, \2'),
    ]
    
    for pattern, replacement in patterns:
        content = re.sub(pattern, replacement, content)
    
    return content

def fix_array_elements_missing_commas(content):
    """Fix array elements that are missing commas"""
    
    # Fix test case arrays
    content = re.sub(
        r'(}\s*)\n\s*({[\s\S]*?field:)',
        r'\1,\n  \2',
        content
    )
    
    return content

def fix_function_call_formatting(content):
    """Fix function calls that have formatting issues"""
    
    # Fix caller.categories.create with trailing spaces
    content = re.sub(
        r'(caller\.categories\.create\(\s*{\s*)(.*?)(}\s*\)\s*)',
        lambda m: m.group(1) + m.group(2).strip() + '\n      ' + m.group(3),
        content,
        flags=re.DOTALL
    )
    
    return content

def fix_file(filepath):
    """Fix syntax errors in a test file"""
    
    print(f"Fixing syntax in {filepath}")
    
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original_content = content
    
    # Apply fixes
    content = fix_malformed_object_fields(content)
    content = fix_array_elements_missing_commas(content)
    content = fix_function_call_formatting(content)
    
    # Only write if content changed
    if content != original_content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"  ✅ Fixed syntax in {filepath}")
    else:
        print(f"  ⏭️  No syntax changes needed in {filepath}")

def main():
    """Fix syntax errors in all test files"""
    
    # Find all test files
    test_patterns = [
        "src/__tests__/**/*.test.ts",
        "src/__tests__/**/*.test.tsx"
    ]
    
    test_files = []
    for pattern in test_patterns:
        test_files.extend(glob.glob(pattern, recursive=True))
    
    print(f"Found {len(test_files)} test files to process for syntax fixes")
    
    for filepath in test_files:
        try:
            fix_file(filepath)
        except Exception as e:
            print(f"❌ Error processing {filepath}: {e}")
    
    print("✅ Syntax fix completed!")

if __name__ == "__main__":
    main()