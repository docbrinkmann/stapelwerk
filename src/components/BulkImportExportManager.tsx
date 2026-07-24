'use client';

import { useState, useCallback, useRef } from 'react';
import { parse as parseYaml } from 'yaml';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/components/ui/use-toast';
import { useStackPersistence } from '@/stores/stack-builder';
import { stackPersistence } from '@/lib/stack-persistence';
import { useT } from '@/lib/i18n/client';
import {
  Upload,
  Download,
  FileText,
  Archive,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  FolderOpen,
  Package,
  GitBranch,
  Database,
  Cloud,
  HardDrive
} from 'lucide-react';

interface BulkImportExportManagerProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'import' | 'export';
}

interface ImportResult {
  success: boolean;
  stackName: string;
  error?: string;
  services: number;
}

interface ExportOptions {
  format: 'json' | 'yaml' | 'zip';
  includeMetadata: boolean;
  includeDocumentation: boolean;
  includeConfigurations: boolean;
  separateFiles: boolean;
}

const BulkImportExportManager: React.FC<BulkImportExportManagerProps> = ({
  isOpen,
  onClose,
  mode
}) => {
  const t = useT();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [importResults, setImportResults] = useState<ImportResult[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [importSource, setImportSource] = useState<'files' | 'folder' | 'urls'>('files');
  const [urlList, setUrlList] = useState('');
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    format: 'json',
    includeMetadata: true,
    includeDocumentation: true,
    includeConfigurations: true,
    separateFiles: false
  });

  const { 
    importFromJSON, 
    exportAsJSON,
    exportDockerCompose 
  } = useStackPersistence();
  
  // Use the service directly for accessing multiple stacks
  const getLocalStacks = () => stackPersistence.getLocalStacks();

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      setSelectedFiles(files);
    }
  }, []);

  const handleFolderSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      setSelectedFiles(files);
    }
  }, []);

  const parseStackFromFile = async (file: File): Promise<any> => {
    const text = await file.text();

    try {
      // Try JSON first
      return JSON.parse(text);
    } catch {
      try {
        // Try parsing as Docker Compose YAML
        if (file.name.includes('docker-compose') || text.includes('version:') || text.includes('services:')) {
          const yamlData = parseYaml(text) as any;

          // Convert Docker Compose format to our stack format
          if (yamlData && yamlData.services) {
            const services = Object.entries(yamlData.services).map(([name, config]: [string, any]) => ({
              serviceId: name,
              name: name,
              image: config.image || 'nginx:latest',
              dockerImage: config.image || 'nginx:latest',
              version: config.image?.split(':')[1] || 'latest',
              category: 'imported',
              description: `Imported from ${file.name}`,
              ports: config.ports?.map((port: any) => {
                const [hostPort, containerPort] = typeof port === 'string'
                  ? port.split(':').map((p: string) => parseInt(p))
                  : [port, port];
                return {
                  host: hostPort || 80,
                  container: containerPort || 80
                };
              }) || [],
              environment: config.environment?.reduce((acc: any, env: string) => {
                const [key, ...valueParts] = env.split('=');
                acc[key] = valueParts.join('=');
                return acc;
              }, {}) || config.environment || {},
              volumes: config.volumes?.map((vol: any) => {
                const [host, container] = typeof vol === 'string'
                  ? vol.split(':')
                  : [vol.source, vol.target];
                return { host, container };
              }) || []
            }));

            return {
              name: yamlData.name || file.name.replace(/\.(ya?ml|json)$/, ''),
              services: services,
              version: yamlData.version || '1.0.0'
            };
          }
          throw new Error('Invalid Docker Compose format - missing services');
        }
        throw new Error('Unsupported file format');
      } catch (error) {
        if (error instanceof Error && error.message.includes('Invalid Docker Compose format')) {
          throw error;
        }
        throw new Error('Failed to parse file');
      }
    }
  };

  const processImportFiles = async () => {
    if (!selectedFiles) return;
    
    setIsProcessing(true);
    setImportResults([]);
    setProcessingProgress(0);

    const results: ImportResult[] = [];
    const totalFiles = selectedFiles.length;

    for (let i = 0; i < totalFiles; i++) {
      const file = selectedFiles[i];
      
      try {
        const stackData = await parseStackFromFile(file);
        
        // Validate stack data structure
        if (!stackData.name || !stackData.services || !Array.isArray(stackData.services)) {
          throw new Error('Invalid stack format - missing required fields');
        }

        // Import the stack
        await importFromJSON(JSON.stringify(stackData));
        
        results.push({
          success: true,
          stackName: stackData.name,
          services: stackData.services.length
        });
      } catch (error) {
        results.push({
          success: false,
          stackName: file.name,
          error: error instanceof Error ? error.message : t('catalog.unknownError'),
          services: 0
        });
      }

      setProcessingProgress(Math.round(((i + 1) / totalFiles) * 100));
      setImportResults([...results]);
    }

    setIsProcessing(false);
    
    const successCount = results.filter(r => r.success).length;
    toast({
      title: t('catalog.importCompleteTitle'),
      description: t('catalog.importCompleteDesc', { success: successCount, total: totalFiles }),
      variant: successCount > 0 ? "default" : "destructive"
    });
  };

  const processImportUrls = async () => {
    const urls = urlList.split('\n').filter(url => url.trim().length > 0);
    if (urls.length === 0) return;

    setIsProcessing(true);
    setImportResults([]);
    setProcessingProgress(0);

    const results: ImportResult[] = [];
    const totalUrls = urls.length;

    for (let i = 0; i < totalUrls; i++) {
      const url = urls[i].trim();
      
      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const text = await response.text();
        const stackData = JSON.parse(text);
        
        // Validate and import
        if (!stackData.name || !stackData.services || !Array.isArray(stackData.services)) {
          throw new Error('Invalid stack format');
        }

        await importFromJSON(JSON.stringify(stackData));
        
        results.push({
          success: true,
          stackName: stackData.name,
          services: stackData.services.length
        });
      } catch (error) {
        results.push({
          success: false,
          stackName: url,
          error: error instanceof Error ? error.message : t('catalog.unknownError'),
          services: 0
        });
      }

      setProcessingProgress(Math.round(((i + 1) / totalUrls) * 100));
      setImportResults([...results]);
    }

    setIsProcessing(false);
    
    const successCount = results.filter(r => r.success).length;
    toast({
      title: t('catalog.importCompleteTitle'),
      description: t('catalog.importCompleteDesc', { success: successCount, total: totalUrls }),
      variant: successCount > 0 ? "default" : "destructive"
    });
  };

  const handleBulkExport = async () => {
    setIsProcessing(true);
    setProcessingProgress(0);

    try {
      const stacks = getLocalStacks();
      if (stacks.length === 0) {
        toast({
          title: t('catalog.noStacksFoundTitle'),
          description: t('catalog.noStacksToExport'),
          variant: "destructive"
        });
        return;
      }

      if (exportOptions.separateFiles) {
        // Export each stack as a separate file
        for (let i = 0; i < stacks.length; i++) {
          const stack = stacks[i];
          
          if (exportOptions.format === 'json') {
            const stackData = {
              ...stack,
              metadata: exportOptions.includeMetadata ? {
                exportedAt: new Date().toISOString(),
                version: '1.0.0',
                source: 'build-my-stack'
              } : undefined,
              documentation: exportOptions.includeDocumentation ? stack.description : undefined
            };
            
            const blob = new Blob([JSON.stringify(stackData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${stack.name.toLowerCase().replace(/\s+/g, '-')}.json`;
            a.click();
            URL.revokeObjectURL(url);
          } else if (exportOptions.format === 'yaml') {
            // Export as Docker Compose YAML
            const dockerCompose = exportDockerCompose(); // This would need the stack data
            const blob = new Blob([dockerCompose], { type: 'text/yaml' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${stack.name.toLowerCase().replace(/\s+/g, '-')}-docker-compose.yml`;
            a.click();
            URL.revokeObjectURL(url);
          }
          
          setProcessingProgress(Math.round(((i + 1) / stacks.length) * 100));
        }
      } else {
        // Export all stacks in a single file
        const bulkData = {
          metadata: exportOptions.includeMetadata ? {
            exportedAt: new Date().toISOString(),
            version: '1.0.0',
            source: 'build-my-stack',
            totalStacks: stacks.length
          } : undefined,
          stacks: stacks.map(stack => ({
            ...stack,
            documentation: exportOptions.includeDocumentation ? stack.description : undefined
          }))
        };

        if (exportOptions.format === 'json') {
          const blob = new Blob([JSON.stringify(bulkData, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `bulk-stacks-export-${new Date().toISOString().split('T')[0]}.json`;
          a.click();
          URL.revokeObjectURL(url);
        }
        
        setProcessingProgress(100);
      }

      toast({
        title: t('catalog.exportCompleteTitle'),
        description: t('catalog.exportCompleteDesc', { count: stacks.length }),
variant: 'default'
      });
    } catch (error) {
      toast({
        title: t('catalog.exportFailedTitle'),
        description: t('catalog.exportFailedDesc'),
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const renderImportInterface = () => (
    <div className="space-y-6">
      <Tabs value={importSource} onValueChange={(value: any) => setImportSource(value)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="files">{t('catalog.tabFiles')}</TabsTrigger>
          <TabsTrigger value="folder">{t('catalog.tabFolder')}</TabsTrigger>
          <TabsTrigger value="urls">{t('catalog.tabUrls')}</TabsTrigger>
        </TabsList>

        <TabsContent value="files" className="space-y-4">
          <div>
            <Label>{t('catalog.selectStackFiles')}</Label>
            <p className="text-sm text-muted-foreground mb-2">
              {t('catalog.selectStackFilesDesc')}
            </p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".json,.yml,.yaml"
              onChange={handleFileSelect}
              className="hidden"
            />
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              className="w-full"
            >
              <FileText className="h-4 w-4 mr-2" />
              {t('catalog.chooseFiles')}
            </Button>
            {selectedFiles && (
              <p className="text-sm text-muted-foreground mt-2">
                {t('catalog.selectedFilesCount', { count: selectedFiles.length })}
              </p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="folder" className="space-y-4">
          <div>
            <Label>{t('catalog.selectFolder')}</Label>
            <p className="text-sm text-muted-foreground mb-2">
              {t('catalog.selectFolderDesc')}
            </p>
            <input
              ref={folderInputRef}
              type="file"
              /* @ts-expect-error -- non-standard attribute to allow directory selection */
              webkitdirectory="true"
              onChange={handleFolderSelect}
              className="hidden"
            />
            <Button
              variant="outline"
              onClick={() => folderInputRef.current?.click()}
              className="w-full"
            >
              <FolderOpen className="h-4 w-4 mr-2" />
              {t('catalog.chooseFolder')}
            </Button>
            {selectedFiles && (
              <p className="text-sm text-muted-foreground mt-2">
                {t('catalog.foundFilesCount', { count: selectedFiles.length })}
              </p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="urls" className="space-y-4">
          <div>
            <Label htmlFor="url-list">{t('catalog.stackUrls')}</Label>
            <p className="text-sm text-muted-foreground mb-2">
              {t('catalog.stackUrlsDesc')}
            </p>
            <Textarea
              id="url-list"
              placeholder="https://example.com/stack1.json&#10;https://example.com/stack2.json"
              value={urlList}
              onChange={(e) => setUrlList(e.target.value)}
              rows={5}
            />
            <p className="text-sm text-muted-foreground">
              {t('catalog.urlsCount', { count: urlList.split('\n').filter(url => url.trim().length > 0).length })}
            </p>
          </div>
        </TabsContent>
      </Tabs>

      {/* Processing Status */}
      {isProcessing && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">{t('catalog.processingImports')}</span>
          </div>
          <Progress value={processingProgress} className="w-full" />
        </div>
      )}

      {/* Import Results */}
      {importResults.length > 0 && (
        <div className="space-y-2">
          <h4 className="font-medium">{t('catalog.importResults')}</h4>
          <div className="max-h-48 overflow-y-auto space-y-1">
            {importResults.map((result, index) => (
              <div key={index} className="flex items-center justify-between p-2 bg-muted rounded text-sm">
                <div className="flex items-center gap-2">
                  {result.success ? (
                    <CheckCircle2 className="h-4 w-4 text-success" />
                  ) : (
                    <XCircle className="h-4 w-4 text-destructive" />
                  )}
                  <span className="font-medium">{result.stackName}</span>
                  {result.success && (
                    <Badge variant="outline" className="text-xs">
                      {t('catalog.servicesCount', { count: result.services })}
                    </Badge>
                  )}
                </div>
                {!result.success && result.error && (
                  <span className="text-xs text-destructive max-w-xs truncate">
                    {result.error}
                  </span>
                )}
              </div>
            ))}
          </div>
          
          <div className="flex gap-2 text-sm">
            <Badge variant="outline" className="text-success">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              {t('catalog.successfulCount', { count: importResults.filter(r => r.success).length })}
            </Badge>
            <Badge variant="outline" className="text-destructive">
              <XCircle className="h-3 w-3 mr-1" />
              {t('catalog.failedCount', { count: importResults.filter(r => !r.success).length })}
            </Badge>
          </div>
        </div>
      )}

      <div className="flex gap-3">
        <Button 
          onClick={
            importSource === 'urls' 
              ? processImportUrls 
              : processImportFiles
          }
          disabled={
            isProcessing || 
            (importSource !== 'urls' && !selectedFiles) ||
            (importSource === 'urls' && urlList.trim().length === 0)
          }
          className="flex-1"
        >
          {isProcessing ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              {t('catalog.processing')}
            </>
          ) : (
            <>
              <Upload className="h-4 w-4 mr-2" />
              {t('catalog.importStacks')}
            </>
          )}
        </Button>
      </div>
    </div>
  );

  const renderExportInterface = () => (
    <div className="space-y-6">
      <div className="space-y-4">
        <h4 className="font-medium">{t('catalog.exportOptions')}</h4>

        <div className="space-y-3">
          <div>
            <Label>{t('catalog.exportFormat')}</Label>
            <div className="flex gap-2 mt-1">
              {['json', 'yaml', 'zip'].map((format) => (
                <Button
                  key={format}
                  variant={exportOptions.format === format ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setExportOptions(prev => ({ ...prev, format: format as any }))}
                >
                  {format.toUpperCase()}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t('catalog.includeOptions')}</Label>
            <div className="space-y-2">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={exportOptions.includeMetadata}
                  onChange={(e) => setExportOptions(prev => ({ 
                    ...prev, 
                    includeMetadata: e.target.checked 
                  }))}
                  className="rounded"
                />
                <span className="text-sm">{t('catalog.includeMetadata')}</span>
              </label>
              
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={exportOptions.includeDocumentation}
                  onChange={(e) => setExportOptions(prev => ({ 
                    ...prev, 
                    includeDocumentation: e.target.checked 
                  }))}
                  className="rounded"
                />
                <span className="text-sm">{t('catalog.includeDocumentation')}</span>
              </label>
              
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={exportOptions.includeConfigurations}
                  onChange={(e) => setExportOptions(prev => ({ 
                    ...prev, 
                    includeConfigurations: e.target.checked 
                  }))}
                  className="rounded"
                />
                <span className="text-sm">{t('catalog.includeConfigurations')}</span>
              </label>

              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={exportOptions.separateFiles}
                  onChange={(e) => setExportOptions(prev => ({ 
                    ...prev, 
                    separateFiles: e.target.checked 
                  }))}
                  className="rounded"
                />
                <span className="text-sm">{t('catalog.exportSeparateFiles')}</span>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Processing Status */}
      {isProcessing && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">{t('catalog.exportingStacks')}</span>
          </div>
          <Progress value={processingProgress} className="w-full" />
        </div>
      )}

      <Alert>
        <Database className="h-4 w-4" />
        <AlertDescription>
          {t('catalog.stacksAvailableForExport', { count: getLocalStacks().length })}
          {' '}
          {exportOptions.separateFiles
            ? t('catalog.eachStackSeparateFile')
            : t('catalog.allStacksCombined')
          }
        </AlertDescription>
      </Alert>

      <Button 
        onClick={handleBulkExport}
        disabled={isProcessing || getLocalStacks().length === 0}
        className="w-full"
      >
        {isProcessing ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            {t('catalog.exporting')}
          </>
        ) : (
          <>
            <Download className="h-4 w-4 mr-2" />
            {t('catalog.exportAllStacks')}
          </>
        )}
      </Button>
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            <div className="flex items-center gap-2">
              {mode === 'import' ? (
                <>
                  <Upload className="h-5 w-5" />
                  {t('catalog.bulkImportStacks')}
                </>
              ) : (
                <>
                  <Download className="h-5 w-5" />
                  {t('catalog.bulkExportStacks')}
                </>
              )}
            </div>
          </DialogTitle>
          <DialogDescription>
            {mode === 'import'
              ? t('catalog.bulkImportDesc')
              : t('catalog.bulkExportDesc')
            }
          </DialogDescription>
        </DialogHeader>

        {mode === 'import' ? renderImportInterface() : renderExportInterface()}
      </DialogContent>
    </Dialog>
  );
};

export default BulkImportExportManager;