import { AppConfig } from '@/types/globals'

export const APP_CONFIG: AppConfig = {
  name: 'Stapelwerk',
  version: '0.1.2',
  description:
    'Guided Docker stack composer for self-hosters. Compose a Jellyfin + *arr media server, verify the VPN kill-switch by construction, export a compose file that runs anywhere. AGPL-3.0, free forever.',
}

export const ROUTES = {
  HOME: '/',
  ABOUT: '/about',
  DOCS: '/docs',
} as const

export const METADATA = {
  title: APP_CONFIG.name,
  description: APP_CONFIG.description,
  keywords: ['docker', 'stack', 'builder', 'home', 'server', 'deployment'],
}