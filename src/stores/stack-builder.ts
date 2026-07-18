import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { useShallow } from 'zustand/react/shallow';
import type { Service, ServiceEnvVar } from '../types/service';
import type { StackService, StackServiceConfiguration } from '../types/stack';
import { stackPersistence, type PersistedStack } from '../lib/stack-persistence';
import { DEFAULT_TARGET_PROFILE_ID } from '../lib/resource-profiles';

export interface StackBuilderState {
  // Stack metadata
  id?: string;
  name: string;
  description: string;
  isPublic: boolean;

  // Stack services
  services: StackService[];

  // State management
  isDirty: boolean;
  lastSaved?: Date;
  autoSaveEnabled: boolean;

  // Resource budgeting: which target hardware profile to check the stack against
  targetProfileId: string;
  setTargetProfile: (profileId: string) => void;

  // Actions
  updateName: (name: string) => void;
  updateDescription: (description: string) => void;
  togglePublic: () => void;
  
  // Service management
  addService: (service: Service) => void;
  removeService: (serviceId: number) => void;
  reorderServices: (services: StackService[]) => void;
  updateServiceConfiguration: (serviceId: number, configuration: StackServiceConfiguration) => void;
  
  // Stack operations
  clearStack: () => void;
  loadStack: (stackData: Partial<StackBuilderState>) => void;
  exportStack: () => {
    name: string;
    description: string;
    isPublic: boolean;
    services: StackService[];
  };
  
  // Persistence operations
  saveAsDraft: () => Promise<void>;
  savePermanently: () => Promise<void>;
  exportDockerCompose: () => string;
  exportAsJSON: () => string;
  importFromJSON: (jsonContent: string) => void;
  importFromDockerCompose: (yamlContent: string) => void;
  startAutoSave: () => void;
  stopAutoSave: () => void;
  toggleAutoSave: () => void;
  
  // Validation and computed properties
  isValid: boolean;
  validationErrors: string[];
  totalServices: number;
  hasChanges: boolean;
  getServicesByCategory: (categoryName: string) => StackService[];
  getStackValidationErrors: () => string[];
}

const initialState = {
  name: '',
  description: '',
  isPublic: false,
  services: [],
  isDirty: false,
  autoSaveEnabled: true,
  targetProfileId: DEFAULT_TARGET_PROFILE_ID,
};

// Helper functions
const generateStackServiceId = (serviceId: number): string => {
  return `stack-service-${serviceId}-${Date.now()}`;
};

// Read env metadata off a service. The services API returns the seeded catalog
// metadata as an ARRAY under `environmentVariables` (parsed from a JSON string);
// tolerate a raw JSON string and the legacy `Record<string,string>` shape too.
const readServiceEnvMeta = (service: Service): ServiceEnvVar[] => {
  let raw: unknown = service.env ?? service.environmentVariables;
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw);
    } catch {
      raw = [];
    }
  }
  if (Array.isArray(raw)) {
    return raw.filter(
      (e): e is ServiceEnvVar =>
        !!e && typeof e === 'object' && typeof (e as ServiceEnvVar).name === 'string'
    );
  }
  // Legacy object form: { NAME: 'default', ... }
  if (raw && typeof raw === 'object') {
    return Object.entries(raw as Record<string, unknown>).map(([name, value]) => ({
      name,
      default: typeof value === 'string' ? value : undefined,
    }));
  }
  return [];
};

const createDefaultConfiguration = (service: Service): StackServiceConfiguration => {
  // Services from the API may have ports as numbers or objects ({ containerPort, protocol, ... })
  const rawPorts = (service.ports ?? []) as Array<number | { containerPort?: number }>;
  const portNumbers = rawPorts
    .map(port => (typeof port === 'number' ? port : port?.containerPort))
    .filter((port): port is number => typeof port === 'number');

  // Seed env config from catalog metadata: non-secret vars get their default,
  // secret vars are left empty so the compose generator auto-fills them.
  const environmentVariables: Record<string, string> = {};
  for (const envVar of readServiceEnvMeta(service)) {
    environmentVariables[envVar.name] = envVar.secret ? '' : envVar.default ?? '';
  }

  return {
    environmentVariables,
    portMappings: portNumbers.map(port => ({
      containerPort: port,
      hostPort: port,
    })),
    volumeMounts: [],
    dependsOn: [],
  };
};

