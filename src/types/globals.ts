// Global type definitions for BuildMyStack

export interface AppConfig {
  name: string
  version: string
  description: string
}

export interface PageProps<P = Record<string, string>, SP = Record<string, string | string[] | undefined>> {
  params?: Promise<P>
  searchParams?: Promise<SP>
}

export interface LayoutProps<P = Record<string, string>> {
  children: React.ReactNode
  params?: Promise<P>
}
