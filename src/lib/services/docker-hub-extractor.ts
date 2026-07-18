import { z } from 'zod'

// Docker Hub API response types
interface DockerHubRepository {
  name: string
  namespace: string
  repository_type: string
  status: number
  description: string
  is_private: boolean
  is_automated: boolean
  can_edit: boolean
  star_count: number
  pull_count: number
  last_updated: string
  date_registered: string
  collaborator: boolean
  has_starred: boolean
}

interface DockerHubTag {
  creator: number
  id: number
  image_id: string | null
  images: DockerHubImage[]
  last_updated: string
  last_updater: number
  last_updater_username: string
  name: string
  repository: number
  full_size: number
  v2: boolean
}

interface DockerHubImage {
  architecture: string
  features: string
  variant: string | null
  digest: string
  os: string
  os_features: string
  os_version: string | null
  size: number
  status: string
  last_pushed: string
  last_pulled: string | null
}

interface DockerHubTagResponse {
  count: number
  next: string | null
  previous: string | null
  results: DockerHubTag[]
}

// Dockerfile parsing types
interface ParsedDockerfile {
  baseImage: string
  exposedPorts: number[]
  environmentVariables: Record<string, string>
  labels: Record<string, string>
  workdir?: string
  user?: string
  entrypoint?: string[]
  cmd?: string[]
  volumes: string[]
}

// Extracted metadata schema
export const ExtractedMetadataSchema = z.object({
  name: z.string(),
  namespace: z.string(),
  description: z.string().nullable(),
  tags: z.array(z.string()),
  pullCount: z.number(),
  starCount: z.number(),
  isOfficial: z.boolean(),
  isAutomated: z.boolean(),
  lastUpdated: z.string(),
  exposedPorts: z.array(z.object({
    containerPort: z.number(),
    protocol: z.string().default('tcp'),
    description: z.string().optional()
  })),
  environmentVariables: z.array(z.object({
    name: z.string(),
    defaultValue: z.string().optional(),
    required: z.boolean().default(false),
    type: z.string().default('string'),
    description: z.string().optional()
  })),
  volumes: z.array(z.string()),
  labels: z.record(z.string(), z.string()),
  baseImage: z.string().optional(),
  workdir: z.string().optional(),
  user: z.string().optional(),
  entrypoint: z.array(z.string()).optional(),
  cmd: z.array(z.string()).optional()
})

export type ExtractedMetadata = z.infer<typeof ExtractedMetadataSchema>

export class DockerHubExtractor {
  private readonly baseUrl = 'https://hub.docker.com/v2'
  private readonly timeout = 30000 // 30 seconds timeout

