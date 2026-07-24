import React, { useState, useMemo } from 'react';
import { X } from 'lucide-react';
import { useStackServices } from '@/stores/stack-builder';
import { useT } from '@/lib/i18n/client';
import { ServiceConfigurationPanel } from './ServiceConfigurationPanel';
import type { Service } from '@/types/service';
import type { StackService } from '@/types/stack';

interface ServiceConfigurationCardProps {
  service: StackService;
  onClick: () => void;
  onRemove: () => void;
}

const ServiceConfigurationCard: React.FC<ServiceConfigurationCardProps> = ({ service, onClick, onRemove }) => {
  const t = useT();
  // Calculate configuration completeness
  const configurationScore = useMemo(() => {
    const config = service.configuration;
    let completed = 0;
    const total = 3; // env vars, ports, volumes (dependencies managed at stack level)

    // Environment variables check
    if (config.environmentVariables && Object.keys(config.environmentVariables).length > 0) {
      completed += 1;
    }

    // Port mappings check
    if (config.portMappings && config.portMappings.length > 0) {
      completed += 1;
    }

    // Volume mounts check
    if (config.volumeMounts && config.volumeMounts.length > 0) {
      completed += 1;
    }

    // Note: Dependencies are managed at stack level via dependsOn, not in service configuration

    return Math.round((completed / total) * 100);
  }, [service.configuration]);

  const getStatusColor = (score: number) => {
    if (score >= 75) return 'bg-success/20 text-success';
    if (score >= 50) return 'bg-warning/20 text-warning';
    return 'bg-destructive/20 text-destructive';
  };

  return (
    <div
      className="aspect-square min-h-0 bg-card border border-border rounded-lg p-4 shadow-sm hover:shadow-md dark:hover:shadow-lg dark:hover:shadow-primary/5 cursor-pointer transition-all duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      tabIndex={0}
      role="button"
      aria-label={t('builder.canvasConfigureAria', { name: service.service?.name ?? 'Service' })}
      data-testid="service-configuration-card"
    >
      {/* Service Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-foreground truncate">
            {service.service?.name ?? 'Service'}
          </h3>
          <p className="text-sm text-muted-foreground">
            {service.service?.category?.name ?? t('builder.uncategorized')}
          </p>
        </div>
        
        {/* Configuration Status + remove */}
        <div className="flex items-center gap-1.5">
          <div
            className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(configurationScore)}`}
            data-testid="configuration-status"
          >
            {t('builder.cardReady')}
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            onKeyDown={(e) => e.stopPropagation()}
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus:outline-none focus:ring-2 focus:ring-ring"
            aria-label={t('builder.cardRemoveAria', { name: service.service?.name ?? 'Service' })}
            title={t('builder.cardRemoveAria', { name: service.service?.name ?? 'Service' })}
            data-testid="remove-service-card"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Service Description */}
      <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
        {service.service.description}
      </p>

      {/* Configuration Completeness */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-foreground">{t('builder.cardConfiguration')}</span>
          <span 
            className="text-sm text-muted-foreground"
            data-testid="configuration-completeness"
          >
            {configurationScore}%
          </span>
        </div>
        
        {/* Progress bar */}
        <div className="w-full bg-secondary rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all duration-300 ${
              configurationScore >= 75 ? 'bg-success' :
              configurationScore >= 50 ? 'bg-warning' : 'bg-destructive'
            }`}
            style={{ width: `${configurationScore}%` }}
          />
        </div>

        {/* Quick indicators */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className={service.configuration.environmentVariables && Object.keys(service.configuration.environmentVariables).length > 0 ? 'text-success' : ''}>
            ✓ Env
          </span>
          <span className={service.configuration.portMappings && service.configuration.portMappings.length > 0 ? 'text-success' : ''}>
            ✓ Ports
          </span>
          <span className={service.configuration.volumeMounts && service.configuration.volumeMounts.length > 0 ? 'text-success' : ''}>
            ✓ Volumes
          </span>
        </div>
      </div>
    </div>
  );
};

