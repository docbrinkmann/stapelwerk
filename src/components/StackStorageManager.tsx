'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useStackPersistence } from '@/stores/stack-builder';
import { useStackPersistence as usePersistenceService } from '@/lib/stack-persistence';
import { 
  Clock, 
  Trash2, 
  Download, 
  Upload, 
  Search, 
  Save, 
  HardDrive, 
  Cloud,
  AlertCircle,
  History,
  Settings
} from 'lucide-react';
import type { PersistedStack } from '@/lib/stack-persistence';
import { useT } from '@/lib/i18n/client';

interface StackStorageManagerProps {
  isOpen: boolean;
  onClose: () => void;
  onLoadStack?: (stack: PersistedStack) => void;
}

export function StackStorageManager({ isOpen, onClose, onLoadStack }: StackStorageManagerProps) {
  const t = useT();
  const [activeTab, setActiveTab] = useState('local');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStack, setSelectedStack] = useState<PersistedStack | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [storageStats, setStorageStats] = useState({
    localStacks: 0,
    localStorageSize: 0,
    autoSaveEnabled: false,
  });

  const { 
    isDirty,
    lastSaved,
    autoSaveEnabled,
    saveAsDraft,
    savePermanently,
    toggleAutoSave 
  } = useStackPersistence();

  const {
    getLocalStacks,
    deleteLocalStack,
    clearLocalStacks,
    getStorageStats,
  } = usePersistenceService();

  const [localStacks, setLocalStacks] = useState<PersistedStack[]>([]);

  // Load local stacks and stats
  useEffect(() => {
    if (isOpen) {
      const stacks = getLocalStacks();
      setLocalStacks(stacks);
      setStorageStats(getStorageStats());
    }
  }, [isOpen, getLocalStacks, getStorageStats]);

  // Filter stacks based on search query
  const filteredLocalStacks = localStacks.filter(stack =>
    stack.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    stack.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleLoadStack = (stack: PersistedStack) => {
    if (onLoadStack) {
      onLoadStack(stack);
      onClose();
    }
  };

  const handleDeleteStack = async (stackId: string | number) => {
    setIsDeleting(String(stackId));
    try {
      const success = deleteLocalStack(stackId);
      if (success) {
        // Refresh the list
        const updatedStacks = getLocalStacks();
        setLocalStacks(updatedStacks);
        setStorageStats(getStorageStats());
      }
    } catch (error) {
      console.error('Failed to delete stack:', error);
    } finally {
      setIsDeleting(null);
    }
  };

  const handleClearAllLocal = () => {
    if (window.confirm(t('catalog.confirmDeleteAllStacks'))) {
      clearLocalStacks();
      setLocalStacks([]);
      setStorageStats(getStorageStats());
    }
  };

  const handleSaveCurrentStack = async () => {
    try {
      await saveAsDraft();
      // Refresh the list
      const updatedStacks = getLocalStacks();
      setLocalStacks(updatedStacks);
      setStorageStats(getStorageStats());
    } catch (error) {
      console.error('Failed to save current stack:', error);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString() + ' ' + new Date(date).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const getStackTypeLabel = (stack: any) => {
    const metadata = stack.metadata;
    if (metadata?.autoSave) return { label: t('catalog.autoSaveLabel'), color: 'bg-info/10 text-info' };
    if (metadata?.isDraft) return { label: t('common.draft'), color: 'bg-warning/10 text-warning' };
    return { label: t('catalog.savedLabel'), color: 'bg-success/10 text-success' };
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>
            <div className="flex items-center gap-2">
              <HardDrive className="h-5 w-5" />
              <span>{t('catalog.stackStorageManager')}</span>
            </div>
          </DialogTitle>
          <DialogDescription>
            {t('catalog.stackStorageManagerDesc')}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="local" className="flex items-center gap-2">
              <HardDrive className="h-4 w-4" />
              {t('catalog.localStorageTab')}
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              {t('common.settings')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="local" className="space-y-4">
            {/* Current Stack Status */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  {t('catalog.currentStack')}
                  {isDirty && <Badge variant="outline">{t('catalog.unsavedChanges')}</Badge>}
                </CardTitle>
                <CardDescription>
                  {lastSaved ? t('catalog.lastSavedAt', { date: formatDate(lastSaved) }) : t('catalog.notSavedYet')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Button onClick={handleSaveCurrentStack} disabled={!isDirty}>
                    <Save className="h-4 w-4 mr-1" />
                    {t('catalog.saveAsDraft')}
                  </Button>
                  <Button variant="outline" onClick={() => savePermanently()}>
                    <Cloud className="h-4 w-4 mr-1" />
                    {t('catalog.savePermanently')}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Storage Stats */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">{t('catalog.storageStatistics')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>{t('catalog.localStacksColon')}</span>
                  <span className="font-medium">{storageStats.localStacks}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>{t('catalog.storageUsedColon')}</span>
                  <span className="font-medium">{formatFileSize(storageStats.localStorageSize)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>{t('catalog.autoSaveColon')}</span>
                  <span className={`font-medium ${autoSaveEnabled ? 'text-success' : 'text-muted-foreground'}`}>
                    {autoSaveEnabled ? t('catalog.enabled') : t('catalog.disabled')}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Search */}
            <div className="flex items-center gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t('catalog.searchSavedStacksPlaceholder')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button variant="outline" onClick={handleClearAllLocal} size="sm">
                <Trash2 className="h-4 w-4 mr-1" />
                {t('catalog.clearAll')}
              </Button>
            </div>

            {/* Local Stacks List */}
            <ScrollArea className="h-96">
              <div className="space-y-3">
                {filteredLocalStacks.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <HardDrive className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>{t('catalog.noSavedStacks')}</p>
                    <p className="text-sm">{t('catalog.noSavedStacksHint')}</p>
                  </div>
                ) : (
                  filteredLocalStacks.map((stack) => {
                    const typeInfo = getStackTypeLabel(stack);
                    return (
                      <Card key={stack.id} className="hover:shadow-md transition-shadow">
                        <CardHeader className="pb-3">
                          <div className="flex justify-between items-start">
                            <div className="flex-1 min-w-0">
                              <CardTitle className="text-base truncate">{stack.name}</CardTitle>
                              <CardDescription className="text-sm">
                                {stack.description || t('catalog.noDescription')}
                              </CardDescription>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge className={typeInfo.color}>
                                {typeInfo.label}
                              </Badge>
                              {stack.isPublic && <Badge variant="outline">{t('catalog.publicBadge')}</Badge>}
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <div className="flex justify-between items-center text-sm text-muted-foreground mb-3">
                            <span>{t('catalog.servicesCount', { count: stack.services.length })}</span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatDate(stack.updatedAt || stack.createdAt || new Date())}
                            </span>
                          </div>
                          
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleLoadStack(stack)}
                            >
                              <Upload className="h-3 w-3 mr-1" />
                              {t('catalog.load')}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedStack(stack)}
                            >
                              <Download className="h-3 w-3 mr-1" />
                              {t('common.export')}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeleteStack(stack.id!)}
                              disabled={isDeleting === String(stack.id)}
                            >
                              <Trash2 className="h-3 w-3 mr-1" />
                              {t('common.delete')}
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="settings" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>{t('catalog.autoSaveSettings')}</CardTitle>
                <CardDescription>
                  {t('catalog.autoSaveSettingsDesc')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="auto-save-toggle">{t('catalog.enableAutoSave')}</Label>
                    <p className="text-sm text-muted-foreground">
                      {t('catalog.autoSaveEvery30s')}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    onClick={toggleAutoSave}
                    className={autoSaveEnabled ? 'bg-success/10 border-success/30' : ''}
                  >
                    {autoSaveEnabled ? t('catalog.enabled') : t('catalog.disabled')}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t('catalog.storageCleanup')}</CardTitle>
                <CardDescription>
                  {t('catalog.storageCleanupDesc')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-medium">{t('catalog.clearAutoSaves')}</p>
                    <p className="text-sm text-muted-foreground">{t('catalog.clearAutoSavesDesc')}</p>
                  </div>
                  <Button variant="outline" size="sm">
                    <Trash2 className="h-4 w-4 mr-1" />
                    {t('catalog.cleanUp')}
                  </Button>
                </div>
                
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-medium">{t('catalog.clearAllData')}</p>
                    <p className="text-sm text-muted-foreground">{t('catalog.clearAllDataDesc')}</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={handleClearAllLocal}>
                    <AlertCircle className="h-4 w-4 mr-1" />
                    {t('catalog.clearAll')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}