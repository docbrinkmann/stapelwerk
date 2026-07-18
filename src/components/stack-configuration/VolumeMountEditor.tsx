import React, { useState } from 'react';
import type { Service } from '@/types/service';

interface VolumeMount {
  id?: string;
  hostPath: string;
  containerPath: string;
  readOnly?: boolean;
  type?: 'bind' | 'volume' | 'tmpfs';
  options?: { readonly?: boolean };
}

interface VolumeMountEditorProps {
  service: Service;
  volumeMounts: VolumeMount[];
  onChange: (mounts: VolumeMount[]) => void;
}

export const VolumeMountEditor: React.FC<VolumeMountEditorProps> = ({
  service,
  volumeMounts,
  onChange,
}) => {
  const [showAddForm, setShowAddForm] = useState(false);
const [newMount, setNewMount] = useState({
    hostPath: '',
    containerPath: '',
    readOnly: false,
    type: 'bind' as const,
  });

// Normalize service volumes (string[] or objects)
  // Note: Service type doesn't define volumes - this would need to be added to Service interface
  const normalizedVolumes = Array.isArray((service as any).volumes)
    ? (service as any).volumes.map((v: any, idx: number) => typeof v === 'string' ? ({ name: 'Required Volume', containerPath: v, readOnly: false, description: '', defaultHostPath: '' }) : v)
    : [];

  const handleAddMount = () => {
    if (newMount.hostPath.trim() && newMount.containerPath.trim()) {
      const mount: VolumeMount = {
        id: `${Date.now()}-${Math.random()}`,
        hostPath: newMount.hostPath.trim(),
        containerPath: newMount.containerPath.trim(),
        readOnly: newMount.readOnly,
      };
      
      onChange([...volumeMounts, mount]);
      setNewMount({ hostPath: '', containerPath: '', readOnly: false, type: 'bind' });
      setShowAddForm(false);
    }
  };

  const handleRemoveMount = (id: string) => {
    onChange(volumeMounts.filter(mount => mount.id !== id));
  };

  const handleToggleReadOnly = (id: string) => {
    onChange(volumeMounts.map(mount => 
      mount.id === id ? { ...mount, readOnly: !mount.readOnly } : mount
    ));
  };

  const validatePath = (path: string, type: 'host' | 'container') => {
    if (!path) return null;
    
if (type === 'host') {
      // Host path validation
      if (path.includes('..')) {
        return 'Invalid path format';
      }
      if (!path.startsWith('/') && !path.match(/^[a-zA-Z]:/)) {
        return 'Host path must be absolute';
      }
    } else {
      // Container path validation
      if (!path.startsWith('/')) {
        return 'Container path must be absolute';
      }
    }
    return null;
  };

  return (
    <div className="space-y-4">
      {/* Default service volumes */}
{normalizedVolumes.map((volume: any, index: number) => {
        const mount = volumeMounts.find(m => m.containerPath === volume.containerPath);
        const hostPath = mount?.hostPath || volume.defaultHostPath || '';
        
        return (
          <div key={`volume-${volume.containerPath}-${index}`} className="p-3 bg-info/10 rounded">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-sm">{volume.name}</span>
              <span className="text-xs text-muted-foreground">Required Volume</span>
            </div>
            <div className="space-y-2">
              <div>
                <label className="block text-sm font-medium text-foreground">
                  Host Path
                </label>
                <input
                  type="text"
                  value={hostPath}
                  onChange={(e) => {
                    const existingMount = volumeMounts.find(m => m.containerPath === volume.containerPath);
                    if (existingMount) {
                      onChange(volumeMounts.map(m => 
                        m.containerPath === volume.containerPath 
                          ? { ...m, hostPath: e.target.value }
                          : m
                      ));
                    } else {
                      onChange([...volumeMounts, {
                        id: `default-${volume.containerPath}`,
                        hostPath: e.target.value,
                        containerPath: volume.containerPath,
                        readOnly: volume.readOnly || false,
                      }]);
                    }
                  }}
                  className="mt-1 block w-full rounded-md border-border shadow-sm focus:border-ring focus:ring-ring"
                  placeholder={`e.g., ${volume.defaultHostPath || './data'}`}
                />
                {validatePath(hostPath, 'host') && (
                  <p className="mt-1 text-sm text-destructive">{validatePath(hostPath, 'host')}</p>
                )}
              </div>
<div>
                <label htmlFor={`container-path-default-${index}`} className="block text-sm font-medium text-foreground">
                  Container Path
                </label>
                <input
                  id={`container-path-default-${index}`}
                  type="text"
                  readOnly
                  value={volume.containerPath}
                  className="mt-1 block w-full rounded-md border-border shadow-sm bg-muted"
                />
              </div>
              <p className="text-xs text-muted-foreground">{volume.description}</p>
            </div>
          </div>
        );
      })}

      {/* Custom volume mounts */}
{volumeMounts.map((mount: any, idx: number) => (
<div key={mount.id || `${mount.containerPath}-${idx}`} className="p-3 bg-muted rounded">
          <div className="flex items-center justify-between mb-2">
            <span className="font-medium text-sm">Custom Volume</span>
            <button
              onClick={() => handleRemoveMount(mount.id)}
              className="text-destructive hover:text-destructive/80 text-sm"
              data-testid="remove-volume-mount"
            >
              Remove
            </button>
          </div>
          <div className="space-y-2">
            <div className="text-sm">
              <span className="font-medium">{mount.hostPath}</span>
              <span className="mx-2">→</span>
              <span className="font-medium">{mount.containerPath}</span>
              {mount.readOnly && <span className="ml-2 text-muted-foreground">(read-only)</span>}
            </div>
<div className="flex items-center justify-between">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={mount.readOnly}
                onChange={() => handleToggleReadOnly(mount.id)}
                className="rounded border-border text-primary shadow-sm focus:border-ring focus:ring focus:ring-ring focus:ring-opacity-50"
              />
              <span className="ml-2 text-sm text-muted-foreground">Read-only</span>
</label>
            <button
              type="button"
              className="text-sm text-primary hover:text-primary/80"
              data-testid="mount-options"
              onClick={() => {
                // Toggle read-only directly and emit change with expected shape
                const updated = volumeMounts.map((m: any) => (
                  (m.containerPath === mount.containerPath && m.hostPath === mount.hostPath)
                    ? { ...m, options: { ...(m.options || {}), readonly: !((m.options && m.options.readonly) || false) } }
                    : m
                ))
                onChange(updated)
              }}
            >
              Options
            </button>
            </div>
          </div>
        </div>
      ))}

      {/* Add custom mount */}
      <div className="border-t pt-4">
        {!showAddForm ? (
          <button
            onClick={() => setShowAddForm(true)}
            className="text-sm text-primary hover:text-primary/80"
            data-testid="add-volume-mount"
          >
            + Add custom volume mount
          </button>
        ) : (
          <div className="space-y-3">
<div>
              <label htmlFor="mount-type" className="block text-sm font-medium text-foreground">Mount Type</label>
              <select
                id="mount-type"
                value={newMount.type}
                onChange={(e) => setNewMount(prev => ({ ...prev, type: e.target.value as any }))}
                className="mt-1 block w-full rounded-md border-border shadow-sm focus:border-ring focus:ring-ring"
              >
                <option value="bind">bind</option>
                <option value="volume">volume</option>
                <option value="tmpfs">tmpfs</option>
              </select>
            </div>
            <div>
              <label htmlFor="host-path" className="block text-sm font-medium text-foreground">
                Host Path
              </label>
              <input
                type="text"
                id="host-path"
                value={newMount.hostPath}
                onChange={(e) => setNewMount(prev => ({ ...prev, hostPath: e.target.value }))}
                className="mt-1 block w-full rounded-md border-border shadow-sm focus:border-ring focus:ring-ring"
                placeholder="/host/path"
              />
              {validatePath(newMount.hostPath, 'host') && (
                <p className="mt-1 text-sm text-destructive">{validatePath(newMount.hostPath, 'host')}</p>
              )}
            </div>
            <div>
              <label htmlFor="container-path" className="block text-sm font-medium text-foreground">
                Container Path
              </label>
              <input
                type="text"
                id="container-path"
                value={newMount.containerPath}
                onChange={(e) => setNewMount(prev => ({ ...prev, containerPath: e.target.value }))}
                className="mt-1 block w-full rounded-md border-border shadow-sm focus:border-ring focus:ring-ring"
                placeholder="/container/path"
              />
              {validatePath(newMount.containerPath, 'container') && (
                <p className="mt-1 text-sm text-destructive">{validatePath(newMount.containerPath, 'container')}</p>
              )}
            </div>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={newMount.readOnly}
                onChange={(e) => setNewMount(prev => ({ ...prev, readOnly: e.target.checked }))}
                className="rounded border-border text-primary shadow-sm focus:border-ring focus:ring focus:ring-ring focus:ring-opacity-50"
              />
              <span className="ml-2 text-sm text-muted-foreground">Read-only</span>
            </label>
            <div className="flex gap-2">
              <button
                onClick={handleAddMount}
                disabled={!newMount.hostPath.trim() || !newMount.containerPath.trim() || 
                         validatePath(newMount.hostPath, 'host') !== null ||
                         validatePath(newMount.containerPath, 'container') !== null}
                className="px-3 py-1 text-sm bg-primary text-white rounded hover:bg-primary/90 disabled:bg-muted"
                data-testid="save-volume-mount"
              >
                Add
              </button>
              <button
                onClick={() => setShowAddForm(false)}
                className="px-3 py-1 text-sm bg-secondary text-secondary-foreground rounded hover:bg-secondary/80"
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