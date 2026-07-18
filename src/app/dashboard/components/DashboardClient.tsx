'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MonitoringPanel } from '@/components/dashboard/monitoring-panel';
import { AnalyticsPanel } from '@/components/dashboard/analytics-panel';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useStackPersistence, stackPersistence } from '@/lib/stack-persistence';
import { dbStackServicesToPersisted } from '@/lib/deploy/persisted-stack';
import { trpc } from '@/utils/trpc';
import { 
  Plus,
  Play,
  Pause,
  Settings,
  Download,
  Upload,
  Trash2,
  Search,
  Filter,
  BarChart3,
  Activity,
  Clock,
  Server,
  Database,
  Network,
  HardDrive,
  Cpu,
  MemoryStick,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Layers3,
  ExternalLink,
  RefreshCw,
  Eye,
  Edit,
  Share,
  Copy,
  TrendingUp,
  TrendingDown,
  Users
} from 'lucide-react';
import type { PersistedStack } from '@/lib/stack-persistence';
import ShareStackModal from '@/components/modals/ShareStackModal';
import SubmitTemplateModal from '@/components/modals/SubmitTemplateModal';

interface StackMetrics {
  status: 'running' | 'stopped' | 'error' | 'deploying' | 'draft';
  services: number;
  uptime?: string;
  lastDeployed?: Date;
  cpuUsage?: number;
  memoryUsage?: number;
  networkTraffic?: number;
}

interface DashboardStats {
  totalStacks: number;
  runningStacks: number;
  totalServices: number;
  storageUsed: number;
  lastActivity?: Date;
}

