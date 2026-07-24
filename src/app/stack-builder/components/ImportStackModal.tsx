'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, FileText, Link, AlertCircle, CheckCircle } from 'lucide-react';
import { stackPersistence } from '@/lib/stack-persistence';
import { trpc } from '@/utils/trpc';
import { useStackServices } from '@/stores/stack-builder';
import { useT } from '@/lib/i18n/client';
import type { Service } from '@/types/service';

interface ImportStackModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ImportStackModal({ isOpen, onClose }: ImportStackModalProps) {
  const t = useT();
  const [activeTab, setActiveTab] = useState('file');
  const [dockerCompose, setDockerCompose] = useState('');
  const [stackUrl, setStackUrl] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<{ total: number; matched: number; unmatched: string[] } | null>(null);

  const { addService } = useStackServices();
  const servicesQuery = trpc.services.list.useQuery({ limit: 1000 }); // Load all services for matching

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        setDockerCompose(content);
      };
      reader.readAsText(file);
    }
  };

  const handleImport = async () => {
    setIsImporting(true);
    setError(null);
    setImportSuccess(null);

    try {
      let yamlContent = dockerCompose;

      // If using URL tab, fetch the docker-compose file
      if (activeTab === 'url' && stackUrl.trim()) {
        try {
          const response = await fetch(stackUrl);
          if (!response.ok) {
            throw new Error(t('builder.importFetchUrlFailed', { status: response.statusText }));
          }
          yamlContent = await response.text();
        } catch (fetchError) {
          throw new Error(
            fetchError instanceof Error
              ? t('builder.importFetchComposeFailedDetail', { message: fetchError.message })
              : t('builder.importFetchComposeFailed')
          );
        }
      }

      if (!yamlContent.trim()) {
        throw new Error(t('builder.importNoContent'));
      }

      // Parse the docker-compose YAML
      const parsed = stackPersistence.importFromDockerCompose(yamlContent);

      // Match parsed services with services in our database
      const availableServices = servicesQuery.data?.services || [];
      const matched: Service[] = [];
      const unmatched: string[] = [];

      parsed.parsedServices.forEach(parsedService => {
        // Try to find matching service by docker image name
        const matchingService = availableServices.find(
          s => s.dockerImage.toLowerCase() === parsedService.image.toLowerCase()
        );

        if (matchingService) {
          matched.push(matchingService);
        } else {
          unmatched.push(`${parsedService.image}:${parsedService.tag}`);
        }
      });

      // Add matched services to the stack builder
      matched.forEach(service => {
        addService(service);
      });

      // Show success message with statistics
      setImportSuccess({
        total: parsed.parsedServices.length,
        matched: matched.length,
        unmatched
      });

      // If all services matched, close the modal after a short delay
      if (unmatched.length === 0) {
        setTimeout(() => {
          handleClose();
        }, 2000);
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : t('builder.importFailed'));
    } finally {
      setIsImporting(false);
    }
  };

  const handleClose = () => {
    if (!isImporting) {
      setDockerCompose('');
      setStackUrl('');
      setError(null);
      setImportSuccess(null);
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('builder.importStack')}</DialogTitle>
          <DialogDescription>
            {t('builder.importSubtitle')}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="file" className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              {t('builder.importTabFile')}
            </TabsTrigger>
            <TabsTrigger value="paste" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              {t('builder.importTabPaste')}
            </TabsTrigger>
            <TabsTrigger value="url" className="flex items-center gap-2">
              <Link className="h-4 w-4" />
              {t('builder.importTabUrl')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="file" className="space-y-4">
            <div>
              <Label htmlFor="file-upload">{t('builder.importUploadLabel')}</Label>
              <Input
                id="file-upload"
                type="file"
                accept=".yml,.yaml"
                onChange={handleFileUpload}
                className="mt-2"
              />
              <p className="text-sm text-muted-foreground mt-1">
                {t('builder.importUploadHint')}
              </p>
            </div>
            
            {dockerCompose && (
              <div>
                <Label>{t('builder.preview')}</Label>
                <Textarea
                  value={dockerCompose}
                  onChange={(e) => setDockerCompose(e.target.value)}
                  rows={10}
                  className="mt-2 font-mono text-sm"
                  placeholder={t('builder.importFilePlaceholder')}
                />
              </div>
            )}
          </TabsContent>

          <TabsContent value="paste" className="space-y-4">
            <div>
              <Label htmlFor="compose-content">{t('builder.importPasteLabel')}</Label>
              <Textarea
                id="compose-content"
                value={dockerCompose}
                onChange={(e) => setDockerCompose(e.target.value)}
                rows={12}
                className="mt-2 font-mono text-sm"
                placeholder={t('builder.importPastePlaceholder')}
              />
              <p className="text-sm text-muted-foreground mt-1">
                {t('builder.importPasteHint')}
              </p>
            </div>
          </TabsContent>

          <TabsContent value="url" className="space-y-4">
            <div>
              <Label htmlFor="stack-url">{t('builder.importUrlLabel')}</Label>
              <Input
                id="stack-url"
                type="url"
                value={stackUrl}
                onChange={(e) => setStackUrl(e.target.value)}
                placeholder="https://example.com/docker-compose.yml"
                className="mt-2"
              />
              <p className="text-sm text-muted-foreground mt-1">
                {t('builder.importUrlHint')}
              </p>
            </div>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {t('builder.importUrlNote')}
              </AlertDescription>
            </Alert>
          </TabsContent>
        </Tabs>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {importSuccess && (
          <Alert className={importSuccess.unmatched.length > 0 ? 'border-warning/30 bg-warning/10' : ''}>
            <CheckCircle className="h-4 w-4 text-success" />
            <AlertDescription>
              <div className="space-y-2">
                <p className="font-medium">
                  {t('builder.importCompleted', { matched: importSuccess.matched, total: importSuccess.total })}
                </p>
                {importSuccess.unmatched.length > 0 && (
                  <div className="text-sm">
                    <p className="font-medium mb-1">{t('builder.importUnmatched')}</p>
                    <ul className="list-disc list-inside space-y-1">
                      {importSuccess.unmatched.map((service, idx) => (
                        <li key={idx} className="text-muted-foreground">{service}</li>
                      ))}
                    </ul>
                    <p className="mt-2 text-muted-foreground">
                      {t('builder.importSkipped')}
                    </p>
                  </div>
                )}
              </div>
            </AlertDescription>
          </Alert>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isImporting}
          >
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleImport}
            disabled={
              isImporting ||
              (activeTab === 'paste' && !dockerCompose.trim()) ||
              (activeTab === 'url' && !stackUrl.trim()) ||
              (activeTab === 'file' && !dockerCompose.trim())
            }
          >
            {isImporting ? t('builder.importing') : t('builder.importStack')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}