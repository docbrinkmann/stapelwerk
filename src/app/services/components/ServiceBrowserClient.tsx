'use client';

import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import dynamic from 'next/dynamic';
import { SearchBar } from '@/components/SearchBar';
import { FilterPanel } from '@/components/FilterPanel';
import { ServiceGrid } from '@/components/ServiceGrid';
import { ServiceList } from '@/components/services';
import { useServiceBrowserStore } from '@/stores/service-browser';
import { useStackServices } from '@/stores/stack-builder';
import { useCommandPaletteStore } from '@/stores/command-palette';
import { useInfiniteServiceBrowserScroll } from '@/hooks/useInfiniteScroll';
import { CommandPalette, CommandPaletteTrigger } from '@/components/command-palette';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Expand, Package2, Save, Layers, LayoutGrid, List } from 'lucide-react';
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
import type { Service } from '@/types/service';

// Dynamic imports for heavy components that aren't needed immediately
const ServicePreviewModal = dynamic(
  () => import('@/components/ServicePreviewModal').then(mod => ({ default: mod.ServicePreviewModal })),
  { 
    ssr: false,
    loading: () => <div className="modal-loading" />
  }
);

const StackCanvas = dynamic(
  () => import('@/components/stack-configuration/StackCanvas').then(mod => ({ default: mod.StackCanvas })),
  { 
    ssr: false,
    loading: () => <div className="stack-canvas-loading">Loading stack canvas...</div>
  }
);

const SaveStackModal = dynamic(
  () => import('@/components/SaveStackModal').then(mod => ({ default: mod.SaveStackModal })),
  { 
    ssr: false,
    loading: () => <div className="modal-loading" />
  }
);

