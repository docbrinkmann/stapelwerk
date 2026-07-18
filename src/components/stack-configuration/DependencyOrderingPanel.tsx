import React, { useState, useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import type { Service } from '@/types/service';

interface DependencyOrderingPanelProps {
  services: Service[];
  dependencies: Record<string, string[]>;
  onChange: (dependencies: Record<string, string[]>) => void;
  currentServiceId?: string;
}

export const DependencyOrderingPanel: React.FC<DependencyOrderingPanelProps> = ({
  services,
  dependencies,
  onChange,
  currentServiceId,
}) => {
  const [selectedService, setSelectedService] = useState<string>('');
  const [circularDeps, setCircularDeps] = useState<string[]>([]);

  // Detect circular dependencies
  useEffect(() => {
    const detectCircularDependencies = (deps: Record<string, string[]>): string[] => {
      const WHITE = 0; // Unvisited
      const GRAY = 1; // Being processed
      const BLACK = 2; // Fully processed
      
      const colors: Record<string, number> = {};
      const circular: Set<string> = new Set();
      
      // Initialize all services as unvisited
      services.forEach(service => {
        colors[String(service.id)] = WHITE;
      });
      
      const hasCycleDFS = (serviceId: string, path: string[]): boolean => {
        if (colors[serviceId] === GRAY) {
          // Found a back edge - circular dependency
          const cycleStart = path.indexOf(serviceId);
          if (cycleStart >= 0) {
            path.slice(cycleStart).forEach(id => circular.add(id));
          }
          return true;
        }
        
        if (colors[serviceId] === BLACK) {
          return false; // Already processed
        }
        
        colors[serviceId] = GRAY;
        const serviceDeps = deps[serviceId] || [];
        
        for (const depId of serviceDeps) {
          if (hasCycleDFS(depId, [...path, serviceId])) {
            circular.add(serviceId);
            return true;
          }
        }
        
        colors[serviceId] = BLACK;
        return false;
      };
      
      // Check all services
      services.forEach(service => {
        if (colors[String(service.id)] === WHITE) {
          hasCycleDFS(String(service.id), []);
        }
      });
      
      return Array.from(circular);
    };

    setCircularDeps(detectCircularDependencies(dependencies));
  }, [dependencies]);

  const addDependency = (service: string, dependency: string) => {
    const currentDeps = dependencies[service] || [];
    if (!currentDeps.includes(dependency) && service !== dependency) {
      onChange({
        ...dependencies,
        [service]: [...currentDeps, dependency],
      });
    }
  };

  const removeDependency = (service: string, dependency: string) => {
    const currentDeps = dependencies[service] || [];
    onChange({
      ...dependencies,
      [service]: currentDeps.filter(dep => dep !== dependency),
    });
  };

  const getStartupOrder = (): string[] => {
    const visited = new Set<string>();
    const order: string[] = [];

    const visit = (service: string) => {
      if (visited.has(service)) return;
      visited.add(service);

      const deps = dependencies[service] || [];
      deps.forEach(dep => visit(dep));
      
      order.push(service);
    };

    services.forEach(service => {
      if (!visited.has(String(service.id))) {
        visit(String(service.id));
      }
    });

    return order;
  };

  const availableDependencies = (serviceId: string) => {
    return services.filter(s => 
      String(s.id) !== serviceId && 
      !(dependencies[serviceId] || []).includes(String(s.id))
    );
  };

  const startupOrder = getStartupOrder();

  return (
    <div className="space-y-6">
      {/* Circular dependency warning */}
      {circularDeps.length > 0 && (
        <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-md">
          <div className="flex">
            <div className="flex-shrink-0">
              <AlertTriangle className="h-4 w-4 text-destructive" aria-hidden="true" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-destructive">
                Circular Dependencies Detected
              </h3>
              <div className="mt-2 text-sm text-destructive">
                <p>The following services have circular dependencies:</p>
                <ul className="list-disc list-inside mt-1">
                  {circularDeps.map(service => (
                    <li key={service}>{service}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Service dependency configuration */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium">Configure Dependencies</h3>
        
        {services.map(service => (
          <div key={service.id} className="border rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium">{service.name}</h4>
              <span className="text-sm text-muted-foreground">
                Order: {startupOrder.indexOf(String(service.id)) + 1}
              </span>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Depends on:
              </label>
              
              {/* Current dependencies */}
              <div className="flex flex-wrap gap-2 mb-2">
                {(dependencies[String(service.id)] || []).map(dep => {
                  const depService = services.find(s => String(s.id) === dep);
                  return (
                    <span
                      key={dep}
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        circularDeps.includes(String(service.id)) 
                          ? 'bg-destructive/10 text-destructive'
                          : 'bg-info/10 text-info'
                      }`}
                    >
                      {depService?.name || dep}
                      <button
                        onClick={() => removeDependency(String(service.id), dep)}
                        className="ml-1.5 text-current hover:text-destructive"
                        data-testid="remove-dependency"
                      >
                        ×
                      </button>
                    </span>
                  );
                })}
              </div>

              {/* Add dependency */}
              <div className="flex gap-2">
                <select
                  value={selectedService}
                  onChange={(e) => setSelectedService(e.target.value)}
                  className="block w-full rounded-md border-border shadow-sm focus:border-ring focus:ring-ring"
                >
                  <option value="">Select dependency...</option>
                  {availableDependencies(String(service.id)).map(dep => (
                    <option key={dep.id} value={String(dep.id)}>
                      {dep.name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => {
                    if (selectedService) {
                      addDependency(String(service.id), selectedService);
                      setSelectedService('');
                    }
                  }}
                  disabled={!selectedService}
                  className="px-3 py-2 text-sm bg-primary text-white rounded hover:bg-primary/90 disabled:bg-muted"
                  data-testid="add-dependency"
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Startup order visualization */}
      <div className="border-t pt-6">
        <h3 className="text-lg font-medium mb-4">Startup Order</h3>
        <div className="space-y-2" data-testid="startup-order">
          {startupOrder.map((serviceId, index) => {
            const service = services.find(s => String(s.id) === serviceId);
            return (
              <div
                key={serviceId}
                className={`flex items-center gap-3 p-3 rounded ${
                  circularDeps.includes(serviceId) 
                    ? 'bg-destructive/10 border border-destructive/30' 
                    : 'bg-muted'
                }`}
              >
                <span className="flex-shrink-0 w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center text-sm font-medium">
                  {index + 1}
                </span>
                <div className="flex-1">
                  <div className="font-medium">{service?.name}</div>
                  {dependencies[serviceId] && dependencies[serviceId].length > 0 && (
                    <div className="text-sm text-muted-foreground">
                      Waits for: {dependencies[serviceId]
                        .map(dep => services.find(s => String(s.id) === dep)?.name || dep)
                        .join(', ')}
                    </div>
                  )}
                </div>
                {circularDeps.includes(serviceId) && (
                  <span className="text-destructive text-sm">Circular dependency</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};