const validateStack = (state: Pick<StackBuilderState, 'name' | 'services'>): string[] => {
  const errors: string[] = [];
  
  if (!state.name.trim()) {
    errors.push('Stack name is required');
  }
  
  if (state.services.length === 0) {
    errors.push('At least one service is required');
  }
  
  // Check for port conflicts
  const usedPorts = new Set<number>();
  const conflictingPorts: number[] = [];
  
  state.services.forEach(stackService => {
    // Configs loaded from the dashboard list are thin (no portMappings), and
    // some legacy shapes store portMappings as an object — guard both so
    // loadStack() can't throw "Cannot read properties of undefined (forEach)".
    const mappings = stackService.configuration?.portMappings;
    if (!Array.isArray(mappings)) return;
    mappings.forEach(mapping => {
      if (usedPorts.has(mapping.hostPort)) {
        conflictingPorts.push(mapping.hostPort);
      } else {
        usedPorts.add(mapping.hostPort);
      }
    });
  });
  
  if (conflictingPorts.length > 0) {
    errors.push('Port conflicts detected');
  }
  
  return errors;
};

// Helper function to update computed properties - defined outside to prevent dependency issues
const updateComputedProperties = (state: any) => {
  const validationErrors = validateStack(state);
  state.isValid = validationErrors.length === 0;
  state.validationErrors = validationErrors;
  state.totalServices = state.services.length;
  state.hasChanges = state.isDirty;
};

