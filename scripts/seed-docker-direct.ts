import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const categories = [
  { name: 'Databases', slug: 'databases', description: 'Database management systems' },
  { name: 'Web Servers', slug: 'web-servers', description: 'Web and application servers' },
  { name: 'Media', slug: 'media', description: 'Media servers and streaming' },
  { name: 'Development Tools', slug: 'development-tools', description: 'Development and CI/CD tools' },
  { name: 'Monitoring', slug: 'monitoring', description: 'Monitoring and observability' },
  { name: 'Security', slug: 'security', description: 'Security and authentication' },
  { name: 'Productivity', slug: 'productivity', description: 'Productivity and collaboration' },
];

const dbServices = [
  { name: 'PostgreSQL', slug: 'postgresql', docker_image: 'postgres:17-alpine', category_slug: 'databases', description: 'Powerful open-source relational database' },
  { name: 'MariaDB', slug: 'mariadb', docker_image: 'mariadb:11', category_slug: 'databases', description: 'MySQL-compatible database server' },
  { name: 'Redis', slug: 'redis', docker_image: 'redis:7-alpine', category_slug: 'databases', description: 'In-memory data structure store' },
  { name: 'MongoDB', slug: 'mongodb', docker_image: 'mongo:8', category_slug: 'databases', description: 'NoSQL document database' },
];

async function seed() {
  console.log('🌱 Starting direct SQL seed...');

  try {
    // Insert categories
    console.log('📂 Seeding categories...');
    for (const cat of categories) {
      const sql = `INSERT INTO categories (name, slug, description, "sortOrder", "createdAt", "updatedAt") 
                   VALUES ('${cat.name}', '${cat.slug}', '${cat.description}', 0, NOW(), NOW())
                   ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name;`;
      await execAsync(`docker-compose exec -T postgres psql -U postgres -d build_my_stack_dev -c "${sql}"`);
    }
    console.log('✅ Categories seeded');

    // Get category IDs
    const { stdout } = await execAsync(`docker-compose exec -T postgres psql -U postgres -d build_my_stack_dev -t -c "SELECT id, slug FROM categories;"`);
    const catMap: Record<string, string> = {};
    stdout.trim().split('\n').forEach(line => {
      const [id, slug] = line.trim().split('|').map(s => s.trim());
      if (id && slug) catMap[slug] = id;
    });

    // Insert services
    console.log('🐳 Seeding services...');
    for (const svc of dbServices) {
      const catId = catMap[svc.category_slug];
      if (!catId) continue;
      
      const sql = `INSERT INTO services (name, slug, description, "dockerImage", version, "categoryId", ports, "environmentVariables", "resourceRequirements", "compatibilityInfo", featured, status, "createdAt", "updatedAt", "expectedResourceUsage", "performanceTier", "slaRequirements")
                   VALUES ('${svc.name}', '${svc.slug}', '${svc.description}', '${svc.docker_image}', 'latest', ${catId}, '[]', '[]', '{}', '{}', false, 'approved', NOW(), NOW(), '{}', 'standard', '{}')
                   ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name;`;
      await execAsync(`docker-compose exec -T postgres psql -U postgres -d build_my_stack_dev -c "${sql}"`);
    }
    console.log('✅ Services seeded');

    console.log('✅ Seed completed successfully!');
  } catch (error) {
    console.error('❌ Seed failed:', error);
    throw error;
  }
}

seed();