const EmptyStackCanvas: React.FC = () => {
  const t = useT();
  return (
  <div
    className="col-span-full flex flex-col items-center justify-center py-12 text-center"
    data-testid="empty-stack-canvas"
  >
    <div className="mb-4">
      <svg
        className="w-16 h-16 text-muted-foreground/50 mx-auto"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1}
          d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
        />
      </svg>
    </div>
    
    <h3 className="text-lg font-medium text-foreground mb-2">
      {t('builder.canvasEmptyTitle')}
    </h3>

    <p className="text-muted-foreground mb-4 max-w-md">
      {t('builder.canvasEmptyBody')}
    </p>

    <div className="text-sm text-muted-foreground/80 space-y-1">
      <p>• {t('builder.canvasFeatureEnv')}</p>
      <p>• {t('builder.canvasFeaturePorts')}</p>
      <p>• {t('builder.canvasFeatureVolumes')}</p>
      <p>• {t('builder.canvasFeatureDeps')}</p>
    </div>
  </div>
  );
};

interface StackCanvasProps {
  className?: string;
  viewMode?: 'visual' | 'list';
  onConfigureService?: (serviceId: string) => void;
  /** Starts the guided configuration wizard (renders the header button when set). */
  onStartGuided?: () => void;
}

export const StackCanvas: React.FC<StackCanvasProps> = ({
  className = '',
  viewMode = 'visual',
  onConfigureService,
  onStartGuided,
}) => {
  const { services, removeService } = useStackServices();
  const t = useT();
  const [selectedService, setSelectedService] = useState<StackService | null>(null);
  const [configurationPanelOpen, setConfigurationPanelOpen] = useState(false);

  // Calculate responsive grid columns based on number of services
  const gridColumns = useMemo(() => {
    const serviceCount = services.length;
    
    if (serviceCount === 0) return 'grid-cols-1';
    if (serviceCount === 1) return 'grid-cols-1';
    if (serviceCount === 2) return 'grid-cols-1 sm:grid-cols-2';
    if (serviceCount <= 4) return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-2';
    if (serviceCount <= 6) return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3';
    
    return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4';
  }, [services.length]);

  const handleServiceClick = (service: StackService) => {
    if (onConfigureService) {
      onConfigureService(service.id);
    } else {
      setSelectedService(service);
      setConfigurationPanelOpen(true);
    }
  };

  const handleCloseConfigurationPanel = () => {
    setConfigurationPanelOpen(false);
    setSelectedService(null);
  };

  const handleConfigurationChange = (serviceId: number, newConfiguration: any) => {
    // Configuration changes will be handled by the ServiceConfigurationPanel
    // which will call the store's updateServiceConfiguration method
  };

  return (
    <div className={`w-full space-y-6 ${className}`}>
      {/* Canvas Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">
            {t('builder.canvasTitle')}
          </h2>
          <p className="text-muted-foreground mt-1">
            {t('builder.canvasSubtitle')}
          </p>
        </div>
        
        {services.length > 0 && (
          <div className="flex items-center gap-4">
            {onStartGuided && (
              <button
                onClick={onStartGuided}
                className="px-4 py-2 text-sm font-medium text-primary-foreground bg-primary rounded-md hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring"
                data-testid="start-guided-config"
              >
                {t('builder.guidedStart')}
              </button>
            )}
            <div className="text-right">
              <div className="text-sm text-muted-foreground">
                {t('builder.canvasServicesLabel')} <span className="font-medium text-foreground">{services.length}</span>
              </div>
              <div className="text-xs text-muted-foreground/80 mt-1">
                {t('builder.canvasClickToConfigure')}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Responsive Grid Canvas - layout adapts based on viewMode */}
      <div
        className={`${viewMode === 'list' 
          ? 'flex flex-col gap-4' 
          : 'grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
        } w-full`}
        data-testid="stack-canvas"
        style={viewMode === 'visual' ? {
          // Override with computed grid columns if needed
          gridTemplateColumns: services.length === 0 ? undefined : 
            services.length === 1 ? 'repeat(1, minmax(0, 1fr))' :
            services.length === 2 ? undefined : // Use default responsive classes
            services.length <= 4 ? undefined : // Use default responsive classes  
            services.length <= 6 ? undefined : // Use default responsive classes
            undefined // Use default responsive classes
        } : {}}
      >
        {services.length === 0 ? (
          <EmptyStackCanvas />
        ) : (
          services.map((service) => (
            <ServiceConfigurationCard
              key={service.id}
              service={service}
              onClick={() => handleServiceClick(service)}
              onRemove={() => removeService(service.serviceId)}
            />
          ))
        )}
      </div>

      {/* Service Configuration Panel */}
      {selectedService && (
        <ServiceConfigurationPanel
          service={selectedService.service}
          configuration={selectedService.configuration}
          onConfigurationChange={handleConfigurationChange}
          isOpen={configurationPanelOpen}
          onClose={handleCloseConfigurationPanel}
        />
      )}
    </div>
  );
};
