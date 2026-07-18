import React, { useState, useEffect } from 'react';
import { useStackValidation } from '@/stores/stack-builder';
import { EnvironmentVariableEditor } from './EnvironmentVariableEditor';
import { PortMappingEditor } from './PortMappingEditor';
import { VolumeMountEditor } from './VolumeMountEditor';
import { DependencyOrderingPanel } from './DependencyOrderingPanel';
import type { Service } from '@/types/service';
import type { StackServiceConfiguration } from '@/types/stack';

interface ServiceConfigurationPanelProps {
  service: Service;
  configuration: StackServiceConfiguration;
  onConfigurationChange: (serviceId: number, configuration: StackServiceConfiguration) => void;
  isOpen: boolean;
  onClose: () => void;
}

interface ConfigurationSectionProps {
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  hasErrors?: boolean;
  children: React.ReactNode;
  testId: string;
}

const ConfigurationSection: React.FC<ConfigurationSectionProps> = ({
  title,
  isOpen,
  onToggle,
  hasErrors = false,
  children,
  testId,
}) => (
  <div className="border border-border rounded-lg">
    <button
      className={`w-full px-4 py-3 text-left flex items-center justify-between hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-inset ${
        hasErrors ? 'border-destructive/50 bg-destructive/10' : ''
      }`}
      onClick={onToggle}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onToggle();
        }
      }}
      data-testid={testId}
      aria-expanded={isOpen}
      aria-controls={`${testId}-content`}
    >
      <h3 className={`font-medium ${hasErrors ? 'text-destructive' : 'text-foreground'}`}>
        {title}
        {hasErrors && (
          <span className="ml-2 inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-destructive/20 text-destructive">
            Issues
          </span>
        )}
      </h3>
      <svg
        className={`w-5 h-5 transform transition-transform text-muted-foreground ${isOpen ? 'rotate-180' : ''}`}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </button>
    {isOpen && (
      <div 
        id={`${testId}-content`}
        className="px-4 py-3 border-t border-border bg-card"
        role="region"
        aria-labelledby={testId}
      >
        {children}
      </div>
    )}
  </div>
);

