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
import type { Service } from '@/types/service';

interface ImportStackModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ImportStackModal({ isOpen, onClose }: ImportStackModalProps) {
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
            throw new Error(`Failed to fetch URL: ${response.statusText}`);
          }
          yamlContent = await response.text();
        } catch (fetchError) {
          throw new Error(
            fetchError instanceof Error
              ? `Failed to fetch docker-compose.yml from URL: ${fetchError.message}`
              : 'Failed to fetch docker-compose.yml from URL'
          );
        }
      }

      if (!yamlContent.trim()) {
        throw new Error('No docker-compose content provided');
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
      setError(err instanceof Error ? err.message : 'Failed to import stack');
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
          <DialogTitle>Import Stack</DialogTitle>
          <DialogDescription>
            Import a stack from a Docker Compose file, URL, or template.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="file" className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              Upload File
            </TabsTrigger>
            <TabsTrigger value="paste" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Paste Content
            </TabsTrigger>
            <TabsTrigger value="url" className="flex items-center gap-2">
              <Link className="h-4 w-4" />
              From URL
            </TabsTrigger>
          </TabsList>

          <TabsContent value="file" className="space-y-4">
            <div>
              <Label htmlFor="file-upload">Upload Docker Compose File</Label>
              <Input
                id="file-upload"
                type="file"
                accept=".yml,.yaml"
                onChange={handleFileUpload}
                className="mt-2"
              />
              <p className="text-sm text-muted-foreground mt-1">
                Select a docker-compose.yml or docker-compose.yaml file
              </p>
            </div>
            
            {dockerCompose && (
              <div>
                <Label>Preview</Label>
                <Textarea
                  value={dockerCompose}
                  onChange={(e) => setDockerCompose(e.target.value)}
                  rows={10}
                  className="mt-2 font-mono text-sm"
                  placeholder="Docker Compose content will appear here..."
                />
              </div>
            )}
          </TabsContent>

          <TabsContent value="paste" className="space-y-4">
            <div>
              <Label htmlFor="compose-content">Docker Compose Content</Label>
              <Textarea
                id="compose-content"
                value={dockerCompose}
                onChange={(e) => setDockerCompose(e.target.value)}
                rows={12}
                className="mt-2 font-mono text-sm"
                placeholder="Paste your docker-compose.yml content here..."
              />
              <p className="text-sm text-muted-foreground mt-1">
                Copy and paste the contents of your docker-compose.yml file
              </p>
            </div>
          </TabsContent>

          <TabsContent value="url" className="space-y-4">
            <div>
              <Label htmlFor="stack-url">Stack URL</Label>
              <Input
                id="stack-url"
                type="url"
                value={stackUrl}
                onChange={(e) => setStackUrl(e.target.value)}
                placeholder="https://example.com/docker-compose.yml"
                className="mt-2"
              />
              <p className="text-sm text-muted-foreground mt-1">
                Enter a URL pointing to a docker-compose.yml file
              </p>
            </div>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Make sure the URL is publicly accessible and points directly to a valid Docker Compose file.
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
                  Import completed: {importSuccess.matched} of {importSuccess.total} services matched
                </p>
                {importSuccess.unmatched.length > 0 && (
                  <div className="text-sm">
                    <p className="font-medium mb-1">Unmatched services:</p>
                    <ul className="list-disc list-inside space-y-1">
                      {importSuccess.unmatched.map((service, idx) => (
                        <li key={idx} className="text-muted-foreground">{service}</li>
                      ))}
                    </ul>
                    <p className="mt-2 text-muted-foreground">
                      These services are not available in our catalog. They were skipped.
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
            Cancel
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
            {isImporting ? 'Importing...' : 'Import Stack'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}