  /**
   * Extract metadata from Docker Hub repository
   */
  async extractMetadata(imageUrl: string): Promise<ExtractedMetadata> {
    const { namespace, repository } = this.parseImageUrl(imageUrl)
    
    try {
      // Fetch repository information
      const repoInfo = await this.fetchRepositoryInfo(namespace, repository)
      
      // Fetch tags information
      const tagsInfo = await this.fetchTagsInfo(namespace, repository)
      
      // Get the latest tag for detailed inspection
      const latestTag = tagsInfo.results.find(tag => tag.name === 'latest') || tagsInfo.results[0]
      
      // Extract port and environment information from the image
      const dockerfileInfo = await this.extractDockerfileInfo(namespace, repository, latestTag?.name || 'latest')

      return {
        name: repository,
        namespace: namespace,
        description: repoInfo.description || null,
        tags: tagsInfo.results.map(tag => tag.name).slice(0, 10), // Limit to 10 most recent tags
        pullCount: repoInfo.pull_count,
        starCount: repoInfo.star_count,
        isOfficial: namespace === 'library',
        isAutomated: repoInfo.is_automated,
        lastUpdated: repoInfo.last_updated,
        exposedPorts: dockerfileInfo.exposedPorts.map(port => ({
          containerPort: port,
          protocol: 'tcp',
          description: `Port ${port} exposed by the container`
        })),
        environmentVariables: Object.entries(dockerfileInfo.environmentVariables).map(([name, value]) => ({
          name,
          defaultValue: value,
          required: false,
          type: this.inferVariableType(value),
          description: `Environment variable ${name}`
        })),
        volumes: dockerfileInfo.volumes,
        labels: dockerfileInfo.labels,
        baseImage: dockerfileInfo.baseImage,
        workdir: dockerfileInfo.workdir,
        user: dockerfileInfo.user,
        entrypoint: dockerfileInfo.entrypoint,
        cmd: dockerfileInfo.cmd
      }
    } catch (error) {
      console.error('Error extracting Docker Hub metadata:', error)
      throw new Error(`Failed to extract metadata for ${imageUrl}: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Parse Docker Hub image URL
   */
  private parseImageUrl(imageUrl: string): { namespace: string; repository: string } {
    // Remove protocol if present
    let cleanUrl = imageUrl.replace(/^https?:\/\//, '')
    
    // Remove docker.io or hub.docker.com prefix if present
    cleanUrl = cleanUrl.replace(/^(?:docker\.io\/|hub\.docker\.com\/r\/)?/, '')
    
    // Split into parts
    const parts = cleanUrl.split('/')
    
    if (parts.length === 1) {
      // Official image (e.g., "nginx")
      return {
        namespace: 'library',
        repository: parts[0].split(':')[0] // Remove tag if present
      }
    } else if (parts.length === 2) {
      // User/org image (e.g., "bitnami/nginx")
      return {
        namespace: parts[0],
        repository: parts[1].split(':')[0] // Remove tag if present
      }
    } else {
      throw new Error(`Invalid Docker Hub URL format: ${imageUrl}`)
    }
  }

  /**
   * Fetch repository information from Docker Hub API
   */
  private async fetchRepositoryInfo(namespace: string, repository: string): Promise<DockerHubRepository> {
    const url = `${this.baseUrl}/repositories/${namespace}/${repository}/`
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(this.timeout)
    })

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Repository ${namespace}/${repository} not found on Docker Hub`)
      }
      throw new Error(`Failed to fetch repository info: ${response.status} ${response.statusText}`)
    }