export function ServiceBrowserClient() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [stackMode, setStackMode] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Store state - simplified
  const {
    searchQuery,
    activeFilters,
    syncFromUrl
  } = useServiceBrowserStore();

  // Stack builder state
  const { services: stackServices, addService: addServiceToStack } = useStackServices();
  const hasServicesInStack = stackServices.length > 0;

  // Drag-and-drop: drag a catalog card onto the "Your Stack" drop zone to add
  // it. An 8px activation distance keeps a plain click firing the card's
  // preview instead of starting a drag.
  const [draggedService, setDraggedService] = useState<Service | null>(null);
  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );
  const handleDragStart = (event: DragStartEvent) => {
    setDraggedService((event.active.data.current?.service as Service) ?? null);
  };
  const handleDragEnd = (event: DragEndEvent) => {
    const svc = event.active.data.current?.service as Service | undefined;
    if (event.over?.id === 'stack-dropzone' && svc) {
      addServiceToStack(svc as never);
    }
    setDraggedService(null);
  };

  // Command palette state
  const { setIsOpen: setCommandPaletteOpen } = useCommandPaletteStore();

  // Fetch all services for command palette
  const { services: allServices } = useInfiniteServiceBrowserScroll();

  // Initialize store from URL parameters on mount
  useEffect(() => {
    syncFromUrl();
  }, [searchParams, syncFromUrl]);

  // Update URL when store state changes
  const skipFirstUrlWrite = useRef(true);
  useEffect(() => {
    // Skip the very first run: on mount the URL is the source of truth (it
    // was just read by syncFromUrl and the read-from-URL effect below). Writing
    // here with the initial stackMode=false would router.replace() away an
    // incoming `?mode=stack` before that effect can turn stack mode on, so the
    // toggle and the URL end up out of sync.
    if (skipFirstUrlWrite.current) {
      skipFirstUrlWrite.current = false;
      return;
    }
    // Read the store snapshot at effect time, NOT the render-closure values:
    // on first mount this effect runs in the same commit as syncFromUrl()
    // above, so searchQuery/activeFilters from the render are still the
    // pre-sync defaults (empty). Writing those would router.replace() the
    // query string away, and the searchParams change would re-run
    // syncFromUrl() against the stripped URL — wiping the restored filters.
    // getState() is also StrictMode-safe (no first-run-skip ref needed).
    const { searchQuery: q, activeFilters: filters } = useServiceBrowserStore.getState();
    const params = new URLSearchParams();

    // Keys must match what the store's syncFromUrl reads (q/categories/tags/pricing),
    // otherwise the URL round-trip resets the store right after every change.
    if (q) params.set('q', q);
    if (filters.categories?.length) params.set('categories', filters.categories.join(','));
    if (filters.tags?.length) params.set('tags', filters.tags.join(','));
    if (filters.pricingTypes?.length) params.set('pricing', filters.pricingTypes.join(','));
    if (stackMode) params.set('mode', 'stack');

    const newUrl = `${pathname}${params.toString() ? `?${params.toString()}` : ''}`;
    
    // Only update URL if it's different to prevent unnecessary navigation
    if (newUrl !== `${pathname}${window.location.search}`) {
      router.replace(newUrl as any, { scroll: false });
    }
  }, [searchQuery, activeFilters, stackMode, pathname, router]);

  // Initialize stack mode from URL
  useEffect(() => {
    const modeParam = searchParams.get('mode');
    if (modeParam === 'stack') {
      setStackMode(true);
    }
  }, [searchParams]);

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

  /**
   * Handle service selection from command palette
   */
  const handleServiceSelect = (service: Service, action: 'view' | 'add') => {
    if (action === 'add') {
      // Add to stack in stack mode
      if (stackMode) {
        addServiceToStack(service);
      } else {
        // Enable stack mode and add service
        setStackMode(true);
        addServiceToStack(service);
      }
    } else {
      // Navigate to service detail page
      router.push(`/services/${service.slug}` as any);
    }
  };

  return (
    <DndContext sensors={dndSensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      {/* Offline banner */}
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

      {/* Stack Building Mode Toggle */}
      <div className="service-browser__controls">
        <div className="flex items-center gap-3">
          {/* Command Palette Trigger */}
          <CommandPaletteTrigger onClick={() => setCommandPaletteOpen(true)} />

          {/* Stack Mode Toggle */}
          <div className="stack-mode-toggle" data-testid="stack-mode-toggle">
            <div className="flex items-center space-x-2">
              <Switch
                id="stack-mode"
                checked={stackMode}
                onCheckedChange={setStackMode}
              />
              <Label htmlFor="stack-mode" className="flex items-center gap-2 cursor-pointer">
                <Layers className="h-4 w-4" />
                Build Stack
              </Label>
            </div>
          </div>
        </div>

        {/* View Toggle */}
        <ToggleGroup
          type="single"
          value={viewMode}
          onValueChange={(value) => value && setViewMode(value as 'grid' | 'list')}
          className="border rounded-md"
        >
          <ToggleGroupItem value="grid" aria-label="Grid view" className="px-3">
            <LayoutGrid className="h-4 w-4" />
          </ToggleGroupItem>
          <ToggleGroupItem value="list" aria-label="List view" className="px-3">
            <List className="h-4 w-4" />
          </ToggleGroupItem>
        </ToggleGroup>

        {/* Stack Controls */}
        {stackMode && (
          <div className="stack-controls flex items-center gap-2">
            {hasServicesInStack && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowSaveModal(true)}
                data-testid="save-stack-button"
              >
                <Save className="h-4 w-4 mr-1" />
                Save Stack
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push('/stack-builder')}
              data-testid="expand-to-full-builder"
            >
              <Expand className="h-4 w-4 mr-1" />
              Full Builder
            </Button>
          </div>
        )}
      </div>

      <div className={`service-browser__content ${stackMode ? 'stack-mode' : ''}`}>
        {/* Left Panel - Search & Services */}
        <div className="service-browser__left-panel" data-testid="service-list">
          {/* Search Bar */}
          <div className="service-browser__search">
            <SearchBar
              placeholder="Search services (e.g., database, web server, monitoring...)"
              className="service-browser__search-bar"
            />
          </div>

          {/* Filter Panel */}
          <div className="service-browser__filters">
            <FilterPanel
              className="service-browser__filter-panel"
              isCollapsible={true}
              defaultExpanded={!stackMode}
            />
          </div>

          {/* Services Grid/List */}
          <div className="service-browser__grid">
            {viewMode === 'grid' ? (
              <ServiceGrid
                className="service-browser__service-grid"
                stackMode={stackMode}
                stackServices={stackServices}
              />
            ) : (
              <ServiceList
                services={allServices}
                onServiceClick={(service) => router.push(`/services/${service.slug}` as any)}
                onAddToStack={stackMode ? addServiceToStack : undefined}
                className="service-browser__service-list"
              />
            )}
          </div>
        </div>

        {/* Right Panel - Stack Canvas (only in stack mode) */}
        {stackMode && (
          <ServiceDropZone id="stack-dropzone" className="service-browser__stack-panel">
            <div className="stack-panel-header">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Package2 className="h-5 w-5" />
                Your Stack
              </h2>
              {stackServices.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Drag a service here to add it
                </p>
              )}
            </div>

            <div className="stack-canvas-container">
              {/* List layout: single column fits the narrow side panel, unlike
                  the multi-column grid used in the full-width /stack-builder. */}
              <StackCanvas className="service-browser__stack-canvas" viewMode="list" />
            </div>
          </ServiceDropZone>
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

      {/* Screen Reader Announcements */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
        id="service-browser-announcements"
      >
        {searchQuery && `Search results for "${searchQuery}"`}
        {stackMode && 'Stack building mode activated'}
      </div>

      {/* Command Palette */}
      <CommandPalette
        services={allServices}
        onServiceSelect={handleServiceSelect}
      />

      {/* Page Analytics */}
      <script
        dangerouslySetInnerHTML={{
          __html: `
            // Track page view
            if (typeof window !== 'undefined' && window.gtag) {
              window.gtag('event', 'page_view', {
                page_title: 'Services Browser',
                page_location: window.location.href,
                stack_mode: ${stackMode}
              });
            }
          `
        }}
      />

      <DragOverlay dropAnimation={null}>
        {draggedService ? (
          <div className="pointer-events-none rounded-lg border border-primary bg-card px-3 py-2 text-sm font-medium text-foreground shadow-lg">
            {draggedService.name}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

// Export component for use in tests
export default ServiceBrowserClient;