export const useStackBuilderStore = create<StackBuilderState>()(
  persist(
    immer((set, get) => ({
      ...initialState,
      
      // Computed properties - will be updated by the helper function
      isValid: false,
      validationErrors: [],
      totalServices: 0,
      hasChanges: false,
      
      getServicesByCategory: (categoryName: string) => {
        const currentState = get();
        return currentState.services.filter(
          stackService => stackService.service?.category?.name === categoryName
        );
      },
      
      // Actions
      updateName: (name: string) => set((state) => {
        state.name = name;
        state.isDirty = true;
        updateComputedProperties(state);
      }),
      
      updateDescription: (description: string) => set((state) => {
        state.description = description;
        state.isDirty = true;
        updateComputedProperties(state);
      }),
      
      togglePublic: () => set((state) => {
        state.isPublic = !state.isPublic;
        state.isDirty = true;
        updateComputedProperties(state);
      }),

      // Target hardware profile is a builder preference, not stack content, so
      // changing it doesn't mark the stack dirty.
      setTargetProfile: (profileId: string) => set((state) => {
        state.targetProfileId = profileId;
      }),

      addService: (service: Service) => set((state) => {
        // Check if service is already added
        const existingService = state.services.find(s => s.serviceId === service.id);
        if (existingService) {
          return; // Don't add duplicates
        }
        
        const newStackService: StackService = {
          id: generateStackServiceId(service.id),
          serviceId: service.id,
          order: state.services.length,
          service,
          configuration: createDefaultConfiguration(service),
        };
        
        state.services.push(newStackService);
        state.isDirty = true;
        updateComputedProperties(state);
      }),
      
      removeService: (serviceId: number) => set((state) => {
        const index = state.services.findIndex(s => s.serviceId === serviceId);
        if (index !== -1) {
          state.services.splice(index, 1);
          
          // Reorder remaining services
          state.services.forEach((service, idx) => {
            service.order = idx;
          });
          
          state.isDirty = true;
          updateComputedProperties(state);
        }
      }),
      
      reorderServices: (services: StackService[]) => set((state) => {
        // Sort by order and update the array
        const sortedServices = [...services].sort((a, b) => a.order - b.order);
        state.services = sortedServices;
        state.isDirty = true;
        updateComputedProperties(state);
      }),
      
      updateServiceConfiguration: (serviceId: number, configuration: StackServiceConfiguration) => set((state) => {
        const service = state.services.find(s => s.serviceId === serviceId);
        if (service) {
          service.configuration = { ...configuration };
          state.isDirty = true;
          updateComputedProperties(state);
        }
      }),
      
      clearStack: () => set((state) => {
        Object.assign(state, initialState);
        updateComputedProperties(state);
      }),
      
      loadStack: (stackData: Partial<StackBuilderState>) => set((state) => {
        if (stackData.name !== undefined) state.name = stackData.name;
        if (stackData.description !== undefined) state.description = stackData.description;
        if (stackData.isPublic !== undefined) state.isPublic = stackData.isPublic;
        if (stackData.services !== undefined) state.services = stackData.services;
        state.isDirty = false;
        updateComputedProperties(state);
      }),
      
      exportStack: () => {
        const state = get();
        return {
          name: state.name,
          description: state.description,
          isPublic: state.isPublic,
          services: state.services,
        };
      },
      
      // Persistence methods
      saveAsDraft: async () => {
        const state = get();
        const stackData: PersistedStack = {
          name: state.name,
          description: state.description,
          isPublic: state.isPublic,
          services: state.services,
        };
        
        try {
          await stackPersistence.saveToLocalStorage(stackData, { isDraft: true });
          set((draft) => {
            draft.lastSaved = new Date();
            draft.isDirty = false;
          });
        } catch (error) {
          console.error('Failed to save draft:', error);
          throw error;
        }
      },
      
      savePermanently: async () => {
        const state = get();
        const stackData: PersistedStack = {
          name: state.name,
          description: state.description,
          isPublic: state.isPublic,
          services: state.services,
        };

        try {
          // Save to local storage first as backup
          await stackPersistence.saveToLocalStorage(stackData, { isDraft: false });

          // Save to database via tRPC API client
          const savedStack = await stackPersistence.saveToDatabase(stackData);

          // Update store with saved stack ID and metadata
          set((draft) => {
            if (savedStack?.id) {
              draft.id = savedStack.id;
            }
            draft.lastSaved = new Date();
            draft.isDirty = false;
          });

          console.log('Stack saved to database successfully:', savedStack?.id);
          return savedStack;
        } catch (error) {
          console.error('Failed to save permanently:', error);
          throw error;
        }
      },
      
      exportDockerCompose: () => {
        const state = get();
        const stackData: PersistedStack = {
          name: state.name,
          description: state.description,
          isPublic: state.isPublic,
          services: state.services,
        };
        return stackPersistence.exportToDockerCompose(stackData);
      },
      
      exportAsJSON: () => {
        const state = get();
        const stackData: PersistedStack = {
          name: state.name,
          description: state.description,
          isPublic: state.isPublic,
          services: state.services,
        };
        return stackPersistence.exportAsJSON(stackData);
      },
      
      importFromJSON: (jsonContent: string) => set((state) => {
        try {
          const importedData = JSON.parse(jsonContent);
          if (importedData.name) state.name = importedData.name;
          if (importedData.description) state.description = importedData.description;
          if (importedData.isPublic !== undefined) state.isPublic = importedData.isPublic;
          if (Array.isArray(importedData.services)) {
            // Entries are either full StackServices (exportAsJSON) or raw
            // catalog services (community marketplace import). Normalize both
            // into the builder shape — an entry without a configuration used
            // to persist as-is and crash the builder on next load.
            state.services = importedData.services
              .filter(Boolean)
              .map((entry: any, idx: number): StackService => {
                const raw = entry.service ?? entry;
                // API rows carry the relation as `categories`; the builder's
                // Service shape expects `category`.
                const service: Service = raw.category || !raw.categories
                  ? raw
                  : { ...raw, category: { id: raw.categories.id ?? 0, ...raw.categories } };
                return {
                  id: entry.service ? entry.id ?? generateStackServiceId(service.id) : generateStackServiceId(service.id),
                  serviceId: service.id,
                  order: idx,
                  service,
                  configuration: entry.configuration ?? createDefaultConfiguration(service),
                };
              });
          }
          state.isDirty = true;
          updateComputedProperties(state);
        } catch (error) {
          console.error('Failed to import JSON:', error);
          throw new Error('Invalid JSON format');
        }
      }),
      
      importFromDockerCompose: (yamlContent: string) => set((state) => {
        try {
          const importedStack = stackPersistence.importFromDockerCompose(yamlContent);
          if (importedStack.name) state.name = importedStack.name;
          if (importedStack.description) state.description = importedStack.description;
          if (importedStack.isPublic !== undefined) state.isPublic = importedStack.isPublic;

          // Note: parsedServices are raw docker-compose service definitions
          // They need to be matched against our service database via the ImportStackModal
          // This method just updates metadata. Use ImportStackModal component for full import with service matching.

          state.isDirty = true;
          updateComputedProperties(state);

          console.log('Docker Compose parsed successfully. Use ImportStackModal for complete import with service matching.');
        } catch (error) {
          console.error('Failed to import Docker Compose:', error);
          throw error;
        }
      }),
      
      startAutoSave: () => {
        const state = get();
        if (!state.autoSaveEnabled) return;
        
        stackPersistence.startAutoSave(() => {
          const currentState = get();
          if (!currentState.name || currentState.services.length === 0) return null;
          
          return {
            name: currentState.name,
            description: currentState.description,
            isPublic: currentState.isPublic,
            services: currentState.services,
          };
        });
      },
      
      stopAutoSave: () => {
        stackPersistence.stopAutoSave();
      },
      
      toggleAutoSave: () => set((state) => {
        state.autoSaveEnabled = !state.autoSaveEnabled;
        if (state.autoSaveEnabled) {
          // Start auto-save
          stackPersistence.startAutoSave(() => {
            const currentState = get();
            if (!currentState.name || currentState.services.length === 0) return null;
            
            return {
              name: currentState.name,
              description: currentState.description,
              isPublic: currentState.isPublic,
              services: currentState.services,
            };
          });
        } else {
          stackPersistence.stopAutoSave();
        }
      }),
      
      getStackValidationErrors: () => {
        const state = get();
        return validateStack(state);
      },
    })),
    {
      name: 'stack-builder-state',
      storage: createJSONStorage(() => {
        // Check if we're in a browser environment
        if (typeof window !== 'undefined' && window.localStorage) {
          return localStorage;
        }
        // Check for mocked localStorage in tests (global object)
        if (typeof global !== 'undefined' && (global as any).localStorage) {
          return (global as any).localStorage;
        }
        // Fallback for SSR
        return {
          getItem: () => null,
          setItem: () => {},
          removeItem: () => {},
        };
      }),
      partialize: (state) => ({
        name: state.name,
        description: state.description,
        isPublic: state.isPublic,
        services: state.services,
        isDirty: state.isDirty,
        targetProfileId: state.targetProfileId,
      }),
      onRehydrateStorage: () => (state) => {
        // A corrupt / thin persisted stack (e.g. a service with no `service`
        // object, a missing category, or a non-array config) would crash the
        // builder on render. Sanitize on rehydrate so the builder always loads:
        // drop entries without a service, default the category, and coerce the
        // config collections to their expected shapes.
        if (!state || !Array.isArray(state.services)) return;
        try {
          state.services = state.services
            .filter((s: any) => s && typeof s === 'object' && s.service && typeof s.service === 'object')
            .map((s: any) => ({
              ...s,
              service: {
                ...s.service,
                category: s.service.category ?? { id: 0, name: 'Uncategorized' },
              },
              configuration: {
                environmentVariables:
                  s.configuration && s.configuration.environmentVariables && typeof s.configuration.environmentVariables === 'object'
                    ? s.configuration.environmentVariables
                    : {},
                portMappings: Array.isArray(s.configuration?.portMappings) ? s.configuration.portMappings : [],
                volumeMounts: Array.isArray(s.configuration?.volumeMounts) ? s.configuration.volumeMounts : [],
                dependsOn: Array.isArray(s.configuration?.dependsOn) ? s.configuration.dependsOn : [],
              },
            }));
        } catch {
          state.services = [];
        }
      },
    }
  )
);