    return await response.json()
  }

  /**
   * Fetch tags information from Docker Hub API
   */
  private async fetchTagsInfo(namespace: string, repository: string): Promise<DockerHubTagResponse> {
    const url = `${this.baseUrl}/repositories/${namespace}/${repository}/tags/?page_size=50`
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(this.timeout)
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch tags info: ${response.status} ${response.statusText}`)
    }

    return await response.json()
  }

  /**
   * Extract Dockerfile information (simulated for now)
   * In a real implementation, this would analyze the image layers or use Docker Registry API
   */
  private async extractDockerfileInfo(namespace: string, repository: string, tag: string): Promise<ParsedDockerfile> {
    // For now, we'll return some common defaults based on known images
    // In a real implementation, this would use Docker Registry API or image inspection
    
    const knownConfigs = this.getKnownImageConfig(repository)
    
    return {
      baseImage: knownConfigs?.baseImage || 'unknown',
      exposedPorts: knownConfigs?.ports || [],
      environmentVariables: knownConfigs?.env || {},
      labels: {},
      volumes: knownConfigs?.volumes || [],
      workdir: knownConfigs?.workdir,
      user: knownConfigs?.user,
      entrypoint: knownConfigs?.entrypoint,
      cmd: knownConfigs?.cmd
    }
  }

  /**
   * Get known configuration for popular images
   */
  private getKnownImageConfig(repository: string): {
    baseImage?: string
    ports?: number[]
    env?: Record<string, string>
    volumes?: string[]
    workdir?: string
    user?: string
    entrypoint?: string[]
    cmd?: string[]
  } | null {
    const knownConfigs: Record<string, any> = {
      'nginx': {
        baseImage: 'debian',
        ports: [80],
        volumes: ['/var/log/nginx', '/etc/nginx/conf.d'],
        workdir: '/etc/nginx',
        user: 'root',
        cmd: ['nginx', '-g', 'daemon off;']
      },
      'postgres': {
        baseImage: 'debian',
        ports: [5432],
        env: {
          POSTGRES_PASSWORD: '',
          POSTGRES_USER: 'postgres',
          POSTGRES_DB: 'postgres'
        },
        volumes: ['/var/lib/postgresql/data'],
        user: 'postgres'
      },
      'mysql': {
        baseImage: 'debian',
        ports: [3306],
        env: {
          MYSQL_ROOT_PASSWORD: '',
          MYSQL_DATABASE: '',
          MYSQL_USER: '',
          MYSQL_PASSWORD: ''
        },
        volumes: ['/var/lib/mysql'],
        user: 'mysql'
      },
      'redis': {
        baseImage: 'debian',
        ports: [6379],
        volumes: ['/data'],
        workdir: '/data',
        user: 'redis'
      },
      'mongodb': {
        baseImage: 'debian',
        ports: [27017],
        env: {
          MONGO_INITDB_ROOT_USERNAME: '',
          MONGO_INITDB_ROOT_PASSWORD: '',
          MONGO_INITDB_DATABASE: ''
        },
        volumes: ['/data/db'],
        user: 'mongodb'
      },
      'node': {
        baseImage: 'debian',
        env: {
          NODE_VERSION: '18',
          PATH: '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin'
        },
        workdir: '/app',
        user: 'node'
      },
      'python': {
        baseImage: 'debian',
        env: {
          PYTHON_VERSION: '3.11',
          PATH: '/usr/local/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin'
        },
        workdir: '/app'
      },
      'httpd': {
        baseImage: 'debian',
        ports: [80],
        volumes: ['/usr/local/apache2/htdocs'],
        workdir: '/usr/local/apache2',
        user: 'www-data'
      }
    }

    return knownConfigs[repository.toLowerCase()] || null
  }

  /**
   * Infer the type of an environment variable based on its value
   */
  private inferVariableType(value: string): string {
    if (!value) return 'string'
    
    // Check if it's a boolean
    if (value.toLowerCase() === 'true' || value.toLowerCase() === 'false') {
      return 'boolean'
    }
    
    // Check if it's a number
    if (/^\d+$/.test(value)) {
      return 'number'
    }
    
    // Check if it's a port
    if (/^\d+$/.test(value) && parseInt(value) <= 65535) {
      return 'port'
    }
    
    // Check if it's a file path
    if (value.startsWith('/') || value.includes('\\')) {
      return 'path'
    }
    
    // Check if it's a URL
    if (value.startsWith('http://') || value.startsWith('https://')) {
      return 'url'
    }
    
    return 'string'
  }

  /**
   * Validate that an image exists on Docker Hub
   */
  async validateImageExists(imageUrl: string): Promise<boolean> {
    try {
      const { namespace, repository } = this.parseImageUrl(imageUrl)
      await this.fetchRepositoryInfo(namespace, repository)
      return true
    } catch (error) {
      return false
    }
  }

  /**
   * Get popular tags for a repository
   */
  async getPopularTags(imageUrl: string, limit = 10): Promise<string[]> {
    const { namespace, repository } = this.parseImageUrl(imageUrl)
    
    try {
      const tagsInfo = await this.fetchTagsInfo(namespace, repository)
      
      // Sort by last updated and return most recent
      return tagsInfo.results
        .sort((a, b) => new Date(b.last_updated).getTime() - new Date(a.last_updated).getTime())
        .slice(0, limit)
        .map(tag => tag.name)
    } catch (error) {
      console.error('Error fetching popular tags:', error)
      return []
    }
  }
}