'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { useStackBuilder } from '@/stores/stack-builder';
import { useT } from '@/lib/i18n/client';
import { 
  Download,
  Copy,
  ExternalLink,
  Play,
  Code,
  FileText,
  Heart,
  MessageCircle,
  Share2,
  User,
  Calendar,
  Tag,
  Clock,
  Shield,
  Star,
  ArrowLeft,
  Import,
  Eye,
  Layers3,
  Server
} from 'lucide-react';

interface SharedStack {
  id: string;
  name: string;
  description: string;
  services: any[];
  author: {
    id: string;
    name: string;
    avatar?: string;
  };
  category: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  tags: string[];
  isPublic: boolean;
  allowCloning: boolean;
  allowComments: boolean;
  stats: {
    views: number;
    likes: number;
    clones: number;
    comments: number;
  };
  createdAt: Date;
  updatedAt: Date;
  dockerCompose?: string;
  documentation?: string;
  examples?: string;
}

interface SharedStackViewerProps {
  sharedStack: SharedStack;
  relatedStacks: SharedStack[];
  shareId: string;
}

const SharedStackViewer: React.FC<SharedStackViewerProps> = ({
  sharedStack,
  relatedStacks,
  shareId
}) => {
  const t = useT();
  const router = useRouter();
  const { toast } = useToast();
  const { importFromJSON, services: currentServices } = useStackBuilder();
  
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [selectedTab, setSelectedTab] = useState('overview');

  const handleImportStack = async () => {
    if (!sharedStack.allowCloning) {
      toast({
        title: t('catalog.importNotAllowedTitle'),
        description: t('catalog.importNotAllowedDesc'),
        variant: 'destructive'
      });
      return;
    }

    setIsImporting(true);
    try {
      // Convert shared stack to importable format
      const stackData = {
        name: `${sharedStack.name} (imported)`,
        description: sharedStack.description,
        services: sharedStack.services
      };

      await importFromJSON(JSON.stringify(stackData));
      
      toast({
        title: t('catalog.toastStackImportedTitle'),
        description: t('catalog.toastStackImportedDesc'),
variant: 'default'
      });

      // Redirect to stack builder with imported stack
      router.push('/stack-builder');
    } catch (error) {
      toast({
        title: t('catalog.toastImportFailedTitle'),
        description: t('catalog.toastImportFailedDesc'),
        variant: 'destructive'
      });
    } finally {
      setIsImporting(false);
      setShowImportDialog(false);
    }
  };

  const handleCopyShareUrl = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast({
        title: t('catalog.linkCopiedTitle'),
        description: t('catalog.linkCopiedDesc'),
        variant: 'default'
      });
    } catch (error) {
      toast({
        title: t('catalog.copyFailedTitle'),
        description: t('catalog.copyUrlFailedDesc'),
        variant: 'destructive'
      });
    }
  };

  const handleDownloadCompose = () => {
    if (!sharedStack.dockerCompose) {
      toast({
        title: t('catalog.notAvailableTitle'),
        description: t('catalog.composeNotAvailable'),
        variant: 'destructive'
      });
      return;
    }

    const blob = new Blob([sharedStack.dockerCompose], { type: 'text/yaml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${sharedStack.name.toLowerCase().replace(/\s+/g, '-')}-docker-compose.yml`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return 'bg-success/10 text-success border-success/30';
      case 'intermediate': return 'bg-warning/10 text-warning border-warning/30';
      case 'advanced': return 'bg-destructive/10 text-destructive border-destructive/30';
      default: return 'bg-muted text-foreground border-border';
    }
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div className="shared-stack-viewer">
      {/* Header */}
      <div className="bg-card border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <Button variant="ghost" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t('common.back')}
            </Button>
            
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={handleCopyShareUrl}>
                <Share2 className="h-4 w-4 mr-2" />
                {t('common.share')}
              </Button>

              {sharedStack.allowCloning && (
                <Button onClick={() => setShowImportDialog(true)}>
                  <Import className="h-4 w-4 mr-2" />
                  {t('catalog.importStack')}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content Area */}
          <div className="lg:col-span-2 space-y-6">
            {/* Stack Header */}
            <div className="bg-card rounded-lg p-6 shadow-sm">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h1 className="text-3xl font-bold text-foreground mb-2">
                    {sharedStack.name}
                  </h1>
                  <p className="text-muted-foreground text-lg leading-relaxed">
                    {sharedStack.description}
                  </p>
                </div>
                
                <div className="flex items-center gap-2 ml-4">
                  <Badge className={getDifficultyColor(sharedStack.difficulty)}>
                    {sharedStack.difficulty}
                  </Badge>
                  {sharedStack.isPublic && (
                    <Badge variant="outline">
                      <Eye className="h-3 w-3 mr-1" />
                      {t('catalog.publicBadge')}
                    </Badge>
                  )}
                </div>
              </div>

              {/* Author and Metadata */}
              <div className="flex items-center gap-6 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  <span>{t('catalog.byAuthor', { name: sharedStack.author.name })}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <span>{t('catalog.createdOn', { date: formatDate(sharedStack.createdAt) })}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Tag className="h-4 w-4" />
                  <span>{sharedStack.category}</span>
                </div>
              </div>

              {/* Stats */}
              <div className="flex items-center gap-6 mt-4 pt-4 border-t">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Eye className="h-4 w-4" />
                  <span>{t('catalog.viewsCount', { count: sharedStack.stats.views.toLocaleString() })}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Heart className="h-4 w-4" />
                  <span>{t('catalog.likesCount', { count: sharedStack.stats.likes.toLocaleString() })}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Download className="h-4 w-4" />
                  <span>{t('catalog.clonesCount', { count: sharedStack.stats.clones.toLocaleString() })}</span>
                </div>
                {sharedStack.allowComments && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MessageCircle className="h-4 w-4" />
                    <span>{t('catalog.commentsCount', { count: sharedStack.stats.comments.toLocaleString() })}</span>
                  </div>
                )}
              </div>

              {/* Tags */}
              {(sharedStack.tags?.length ?? 0) > 0 && (
                <div className="flex flex-wrap gap-2 mt-4">
                  {(sharedStack.tags ?? []).map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Stack Content Tabs */}
            <Tabs value={selectedTab} onValueChange={setSelectedTab}>
              <TabsList className="w-full grid grid-cols-4">
                <TabsTrigger value="overview">{t('catalog.tabOverview')}</TabsTrigger>
                <TabsTrigger value="services">{t('catalog.services')}</TabsTrigger>
                <TabsTrigger value="compose">Docker Compose</TabsTrigger>
                <TabsTrigger value="documentation">{t('catalog.documentation')}</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle>{t('catalog.stackOverview')}</CardTitle>
                    <CardDescription>
                      {t('catalog.stackContainsServices', { count: sharedStack.services.length })}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <h4 className="font-medium mb-3">{t('catalog.servicesHeadingCount', { count: sharedStack.services.length })}</h4>
                        <div className="space-y-2">
                          {sharedStack.services.slice(0, 6).map((service, index) => (
                            <div key={index} className="flex items-center gap-3 p-2 bg-muted rounded">
                              <img 
                                src={service.logo} 
                                alt={service.name}
                                className="w-6 h-6"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none';
                                }}
                              />
                              <div>
                                <p className="font-medium text-sm">{service.name}</p>
                                <p className="text-xs text-muted-foreground">{service.category}</p>
                              </div>
                            </div>
                          ))}
                          {sharedStack.services.length > 6 && (
                            <div className="text-sm text-muted-foreground text-center py-2">
                              {t('catalog.moreServicesCount', { count: sharedStack.services.length - 6 })}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div>
                        <h4 className="font-medium mb-3">{t('catalog.stackInformation')}</h4>
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <Layers3 className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">{t('catalog.multiServiceArchitecture')}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Server className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">{t('catalog.containerOrchestrationReady')}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Shield className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">
                              {sharedStack.allowCloning ? t('catalog.cloningAllowed') : t('catalog.viewOnly')}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">
                              {t('catalog.updatedOn', { date: formatDate(sharedStack.updatedAt) })}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="services" className="mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle>{t('catalog.servicesConfiguration')}</CardTitle>
                    <CardDescription>
                      {t('catalog.servicesConfigurationDesc')}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4">
                      {sharedStack.services.map((service, index) => (
                        <div key={index} className="border rounded-lg p-4">
                          <div className="flex items-start gap-4">
                            <img 
                              src={service.logo} 
                              alt={service.name}
                              className="w-12 h-12 rounded"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                            <div className="flex-1">
                              <h5 className="font-medium text-lg">{service.name}</h5>
                              <p className="text-muted-foreground mb-2">{service.description}</p>
                              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                <span>{t('catalog.categoryValue', { value: service.category })}</span>
                                {service.version && <span>{t('catalog.versionValue', { value: service.version })}</span>}
                              </div>
                              {service.ports && service.ports.length > 0 && (
                                <div className="mt-2">
                                  <span className="text-sm font-medium">{t('catalog.portsColon')} </span>
                                  <span className="text-sm text-muted-foreground">
                                    {service.ports.join(', ')}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="compose" className="mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle>{t('catalog.composeConfiguration')}</CardTitle>
                    <CardDescription>
                      {t('catalog.composeConfigurationDesc')}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {sharedStack.dockerCompose ? (
                      <div>
                        <div className="flex justify-end mb-4">
                          <Button variant="outline" onClick={handleDownloadCompose}>
                            <Download className="h-4 w-4 mr-2" />
                            {t('common.download')}
                          </Button>
                        </div>
                        <pre className="bg-muted text-foreground p-4 rounded-lg overflow-x-auto text-sm">
                          <code>{sharedStack.dockerCompose}</code>
                        </pre>
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <Code className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                        <p className="text-muted-foreground">
                          {t('catalog.composeFileNotAvailable')}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="documentation" className="mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle>{t('catalog.documentation')}</CardTitle>
                    <CardDescription>
                      {t('catalog.documentationDesc')}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {sharedStack.documentation ? (
                      <div className="prose prose-sm max-w-none">
                        <pre className="whitespace-pre-wrap text-sm leading-relaxed">
                          {sharedStack.documentation}
                        </pre>
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                        <p className="text-muted-foreground">
                          {t('catalog.noDocumentation')}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{t('catalog.quickActions')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {sharedStack.allowCloning && (
                  <Button 
                    className="w-full" 
                    onClick={() => setShowImportDialog(true)}
                  >
                    <Import className="h-4 w-4 mr-2" />
                    {t('catalog.importToWorkspace')}
                  </Button>
                )}
                
                <Button variant="outline" className="w-full" onClick={handleCopyShareUrl}>
                  <Copy className="h-4 w-4 mr-2" />
                  {t('catalog.copyShareLink')}
                </Button>
                
                {sharedStack.dockerCompose && (
                  <Button variant="outline" className="w-full" onClick={handleDownloadCompose}>
                    <Download className="h-4 w-4 mr-2" />
                    {t('catalog.downloadCompose')}
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Related Stacks */}
            {(relatedStacks?.length ?? 0) > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">{t('catalog.relatedStacks')}</CardTitle>
                  <CardDescription>
                    {t('catalog.relatedStacksDesc')}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {relatedStacks.slice(0, 3).map((stack) => (
                      <div 
                        key={stack.id}
                        className="border rounded p-3 hover:bg-muted cursor-pointer"
                        onClick={() => router.push(`/shared/${stack.id}`)}
                      >
                        <h6 className="font-medium text-sm">{stack.name}</h6>
                        <p className="text-xs text-muted-foreground mb-2">
                          {stack.description}
                        </p>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>{t('catalog.servicesCount', { count: stack.services?.length ?? 0 })}</span>
                          <Badge className={getDifficultyColor(stack.difficulty)}>
                            {stack.difficulty}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Import Confirmation Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('catalog.importStack')}</DialogTitle>
            <DialogDescription>
              {t('catalog.importDialogDesc', { name: sharedStack.name })}
              {currentServices.length > 0 && ` ${t('catalog.currentStackReplaced')}`}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="bg-info/10 border border-info/30 rounded-lg p-4">
              <h4 className="font-medium mb-2">{t('catalog.whatWillBeImported')}</h4>
              <ul className="text-sm text-foreground space-y-1">
                <li>• {t('catalog.servicesCount', { count: sharedStack.services.length })}</li>
                <li>• {t('catalog.importItemConfigs')}</li>
                <li>• {t('catalog.importItemMetadata')}</li>
              </ul>
            </div>
            
            {currentServices.length > 0 && (
              <div className="bg-warning/10 border border-warning/30 rounded-lg p-4">
                <p className="text-sm text-warning">
                  {t('catalog.workspaceReplaceWarning', { count: currentServices.length })}
                </p>
              </div>
            )}
            
            <div className="flex justify-end gap-3">
              <Button 
                variant="outline" 
                onClick={() => setShowImportDialog(false)}
              >
                {t('common.cancel')}
              </Button>
              <Button
                onClick={handleImportStack}
                disabled={isImporting}
              >
                {isImporting ? t('catalog.importing') : t('catalog.importStack')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SharedStackViewer;