export function DashboardClient() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStack, setSelectedStack] = useState<PersistedStack | null>(null);
  const [showStackDetails, setShowStackDetails] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showSubmitTemplateModal, setShowSubmitTemplateModal] = useState(false);
  const [stackToShare, setStackToShare] = useState<PersistedStack | null>(null);
  const [localStacks, setLocalStacks] = useState<PersistedStack[]>([]);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats>({
    totalStacks: 0,
    runningStacks: 0,
    totalServices: 0,
    storageUsed: 0,
  });

  const { getLocalStacks, getStorageStats } = useStackPersistence();
  const utils = trpc.useUtils();

  // Query analytics data from database
  const analyticsQuery = trpc.analytics.getAnalytics.useQuery(undefined, {
    enabled: true,
    staleTime: 5 * 60 * 1000 // 5 minutes
  });

  // Which stacks are actually deployed (running) right now.
  const runningQuery = trpc.analytics.getRunningStackIds.useQuery(undefined, {
    staleTime: 30 * 1000,
  });
  const runningIds = useMemo(
    () => new Set(runningQuery.data?.runningStackIds ?? []),
    [runningQuery.data],
  );

  // The database is the source of truth for stacks; localStorage only
  // contributes drafts that were never saved to the database.
  const stacksQuery = trpc.stacks.list.useQuery(
    { limit: 50 },
    { staleTime: 60 * 1000, retry: false }
  );

  // Load dashboard data
  useEffect(() => {
    const dbStacks: PersistedStack[] = (stacksQuery.data?.stacks ?? []).map((s: any) => ({
      id: s.id,
      name: s.name,
      description: s.description ?? '',
      isPublic: s.isPublic ?? false,
      status: s.status,
      createdAt: s.createdAt ? new Date(s.createdAt) : undefined,
      updatedAt: s.updatedAt ? new Date(s.updatedAt) : undefined,
      services: (s.stack_services ?? []).map((ss: any) => ({
        serviceId: ss.serviceId,
        order: ss.order,
        configuration:
          typeof ss.configuration === 'string'
            ? (() => { try { return JSON.parse(ss.configuration) } catch { return {} } })()
            : ss.configuration ?? {},
        service: ss.services,
      })),
    }));
    const dbIds = new Set(dbStacks.map(s => String(s.id)));
    const localDrafts = getLocalStacks()
      .filter(l => !l.id || !dbIds.has(String(l.id)))
      .map(l => ({ ...l, status: 'draft' }));
    setLocalStacks([...dbStacks, ...localDrafts]);

    const stats = getStorageStats();

    // Combine local storage stats with database analytics
    setDashboardStats({
      totalStacks: analyticsQuery.data?.totalStacks || dbStacks.length,
      runningStacks: analyticsQuery.data?.runningStacks || 0,
      totalServices: analyticsQuery.data?.totalServices || dbStacks.reduce((total, stack) => total + stack.services.length, 0),
      storageUsed: analyticsQuery.data?.storageUsed || stats.localStorageSize,
    });
  }, [getLocalStacks, getStorageStats, analyticsQuery.data, stacksQuery.data]);

  // Filter stacks based on search
  const filteredStacks = localStacks.filter(stack =>
    stack.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    stack.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // While the stacks query is still loading, show a skeleton — NOT the empty
  // "No stacks found" state (which otherwise flashes on every fresh load and
  // made the Overview tab look empty while My Stacks had already populated).
  // Also stay "loading" in the brief gap after the query resolves but before the
  // effect has synced its rows into localStacks, so the empty state never flickers.
  const queryStackCount = stacksQuery.data?.stacks?.length ?? 0;
  const stacksLoading =
    stacksQuery.isLoading || (queryStackCount > 0 && localStacks.length === 0);

  // Get real stack metrics from database
  const getStackMetrics = (stack: PersistedStack): StackMetrics => {
    // Runtime status from real deployment jobs; falls back to draft/stopped
    // for stacks that were never deployed.
    const isRunning = stack.id ? runningIds.has(String(stack.id)) : false;
    return {
      status: isRunning
        ? 'running'
        : stack.status === 'draft' || !stack.id
          ? 'draft'
          : 'stopped',
      services: stack.services.length,
      uptime: undefined, // No uptime until deployed
      lastDeployed: stack.updatedAt ? new Date(stack.updatedAt) : undefined,
      cpuUsage: 0, // Requires Docker Engine API integration (future v2.0)
      memoryUsage: 0, // Requires Docker Engine API integration (future v2.0)
      networkTraffic: 0, // Requires Docker Engine API integration (future v2.0)
    };
  };

  const handleCreateNewStack = () => {
    router.push('/stack-builder');
  };

  const handleLoadStack = (stack: PersistedStack) => {
    // Edit opens the stack's management page (Services, Environment, Deployments,
    // Settings). The legacy /stack-builder can't reliably load an EXISTING stack
    // into its store (it crashes on real per-service config), so route to the
    // working detail page instead of the builder.
    router.push(`/stacks/${stack.id}`);
  };

  const handleViewStack = (stack: PersistedStack) => {
    setSelectedStack(stack);
    setShowStackDetails(true);
  };

  const handleShareStack = (stack: PersistedStack) => {
    setStackToShare(stack);
    setShowShareModal(true);
  };

  // Download a complete docker-compose.yml. The dashboard list only carries thin
  // service data, so fetch the full stack (env/volumes/config + secrets) first.
  const handleExportStack = async (stack: PersistedStack) => {
    try {
      const full = await utils.stacks.get.fetch({ id: String(stack.id) });
      const persisted = {
        id: full.id,
        name: full.name,
        description: full.description ?? '',
        isPublic: Boolean((full as { isPublic?: boolean }).isPublic),
        services: dbStackServicesToPersisted(
          full.stack_services as Parameters<typeof dbStackServicesToPersisted>[0],
        ),
      };
      const yaml = stackPersistence.exportToDockerCompose(persisted);
      const blob = new Blob([yaml], { type: 'text/yaml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(full.name || 'stack').toLowerCase().replace(/\s+/g, '-')}-docker-compose.yml`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export stack:', err);
    }
  };

  const handleSubmitTemplate = (stack: PersistedStack) => {
    setStackToShare(stack);
    setShowSubmitTemplateModal(true);
  };

  const getStatusColor = (status: StackMetrics['status']) => {
    switch (status) {
      case 'running':
        return 'bg-success/10 text-success-foreground border-success/20';
      case 'draft':
      case 'stopped':
        return 'bg-muted text-muted-foreground border-border';
      case 'error':
        return 'bg-destructive/10 text-destructive border-destructive/20';
      case 'deploying':
        return 'bg-info/10 text-info-foreground border-info/20';
      default:
        return 'bg-muted text-muted-foreground border-border';
    }
  };

  const getStatusIcon = (status: StackMetrics['status']) => {
    switch (status) {
      case 'running':
        return <CheckCircle2 className="h-4 w-4" />;
      case 'draft':
        return <Edit className="h-4 w-4" />;
      case 'stopped':
        return <XCircle className="h-4 w-4" />;
      case 'error':
        return <AlertCircle className="h-4 w-4" />;
      case 'deploying':
        return <RefreshCw className="h-4 w-4 animate-spin" />;
      default:
        return <XCircle className="h-4 w-4" />;
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <div className="dashboard">
      {/* Dashboard Header Actions */}
      <div className="dashboard-actions">
        <div className="dashboard-actions__search">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search your stacks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 w-80"
            />
          </div>
        </div>

        <div className="dashboard-actions__buttons">
          <Button variant="outline" onClick={() => router.push('/community')}>
            <Users className="h-4 w-4 mr-2" />
            Community
          </Button>
          <Button onClick={handleCreateNewStack}>
            <Plus className="h-4 w-4 mr-2" />
            New Stack
          </Button>
        </div>
      </div>

      {/* Dashboard Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="dashboard-tabs">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="stacks" className="flex items-center gap-2">
            <Layers3 className="h-4 w-4" />
            My Stacks
          </TabsTrigger>
          <TabsTrigger value="monitoring" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Monitoring
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Analytics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 mt-6">
          {/* Stats live at page level now (StatsCardsLive) — no duplicate grid here */}

          {/* Recent Stacks */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Stacks</CardTitle>
              <CardDescription>Your most recently modified stacks</CardDescription>
            </CardHeader>
            <CardContent>
              {stacksLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-40" />
                  ))}
                </div>
              ) : filteredStacks.length === 0 ? (
                <div className="text-center py-8">
                  <Layers3 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-medium text-foreground mb-2">No stacks found</h3>
                  <p className="text-muted-foreground mb-4">Get started by creating your first stack</p>
                  <Button onClick={handleCreateNewStack}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Stack
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredStacks.slice(0, 6).map((stack) => {
                    const metrics = getStackMetrics(stack);
                    return (
                      <Card key={stack.id} className="hover:shadow-md transition-shadow">
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-base">{stack.name}</CardTitle>
                            <Badge className={getStatusColor(metrics.status)}>
                              {getStatusIcon(metrics.status)}
                              <span className="ml-1 capitalize">{metrics.status}</span>
                            </Badge>
                          </div>
                          <CardDescription className="text-sm">
                            {stack.description || 'No description'}
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="flex items-center justify-between text-sm text-muted-foreground mb-3">
                            <span>{metrics.services} services</span>
                            {metrics.uptime && (
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {metrics.uptime}
                              </span>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => handleViewStack(stack)}>
                              <Eye className="h-3 w-3 mr-1" />
                              View
                            </Button>
                            <Button size="sm" onClick={() => handleLoadStack(stack)}>
                              <Edit className="h-3 w-3 mr-1" />
                              Edit
                            </Button>
                          </div>
                          <div className="flex gap-2 mt-2">
                            <Button size="sm" variant="ghost" onClick={() => handleShareStack(stack)}>
                              <Share className="h-3 w-3 mr-1" />
                              Share
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => handleSubmitTemplate(stack)}>
                              <Upload className="h-3 w-3 mr-1" />
                              Template
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stacks" className="space-y-6 mt-6">
          {/* Stack Management */}
          <div className="grid grid-cols-1 gap-4">
            {stacksLoading ? (
              <>
                {Array.from({ length: 2 }).map((_, i) => (
                  <Skeleton key={i} className="h-32" />
                ))}
              </>
            ) : filteredStacks.length === 0 ? (
              <Card>
                <CardContent className="py-12">
                  <div className="text-center">
                    <Layers3 className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                    <h3 className="text-xl font-medium text-foreground mb-2">No stacks found</h3>
                    <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
                      {searchQuery ? `No stacks match "${searchQuery}"` : 'Start building your infrastructure by creating your first stack'}
                    </p>
                    <Button onClick={handleCreateNewStack}>
                      <Plus className="h-4 w-4 mr-2" />
                      Create Your First Stack
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              filteredStacks.map((stack) => {
                const metrics = getStackMetrics(stack);
                return (
                  <Card key={stack.id} className="hover:shadow-md transition-shadow">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <CardTitle className="text-lg">{stack.name}</CardTitle>
                            <Badge className={getStatusColor(metrics.status)}>
                              {getStatusIcon(metrics.status)}
                              <span className="ml-1 capitalize">{metrics.status}</span>
                            </Badge>
                            {stack.isPublic && <Badge variant="outline">Public</Badge>}
                          </div>
                          <CardDescription>
                            {stack.description || 'No description provided'}
                          </CardDescription>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          {metrics.status === 'running' && (
                            <Button variant="outline" size="sm" onClick={() => router.push(`/stacks/${stack.id}`)}>
                              <Pause className="h-3 w-3 mr-1" />
                              Stop
                            </Button>
                          )}
                          {metrics.status === 'stopped' && (
                            <Button variant="outline" size="sm" onClick={() => router.push(`/stacks/${stack.id}`)}>
                              <Play className="h-3 w-3 mr-1" />
                              Start
                            </Button>
                          )}
                          <Button variant="outline" size="sm" onClick={() => handleViewStack(stack)}>
                            <Eye className="h-3 w-3 mr-1" />
                            View
                          </Button>
                          <Button size="sm" onClick={() => handleLoadStack(stack)}>
                            <Edit className="h-3 w-3 mr-1" />
                            Edit
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleShareStack(stack)}>
                            <Share className="h-3 w-3 mr-1" />
                            Share
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleSubmitTemplate(stack)}>
                            <Upload className="h-3 w-3 mr-1" />
                            Template
                          </Button>
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-foreground">{metrics.services}</div>
                          <div className="text-xs text-muted-foreground">Services</div>
                        </div>
                        {metrics.cpuUsage !== undefined && (
                          <div className="text-center">
                            <div className="text-2xl font-bold text-foreground">{metrics.cpuUsage}%</div>
                            <div className="text-xs text-muted-foreground">CPU</div>
                          </div>
                        )}
                        {metrics.memoryUsage !== undefined && (
                          <div className="text-center">
                            <div className="text-2xl font-bold text-foreground">{metrics.memoryUsage}%</div>
                            <div className="text-xs text-muted-foreground">Memory</div>
                          </div>
                        )}
                        <div className="text-center">
                          <div className="text-2xl font-bold text-foreground">
                            {metrics.lastDeployed ? formatDate(metrics.lastDeployed).split(' ')[0] : 'Never'}
                          </div>
                          <div className="text-xs text-muted-foreground">Last Deploy</div>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {stack.services.slice(0, 5).map((service, index) => (
                          <Badge key={index} variant="secondary" className="text-xs">
                            {service.service?.name ?? 'Service'}
                          </Badge>
                        ))}
                        {stack.services.length > 5 && (
                          <Badge variant="outline" className="text-xs">
                            +{stack.services.length - 5} more
                          </Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </TabsContent>

        <TabsContent value="monitoring" className="space-y-6 mt-6">
          <MonitoringPanel />
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6 mt-6">
          <AnalyticsPanel />
        </TabsContent>
      </Tabs>

      {/* Stack Details Modal */}
      {showStackDetails && selectedStack && (
        <Dialog open={showStackDetails} onOpenChange={setShowStackDetails}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{selectedStack.name}</DialogTitle>
              <DialogDescription>
                {selectedStack.description || 'Stack details and configuration'}
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium mb-2">Services ({selectedStack.services.length})</h4>
                  <div className="space-y-1">
                    {selectedStack.services.map((service, index) => (
                      <div key={index} className="flex items-center gap-2 text-sm">
                        <div className="w-2 h-2 bg-success rounded-full"></div>
                        {service.service?.name ?? 'Service'}
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Status</h4>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge className={getStatusColor(getStackMetrics(selectedStack).status)}>
                        {getStatusIcon(getStackMetrics(selectedStack).status)}
                        <span className="ml-1 capitalize">{getStackMetrics(selectedStack).status}</span>
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Created: {formatDate(selectedStack.createdAt || new Date())}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Updated: {formatDate(selectedStack.updatedAt || new Date())}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="flex gap-2 pt-4">
                <Button onClick={() => handleLoadStack(selectedStack)}>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Stack
                </Button>
                <Button variant="outline" onClick={() => handleExportStack(selectedStack)}>
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
                <Button variant="outline" onClick={() => handleShareStack(selectedStack)}>
                  <Share className="h-4 w-4 mr-2" />
                  Share
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Share Stack Modal */}
      {showShareModal && stackToShare && (
        <ShareStackModal
          isOpen={showShareModal}
          onClose={() => {
            setShowShareModal(false);
            setStackToShare(null);
          }}
          initialStack={{
            id: String(stackToShare.id || ''),
            name: stackToShare.name,
            description: stackToShare.description,
            services: stackToShare.services
          }}
        />
      )}

      {/* Submit Template Modal */}
      {showSubmitTemplateModal && stackToShare && (
        <SubmitTemplateModal
          isOpen={showSubmitTemplateModal}
          onClose={() => {
            setShowSubmitTemplateModal(false);
            setStackToShare(null);
          }}
          initialStack={{
            id: String(stackToShare.id || ''),
            name: stackToShare.name,
            description: stackToShare.description,
            services: stackToShare.services
          }}
        />
      )}

      {/* Screen Reader Announcements */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
        id="dashboard-announcements"
      >
        {searchQuery && `Showing ${filteredStacks.length} stacks for "${searchQuery}"`}
      </div>
    </div>
  );
}

export default DashboardClient;