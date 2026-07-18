'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription,
  DialogFooter 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Copy, 
  Share2, 
  Globe, 
  Lock, 
  Eye,
  Users,
  Settings,
  CheckCircle,
  AlertCircle,
  ExternalLink
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { useStackBuilder } from '@/stores/stack-builder';
import { trpc } from '@/utils/trpc';
import type { StackService } from '@/types/stack';

interface ShareStackModalProps {
  isOpen: boolean;
  onClose: () => void;
  stackId?: string;
  initialStack?: {
    id: string;
    name: string;
    description: string;
    services: StackService[];
    isPublic?: boolean;
    shareUrl?: string;
  };
}

interface ShareSettings {
  isPublic: boolean;
  allowCloning: boolean;
  allowComments: boolean;
  shareDescription: string;
  tags: string[];
  category: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
}

const CATEGORIES = [
  'Web Development',
  'Mobile Development', 
  'Data Science',
  'DevOps',
  'Microservices',
  'E-commerce',
  'Content Management',
  'Analytics',
  'Monitoring',
  'Database',
  'Other'
];

const ShareStackModal: React.FC<ShareStackModalProps> = ({
  isOpen,
  onClose,
  stackId,
  initialStack
}) => {
  const { toast } = useToast();
  const stackBuilder = useStackBuilder();
  
  const [shareSettings, setShareSettings] = useState<ShareSettings>({
    isPublic: false,
    allowCloning: true,
    allowComments: true,
    shareDescription: '',
    tags: [],
    category: 'Web Development',
    difficulty: 'beginner'
  });
  
  const [newTag, setNewTag] = useState('');
  const [shareUrl, setShareUrl] = useState('');
  const [isGeneratingUrl, setIsGeneratingUrl] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Get current stack data
  const currentStack = initialStack || {
    id: stackId || 'current',
    name: stackBuilder.name || 'My Stack',
    description: stackBuilder.description || '',
    services: stackBuilder.services
  };

  // tRPC mutations
  // Real sharing flips the stack's public flag via the actual router (the old
  // `trpc.stack.shareStack` never existed, so this button was a silent no-op).
  const updateStackMutation = trpc.stacks.update.useMutation();

  // Initialize settings when modal opens
  useEffect(() => {
    if (isOpen && initialStack) {
      setShareSettings(prev => ({
        ...prev,
        isPublic: initialStack.isPublic || false,
        shareDescription: initialStack.description || ''
      }));
      setShareUrl(initialStack.shareUrl || '');
    }
  }, [isOpen, initialStack]);

  const handleSettingsChange = useCallback((key: keyof ShareSettings, value: any) => {
    setShareSettings(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  }, []);

  const handleAddTag = useCallback(() => {
    if (newTag.trim() && !shareSettings.tags.includes(newTag.trim())) {
      const updatedTags = [...shareSettings.tags, newTag.trim()];
      setShareSettings(prev => ({ ...prev, tags: updatedTags }));
      setNewTag('');
      setHasChanges(true);
    }
  }, [newTag, shareSettings.tags]);

  const handleRemoveTag = useCallback((tagToRemove: string) => {
    const updatedTags = shareSettings.tags.filter(tag => tag !== tagToRemove);
    setShareSettings(prev => ({ ...prev, tags: updatedTags }));
    setHasChanges(true);
  }, [shareSettings.tags]);

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
  }, [handleAddTag]);

  const generateShareUrl = useCallback(async () => {
    if (!shareSettings.isPublic) return;

    setIsGeneratingUrl(true);
    try {
      // Make the stack public for real, then build its /shared/<id> link.
      await updateStackMutation.mutateAsync({ id: String(currentStack.id), isPublic: true });
      setShareUrl(`${window.location.origin}/shared/${currentStack.id}`);
      toast({
        title: "Share URL ready",
        description: "Your stack is public — anyone with the link can view it.",
        variant: 'default',
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate share URL. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsGeneratingUrl(false);
    }
  }, [shareSettings.isPublic, currentStack.id, updateStackMutation, toast]);

  const copyShareUrl = useCallback(async () => {
    if (!shareUrl) return;
    
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast({
        title: "Copied!",
        description: "Share URL copied to clipboard.",
        variant: "default"
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy URL to clipboard.",
        variant: "destructive"
      });
    }
  }, [shareUrl, toast]);

  const handleShare = useCallback(async () => {
    try {
      // Flip the public flag on the real stack. A public stack is viewable at
      // /shared/<id> (stacks.getSharedStack); private has no share URL.
      await updateStackMutation.mutateAsync({
        id: String(currentStack.id),
        isPublic: shareSettings.isPublic,
      });

      const url = shareSettings.isPublic
        ? `${window.location.origin}/shared/${currentStack.id}`
        : '';
      setShareUrl(url);
      setHasChanges(false);

      toast({
        title: shareSettings.isPublic ? 'Stack is now public' : 'Stack set to private',
        description: shareSettings.isPublic
          ? 'Anyone with the link can view it.'
          : 'Only you can access this stack.',
        variant: 'default',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update sharing. Please try again.',
        variant: 'destructive',
      });
    }
  }, [currentStack.id, shareSettings.isPublic, updateStackMutation, toast]);

  const handleClose = useCallback(() => {
    if (hasChanges) {
      const confirmClose = window.confirm("You have unsaved changes. Are you sure you want to close?");
      if (!confirmClose) return;
    }
    
    setHasChanges(false);
    onClose();
  }, [hasChanges, onClose]);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            <div className="flex items-center gap-2">
              <Share2 className="h-5 w-5" />
              Share Stack: {currentStack.name}
            </div>
          </DialogTitle>
          <DialogDescription>
            Share your stack with the community or keep it private with selective access.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="settings" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Settings
            </TabsTrigger>
            <TabsTrigger value="preview" className="flex items-center gap-2">
              <Eye className="h-4 w-4" />
              Preview
            </TabsTrigger>
            <TabsTrigger value="share" className="flex items-center gap-2">
              <Share2 className="h-4 w-4" />
              Share
            </TabsTrigger>
          </TabsList>

          <TabsContent value="settings" className="space-y-6">
            {/* Visibility Settings */}
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Visibility Settings</h3>
              
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="flex items-center gap-2">
                    <Globe className="h-4 w-4" />
                    Make Public
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Anyone can view and clone your stack
                  </p>
                </div>
                <Switch
                  checked={shareSettings.isPublic}
                  onCheckedChange={(checked) => handleSettingsChange('isPublic', checked)}
                />
              </div>

              {shareSettings.isPublic && (
                <div className="space-y-4 pl-6 border-l-2 border-border">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label>Allow Cloning</Label>
                      <p className="text-sm text-muted-foreground">
                        Users can copy your stack to their account
                      </p>
                    </div>
                    <Switch
                      checked={shareSettings.allowCloning}
                      onCheckedChange={(checked) => handleSettingsChange('allowCloning', checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label>Allow Comments</Label>
                      <p className="text-sm text-muted-foreground">
                        Users can leave comments and feedback
                      </p>
                    </div>
                    <Switch
                      checked={shareSettings.allowComments}
                      onCheckedChange={(checked) => handleSettingsChange('allowComments', checked)}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Description and Metadata */}
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Stack Information</h3>
              
              <div className="space-y-2">
                <Label htmlFor="share-description">Description</Label>
                <Textarea
                  id="share-description"
                  placeholder="Describe your stack and what it's used for..."
                  value={shareSettings.shareDescription}
                  onChange={(e) => handleSettingsChange('shareDescription', e.target.value)}
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <select
                    id="category"
                    className="w-full px-3 py-2 border border-input rounded-md bg-background"
                    value={shareSettings.category}
                    onChange={(e) => handleSettingsChange('category', e.target.value)}
                  >
                    {CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="difficulty">Difficulty</Label>
                  <select
                    id="difficulty"
                    className="w-full px-3 py-2 border border-input rounded-md bg-background"
                    value={shareSettings.difficulty}
                    onChange={(e) => handleSettingsChange('difficulty', e.target.value as any)}
                  >
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                  </select>
                </div>
              </div>

              {/* Tags */}
              <div className="space-y-2">
                <Label>Tags</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Add tags (press Enter)"
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyPress={handleKeyPress}
                    className="flex-1"
                  />
                  <Button 
                    type="button" 
                    variant="outline"
                    onClick={handleAddTag}
                    disabled={!newTag.trim()}
                  >
                    Add
                  </Button>
                </div>
                
                {shareSettings.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {shareSettings.tags.map((tag) => (
                      <Badge 
                        key={tag} 
                        variant="secondary"
                        className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
                        onClick={() => handleRemoveTag(tag)}
                      >
                        {tag} ×
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="preview" className="space-y-4">
            <div className="border rounded-lg p-4 space-y-4">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <h3 className="font-semibold text-xl">{currentStack.name}</h3>
                  <p className="text-muted-foreground">
                    {shareSettings.shareDescription || currentStack.description || 'No description provided'}
                  </p>
                </div>
                <Badge variant={shareSettings.isPublic ? "default" : "secondary"}>
                  {shareSettings.isPublic ? <Globe className="h-3 w-3 mr-1" /> : <Lock className="h-3 w-3 mr-1" />}
                  {shareSettings.isPublic ? 'Public' : 'Private'}
                </Badge>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span>Category: {shareSettings.category}</span>
                  <span>Difficulty: {shareSettings.difficulty}</span>
                  <span>Services: {currentStack.services.length}</span>
                </div>
                
                {shareSettings.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {shareSettings.tags.map((tag) => (
                      <Badge key={tag} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <h4 className="font-medium">Services ({currentStack.services.length})</h4>
                <div className="grid grid-cols-2 gap-2">
                  {currentStack.services.map((stackService, idx) => (
                    <div key={stackService.id || idx} className="flex items-center gap-2 p-2 bg-muted rounded">
                      <span className="text-sm font-medium">{stackService.service?.name ?? 'Service'}</span>
                      {stackService.service?.category?.name && (
                        <span className="text-xs text-muted-foreground">({stackService.service.category.name})</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="share" className="space-y-4">
            {shareSettings.isPublic ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-success">
                  <CheckCircle className="h-5 w-5" />
                  <span className="font-medium">Stack will be publicly accessible</span>
                </div>

                {shareUrl ? (
                  <div className="space-y-2">
                    <Label>Share URL</Label>
                    <div className="flex gap-2">
                      <Input 
                        value={shareUrl} 
                        readOnly 
                        className="flex-1 font-mono text-sm"
                      />
                      <Button 
                        variant="outline" 
                        onClick={copyShareUrl}
                        className="flex items-center gap-2"
                      >
                        <Copy className="h-4 w-4" />
                        Copy
                      </Button>
                      <Button 
                        variant="outline"
                        onClick={() => window.open(shareUrl, '_blank')}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button 
                    onClick={generateShareUrl}
                    disabled={isGeneratingUrl}
                    className="w-full"
                  >
                    {isGeneratingUrl ? "Generating..." : "Generate Share URL"}
                  </Button>
                )}

                <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
                  <div className="text-center">
                    <Users className="h-6 w-6 mx-auto mb-1 text-muted-foreground" />
                    <p className="text-sm font-medium">Cloning</p>
                    <p className="text-xs text-muted-foreground">
                      {shareSettings.allowCloning ? 'Allowed' : 'Disabled'}
                    </p>
                  </div>
                  <div className="text-center">
                    <span className="h-6 w-6 mx-auto mb-1 text-muted-foreground block">💬</span>
                    <p className="text-sm font-medium">Comments</p>
                    <p className="text-xs text-muted-foreground">
                      {shareSettings.allowComments ? 'Allowed' : 'Disabled'}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <Lock className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="font-medium mb-2">Private Stack</h3>
                <p className="text-muted-foreground mb-4">
                  Only you can access this stack. Enable "Make Public" to share it with others.
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {hasChanges && (
              <>
                <AlertCircle className="h-4 w-4" />
                <span>You have unsaved changes</span>
              </>
            )}
          </div>
          
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              onClick={handleShare}
              disabled={updateStackMutation.isPending}
            >
              {updateStackMutation.isPending ? "Sharing..." : "Share Stack"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ShareStackModal;