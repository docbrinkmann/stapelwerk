'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { SearchBar } from '@/components/SearchBar';
import { FilterPanel } from '@/components/FilterPanel';
import { ServiceGrid } from '@/components/ServiceGrid';
import { ServicePreviewModal } from '@/components/ServicePreviewModal';
import { StackCanvas } from '@/components/stack-configuration/StackCanvas';
import { StackComposePreview } from './StackComposePreview';
import { StackChecksPanel } from './StackChecksPanel';
import { ServiceConfigurationPanel } from '@/components/stack-configuration/ServiceConfigurationPanel';
import { RecommendationEngine } from '@/components/recommendations/RecommendationEngine';
import { SaveStackModal } from '@/components/SaveStackModal';
import { ImportStackModal } from './ImportStackModal';
import { StackTemplateModal } from './StackTemplateModal';
import { StackStorageManager } from '@/components/StackStorageManager';
import ShareStackModal from '@/components/modals/ShareStackModal';
import SubmitTemplateModal from '@/components/modals/SubmitTemplateModal';
import BulkImportExportManager from '@/components/BulkImportExportManager';
import { ApplyModal } from '@/components/deployments/ApplyModal';
import { useServiceBrowserStore } from '@/store/service-browser';
import { useStackServices } from '@/stores/stack-builder';
import { useStackPersistence } from '@/stores/stack-builder';
import { analyzeStack } from '@/lib/validation/stack-builder-checks';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { 
  Save, 
  Upload, 
  Download, 
  Share2, 
  Settings, 
  Play, 
  RefreshCw,
  FileText,
  Grid,
  List,
  Package2,
  Search,
  Filter,
  Layers3,
  ChevronDown,
  ChevronRight,
  HardDrive,
  Cloud,
  Lightbulb,
  ShieldAlert
} from 'lucide-react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import { ServiceDropZone } from '@/components/dnd/ServiceDropZone';

