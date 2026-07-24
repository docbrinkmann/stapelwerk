import { AppConfig } from '@/types/globals'

export const APP_CONFIG: AppConfig = {
  name: 'Stapelwerk',
  version: '0.1.0',
  description: 'A guided Docker stack builder for home users, freelancers, and SMEs',
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