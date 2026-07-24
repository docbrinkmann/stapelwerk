/// <reference types="next" />

// Google Analytics gtag extension
declare global {
  interface Window {
    gtag?: (
      command: 'event' | 'config' | 'set' | 'get',
      targetId: string,
      config?: {
        [key: string]: any;
      }
    ) => void;
  }
}

// Service Browser types that may be used globally
export interface GlobalServiceItem {
  id: string;
  name: string;
  category?: string;
  description?: string;
}

export {};