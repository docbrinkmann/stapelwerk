#!/usr/bin/env python3

import re

def fix_trpc_categories_test():
    file_path = '/Users/sebastian/projects/build-my-stack/src/__tests__/trpc/categories.test.ts'
    
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Fix imports - remove MSW import that doesn't exist
    content = re.sub(r'import { createTRPCMsw } from \'msw-trpc\'\n', '', content)
    
    # Fix context creation to include user and userId
    old_context = """const createMockContext = () => ({
  prisma,
  req: {} as any
})"""
    
    new_context = """const createMockContext = () => ({
  prisma,
  req: {} as any,
  user: { id: 'test-user', role: 'user' },
  userId: 'test-user'
})"""
    
    content = content.replace(old_context, new_context)
    
    # Fix category creation calls to include slug fields
    # This pattern matches category creation with missing slug
    pattern = r'(await prisma\.category\.create\(\s*\{\s*data:\s*\{\s*)(name:\s*[^,]+)(,?\s*description:\s*[^,]+)(,?\s*sortOrder:\s*[^}]+)(\s*}\s*\}\s*\))'
    
    def add_slug(match):
        prefix = match.group(1)
        name_part = match.group(2)
        desc_part = match.group(3)
        sort_part = match.group(4)
        suffix = match.group(5)
        
        # Extract name value to generate slug
        name_match = re.search(r'name:\s*(.+)', name_part)
        if name_match:
            name_value = name_match.group(1).strip()
            slug_part = f",\n          slug: TestDataFactory.generateSlug({name_value})"
            return f"{prefix}{name_part}{slug_part}{desc_part}{sort_part}{suffix}"
        return match.group(0)
    
    content = re.sub(pattern, add_slug, content, flags=re.MULTILINE | re.DOTALL)
    
    # Fix service creation calls to include slug fields
    service_pattern = r'(\{\s*)(name:\s*[^,]+)(,?\s*description:\s*[^,]+)(,?\s*dockerImage:\s*[^,]+)(,?\s*categoryId:\s*[^,]+)(,?\s*status:\s*[^}]+)(\s*\})'
    
    def add_service_slug(match):
        prefix = match.group(1)
        name_part = match.group(2)
        desc_part = match.group(3)
        docker_part = match.group(4)
        category_part = match.group(5)
        status_part = match.group(6)
        suffix = match.group(7)
        
        # Extract name value to generate slug
        name_match = re.search(r'name:\s*(.+)', name_part)
        if name_match:
            name_value = name_match.group(1).strip()
            slug_part = f",\n            slug: TestDataFactory.generateSlug({name_value})"
            return f"{prefix}{name_part}{slug_part}{desc_part}{docker_part}{category_part}{status_part}{suffix}"
        return match.group(0)
    
    content = re.sub(service_pattern, add_service_slug, content, flags=re.MULTILINE | re.DOTALL)
    
    # Add TestDataFactory import
    import_line = "import { TestDataFactory } from '@/__tests__/helpers/test-data-factory'"
    if import_line not in content:
        # Add after existing imports
        content = re.sub(
            r'(import { TRPCError } from \'@trpc/server\')',
            r'\1\n' + import_line,
            content
        )
    
    # Fix formatting issues and missing commas
    content = re.sub(r'name:\s*([^,\n]+)\s+description:', r'name: \1,\n          description:', content)
    content = re.sub(r'description:\s*([^,\n]+)\s+sortOrder:', r'description: \1,\n          sortOrder:', content)
    content = re.sub(r'name:\s*([^,\n]+)\s+serviceCount:', r'name: \1,\n            serviceCount:', content)
    
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print("Fixed trpc/categories.test.ts")

if __name__ == '__main__':
    fix_trpc_categories_test()