export const ServiceConfigurationPanel: React.FC<ServiceConfigurationPanelProps> = ({
  service,
  configuration,
  onConfigurationChange,
  isOpen,
  onClose,
}) => {
  const { validationErrors, isValid } = useStackValidation();
  const [openSections, setOpenSections] = useState({
    environment: false,
    ports: false,
    volumes: false,
    dependencies: false,
  });

  // Check for section-specific errors - define these first
  const getSectionErrors = (section: string) => {
    return validationErrors.filter(error => 
      error.toLowerCase().includes(section.toLowerCase())
    );
  };

  // More specific error categorization
  const environmentErrors = validationErrors.filter(error => {
    const lowerError = error.toLowerCase();
    return lowerError.includes('environment') ||
           lowerError.includes('variable') ||
           lowerError.includes('postgres_') ||
           lowerError.includes('password') ||
           lowerError.includes('user') ||
           lowerError.includes('database') ||
           (service.environmentVariables && Object.keys(service.environmentVariables).some(name => lowerError.includes(name.toLowerCase())));
  });
  
  const portErrors = getSectionErrors('port');
  const volumeErrors = getSectionErrors('volume') || getSectionErrors('mount');
  const dependencyErrors = getSectionErrors('dependency') || getSectionErrors('circular');

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onClose]);

  // Auto-expand sections with validation errors
  useEffect(() => {
    if (validationErrors.length > 0) {
      setOpenSections(prev => ({
        ...prev,
        environment: environmentErrors.length > 0 ? true : prev.environment,
        ports: portErrors.length > 0 ? true : prev.ports,
        volumes: volumeErrors.length > 0 ? true : prev.volumes,
        dependencies: dependencyErrors.length > 0 ? true : prev.dependencies,
      }));
    }
  }, [validationErrors, environmentErrors.length, portErrors.length, volumeErrors.length, dependencyErrors.length]);

  // Auto-save configuration changes
  const handleConfigurationUpdate = (updates: Partial<StackServiceConfiguration>) => {
    const updatedConfiguration = { ...configuration, ...updates };
    onConfigurationChange(service.id, updatedConfiguration);
  };

  const toggleSection = (section: keyof typeof openSections) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm transition-opacity" onClick={onClose} />
        
        <div
          className="relative transform overflow-hidden rounded-lg bg-card border border-border text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-4xl"
          role="dialog"
          aria-modal="true"
          aria-labelledby="configuration-panel-title"
          aria-label="Service configuration panel"
          data-testid="service-configuration-panel"
        >
          {/* Header */}
          <div className="bg-card px-6 py-4 border-b border-border">
            <div className="flex items-center justify-between">
              <div>
                <h2 id="configuration-panel-title" className="text-lg font-medium text-foreground">
                  {service.name} Configuration
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Configure environment variables, ports, volumes, and dependencies
                </p>
              </div>
              
              {/* Validation Summary */}
              <div className="flex items-center gap-4">
                {validationErrors.length > 0 && (
                  <div 
                    className="flex items-center gap-2 text-sm text-destructive"
                    data-testid="validation-summary"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    {validationErrors.length} issues found
                  </div>
                )}
                
                {isValid && (
                  <div className="flex items-center gap-2 text-sm text-success">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Configuration is valid
                  </div>
                )}

                <button
                  onClick={onClose}
                  className="rounded-md text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  data-testid="close-configuration-panel"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* Configuration Sections */}
          <div className="bg-card px-6 py-4 space-y-4 max-h-96 overflow-y-auto">
            {/* Environment Variables */}
            <ConfigurationSection
              title="Environment Variables"
              isOpen={openSections.environment}
              onToggle={() => toggleSection('environment')}
              hasErrors={environmentErrors.length > 0}
              testId="environment-section-toggle"
            >
              <div data-testid="environment-variables-editor">
                <EnvironmentVariableEditor
                  service={service}
                  variables={configuration.environmentVariables || {}}
                  onChange={(variables) => handleConfigurationUpdate({ environmentVariables: variables })}
                  validationErrors={environmentErrors}
                />
              </div>
            </ConfigurationSection>

            {/* Port Mappings */}
            <ConfigurationSection
              title="Port Mappings"
              isOpen={openSections.ports}
              onToggle={() => toggleSection('ports')}
              hasErrors={portErrors.length > 0}
              testId="ports-section-toggle"
            >
              <div data-testid="port-mappings-editor">
                <PortMappingEditor
                  service={service}
                  portMappings={(configuration.portMappings || []) as any}
                  onChange={(mappings) => handleConfigurationUpdate({ portMappings: mappings as any })}
                  usedPorts={[5432]} // Mock used ports for testing
                />
                
                {portErrors.length > 0 && (
                  <div className="mt-3 p-3 bg-destructive/10 border border-destructive/30 rounded-md">
                    <ul className="text-sm text-destructive space-y-1">
                      {portErrors.map((error, index) => (
                        <li key={index} role="alert">• {error}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </ConfigurationSection>

            {/* Volume Mounts */}
            <ConfigurationSection
              title="Volume Mounts"
              isOpen={openSections.volumes}
              onToggle={() => toggleSection('volumes')}
              hasErrors={volumeErrors.length > 0}
              testId="volumes-section-toggle"
            >
              <div data-testid="volume-mounts-editor">
                <VolumeMountEditor
                  service={service}
                  volumeMounts={configuration.volumeMounts || []}
                  onChange={(mounts) => handleConfigurationUpdate({ volumeMounts: mounts })}
                />
                
                {volumeErrors.length > 0 && (
                  <div className="mt-3 p-3 bg-destructive/10 border border-destructive/30 rounded-md">
                    <ul className="text-sm text-destructive space-y-1">
                      {volumeErrors.map((error, index) => (
                        <li key={index} role="alert">• {error}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </ConfigurationSection>

            {/* Dependencies */}
            <ConfigurationSection
              title="Dependencies"
              isOpen={openSections.dependencies}
              onToggle={() => toggleSection('dependencies')}
              hasErrors={dependencyErrors.length > 0}
              testId="dependencies-section-toggle"
            >
              <div data-testid="dependencies-editor">
                <DependencyOrderingPanel
                  services={[]} // Will be populated by parent
                  dependencies={{}} // Will be populated with full dependency map
                  onChange={(deps) => {
                    // TODO: Dependencies are managed at stack level, not service configuration level
                    console.log('Dependencies updated:', deps);
                  }}
                />
                
                {dependencyErrors.length > 0 && (
                  <div className="mt-3 p-3 bg-destructive/10 border border-destructive/30 rounded-md">
                    <ul className="text-sm text-destructive space-y-1">
                      {dependencyErrors.map((error, index) => (
                        <li key={index} role="alert">• {error}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </ConfigurationSection>
          </div>

          {/* Footer */}
          <div className="bg-muted/50 px-6 py-3 flex justify-between items-center border-t border-border">
            <div className="text-sm text-muted-foreground">
              Changes are saved automatically
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => {
                  // Reset to default configuration
                  // Implementation would reset to service defaults
                }}
                className="px-4 py-2 text-sm font-medium text-foreground bg-background border border-border rounded-md hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring"
              >
                Reset
              </button>
              
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-primary-foreground bg-primary border border-transparent rounded-md hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};