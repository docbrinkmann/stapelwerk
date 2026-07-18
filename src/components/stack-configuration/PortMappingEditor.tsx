import React, { useState } from 'react';
import type { Service } from '@/types/service';

interface PortMapping {
  containerPort: number;
  hostPort: number;
  protocol: 'tcp' | 'udp';
}

interface PortMappingEditorProps {
  service: Service;
  portMappings: PortMapping[];
  onChange: (mappings: PortMapping[]) => void;
  usedPorts: number[];
}

export const PortMappingEditor: React.FC<PortMappingEditorProps> = ({
  service,
  portMappings,
  onChange,
  usedPorts,
}) => {
const [showAddForm, setShowAddForm] = useState(false);
  const [newMapping, setNewMapping] = useState<{
    hostPort: string;
    containerPort: string;
    protocol: 'tcp' | 'udp';
  }>({
    hostPort: '',
    containerPort: '',
    protocol: 'tcp',
  });
  const isPortInRange = (p: number) => p >= 1 && p <= 65535;
  const hasPortRangeError = (val: string) => {
    const n = parseInt(val);
    return !!val && (!Number.isFinite(n) || !isPortInRange(n));
  };
  
  // Normalize service ports (support number[] or objects)
  const normalizedPorts = Array.isArray(service.ports)
    ? service.ports.map((p: any) => typeof p === 'number' ? ({ port: p, name: String(p), protocol: 'tcp' }) : p)
    : [];

const hostPortDuplicateMap = portMappings.reduce<Record<number, number>>((acc, m) => {
    acc[m.hostPort] = (acc[m.hostPort] || 0) + 1; return acc;
  }, {});

  const handleAddMapping = () => {
    const hostPort = parseInt(newMapping.hostPort);
    const containerPort = parseInt(newMapping.containerPort);
    
if (hostPort && containerPort && isPortInRange(hostPort) && isPortInRange(containerPort)) {
      const mapping: PortMapping = {
        hostPort,
        containerPort,
        protocol: newMapping.protocol,
      };
      
      onChange([...portMappings, mapping]);
      setNewMapping({ hostPort: '', containerPort: '', protocol: 'tcp' });
      setShowAddForm(false);
    }
  };

const handleRemoveMapping = (toRemove: PortMapping) => {
    onChange(portMappings.filter(m => !(m.containerPort === toRemove.containerPort && m.hostPort === toRemove.hostPort)));
  };

const isPortConflict = (port: number) => {
    const dup = (hostPortDuplicateMap[port] || 0) > 1;
    return dup || (usedPorts?.includes(port) || false);
  };

  return (
    <div className="space-y-4">
      {/* Default service ports */}
{/* Conflict banner for duplicates */}

      {normalizedPorts.map((port: any) => {
        const mapping = portMappings.find(m => m.containerPort === port.port);
        const hostPort = mapping?.hostPort || port.port;
        const hasConflict = isPortConflict(hostPort);
        
return (
          <div key={port.port} className="flex items-center gap-4">
            <div className="flex-1">
<label htmlFor={`container-port-${port.port}`} className="block text-sm font-medium text-foreground">
                Container Port (default)
              </label>
              <input
                id={`container-port-${port.port}`}
                type="number"
                value={port.port}
                readOnly
                className="mt-1 block w-full rounded-md border-border shadow-sm bg-muted"
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-foreground">
                Host Port for {port.name} ({port.port}/{port.protocol})
              </label>
              <input
                type="number"
                value={hostPort}
                onChange={(e) => {
                  const newPort = parseInt(e.target.value);
                  if (newPort) {
                    const existingMapping = portMappings.find(m => m.containerPort === port.port);
                    if (existingMapping) {
                      onChange(portMappings.map(m => 
                        m.containerPort === port.port 
                          ? { ...m, hostPort: newPort }
                          : m
                      ));
                    } else {
                      onChange([...portMappings, {
                        hostPort: newPort,
                        containerPort: port.port,
                        protocol: port.protocol as 'tcp' | 'udp',
                      }]);
                    }
                  }
                }}
className={`mt-1 block w-full rounded-md shadow-sm focus:border-ring focus:ring-ring ${
                  hasConflict ? 'border-destructive' : 'border-border'
                }`}
              />
              {hasConflict && (
                <p className="mt-1 text-sm text-destructive">Port {hostPort} is already in use</p>
              )}
            </div>
            <div className="w-40">
              <label htmlFor={`protocol-${port.port}`} className="block text-sm font-medium text-foreground">Protocol</label>
              <select
                id={`protocol-${port.port}`}
                value={(portMappings.find(m => m.containerPort === port.port)?.protocol) || port.protocol}
                onChange={(e) => {
                  const proto = e.target.value as 'tcp' | 'udp'
                  const existing = portMappings.find(m => m.containerPort === port.port)
                  if (existing) {
                    onChange(portMappings.map(m => m.containerPort === port.port ? { ...m, protocol: proto } : m))
                  } else {
                    onChange([...portMappings, { containerPort: port.port, hostPort: hostPort, protocol: proto }])
                  }
                }}
                className="mt-1 block w-full rounded-md border-border shadow-sm focus:border-ring focus:ring-ring"
              >
                <option value="tcp">TCP</option>
                <option value="udp">UDP</option>
              </select>
            </div>
          </div>
        );
      })}

      {/* Custom port mappings */}
{portMappings.filter(mapping => 
        !normalizedPorts.some((port: any) => port.port === mapping.containerPort)
      ).map((mapping, idx) => (
<div key={`${mapping.containerPort}-${mapping.hostPort}-${idx}`} className="flex items-center gap-4 p-3 bg-muted rounded">
          <div className="flex-1">
            <span className="text-sm">
              {mapping.hostPort} → {mapping.containerPort}/{mapping.protocol}
            </span>
            {isPortConflict(mapping.hostPort) && (
              <p className="text-sm text-destructive">Port conflict detected</p>
            )}
          </div>
          <button
onClick={() => handleRemoveMapping(mapping)}
            className="text-destructive hover:text-destructive/80"
            data-testid="remove-port-mapping"
          >
            Remove
          </button>
        </div>
      ))}

      {/* Add custom mapping */}
      <div className="border-t pt-4">
        {!showAddForm ? (
          <button
            onClick={() => setShowAddForm(true)}
            className="text-sm text-primary hover:text-primary/80"
            data-testid="add-port-mapping"
          >
            + Add custom port mapping
          </button>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label htmlFor="host-port" className="block text-sm font-medium text-foreground">
                  Host Port
                </label>
<input
                  type="number"
                  id="host-port"
                  value={newMapping.hostPort}
                  onChange={(e) => setNewMapping(prev => ({ ...prev, hostPort: e.target.value }))}
                  className="mt-1 block w-full rounded-md border-border shadow-sm focus:border-ring focus:ring-ring"
                />
                {hasPortRangeError(newMapping.hostPort) && (
                  <p className="mt-1 text-sm text-destructive">Port must be between 1 and 65535</p>
                )}
              </div>
              <div>
                <label htmlFor="container-port" className="block text-sm font-medium text-foreground">
                  Container Port
                </label>
<input
                  type="number"
                  id="container-port"
                  value={newMapping.containerPort}
                  onChange={(e) => setNewMapping(prev => ({ ...prev, containerPort: e.target.value }))}
                  className="mt-1 block w-full rounded-md border-border shadow-sm focus:border-ring focus:ring-ring"
                />
                {hasPortRangeError(newMapping.containerPort) && (
                  <p className="mt-1 text-sm text-destructive">Port must be between 1 and 65535</p>
                )}
              </div>
              <div>
                <label htmlFor="protocol" className="block text-sm font-medium text-foreground">
                  Protocol
                </label>
                <select
                  id="protocol"
                  value={newMapping.protocol}
                  onChange={(e) => setNewMapping(prev => ({ ...prev, protocol: e.target.value as 'tcp' | 'udp' }))}
                  className="mt-1 block w-full rounded-md border-border shadow-sm focus:border-ring focus:ring-ring"
                >
                  <option value="tcp">TCP</option>
                  <option value="udp">UDP</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2">
<button
                onClick={handleAddMapping}
                className="px-3 py-1 text-sm bg-primary text-white rounded hover:bg-primary/90"
                data-testid="save-port-mapping"
                disabled={hasPortRangeError(newMapping.hostPort) || hasPortRangeError(newMapping.containerPort) || !newMapping.hostPort || !newMapping.containerPort}
              >
                Add
              </button>
              <button
                onClick={() => setShowAddForm(false)}
                className="px-3 py-1 text-sm bg-muted text-foreground rounded hover:bg-muted/80"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};