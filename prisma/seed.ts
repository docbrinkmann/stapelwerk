import { PrismaClient } from '@prisma/client'
import { hashPassword } from '../src/lib/password'
import { shouldResetCatalog } from './seed-guard'

const prisma = new PrismaClient()

/**
 * Default service categories for the Service Catalog API
 * These categories organize container services into logical groups
 */
const defaultCategories = [
  {
    name: 'Databases',
    slug: 'databases',
    description: 'Database management systems and data storage solutions including SQL and NoSQL databases',
    icon: 'database',
    sortOrder: 1
  },
  {
    name: 'Web Servers',
    slug: 'web-servers',
    description: 'HTTP servers, reverse proxies, and web infrastructure components',
    icon: 'server',
    sortOrder: 2
  },
  {
    name: 'Media',
    slug: 'media',
    description: 'Media streaming, processing, and management applications for audio, video, and images',
    icon: 'play-circle',
    sortOrder: 3
  },
  {
    name: 'Development Tools',
    slug: 'development-tools',
    description: 'Development environments, version control systems, and build tools',
    icon: 'code',
    sortOrder: 4
  },
  {
    name: 'Monitoring',
    slug: 'monitoring',
    description: 'System monitoring, logging, observability tools, and performance tracking',
    icon: 'activity',
    sortOrder: 5
  },
  {
    name: 'Security',
    slug: 'security',
    description: 'Security tools, firewalls, authentication services, and vulnerability scanners',
    icon: 'shield',
    sortOrder: 6
  },
  {
    name: 'Productivity',
    slug: 'productivity',
    description: 'Collaboration tools, document management, project management, and productivity applications',
    icon: 'briefcase',
    sortOrder: 7
  }
]