// Helper hooks for specific use cases
export const useStackMetadata = (): {
  name: string;
  description: string;
  isPublic: boolean;
  updateName: (name: string) => void;
  updateDescription: (description: string) => void;
  togglePublic: () => void;
} => {
return useStackBuilderStore(useShallow((state) => ({
    name: state.name,
    description: state.description,
    isPublic: state.isPublic,
    updateName: state.updateName,
    updateDescription: state.updateDescription,
    togglePublic: state.togglePublic,
  })));
};

export const useStackServices = (): {
  services: StackService[];
  totalServices: number;
  addService: (service: Service) => void;
  removeService: (serviceId: number) => void;
  reorderServices: (services: StackService[]) => void;
  updateServiceConfiguration: (serviceId: number, configuration: StackServiceConfiguration) => void;
  clearStack: () => void;
  exportDockerCompose: () => string;
  exportAsJSON: () => string;
  getStackValidationErrors: () => string[];
} => {
return useStackBuilderStore(useShallow((state) => ({
    services: state.services,
    totalServices: state.totalServices,
    addService: state.addService,
    removeService: state.removeService,
    reorderServices: state.reorderServices,
    updateServiceConfiguration: state.updateServiceConfiguration,
    clearStack: state.clearStack,
    exportDockerCompose: state.exportDockerCompose,
    exportAsJSON: state.exportAsJSON,
    getStackValidationErrors: state.getStackValidationErrors,
  })));
};