export function StackBuilderClient() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  
  // State management
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showStorageManager, setShowStorageManager] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showSubmitTemplateModal, setShowSubmitTemplateModal] = useState(false);
  const [showBulkImportModal, setShowBulkImportModal] = useState(false);
  const [showBulkExportModal, setShowBulkExportModal] = useState(false);
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [showServicePanel, setShowServicePanel] = useState(true);
  const [showStackPanel, setShowStackPanel] = useState(true);
  const [showRecommendationPanel, setShowRecommendationPanel] = useState(true);
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [stackViewMode, setStackViewMode] = useState<'visual' | 'list'>('visual');
  const [canvasTab, setCanvasTab] = useState<'canvas' | 'preview' | 'checks'>('canvas');
  
  // Store state
  const {
    searchQuery,
    activeFilters,
    syncFromUrl,
    viewMode,
    setViewMode
  } = useServiceBrowserStore();

  // Stack builder state
  const {
    services: stackServices,
    addService,
    clearStack,
    exportDockerCompose,
    getStackValidationErrors,
    updateServiceConfiguration
  } = useStackServices();
  
  // Persistence state
  const {
    isDirty,
    hasChanges,
    lastSaved,
    autoSaveEnabled,
    saveAsDraft,
    startAutoSave,
    stopAutoSave,
    loadStack
  } = useStackPersistence();
  
  const hasServicesInStack = stackServices.length > 0;
  const stackErrors = hasServicesInStack ? getStackValidationErrors() : [];
  const hasStackErrors = stackErrors.length > 0;

  // Drag-and-drop: drag a card from "Available Services" onto the stack canvas
  // to add it. 8px activation distance preserves click-to-preview on the card.
  const [draggedService, setDraggedService] = useState<any | null>(null);
  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );
  const handleDragStart = (event: DragStartEvent) => {
    setDraggedService(event.active.data.current?.service ?? null);
  };
  const handleDragEnd = (event: DragEndEvent) => {
    const svc = event.active.data.current?.service;
    if (event.over?.id === 'stack-dropzone' && svc) {
      addService(svc);
    }
    setDraggedService(null);
  };

  // Live build-time checks (port/volume conflicts, missing deps, incompatible
  // pairs) surfaced on the Checks tab and as a count badge on the tab button.
  const builderChecks = useMemo(() => analyzeStack(stackServices), [stackServices]);

  // Initialize store from URL parameters on mount
  useEffect(() => {
    syncFromUrl();
  }, [searchParams, syncFromUrl]);
  
  // Initialize auto-save on mount
  useEffect(() => {
    if (autoSaveEnabled) {
      startAutoSave();
    }
    
    // Cleanup on unmount
    return () => {
      stopAutoSave();
    };
  }, [autoSaveEnabled, startAutoSave, stopAutoSave]);
  
  // Handle loading a stack from storage
  const handleLoadStack = (stackData: any) => {
    loadStack(stackData);
  };

  // Online/offline detection
  useEffect(() => {
    const updateStatus = () => setIsOnline(typeof navigator === 'undefined' ? true : navigator.onLine !== false);
    updateStatus();
    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);
    return () => {
      window.removeEventListener('online', updateStatus);
      window.removeEventListener('offline', updateStatus);
    };
  }, []);

  // Handle service configuration
  const handleConfigureService = (serviceId: string) => {
    setSelectedService(serviceId);
  };

  // Handle recommendation actions
  const handleTemplateSelect = (templateId: string) => {
    setShowTemplateModal(true);
    // Pre-select the template in the modal if needed
    console.log('Opening template modal for:', templateId);
  };

  const handleServiceRecommend = (service: any) => {
    // The recommendation carries the full catalog service — add it straight in.
    if (service && typeof service === 'object' && (service.id ?? service.serviceId)) {
      addService(service as any);
    }
  };

  // Handle export actions
  const handleExportStack = () => {
    const dockerCompose = exportDockerCompose();
    const blob = new Blob([dockerCompose], { type: 'text/yaml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'docker-compose.yml';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <DndContext sensors={dndSensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
    <div className="stack-builder">
      {!isOnline && (
        <div role="status" aria-live="polite" className="offline-banner">
          <div className="offline-banner__content">
            <span>You’re offline. Check your connection and retry.</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                queryClient.invalidateQueries();
              }}
              className="ml-3"
            >
              Retry
            </Button>
          </div>
        </div>
      )}
      {/* Top Toolbar */}
      <div className="stack-builder__toolbar">
        <div className="stack-builder__toolbar-left">
          {/* Stack Actions */}
          <div className="stack-actions">
            {hasServicesInStack && (
              <>
                <Button
                  variant={isDirty ? "default" : "outline"}
                  size="sm"
                  onClick={() => saveAsDraft()}
                  className="mr-2"
                  disabled={!isDirty}
                >
                  <Save className="h-4 w-4 mr-1" />
                  {isDirty ? 'Save Draft' : 'Saved'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowSaveModal(true)}
                  className="mr-2"
                >
                  <Cloud className="h-4 w-4 mr-1" />
                  Save Stack
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportStack}
                  className="mr-2"
                >
                  <Download className="h-4 w-4 mr-1" />
                  Export
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => setShowApplyModal(true)}
                  className="mr-2"
                >
                  <Play className="h-4 w-4 mr-1" />
                  Deploy
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowBulkExportModal(true)}
                  className="mr-2"
                >
                  <Download className="h-4 w-4 mr-1" />
                  Bulk Export
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowShareModal(true)}
                  className="mr-2"
                >
                  <Share2 className="h-4 w-4 mr-1" />
                  Share
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearStack}
                  className="mr-2"
                >
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Clear
                </Button>
              </>
            )}
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowStorageManager(true)}
              className="mr-2"
            >
              <HardDrive className="h-4 w-4 mr-1" />
              Storage
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowImportModal(true)}
              className="mr-2"
            >
              <Upload className="h-4 w-4 mr-1" />
              Import
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowBulkImportModal(true)}
              className="mr-2"
            >
              <Upload className="h-4 w-4 mr-1" />
              Bulk Import
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowTemplateModal(true)}
              className="mr-2"
            >
              <FileText className="h-4 w-4 mr-1" />
              Browse Templates
            </Button>
            
            {hasServicesInStack && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowSubmitTemplateModal(true)}
              >
                <Upload className="h-4 w-4 mr-1" />
                Submit Template
              </Button>
            )}
          </div>
        </div>

        <div className="stack-builder__toolbar-right">
          {/* Stack Status */}
          <div className="stack-status">
            <Badge variant={hasServicesInStack ? "default" : "secondary"}>
              {stackServices.length} services
            </Badge>
            {hasStackErrors && (
              <Badge
                variant="destructive"
                className="ml-2 cursor-pointer"
                title={`${stackErrors.join('\n')}\n\nClick to open the Checks tab.`}
                role="button"
                tabIndex={0}
                onClick={() => setCanvasTab('checks')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setCanvasTab('checks');
                  }
                }}
              >
                {stackErrors.length} {stackErrors.length === 1 ? 'error' : 'errors'}
              </Badge>
            )}
          </div>

          {/* View Controls */}
          <Separator orientation="vertical" className="mx-3" />
          <div className="view-controls">
            <Button
              variant={stackViewMode === 'visual' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStackViewMode('visual')}
            >
              <Layers3 className="h-4 w-4" />
            </Button>
            <Button
              variant={stackViewMode === 'list' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStackViewMode('list')}
              className="ml-1"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Recommendation Panel Toggle */}
          <div className="flex items-center gap-2 ml-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowRecommendationPanel(!showRecommendationPanel)}
              className="flex items-center gap-2"
            >
              <Lightbulb className="h-4 w-4" />
              {showRecommendationPanel ? 'Hide' : 'Show'} Recommendations
            </Button>
          </div>
        </div>
      </div>

      {/* Main Layout */}
      <div className="stack-builder__layout">
        {/* Left Panel - Service Browser */}
        <div className={`stack-builder__services-panel ${showServicePanel ? 'expanded' : 'collapsed'}`}>
          <div className="panel-header">
            <button 
              className="panel-toggle"
              onClick={() => setShowServicePanel(!showServicePanel)}
              aria-label={showServicePanel ? 'Collapse service panel' : 'Expand service panel'}
            >
              {showServicePanel ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              <Package2 className="h-4 w-4 ml-1" />
              <span>Available Services</span>
            </button>
            
            {showServicePanel && (
              <div className="panel-header-actions">
                <Button
                  variant={viewMode === 'grid' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('grid')}
                >
                  <Grid className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                  className="ml-1"
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
          
          {showServicePanel && (
            <div className="panel-content">
              {/* Search Bar */}
              <div className="search-section">
                <SearchBar
                  placeholder="Search services to add to your stack..."
                  className="stack-builder__search-bar"
                />
              </div>

              {/* Filter Panel */}
              <div className="filter-section">
                <FilterPanel
                  className="stack-builder__filter-panel"
                  isCollapsible={true}
                  defaultExpanded={false}
                />
              </div>

              {/* Services Grid */}
              <div className="services-section">
                <ServiceGrid
                  className="stack-builder__service-grid"
                  stackMode={true}
                  stackServices={stackServices}
                />
              </div>
            </div>
          )}
        </div>

        {/* Center Panel - Stack Canvas (drop target for dragged services) */}
        <ServiceDropZone id="stack-dropzone" className="stack-builder__canvas-panel">
          <div className="panel-header">
            <div className="panel-title">
              <Layers3 className="h-4 w-4" />
              <span>Your Stack</span>
              {hasServicesInStack && (
                <Badge variant="outline" className="ml-2">
                  {stackServices.length}
                </Badge>
              )}
            </div>
            
            <div className="panel-header-actions">
              <Button
                variant={canvasTab === 'canvas' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setCanvasTab('canvas')}
              >
                <Layers3 className="h-4 w-4 mr-1" />
                Canvas
              </Button>
              <Button
                variant={canvasTab === 'preview' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setCanvasTab('preview')}
                className="ml-1"
              >
                <FileText className="h-4 w-4 mr-1" />
                Preview
              </Button>
              <Button
                variant={canvasTab === 'checks' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setCanvasTab('checks')}
                className="ml-1"
              >
                <ShieldAlert className="h-4 w-4 mr-1" />
                Checks
                {builderChecks.length > 0 && (
                  <span className="ml-1.5 inline-flex min-w-4 items-center justify-center rounded-full bg-warning/20 px-1.5 text-xs font-medium text-warning">
                    {builderChecks.length}
                  </span>
                )}
              </Button>
              {hasServicesInStack && canvasTab === 'canvas' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedService(stackServices[0]?.id || null)}
                  disabled={!hasServicesInStack}
                  className="ml-1"
                >
                  <Settings className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          <div className="panel-content">
            {canvasTab === 'canvas' ? (
              <StackCanvas
                className="stack-builder__stack-canvas"
                viewMode={stackViewMode}
                onConfigureService={handleConfigureService}
              />
            ) : canvasTab === 'preview' ? (
              <StackComposePreview />
            ) : (
              <StackChecksPanel />
            )}
          </div>
        </ServiceDropZone>

        {/* Right Panel - Configuration (conditional) */}
        {selectedService && (() => {
          const stackService = stackServices.find(s => s.id === selectedService);
          if (!stackService) return null;
          
          return (
            <div className="stack-builder__config-panel">
              <ServiceConfigurationPanel
                service={stackService.service}
                configuration={stackService.configuration}
                onConfigurationChange={updateServiceConfiguration}
                isOpen={!!selectedService}
                onClose={() => setSelectedService(null)}
              />
            </div>
          );
        })()}
        
        {/* Recommendation Panel */}
        {showRecommendationPanel && (
          <div className="stack-builder__recommendation-panel">
            <div className="panel-header">
              <button 
                className="panel-toggle"
                onClick={() => setShowRecommendationPanel(!showRecommendationPanel)}
                aria-label={showRecommendationPanel ? 'Collapse recommendation panel' : 'Expand recommendation panel'}
              >
                {showRecommendationPanel ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                <Lightbulb className="h-4 w-4 ml-1" />
                <span>Recommendations</span>
              </button>
            </div>
            
            <div className="panel-content">
              <RecommendationEngine
                onTemplateSelect={handleTemplateSelect}
                onServiceRecommend={handleServiceRecommend}
                maxRecommendations={5}
                showPersonalized={true}
                className="h-full"
              />
            </div>
          </div>
        )}
      </div>

      {/* Service Preview Modal */}
      <ServicePreviewModal />

      {/* Save Stack Modal */}
      {showSaveModal && (
        <SaveStackModal
          isOpen={showSaveModal}
          onClose={() => setShowSaveModal(false)}
          stackServices={stackServices}
        />
      )}

      {/* Import Stack Modal */}
      {showImportModal && (
        <ImportStackModal
          isOpen={showImportModal}
          onClose={() => setShowImportModal(false)}
        />
      )}

      {/* Stack Templates Modal */}
      {showTemplateModal && (
        <StackTemplateModal
          isOpen={showTemplateModal}
          onClose={() => setShowTemplateModal(false)}
        />
      )}
      
      {/* Stack Storage Manager */}
      {showStorageManager && (
        <StackStorageManager
          isOpen={showStorageManager}
          onClose={() => setShowStorageManager(false)}
          onLoadStack={handleLoadStack}
        />
      )}
      
      {/* Share Stack Modal */}
      {showShareModal && (
        <ShareStackModal
          isOpen={showShareModal}
          onClose={() => setShowShareModal(false)}
        />
      )}
      
      {/* Submit Template Modal */}
      {showSubmitTemplateModal && (
        <SubmitTemplateModal
          isOpen={showSubmitTemplateModal}
          onClose={() => setShowSubmitTemplateModal(false)}
        />
      )}
      
      {/* Apply (Direct Deploy) Modal */}
      {showApplyModal && (
        <ApplyModal
          isOpen={showApplyModal}
          onClose={() => setShowApplyModal(false)}
        />
      )}
      
      {/* Bulk Import Modal */}
      {showBulkImportModal && (
        <BulkImportExportManager
          isOpen={showBulkImportModal}
          onClose={() => setShowBulkImportModal(false)}
          mode="import"
        />
      )}
      
      {/* Bulk Export Modal */}
      {showBulkExportModal && (
        <BulkImportExportManager
          isOpen={showBulkExportModal}
          onClose={() => setShowBulkExportModal(false)}
          mode="export"
        />
      )}

      {/* Screen Reader Announcements */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
        id="stack-builder-announcements"
      >
        {hasServicesInStack && `Stack contains ${stackServices.length} services`}
        {hasStackErrors && `${stackErrors.length} configuration errors found`}
        {searchQuery && `Search results for "${searchQuery}"`}
      </div>

      {/* Page Analytics */}
      <script
        dangerouslySetInnerHTML={{
          __html: `
            // Track page view
            if (typeof window !== 'undefined' && window.gtag) {
              window.gtag('event', 'page_view', {
                page_title: 'Stack Builder',
                page_location: window.location.href,
                stack_services: ${stackServices.length},
                has_errors: ${hasStackErrors}
              });
            }
          `
        }}
      />
    </div>

      <DragOverlay dropAnimation={null}>
        {draggedService ? (
          <div className="pointer-events-none rounded-lg border border-primary bg-card px-3 py-2 text-sm font-medium text-foreground shadow-lg">
            {draggedService.name ?? draggedService.service?.name ?? 'Service'}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

// Export component for use in tests
export default StackBuilderClient;