async function main() {
  console.log('🌱 Starting database seed...')
  
  // Destructive catalog reset — opt-in only (SEED_RESET=true), never in production.
  // Day-to-day re-seeds (incl. the deploy-time `migrate` service) don't need it:
  // services and categories are upserted by slug. See seed-guard for the fail-safe.
  // Community submissions (service_imports) are intentionally never touched.
  if (shouldResetCatalog()) {
    console.log('🧹 SEED_RESET: resetting catalog (services + categories)...')
    await prisma.services.deleteMany({})
    await prisma.categories.deleteMany({})
  }

  // Seed categories
  console.log('📂 Seeding service categories...')
  
  for (const categoryData of defaultCategories) {
    const category = await prisma.categories.upsert({
      where: { slug: categoryData.slug },
      update: {
        name: categoryData.name,
        description: categoryData.description,
        icon: categoryData.icon,
        sortOrder: categoryData.sortOrder,
        updatedAt: new Date()
      },
      create: {
        ...categoryData,
        updatedAt: new Date()
      }
    })
    
    console.log(`✅ Created/updated category: ${category.name} (${category.slug})`)
  }

  // Add comprehensive service catalog (50+ services across categories)
  console.log('🐳 Seeding service catalog (50+ services)...')

  // Helper to upsert a service by slug
  const upsertService = async (data: {
    name: string
    slug: string
    description: string
    dockerImage: string
    version?: string
    categoryId: number
    ports?: any[]
    env?: any[]
    volumes?: any[]
    resources?: any
    compat?: any
    docs?: string
    featured?: boolean
    status?: string
  }) => {
    await prisma.services.upsert({
      where: { slug: data.slug },
      update: {
        name: data.name,
        description: data.description,
        dockerImage: data.dockerImage,
        version: data.version || 'latest',
        categoryId: data.categoryId,
        ports: JSON.stringify(data.ports || []),
        environmentVariables: JSON.stringify(data.env || []),
        volumes: JSON.stringify(data.volumes || []),
        resourceRequirements: JSON.stringify(
          data.resources || { cpu: 0.25, memory: 256 }
        ),
        compatibilityInfo: JSON.stringify(
          data.compat || { operatingSystems: ['linux'], architectures: ['amd64','arm64'] }
        ),
        documentationUrl: data.docs,
        featured: data.featured ?? false,
        status: data.status || 'approved',
        updatedAt: new Date(),
      },
      create: {
        name: data.name,
        slug: data.slug,
        description: data.description,
        dockerImage: data.dockerImage,
        version: data.version || 'latest',
        categoryId: data.categoryId,
        ports: JSON.stringify(data.ports || []),
        environmentVariables: JSON.stringify(data.env || []),
        volumes: JSON.stringify(data.volumes || []),
        resourceRequirements: JSON.stringify(
          data.resources || { cpu: 0.25, memory: 256 }
        ),
        compatibilityInfo: JSON.stringify(
          data.compat || { operatingSystems: ['linux'], architectures: ['amd64','arm64'] }
        ),
        documentationUrl: data.docs,
        featured: data.featured ?? false,
        status: data.status || 'approved',
        updatedAt: new Date(),
      },
    })
  }

  const categories = await prisma.categories.findMany()
  const bySlug: Record<string, number> = {}
  categories.forEach(c => { bySlug[c.slug] = c.id })

  // Reusable env building block for linuxserver.io-style images (jellyfin, *arr, …)
  const lsioEnv = [
    { name: 'PUID', description: 'User ID the container process runs as', required: false, secret: false, default: '1000' },
    { name: 'PGID', description: 'Group ID the container process runs as', required: false, secret: false, default: '1000' },
    { name: 'TZ', description: 'Container timezone (IANA name)', required: false, secret: false, default: 'Europe/Berlin' },
  ]

  // Seed per-category service definitions.
  // env:       [{ name, description, required, secret, default? }]
  // volumes:   [{ containerPath, description, named }]  (named=true → docker named volume; false → bind mount)
  // resources: { cpu (cores), memory (MB) }
  const dbServices = [
    {
      name: 'PostgreSQL', slug: 'postgresql', image: 'postgres:18-alpine', version: '18',
      ports: [{ containerPort: 5432, protocol: 'tcp', description: 'PostgreSQL' }],
      env: [
        { name: 'POSTGRES_PASSWORD', description: 'Superuser password', required: true, secret: true },
        { name: 'POSTGRES_USER', description: 'Superuser name', required: false, secret: false, default: 'postgres' },
        { name: 'POSTGRES_DB', description: 'Default database created on first start', required: false, secret: false, default: 'app' },
      ],
      volumes: [{ containerPath: '/var/lib/postgresql/data', description: 'Database data directory', named: true }],
      resources: { cpu: 0.5, memory: 512 },
    },
    {
      name: 'MySQL', slug: 'mysql', image: 'mysql:8.0', version: '8.0',
      ports: [{ containerPort: 3306, protocol: 'tcp', description: 'MySQL' }],
      env: [
        { name: 'MYSQL_ROOT_PASSWORD', description: 'Password for the root user', required: true, secret: true },
        { name: 'MYSQL_DATABASE', description: 'Database created on first start', required: false, secret: false, default: 'app' },
        { name: 'MYSQL_USER', description: 'Application database user', required: false, secret: false },
        { name: 'MYSQL_PASSWORD', description: 'Application database user password', required: false, secret: true },
      ],
      volumes: [{ containerPath: '/var/lib/mysql', description: 'Database data directory', named: true }],
      resources: { cpu: 0.5, memory: 512 },
    },
    {
      name: 'MariaDB', slug: 'mariadb', image: 'mariadb:11', version: '11',
      ports: [{ containerPort: 3306, protocol: 'tcp', description: 'MariaDB' }],
      env: [
        { name: 'MYSQL_ROOT_PASSWORD', description: 'Password for the root user', required: true, secret: true },
        { name: 'MYSQL_DATABASE', description: 'Database created on first start', required: false, secret: false, default: 'app' },
        { name: 'MYSQL_USER', description: 'Application database user', required: false, secret: false },
        { name: 'MYSQL_PASSWORD', description: 'Application database user password', required: false, secret: true },
      ],
      volumes: [{ containerPath: '/var/lib/mysql', description: 'Database data directory', named: true }],
      resources: { cpu: 0.5, memory: 512 },
    },
    {
      name: 'MongoDB', slug: 'mongodb', image: 'mongo:7', version: '7',
      ports: [{ containerPort: 27017, protocol: 'tcp', description: 'MongoDB' }],
      env: [
        { name: 'MONGO_INITDB_ROOT_USERNAME', description: 'Root username created on first start', required: false, secret: false, default: 'root' },
        { name: 'MONGO_INITDB_ROOT_PASSWORD', description: 'Root user password', required: true, secret: true },
      ],
      volumes: [{ containerPath: '/data/db', description: 'Database data directory', named: true }],
      resources: { cpu: 0.5, memory: 512 },
    },
    {
      name: 'Redis', slug: 'redis', image: 'redis:7-alpine', version: '7',
      ports: [{ containerPort: 6379, protocol: 'tcp', description: 'Redis' }],
      env: [],
      volumes: [{ containerPath: '/data', description: 'Append-only file / RDB persistence', named: true }],
      resources: { cpu: 0.25, memory: 256 },
    },
    {
      name: 'Elasticsearch', slug: 'elasticsearch', image: 'elasticsearch:8.14.0', version: '8.14',
      ports: [{ containerPort: 9200, protocol: 'tcp', description: 'HTTP API' }],
      env: [
        { name: 'discovery.type', description: 'Cluster discovery mode', required: false, secret: false, default: 'single-node' },
        { name: 'ELASTIC_PASSWORD', description: 'Password for the elastic superuser', required: false, secret: true },
        { name: 'xpack.security.enabled', description: 'Enable X-Pack security', required: false, secret: false, default: 'false' },
      ],
      volumes: [{ containerPath: '/usr/share/elasticsearch/data', description: 'Index data directory', named: true }],
      resources: { cpu: 1.0, memory: 2048 },
    },
    {
      name: 'ClickHouse', slug: 'clickhouse', image: 'clickhouse/clickhouse-server:24', version: '24',
      ports: [{ containerPort: 8123, protocol: 'tcp', description: 'HTTP' }],
      env: [
        { name: 'CLICKHOUSE_DB', description: 'Database created on first start', required: false, secret: false, default: 'default' },
        { name: 'CLICKHOUSE_USER', description: 'Initial user', required: false, secret: false, default: 'default' },
        { name: 'CLICKHOUSE_PASSWORD', description: 'Password for the initial user', required: true, secret: true },
      ],
      volumes: [{ containerPath: '/var/lib/clickhouse', description: 'Column data directory', named: true }],
      resources: { cpu: 1.0, memory: 1024 },
    },
    {
      name: 'Neo4j', slug: 'neo4j', image: 'neo4j:5', version: '5',
      ports: [{ containerPort: 7687, protocol: 'tcp', description: 'Bolt' }],
      env: [
        { name: 'NEO4J_AUTH', description: 'Initial credentials as user/password (or "none")', required: false, secret: true, default: 'neo4j/password' },
      ],
      volumes: [{ containerPath: '/data', description: 'Graph data directory', named: true }],
      resources: { cpu: 0.5, memory: 512 },
    },
  ]

  const webServices = [
    {
      name: 'NGINX', slug: 'nginx', image: 'nginx:1.25-alpine', version: '1.25',
      ports: [{ containerPort: 80, protocol: 'tcp', description: 'HTTP' }, { containerPort: 443, protocol: 'tcp', description: 'HTTPS' }],
      env: [],
      // No default conf.d mount: an empty bind would shadow the image's default.conf,
      // so `docker compose up` would serve nothing. Users add a config mount in the
      // builder when they have one; the bare image serves its welcome page out of the box.
      volumes: [],
      resources: { cpu: 0.25, memory: 128 },
    },
    {
      name: 'Apache HTTPD', slug: 'httpd', image: 'httpd:2.4', version: '2.4',
      ports: [{ containerPort: 80, protocol: 'tcp', description: 'HTTP' }],
      env: [],
      // No default htdocs mount: an empty bind would hide the image's "It works!" page.
      // Add a content mount in the builder to serve your own site.
      volumes: [],
      resources: { cpu: 0.25, memory: 128 },
    },
    {
      name: 'Caddy', slug: 'caddy', image: 'caddy:2-alpine', version: '2',
      ports: [{ containerPort: 80, protocol: 'tcp', description: 'HTTP' }, { containerPort: 443, protocol: 'tcp', description: 'HTTPS' }],
      env: [],
      // /etc/caddy omitted: an empty bind would shadow the image's default Caddyfile
      // and Caddy would serve nothing. /data persists certs/state (a named volume is
      // fine — Docker seeds it from the image on first run).
      volumes: [
        { containerPath: '/data', description: 'Certificates and Caddy state', named: true },
      ],
      resources: { cpu: 0.25, memory: 128 },
    },
    {
      name: 'Traefik', slug: 'traefik', image: 'traefik:v3.0', version: '3.0',
      ports: [{ containerPort: 80, protocol: 'tcp', description: 'HTTP' }, { containerPort: 443, protocol: 'tcp', description: 'HTTPS' }],
      env: [],
      volumes: [{ containerPath: '/etc/traefik', description: 'Static/dynamic configuration directory', named: false }],
      resources: { cpu: 0.25, memory: 128 },
    },
    {
      name: 'HAProxy', slug: 'haproxy', image: 'haproxy:2.9', version: '2.9',
      ports: [{ containerPort: 80, protocol: 'tcp', description: 'HTTP' }],
      env: [],
      volumes: [{ containerPath: '/usr/local/etc/haproxy', description: 'haproxy.cfg configuration directory', named: false }],
      resources: { cpu: 0.25, memory: 128 },
    },
    {
      name: 'Envoy', slug: 'envoy', image: 'envoyproxy/envoy:v1.30.5', version: '1.30',
      ports: [{ containerPort: 80, protocol: 'tcp', description: 'HTTP proxy' }],
      env: [],
      volumes: [{ containerPath: '/etc/envoy', description: 'envoy.yaml configuration directory', named: false }],
      resources: { cpu: 0.25, memory: 256 },
    },
    {
      name: 'Kong', slug: 'kong', image: 'kong:3.6', version: '3.6',
      ports: [{ containerPort: 8000, protocol: 'tcp', description: 'Proxy' }],
      env: [
        // Without KONG_DATABASE=off the image expects a Postgres and won't start.
        { name: 'KONG_DATABASE', description: "Datastore: 'off' = DB-less (declarative config)", required: false, secret: false, default: 'off' },
        { name: 'KONG_DECLARATIVE_CONFIG', description: 'Path to kong.yml when running DB-less', required: false, secret: false, default: '' },
      ],
      volumes: [],
      resources: { cpu: 0.5, memory: 512 },
    },
  ]

  const mediaServices = [
    {
      name: 'Jellyfin', slug: 'jellyfin', image: 'jellyfin/jellyfin:latest',
      ports: [{ containerPort: 8096, protocol: 'tcp', description: 'Web UI' }],
      env: lsioEnv,
      volumes: [
        { containerPath: '/config', description: 'Server configuration and metadata', named: true },
        { containerPath: '/media', description: 'Media library (mount your media here)', named: false },
      ],
      resources: { cpu: 1.0, memory: 1024 },
    },
    {
      name: 'Plex', slug: 'plex', image: 'plexinc/pms-docker:latest',
      ports: [{ containerPort: 32400, protocol: 'tcp', description: 'Web UI' }],
      env: [
        ...lsioEnv,
        { name: 'PLEX_CLAIM', description: 'Claim token from plex.tv/claim to bind the server', required: false, secret: true },
      ],
      volumes: [
        { containerPath: '/config', description: 'Server configuration and metadata', named: true },
        { containerPath: '/media', description: 'Media library (mount your media here)', named: false },
      ],
      resources: { cpu: 1.0, memory: 1024 },
    },
    // ---- The *arr automation stack (linuxserver.io images) ----
    {
      name: 'Sonarr', slug: 'sonarr', image: 'lscr.io/linuxserver/sonarr:latest',
      ports: [{ containerPort: 8989, protocol: 'tcp', description: 'Web UI' }],
      env: lsioEnv,
      volumes: [
        { containerPath: '/config', description: 'App configuration and database', named: true },
        { containerPath: '/media', description: 'Media library, shared with the player (bind mount)', named: false },
        { containerPath: '/downloads', description: 'Completed downloads handed off by the download client', named: false },
      ],
      resources: { cpu: 0.5, memory: 512 },
    },
    {
      name: 'Radarr', slug: 'radarr', image: 'lscr.io/linuxserver/radarr:latest',
      ports: [{ containerPort: 7878, protocol: 'tcp', description: 'Web UI' }],
      env: lsioEnv,
      volumes: [
        { containerPath: '/config', description: 'App configuration and database', named: true },
        { containerPath: '/media', description: 'Media library, shared with the player (bind mount)', named: false },
        { containerPath: '/downloads', description: 'Completed downloads handed off by the download client', named: false },
      ],
      resources: { cpu: 0.5, memory: 512 },
    },
    {
      name: 'Prowlarr', slug: 'prowlarr', image: 'lscr.io/linuxserver/prowlarr:latest',
      ports: [{ containerPort: 9696, protocol: 'tcp', description: 'Web UI' }],
      env: lsioEnv,
      volumes: [
        { containerPath: '/config', description: 'Indexer definitions and configuration', named: true },
      ],
      resources: { cpu: 0.25, memory: 256 },
    },
    {
      name: 'qBittorrent', slug: 'qbittorrent', image: 'lscr.io/linuxserver/qbittorrent:latest',
      ports: [
        { containerPort: 8080, protocol: 'tcp', description: 'Web UI' },
        { containerPort: 6881, protocol: 'tcp', description: 'BitTorrent' },
      ],
      env: [
        ...lsioEnv,
        { name: 'WEBUI_PORT', description: 'Port the web UI listens on (match the published port)', required: false, secret: false, default: '8080' },
      ],
      volumes: [
        { containerPath: '/config', description: 'Client configuration and session state', named: true },
        { containerPath: '/downloads', description: 'Download destination, shared with the *arr apps (bind mount)', named: false },
      ],
      resources: { cpu: 0.5, memory: 512 },
    },
    {
      name: 'Bazarr', slug: 'bazarr', image: 'lscr.io/linuxserver/bazarr:latest',
      ports: [{ containerPort: 6767, protocol: 'tcp', description: 'Web UI' }],
      env: lsioEnv,
      volumes: [
        { containerPath: '/config', description: 'App configuration and database', named: true },
        { containerPath: '/media', description: 'Media library subtitles are written alongside (bind mount)', named: false },
      ],
      resources: { cpu: 0.25, memory: 512 },
    },
    {
      name: 'Overseerr', slug: 'overseerr', image: 'lscr.io/linuxserver/overseerr:latest',
      ports: [{ containerPort: 5055, protocol: 'tcp', description: 'Web UI' }],
      env: lsioEnv,
      volumes: [
        { containerPath: '/config', description: 'Request database and configuration', named: true },
      ],
      resources: { cpu: 0.25, memory: 256 },
    },
    {
      name: 'Immich', slug: 'immich', image: 'ghcr.io/immich-app/immich-server:latest',
      ports: [{ containerPort: 2283, protocol: 'tcp', description: 'Web' }],
      env: [
        { name: 'DB_PASSWORD', description: 'Postgres password Immich connects with', required: false, secret: true },
        { name: 'DB_HOSTNAME', description: 'Postgres hostname', required: false, secret: false },
      ],
      volumes: [{ containerPath: '/usr/src/app/upload', description: 'Uploaded photos and videos', named: true }],
      resources: { cpu: 1.0, memory: 1024 },
    },
    {
      name: 'PhotoPrism', slug: 'photoprism', image: 'photoprism/photoprism:latest',
      ports: [{ containerPort: 2342, protocol: 'tcp', description: 'Web' }],
      env: [
        { name: 'PHOTOPRISM_ADMIN_PASSWORD', description: 'Initial admin password', required: true, secret: true },
      ],
      volumes: [
        { containerPath: '/photoprism/storage', description: 'Sidecar files, thumbnails and database', named: true },
        { containerPath: '/photoprism/originals', description: 'Original photos and videos', named: false },
      ],
      resources: { cpu: 0.5, memory: 1024 },
    },
    {
      name: 'MinIO', slug: 'minio', image: 'minio/minio:latest',
      ports: [{ containerPort: 9000, protocol: 'tcp', description: 'S3 API' }],
      env: [
        { name: 'MINIO_ROOT_USER', description: 'Root access key', required: false, secret: false, default: 'minioadmin' },
        { name: 'MINIO_ROOT_PASSWORD', description: 'Root secret key', required: true, secret: true },
      ],
      volumes: [{ containerPath: '/data', description: 'Object storage data directory', named: true }],
      resources: { cpu: 0.5, memory: 512 },
    },
    {
      name: 'OnlyOffice Docs', slug: 'onlyoffice-docs', image: 'onlyoffice/documentserver:latest',
      ports: [{ containerPort: 80, protocol: 'tcp', description: 'HTTP' }],
      env: [
        { name: 'JWT_SECRET', description: 'Shared secret for signing API requests', required: false, secret: true },
      ],
      volumes: [{ containerPath: '/var/lib/onlyoffice', description: 'Document server data', named: true }],
      resources: { cpu: 1.0, memory: 1024 },
    },
    {
      name: 'Bitwarden', slug: 'bitwarden', image: 'vaultwarden/server:latest',
      ports: [{ containerPort: 80, protocol: 'tcp', description: 'HTTP' }],
      env: [
        { name: 'ADMIN_TOKEN', description: 'Token that unlocks the /admin panel', required: false, secret: true },
      ],
      volumes: [{ containerPath: '/data', description: 'Vault database and attachments', named: true }],
      resources: { cpu: 0.25, memory: 256 },
    },
  ]

  const devServices = [
    {
      name: 'Gitea', slug: 'gitea', image: 'gitea/gitea:latest',
      ports: [{ containerPort: 3000, protocol: 'tcp', description: 'Web UI' }],
      env: [
        { name: 'USER_UID', description: 'UID for the git user inside the container', required: false, secret: false, default: '1000' },
        { name: 'USER_GID', description: 'GID for the git user inside the container', required: false, secret: false, default: '1000' },
      ],
      volumes: [{ containerPath: '/data', description: 'Repositories, config and app data', named: true }],
      resources: { cpu: 0.5, memory: 512 },
    },
    {
      name: 'GitLab', slug: 'gitlab', image: 'gitlab/gitlab-ce:latest',
      ports: [{ containerPort: 80, protocol: 'tcp', description: 'HTTP' }],
      env: [],
      volumes: [
        { containerPath: '/etc/gitlab', description: 'GitLab configuration', named: true },
        { containerPath: '/var/opt/gitlab', description: 'Application data (repos, db, uploads)', named: true },
        { containerPath: '/var/log/gitlab', description: 'Logs', named: true },
      ],
      resources: { cpu: 2.0, memory: 4096 },
    },
    {
      name: 'Jenkins', slug: 'jenkins', image: 'jenkins/jenkins:lts',
      ports: [{ containerPort: 8080, protocol: 'tcp', description: 'Web UI' }],
      env: [],
      volumes: [{ containerPath: '/var/jenkins_home', description: 'Jobs, plugins and configuration', named: true }],
      resources: { cpu: 0.5, memory: 1024 },
    },
    {
      name: 'Drone CI', slug: 'drone', image: 'drone/drone:latest',
      ports: [{ containerPort: 80, protocol: 'tcp', description: 'HTTP' }],
      env: [
        { name: 'DRONE_RPC_SECRET', description: 'Shared secret between server and runners', required: true, secret: true },
        { name: 'DRONE_SERVER_HOST', description: 'External hostname of the Drone server', required: false, secret: false },
        { name: 'DRONE_SERVER_PROTO', description: 'External protocol (http or https)', required: false, secret: false, default: 'http' },
      ],
      volumes: [{ containerPath: '/data', description: 'Build database', named: true }],
      resources: { cpu: 0.25, memory: 256 },
    },
    {
      name: 'SonarQube', slug: 'sonarqube', image: 'sonarqube:latest',
      ports: [{ containerPort: 9000, protocol: 'tcp', description: 'Web UI' }],
      env: [],
      volumes: [{ containerPath: '/opt/sonarqube/data', description: 'Analysis data', named: true }],
      resources: { cpu: 1.0, memory: 2048 },
    },
    {
      name: 'Nexus', slug: 'nexus', image: 'sonatype/nexus3:latest',
      ports: [{ containerPort: 8081, protocol: 'tcp', description: 'Web UI' }],
      env: [],
      volumes: [{ containerPath: '/nexus-data', description: 'Repository blobs and config', named: true }],
      resources: { cpu: 1.0, memory: 2048 },
    },
    {
      name: 'Verdaccio', slug: 'verdaccio', image: 'verdaccio/verdaccio:latest',
      ports: [{ containerPort: 4873, protocol: 'tcp', description: 'Web UI' }],
      env: [],
      volumes: [{ containerPath: '/verdaccio/storage', description: 'Published packages and cache', named: true }],
      resources: { cpu: 0.25, memory: 256 },
    },
    {
      name: 'Docker Registry', slug: 'registry', image: 'registry:2',
      ports: [{ containerPort: 5000, protocol: 'tcp', description: 'HTTP' }],
      env: [],
      volumes: [{ containerPath: '/var/lib/registry', description: 'Image layer storage', named: true }],
      resources: { cpu: 0.25, memory: 256 },
    },
  ]

  const monitoringServices = [
    {
      name: 'Prometheus', slug: 'prometheus', image: 'prom/prometheus:latest',
      ports: [{ containerPort: 9090, protocol: 'tcp', description: 'UI' }],
      env: [],
      // /etc/prometheus omitted: an empty bind would shadow the image's default
      // prometheus.yml and the container would crash on startup. /prometheus keeps the
      // TSDB. Add a config mount in the builder to supply your own scrape targets.
      volumes: [
        { containerPath: '/prometheus', description: 'Time-series database (TSDB)', named: true },
      ],
      resources: { cpu: 0.5, memory: 512 },
    },
    {
      name: 'Grafana', slug: 'grafana', image: 'grafana/grafana:latest',
      ports: [{ containerPort: 3000, protocol: 'tcp', description: 'UI' }],
      env: [
        { name: 'GF_SECURITY_ADMIN_PASSWORD', description: 'Initial admin password', required: true, secret: true },
      ],
      volumes: [{ containerPath: '/var/lib/grafana', description: 'Dashboards, plugins and database', named: true }],
      resources: { cpu: 0.5, memory: 512 },
    },
    {
      name: 'Loki', slug: 'loki', image: 'grafana/loki:2.9.0',
      ports: [{ containerPort: 3100, protocol: 'tcp', description: 'HTTP' }],
      env: [],
      volumes: [{ containerPath: '/loki', description: 'Log chunk and index storage', named: true }],
      resources: { cpu: 0.5, memory: 512 },
    },
    {
      name: 'Promtail', slug: 'promtail', image: 'grafana/promtail:2.9.0',
      ports: [],
      env: [],
      volumes: [{ containerPath: '/var/log', description: 'Host logs to scrape (bind mount)', named: false }],
      resources: { cpu: 0.25, memory: 128 },
    },
    {
      name: 'Tempo', slug: 'tempo', image: 'grafana/tempo:2.4.1',
      ports: [{ containerPort: 3200, protocol: 'tcp', description: 'HTTP' }],
      env: [],
      volumes: [{ containerPath: '/var/tempo', description: 'Trace storage', named: true }],
      resources: { cpu: 0.5, memory: 512 },
    },
    {
      name: 'Jaeger', slug: 'jaeger', image: 'jaegertracing/all-in-one:1.52',
      ports: [{ containerPort: 16686, protocol: 'tcp', description: 'UI' }],
      env: [],
      volumes: [],
      resources: { cpu: 0.25, memory: 256 },
    },
    {
      name: 'Zipkin', slug: 'zipkin', image: 'openzipkin/zipkin:latest',
      ports: [{ containerPort: 9411, protocol: 'tcp', description: 'HTTP' }],
      env: [],
      volumes: [],
      resources: { cpu: 0.25, memory: 256 },
    },
  ]

  const securityServices = [
    {
      name: 'Vault', slug: 'vault', image: 'hashicorp/vault:latest',
      ports: [{ containerPort: 8200, protocol: 'tcp', description: 'HTTP' }],
      env: [
        { name: 'VAULT_DEV_ROOT_TOKEN_ID', description: 'Root token when running in dev mode', required: false, secret: true },
      ],
      volumes: [
        { containerPath: '/vault/file', description: 'File storage backend', named: true },
        { containerPath: '/vault/config', description: 'Server configuration', named: false },
      ],
      resources: { cpu: 0.25, memory: 256 },
    },
    {
      name: 'CrowdSec', slug: 'crowdsec', image: 'crowdsecurity/crowdsec:latest',
      ports: [],
      env: [],
      volumes: [{ containerPath: '/var/lib/crowdsec/data', description: 'Local API database and decisions', named: true }],
      resources: { cpu: 0.25, memory: 256 },
    },
    {
      name: 'Wazuh', slug: 'wazuh', image: 'wazuh/wazuh:latest',
      ports: [{ containerPort: 55000, protocol: 'tcp', description: 'Agent' }],
      env: [],
      volumes: [{ containerPath: '/var/ossec/data', description: 'Manager data directory', named: true }],
      resources: { cpu: 1.0, memory: 2048 },
    },
    {
      name: 'Keycloak', slug: 'keycloak', image: 'quay.io/keycloak/keycloak:latest',
      ports: [{ containerPort: 8080, protocol: 'tcp', description: 'HTTP' }],
      env: [
        { name: 'KEYCLOAK_ADMIN', description: 'Initial admin username', required: false, secret: false, default: 'admin' },
        { name: 'KEYCLOAK_ADMIN_PASSWORD', description: 'Initial admin password', required: true, secret: true },
      ],
      volumes: [{ containerPath: '/opt/keycloak/data', description: 'Realm/H2 data (dev mode) — without it everything is lost on restart', named: true }],
      resources: { cpu: 0.5, memory: 512 },
    },
    {
      name: 'oauth2-proxy', slug: 'oauth2-proxy', image: 'quay.io/oauth2-proxy/oauth2-proxy:latest',
      ports: [{ containerPort: 4180, protocol: 'tcp', description: 'HTTP' }],
      env: [
        { name: 'OAUTH2_PROXY_CLIENT_ID', description: 'OAuth client ID', required: false, secret: false },
        { name: 'OAUTH2_PROXY_CLIENT_SECRET', description: 'OAuth client secret', required: false, secret: true },
        { name: 'OAUTH2_PROXY_COOKIE_SECRET', description: 'Secret used to encrypt session cookies', required: true, secret: true },
      ],
      volumes: [],
      resources: { cpu: 0.25, memory: 128 },
    },
    {
      name: 'Trivy', slug: 'trivy', image: 'aquasec/trivy:latest',
      ports: [],
      env: [],
      volumes: [{ containerPath: '/root/.cache', description: 'Vulnerability database cache', named: true }],
      resources: { cpu: 0.25, memory: 256 },
    },
  ]

  const productivityServices = [
    {
      name: 'Nextcloud', slug: 'nextcloud', image: 'nextcloud:latest',
      ports: [{ containerPort: 80, protocol: 'tcp', description: 'HTTP' }],
      env: [
        { name: 'MYSQL_HOST', description: 'Hostname of the MySQL/MariaDB server', required: false, secret: false },
        { name: 'MYSQL_DATABASE', description: 'Database name', required: false, secret: false, default: 'nextcloud' },
        { name: 'MYSQL_USER', description: 'Database user', required: false, secret: false },
        { name: 'MYSQL_PASSWORD', description: 'Database user password', required: false, secret: true },
      ],
      volumes: [{ containerPath: '/var/www/html', description: 'App code, config and user data', named: true }],
      resources: { cpu: 0.5, memory: 512 },
    },
    {
      name: 'Mattermost', slug: 'mattermost', image: 'mattermost/mattermost-team-edition:latest',
      ports: [{ containerPort: 8065, protocol: 'tcp', description: 'HTTP' }],
      env: [
        { name: 'MM_SQLSETTINGS_DATASOURCE', description: 'Database connection string', required: false, secret: true },
      ],
      volumes: [{ containerPath: '/mattermost/data', description: 'Uploaded files and plugins', named: true }],
      resources: { cpu: 0.5, memory: 512 },
    },
    {
      name: 'Rocket.Chat', slug: 'rocket-chat', image: 'rocketchat/rocket.chat:latest',
      ports: [{ containerPort: 3000, protocol: 'tcp', description: 'HTTP' }],
      env: [
        { name: 'MONGO_URL', description: 'MongoDB connection string', required: false, secret: true },
        { name: 'ROOT_URL', description: 'Public URL of the instance', required: false, secret: false },
      ],
      volumes: [{ containerPath: '/app/uploads', description: 'Uploaded files', named: true }],
      resources: { cpu: 0.5, memory: 512 },
    },
    {
      name: 'Outline', slug: 'outline', image: 'outlinewiki/outline:latest',
      ports: [{ containerPort: 3000, protocol: 'tcp', description: 'HTTP' }],
      env: [
        { name: 'SECRET_KEY', description: 'App secret used to sign sessions', required: true, secret: true },
        { name: 'UTILS_SECRET', description: 'Secret used for utility endpoints', required: true, secret: true },
        { name: 'DATABASE_URL', description: 'Postgres connection string', required: false, secret: true },
        { name: 'REDIS_URL', description: 'Redis connection string', required: false, secret: false },
      ],
      volumes: [{ containerPath: '/var/lib/outline/data', description: 'Local file storage', named: true }],
      resources: { cpu: 0.5, memory: 512 },
    },
    {
      name: 'HedgeDoc', slug: 'hedgedoc', image: 'quay.io/hedgedoc/hedgedoc:latest',
      ports: [{ containerPort: 3000, protocol: 'tcp', description: 'HTTP' }],
      env: [
        { name: 'CMD_DB_URL', description: 'Database connection string', required: false, secret: true },
      ],
      volumes: [{ containerPath: '/hedgedoc/public/uploads', description: 'Uploaded images and files', named: true }],
      resources: { cpu: 0.5, memory: 512 },
    },
    {
      name: 'Penpot', slug: 'penpot', image: 'penpotapp/penpot:latest',
      ports: [{ containerPort: 9001, protocol: 'tcp', description: 'HTTP' }],
      env: [],
      volumes: [{ containerPath: '/opt/data', description: 'Assets and uploaded files', named: true }],
      resources: { cpu: 0.5, memory: 1024 },
    },
    {
      name: 'n8n', slug: 'n8n', image: 'n8nio/n8n:latest',
      ports: [{ containerPort: 5678, protocol: 'tcp', description: 'HTTP' }],
      env: [
        { name: 'N8N_ENCRYPTION_KEY', description: 'Key used to encrypt stored credentials', required: false, secret: true },
      ],
      volumes: [{ containerPath: '/home/node/.n8n', description: 'Workflows, credentials and config', named: true }],
      resources: { cpu: 0.5, memory: 512 },
    },
    {
      name: 'Metabase', slug: 'metabase', image: 'metabase/metabase:latest',
      ports: [{ containerPort: 3000, protocol: 'tcp', description: 'HTTP' }],
      env: [
        { name: 'MB_DB_TYPE', description: 'Application database type (h2, postgres, mysql)', required: false, secret: false },
        { name: 'MB_DB_CONNECTION_URI', description: 'Application database connection URI', required: false, secret: true },
      ],
      volumes: [{ containerPath: '/metabase-data', description: 'Embedded H2 database (when not using an external DB)', named: true }],
      resources: { cpu: 0.5, memory: 1024 },
    },
  ]

  // Real one-line catalog descriptions, keyed by service slug. Keeps the /services
  // catalog from reading as auto-generated ("X service for the Y category").
  const CATALOG_DESCRIPTIONS: Record<string, string> = {
    // databases
    clickhouse: 'Column-oriented database for real-time analytics over huge datasets',
    elasticsearch: 'Distributed search and analytics engine for logs, text and vectors',
    mariadb: 'Community-developed, MySQL-compatible relational database',
    mongodb: 'Document-oriented NoSQL database for flexible, JSON-like data',
    mysql: 'Popular open-source relational database used across the web',
    neo4j: 'Graph database for highly connected data and relationship queries',
    postgresql: 'Advanced open-source relational database with strong SQL and JSON support',
    redis: 'In-memory data store used as a cache, message broker and queue',
    // development-tools
    registry: 'Private Docker image registry for storing and distributing images',
    drone: 'Container-native continuous integration and delivery platform',
    gitlab: 'Complete DevOps platform with Git hosting, CI/CD, issues and registry',
    gitea: 'Lightweight, self-hosted Git service with a familiar web UI',
    jenkins: 'Extensible automation server for building, testing and deploying software',
    nexus: 'Repository manager for build artifacts, packages and Docker images',
    sonarqube: 'Continuous code-quality and security inspection for many languages',
    verdaccio: 'Lightweight private npm proxy registry for JavaScript packages',
    // media
    bazarr: 'Companion to Sonarr and Radarr that downloads subtitles automatically',
    bitwarden: 'Self-hosted password manager for storing and sharing credentials',
    immich: 'Self-hosted photo and video backup with mobile apps and smart search',
    jellyfin: 'Free media server that streams movies, shows and music to any device',
    minio: 'High-performance, S3-compatible object storage',
    'onlyoffice-docs': 'Collaborative office suite for documents, spreadsheets and slides',
    overseerr: 'Lets users request new movies and shows for your media stack',
    photoprism: 'AI-powered photo library for browsing, organizing and sharing pictures',
    plex: 'Media server that organizes and streams your movies, TV and music',
    prowlarr: 'Indexer manager that feeds releases to the *arr apps from one place',
    radarr: 'Automatically downloads, sorts and manages your movie library',
    sonarr: 'Automatically downloads, sorts and manages your TV series library',
    qbittorrent: 'Lightweight BitTorrent client with a built-in web interface',
    // monitoring
    grafana: 'Dashboards and visualization for metrics, logs and traces',
    jaeger: 'Distributed tracing to monitor and troubleshoot microservice requests',
    loki: 'Horizontally scalable log aggregation that pairs with Grafana',
    prometheus: 'Time-series metrics collection and alerting for your systems',
    promtail: 'Agent that ships local logs to Loki',
    tempo: 'High-scale distributed tracing backend for storing and querying traces',
    zipkin: 'Distributed tracing system for gathering and looking up request timing',
    // productivity
    hedgedoc: 'Real-time collaborative Markdown notes in the browser',
    mattermost: 'Self-hosted team chat and collaboration, an open Slack alternative',
    metabase: 'Business-intelligence tool for asking questions and building dashboards',
    nextcloud: 'Self-hosted file sync, sharing and collaboration suite',
    outline: 'Team knowledge base and wiki with fast search and Markdown editing',
    penpot: 'Open-source design and prototyping tool for product teams',
    'rocket-chat': 'Self-hosted team chat, video calls and collaboration platform',
    n8n: 'Workflow automation that connects apps and APIs with a visual editor',
    // security
    crowdsec: 'Collaborative intrusion prevention that detects and blocks malicious IPs',
    keycloak: 'Identity and access management with SSO, OIDC and SAML',
    trivy: 'Vulnerability and misconfiguration scanner for containers and code',
    vault: 'Secrets management for storing and tightly controlling tokens and keys',
    wazuh: 'Security monitoring, XDR and SIEM for threat detection and compliance',
    'oauth2-proxy': 'Reverse proxy that adds OAuth and OIDC authentication to any app',
    // web-servers
    httpd: 'The Apache HTTP Server, a mature and widely used web server',
    caddy: 'Modern web server with automatic HTTPS out of the box',
    envoy: 'High-performance service proxy for edge and service-mesh traffic',
    haproxy: 'Reliable, high-performance TCP and HTTP load balancer',
    kong: 'API gateway for routing, authentication and rate limiting',
    nginx: 'High-performance web server, reverse proxy and load balancer',
    traefik: 'Cloud-native reverse proxy with automatic service discovery and TLS',
  }

  const addAll = async (list: any[], categorySlug: string) => {
    const categoryId = bySlug[categorySlug]
    if (!categoryId) return
    for (const s of list) {
      await upsertService({
        name: s.name,
        slug: s.slug,
        // Real, human catalog copy; falls back to a generated line only for
        // a service not yet in CATALOG_DESCRIPTIONS.
        description:
          CATALOG_DESCRIPTIONS[s.slug] ?? `${s.name} service for the ${categorySlug} category`,
        dockerImage: s.image,
        version: s.version,
        categoryId,
        ports: s.ports,
        env: s.env,
        volumes: s.volumes,
        resources: s.resources,
        compat: s.compat,
        docs: s.docs,
        featured: false,
      })
    }
  }

  await addAll(dbServices, 'databases')
  await addAll(webServices, 'web-servers')
  await addAll(mediaServices, 'media')
  await addAll(devServices, 'development-tools')
  await addAll(monitoringServices, 'monitoring')
  await addAll(securityServices, 'security')
  await addAll(productivityServices, 'productivity')

  console.log('✅ Seeded comprehensive service catalog')

  // ----------------------------------------------
  // Curated use-case templates (guided compositions)
  //
  // Each template is a coherent, real stack composed from the seeded services.
  // Member services are resolved BY SLUG → real (auto-increment) ids, so the
  // stored `serviceIds` always match the current catalog even though ids shift
  // when the catalog is re-seeded. The M2M `services` relation is connected too
  // so `include: { services: true }` (used by the templates API/UI) returns the
  // real service rows. Per-service "why it's included" notes and tags live in
  // the existing `metadata` JSON column — no schema change needed.
  // ----------------------------------------------
  console.log('🧩 Seeding curated use-case templates...')

  const serviceIdBySlug: Record<string, number> = {}
  for (const s of await prisma.services.findMany({ select: { id: true, slug: true } })) {
    serviceIdBySlug[s.slug] = s.id
  }

  type TemplateSeed = {
    id: string
    name: string
    description: string
    category: string
    difficulty: 'beginner' | 'intermediate' | 'advanced'
    estimatedSetupTime: string
    featured?: boolean
    tags: string[]
    // slug → short "why it's included" note
    members: Record<string, string>
  }

  const templateSeeds: TemplateSeed[] = [
    {
      id: 'tpl-media-server',
      name: 'Media Server',
      description:
        'A complete self-hosted media stack: stream your library and automatically find, download, organize and subtitle new movies and shows.',
      category: 'media',
      difficulty: 'intermediate',
      estimatedSetupTime: '45 minutes',
      featured: true,
      tags: ['media', 'streaming', 'jellyfin', 'arr', 'automation'],
      members: {
        jellyfin: 'Streams your movies and shows to any device',
        sonarr: 'Automatically finds and organizes TV episodes',
        radarr: 'Automatically finds and organizes movies',
        prowlarr: 'Central indexer manager that feeds Sonarr and Radarr',
        qbittorrent: 'Download client the *arr apps hand releases to',
        bazarr: 'Fetches matching subtitles for your library',
        overseerr: 'Lets users request new movies and shows',
      },
    },
    {
      id: 'tpl-web-dev',
      name: 'Web Dev Environment',
      description:
        'Everything a modern web app needs to run locally or in a homelab: a relational database, a cache, a reverse proxy and a Git server.',
      category: 'development',
      difficulty: 'beginner',
      estimatedSetupTime: '20 minutes',
      featured: true,
      tags: ['development', 'web', 'database', 'cache', 'git'],
      members: {
        postgresql: 'Primary relational database for your application',
        redis: 'In-memory cache and session/queue store',
        nginx: 'Reverse proxy and static file server in front of your app',
        gitea: 'Lightweight self-hosted Git server for your code',
      },
    },
    {
      id: 'tpl-monitoring',
      name: 'Monitoring & Observability',
      description:
        'A full metrics-and-logs observability stack: collect time-series metrics, aggregate logs and visualize everything on shared dashboards.',
      category: 'monitoring',
      difficulty: 'advanced',
      estimatedSetupTime: '60 minutes',
      featured: true,
      tags: ['monitoring', 'metrics', 'logs', 'grafana', 'prometheus'],
      members: {
        prometheus: 'Scrapes and stores time-series metrics',
        grafana: 'Dashboards and visualization for metrics and logs',
        loki: 'Aggregates logs, queryable alongside your metrics',
        promtail: 'Ships host and container logs into Loki',
      },
    },
    {
      id: 'tpl-business',
      name: 'Business Productivity Suite',
      description:
        'Self-hosted collaboration for a team: file sync, collaborative document editing, a knowledge-base wiki and group chat.',
      category: 'business',
      difficulty: 'beginner',
      estimatedSetupTime: '30 minutes',
      tags: ['business', 'productivity', 'collaboration', 'documents', 'chat'],
      members: {
        nextcloud: 'Files, calendar and contacts for the whole team',
        'onlyoffice-docs': 'Collaborative document editing inside Nextcloud',
        outline: 'Team knowledge base and documentation wiki',
        mattermost: 'Self-hosted team chat and collaboration',
      },
    },
    {
      id: 'tpl-automation',
      name: 'Workflow Automation Hub',
      description:
        'Connect your services and automate routine tasks with a low-code workflow engine, backed by a durable database and a queue.',
      category: 'productivity',
      difficulty: 'intermediate',
      estimatedSetupTime: '30 minutes',
      tags: ['automation', 'workflows', 'n8n', 'integration'],
      members: {
        n8n: 'Low-code workflow automation connecting your services',
        postgresql: 'Durable store for n8n workflows and executions',
        redis: 'Queue backend for scaling n8n executions',
      },
    },
    {
      id: 'tpl-security',
      name: 'Security & Identity Stack',
      description:
        'Put identity, access and secrets management in front of your services: single sign-on, an auth gateway, a secrets vault, intrusion protection and a password manager.',
      category: 'security',
      difficulty: 'advanced',
      estimatedSetupTime: '50 minutes',
      tags: ['security', 'identity', 'sso', 'secrets', 'passwords'],
      members: {
        keycloak: 'Single sign-on and identity provider (OIDC/SAML)',
        'oauth2-proxy': 'Adds SSO in front of apps that lack their own auth',
        vault: 'Central secrets management and encryption',
        crowdsec: 'Detects and blocks malicious traffic',
        bitwarden: 'Self-hosted password manager for the team',
      },
    },
  ]

  for (const t of templateSeeds) {
    const memberSlugs = Object.keys(t.members)
    const missing = memberSlugs.filter(slug => serviceIdBySlug[slug] === undefined)
    if (missing.length) {
      console.warn(`   ⚠️ template ${t.id}: skipping unseeded services: ${missing.join(', ')}`)
    }
    const resolved = memberSlugs.filter(slug => serviceIdBySlug[slug] !== undefined)
    const ids = resolved.map(slug => serviceIdBySlug[slug])
    if (ids.length === 0) {
      console.warn(`   ⏭️ template ${t.id}: no seeded services resolved, skipping`)
      continue
    }

    const serviceNotes: Record<string, string> = {}
    for (const slug of resolved) serviceNotes[slug] = t.members[slug]
    const metadata = JSON.stringify({ tags: t.tags, serviceNotes })
    const serviceIds = JSON.stringify(ids)

    await prisma.use_case_templates.upsert({
      where: { id: t.id },
      update: {
        name: t.name,
        description: t.description,
        category: t.category,
        difficulty: t.difficulty,
        estimatedSetupTime: t.estimatedSetupTime,
        serviceIds,
        metadata,
        featured: t.featured ?? false,
        isActive: true,
        services: { set: ids.map(id => ({ id })) },
        updatedAt: new Date(),
      },
      create: {
        id: t.id,
        name: t.name,
        description: t.description,
        category: t.category,
        difficulty: t.difficulty,
        estimatedSetupTime: t.estimatedSetupTime,
        serviceIds,
        metadata,
        version: '1.0.0',
        isActive: true,
        featured: t.featured ?? false,
        usageCount: 0,
        services: { connect: ids.map(id => ({ id })) },
        updatedAt: new Date(),
      },
    })
    console.log(`   ✅ template: ${t.name} → [${resolved.join(', ')}]`)
  }

  // ----------------------------------------------
  // Deployment fixtures: stack, target, overrides, artifact, job
  // ----------------------------------------------
  console.log('🚀 Seeding deployment fixtures...')

  // Helper to find a service by slug
  const nginxService = await prisma.services.findUnique({ where: { slug: 'nginx' } })
  const postgresService = await prisma.services.findUnique({ where: { slug: 'postgresql' } })

  // 1) Create or upsert a sample stack
  const stackSlug = 'sample-web-stack'
  const stack = await prisma.stacks.upsert({
    where: { slug: stackSlug },
    update: { name: 'Sample Web Stack', updatedAt: new Date() },
    create: {
      id: crypto.randomUUID(),
      name: 'Sample Web Stack',
      slug: stackSlug,
      isPublic: false,
      isTemplate: false,
      status: 'draft',
      updatedAt: new Date(),
      stack_services: nginxService
        ? {
            create: [{ id: crypto.randomUUID(), serviceId: nginxService.id, order: 1 }],
          }
        : undefined,
    },
    include: { stack_services: true },
  })

  // Create default empty configuration for the stack service
  if (stack.stack_services.length > 0) {
    const ss = stack.stack_services[0]
    const existingCfg = await prisma.stack_service_configurations.findUnique({ where: { stackServiceId: ss.id } })
    if (!existingCfg) {
      await prisma.stack_service_configurations.create({
        data: {
          id: crypto.randomUUID(),
          stackServiceId: ss.id,
          environmentVariables: '{}',
          portMappings: '{}',
          volumeMounts: '{}',
          dependsOn: '[]',
          updatedAt: new Date(),
        },
      })
    }
  }

  // 2) Create a deployment target (Kubernetes self-managed)
  const target = await prisma.deployment_targets.upsert({
    where: { id: (await prisma.deployment_targets.findFirst({ where: { name: 'Local K3s' } }))?.id || '00000000-0000-0000-0000-000000000000' },
    update: { provider: 'self-managed', updatedAt: new Date() },
    create: {
      id: crypto.randomUUID(),
      name: 'Local K3s',
      type: 'kubernetes',
      provider: 'self-managed',
      config: JSON.stringify({ kubecontext: 'default', ingress: 'nginx' }),
      updatedAt: new Date(),
    },
  })

  // 3) Create an override for nginx on this target
  if (nginxService) {
    const existingOverride = await prisma.deployment_target_overrides.findFirst({
      where: { targetId: target.id, serviceId: nginxService.id, stackId: null },
    })
    if (!existingOverride) {
      await prisma.deployment_target_overrides.create({
        data: {
          id: crypto.randomUUID(),
          targetId: target.id,
          serviceId: nginxService.id,
          stackId: null,
          overrides: JSON.stringify({
            ingress: { enabled: true, host: 'app.local' },
            resources: { requests: { cpu: '100m', memory: '128Mi' } },
          }),
          updatedAt: new Date(),
        },
      })
    }
  }

  // 4) Create an artifact for the stack
  const artifact = await prisma.deployment_artifacts.create({
    data: {
      id: crypto.randomUUID(),
      type: 'yaml',
      checksum: 'seeded-checksum-abc123',
      location: '/tmp/artifacts/sample-web-stack.yaml',
      metadata: JSON.stringify({ note: 'seed' }),
      stackId: stack.id,
      targetId: target.id,
    },
  })

  // 5) Create a job referencing the artifact
  await prisma.deployment_jobs.create({
    data: {
      id: crypto.randomUUID(),
      mode: 'export',
      status: 'queued',
      logs: '[]',
      stackId: stack.id,
      targetId: target.id,
      artifactId: artifact.id,
      createdBy: 'seed-script',
      updatedAt: new Date(),
    },
  })

  // Ensure the sample stack has at least one service even when the stack
  // already existed (the upsert update-branch doesn't touch relations).
  if (nginxService) {
    const existing = await prisma.stack_services.findFirst({
      where: { stackId: stack.id, serviceId: nginxService.id },
    })
    if (!existing) {
      await prisma.stack_services.create({
        data: { id: crypto.randomUUID(), stackId: stack.id, serviceId: nginxService.id, order: 1 },
      })
    }
  }

  // Sample deployment logs so the stack detail Logs tab has real data
  const existingLogs = await prisma.deployment_logs.count({ where: { stackId: stack.id } })
  if (existingLogs === 0) {
    await prisma.deployment_logs.createMany({
      data: [
        { stackId: stack.id, level: 'info', source: 'compose', message: 'Deployment queued for Sample Web Stack' },
        { stackId: stack.id, level: 'debug', source: 'compose', message: 'Generated docker-compose.yaml (1 service)' },
        { stackId: stack.id, level: 'info', source: 'nginx', message: 'Pulling image nginx:latest' },
        { stackId: stack.id, level: 'warn', source: 'compose', message: 'No healthcheck defined for service nginx' },
        { stackId: stack.id, level: 'info', source: 'nginx', message: 'Container started, listening on port 80' },
      ],
    })
  }

  // Demo login user for local development; owns the sample stack so the
  // dashboard and /stacks show data right after signing in.
  const demoPassword = process.env.SEED_DEMO_PASSWORD || 'demo1234'
  const demoUser = await prisma.users.upsert({
    where: { email: 'demo@buildmystack.dev' },
    // Single-user setup: the demo user is also the admin (reviews template submissions)
    update: { passwordHash: hashPassword(demoPassword), role: 'admin' },
    create: {
      id: crypto.randomUUID(),
      email: 'demo@buildmystack.dev',
      name: 'Demo User',
      passwordHash: hashPassword(demoPassword),
      role: 'admin',
      updatedAt: new Date(),
    },
  })
  await prisma.stacks.update({
    where: { id: stack.id },
    data: { userId: demoUser.id },
  })
  console.log(`👤 Demo user: demo@buildmystack.dev / ${demoPassword}`)

  console.log('✅ Database seed completed successfully!')
  console.log('📊 Summary:')
  console.log(`   - Categories: ${defaultCategories.length}`)
  console.log('   - Services: 50+ across 7 categories (idempotent upserts)')
  console.log('   - Use-case templates: 6 curated compositions (resolved by slug)')
  console.log('   - Deployment fixtures: target, override, artifact, job, and sample stack')
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error('❌ Seed failed:', e)
    await prisma.$disconnect()
    process.exit(1)
  })