export const useStackValidation = (): {
  isValid: boolean;
  validationErrors: string[];
} => {
return useStackBuilderStore(useShallow((state) => ({
    isValid: state.isValid,
    validationErrors: state.validationErrors,
  })));
};

export const useStackPersistence = (): {
  isDirty: boolean;
  hasChanges: boolean;
  lastSaved?: Date;
  autoSaveEnabled: boolean;
  clearStack: () => void;
  loadStack: (stackData: Partial<StackBuilderState>) => void;
  exportStack: () => { name: string; description: string; isPublic: boolean; services: StackService[] };
  saveAsDraft: () => Promise<void>;
  savePermanently: () => Promise<void>;
  importFromJSON: (jsonContent: string) => void;
  importFromDockerCompose: (yamlContent: string) => void;
  exportAsJSON: () => string;
  exportDockerCompose: () => string;
  startAutoSave: () => void;
  stopAutoSave: () => void;
  toggleAutoSave: () => void;
} => {
return useStackBuilderStore(useShallow((state) => ({
    isDirty: state.isDirty,
    hasChanges: state.hasChanges,
    lastSaved: state.lastSaved,
    autoSaveEnabled: state.autoSaveEnabled,
    clearStack: state.clearStack,
    loadStack: state.loadStack,
    exportStack: state.exportStack,
    saveAsDraft: state.saveAsDraft,
    savePermanently: state.savePermanently,
    importFromJSON: state.importFromJSON,
    importFromDockerCompose: state.importFromDockerCompose,
    exportAsJSON: state.exportAsJSON,
    exportDockerCompose: state.exportDockerCompose,
    startAutoSave: state.startAutoSave,
    stopAutoSave: state.stopAutoSave,
    toggleAutoSave: state.toggleAutoSave,
  })));
};

// Export alias for backward compatibility
export { useStackBuilderStore as useStackBuilder };
