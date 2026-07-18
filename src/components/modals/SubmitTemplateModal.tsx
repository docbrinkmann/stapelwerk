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
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Upload, 
  FileText, 
  Tag, 
  Settings,
  CheckCircle,
  AlertTriangle,
  Info,
  Star,
  Users,
  Clock,
  Shield
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { useStackBuilder } from '@/stores/stack-builder';
import { trpc } from '@/utils/trpc';
import { SaveStackModal } from '@/components/SaveStackModal';
import type { StackService } from '@/types/stack';

interface SubmitTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  stackId?: string;
  initialStack?: {
    id: string;
    name: string;
    description: string;
    services: StackService[];
  };
}

interface TemplateSubmission {
  title: string;
  description: string;
  category: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  tags: string[];
  setupInstructions: string;
  requirements: string;
  useCases: string[];
  estimatedSetupTime: number; // in minutes
  authorNotes: string;
  isOriginalWork: boolean;
  allowCommercialUse: boolean;
  hasDocumentation: boolean;
  hasExampleData: boolean;
}

const TEMPLATE_CATEGORIES = [
  'Web Development',
  'Mobile Development',
  'Data Science & Analytics',
  'DevOps & CI/CD',
  'Microservices',
  'E-commerce',
  'Content Management',
  'Monitoring & Logging',
  'Database & Storage',
  'API Development',
  'Machine Learning',
  'Blockchain',
  'Gaming',
  'IoT',
  'Educational',
  'Other'
];

const SUGGESTED_USE_CASES = [
  'Development Environment',
  'Production Ready',
  'Learning & Education',
  'Proof of Concept',
  'Testing & QA',
  'Monitoring Setup',
  'Data Pipeline',
  'API Backend',
  'Frontend Development',
  'Full Stack Application',
  'Microservices Architecture',
  'Database Cluster',
  'Caching Layer',
  'Message Queue',
  'Analytics Platform'
];

const SubmitTemplateModal: React.FC<SubmitTemplateModalProps> = ({
  isOpen,
  onClose,
  stackId,
  initialStack
}) => {
  const { toast } = useToast();
  const stackBuilder = useStackBuilder();
  
  const [submission, setSubmission] = useState<TemplateSubmission>({
    title: '',
    description: '',
    category: 'Web Development',
    difficulty: 'beginner',
    tags: [],
    setupInstructions: '',
    requirements: '',
    useCases: [],
    estimatedSetupTime: 30,
    authorNotes: '',
    isOriginalWork: false,
    allowCommercialUse: true,
    hasDocumentation: false,
    hasExampleData: false
  });

  const [newTag, setNewTag] = useState('');
  const [newUseCase, setNewUseCase] = useState('');
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);

  // Get current stack data
  const currentStack = initialStack || {
    id: stackId || 'current',
    name: stackBuilder.name || 'My Stack',
    description: stackBuilder.description || '',
    services: stackBuilder.services
  };

  // Submission reuses the existing submit-for-approval flow: it flips a
  // persisted stack to status='pending_approval' so it appears in the admin
  // template-approval queue. The stack must be saved first (real DB id).
  const persistedStackId = stackId ?? initialStack?.id ?? stackBuilder.id;
  const submitForApprovalMutation = trpc.stacks.submitForApproval.useMutation();

  // Initialize submission data when modal opens. Depend on the stable primitive
  // values (not the currentStack object, which is a new reference every render)
  // so typing into title/description isn't reset on each keystroke.
  useEffect(() => {
    if (isOpen) {
      setSubmission(prev => ({
        ...prev,
        title: currentStack.name || '',
        description: currentStack.description || ''
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, currentStack.name, currentStack.description]);

  const handleInputChange = useCallback((key: keyof TemplateSubmission, value: any) => {
    setSubmission(prev => ({ ...prev, [key]: value }));
    // Clear validation errors when user starts fixing them
    if (validationErrors.length > 0) {
      setValidationErrors([]);
    }
  }, [validationErrors]);

  const handleAddTag = useCallback(() => {
    if (newTag.trim() && !submission.tags.includes(newTag.trim())) {
      const updatedTags = [...submission.tags, newTag.trim()];
      setSubmission(prev => ({ ...prev, tags: updatedTags }));
      setNewTag('');
    }
  }, [newTag, submission.tags]);

  const handleRemoveTag = useCallback((tagToRemove: string) => {
    const updatedTags = submission.tags.filter(tag => tag !== tagToRemove);
    setSubmission(prev => ({ ...prev, tags: updatedTags }));
  }, [submission.tags]);

  const handleAddUseCase = useCallback((useCase: string) => {
    if (!submission.useCases.includes(useCase)) {
      const updatedUseCases = [...submission.useCases, useCase];
      setSubmission(prev => ({ ...prev, useCases: updatedUseCases }));
    }
  }, [submission.useCases]);

  const handleRemoveUseCase = useCallback((useCaseToRemove: string) => {
    const updatedUseCases = submission.useCases.filter(useCase => useCase !== useCaseToRemove);
    setSubmission(prev => ({ ...prev, useCases: updatedUseCases }));
  }, [submission.useCases]);

  const handleAddCustomUseCase = useCallback(() => {
    if (newUseCase.trim() && !submission.useCases.includes(newUseCase.trim())) {
      handleAddUseCase(newUseCase.trim());
      setNewUseCase('');
    }
  }, [newUseCase, handleAddUseCase]);

  const validateSubmission = useCallback((): string[] => {
    const errors: string[] = [];

    if (!submission.title.trim()) {
      errors.push('Title is required');
    }
    if (!submission.description.trim()) {
      errors.push('Description is required');
    }
    if (submission.description.length < 100) {
      errors.push('Description should be at least 100 characters');
    }
    if (submission.tags.length === 0) {
      errors.push('At least one tag is required');
    }
    if (!submission.setupInstructions.trim()) {
      errors.push('Setup instructions are required');
    }
    if (!submission.requirements.trim()) {
      errors.push('Requirements are required');
    }
    if (submission.useCases.length === 0) {
      errors.push('At least one use case is required');
    }
    if (!submission.isOriginalWork) {
      errors.push('You must confirm this is your original work');
    }
    if (currentStack.services.length === 0) {
      errors.push('Stack must contain at least one service');
    }

    return errors;
  }, [submission, currentStack.services]);

  // Flip a persisted stack into the admin review queue.
  const doSubmit = useCallback(async (stackIdToSubmit: string) => {
    setIsSubmitting(true);
    try {
      await submitForApprovalMutation.mutateAsync({
        id: stackIdToSubmit,
        // Persist the template description the form made mandatory — the
        // marketplace card renders stack.description.
        description: submission.description,
      });

      toast({
        title: 'Submitted for review',
        description: "Your stack was submitted as a template proposal. You'll be notified once an admin reviews it.",
        variant: 'default'
      });

      onClose();
    } catch (error: any) {
      toast({
        title: 'Submission Failed',
        description: error?.message || 'Failed to submit template. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [submitForApprovalMutation, submission.description, toast, onClose]);

  const handleSubmit = useCallback(async () => {
    const errors = validateSubmission();
    if (errors.length > 0) {
      setValidationErrors(errors);
      toast({
        title: "Validation Error",
        description: `Please fix ${errors.length} error${errors.length > 1 ? 's' : ''} before submitting.`,
        variant: "destructive"
      });
      return;
    }

    // Submission needs a real DB stack id. If the builder stack isn't persisted
    // yet, save it first (reusing SaveStackModal), then submit on save success.
    if (persistedStackId) {
      await doSubmit(persistedStackId);
    } else {
      setShowSaveModal(true);
    }
  }, [validateSubmission, toast, persistedStackId, doSubmit]);

  const handleSavedThenSubmit = useCallback((saved: { id: string }) => {
    setShowSaveModal(false);
    if (saved?.id) {
      // Track the persisted id so a retry reuses it instead of re-saving.
      try { (useStackBuilder as any).setState?.({ id: saved.id }); } catch { /* noop */ }
      void doSubmit(saved.id);
    }
  }, [doSubmit]);

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return 'text-success bg-success/10';
      case 'intermediate': return 'text-warning bg-warning/10';
      case 'advanced': return 'text-destructive bg-destructive/10';
      default: return 'text-muted-foreground bg-muted';
    }
  };

  const getEstimatedTimeColor = (minutes: number) => {
    if (minutes <= 15) return 'text-success';
    if (minutes <= 60) return 'text-warning';
    return 'text-destructive';
  };

  return (
    <>
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            <div className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Submit Template: {currentStack.name}
            </div>
          </DialogTitle>
          <DialogDescription>
            Share your stack with the community by submitting it as a template. 
            All submissions are reviewed before being published.
          </DialogDescription>
        </DialogHeader>

        {validationErrors.length > 0 && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
            <div className="flex items-center gap-2 font-medium text-destructive mb-2">
              <AlertTriangle className="h-4 w-4" />
              Please fix the following errors:
            </div>
            <ul className="list-disc list-inside space-y-1 text-sm text-destructive">
              {validationErrors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </div>
        )}

        <Tabs defaultValue="basic" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="basic">Basic Info</TabsTrigger>
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="guidelines">Guidelines</TabsTrigger>
            <TabsTrigger value="preview">Preview</TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="title">Template Title *</Label>
                <Input
                  id="title"
                  placeholder="e.g., Full Stack MEAN Development Environment"
                  value={submission.title}
                  onChange={(e) => handleInputChange('title', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Category *</Label>
                <select
                  id="category"
                  className="w-full px-3 py-2 border border-input rounded-md bg-background"
                  value={submission.category}
                  onChange={(e) => handleInputChange('category', e.target.value)}
                >
                  {TEMPLATE_CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description * (min 100 characters)</Label>
              <Textarea
                id="description"
                placeholder="Provide a comprehensive description of what this stack does, its purpose, and key features..."
                value={submission.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                rows={4}
              />
              <p className="text-xs text-muted-foreground">
                {submission.description.length}/100 characters minimum
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Difficulty Level *</Label>
                <div className="space-y-2">
                  {(['beginner', 'intermediate', 'advanced'] as const).map((level) => (
                    <label key={level} className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="radio"
                        name="difficulty"
                        value={level}
                        checked={submission.difficulty === level}
                        onChange={(e) => handleInputChange('difficulty', e.target.value)}
                        className="w-4 h-4"
                      />
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getDifficultyColor(level)}`}>
                        {level.charAt(0).toUpperCase() + level.slice(1)}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="setup-time">Estimated Setup Time (minutes) *</Label>
                <Input
                  id="setup-time"
                  type="number"
                  min="5"
                  max="480"
                  value={submission.estimatedSetupTime}
                  onChange={(e) => handleInputChange('estimatedSetupTime', parseInt(e.target.value))}
                />
                <p className={`text-xs ${getEstimatedTimeColor(submission.estimatedSetupTime)}`}>
                  {submission.estimatedSetupTime <= 15 && 'Quick setup'}
                  {submission.estimatedSetupTime > 15 && submission.estimatedSetupTime <= 60 && '⏱️ Moderate setup'}
                  {submission.estimatedSetupTime > 60 && '🕐 Complex setup'}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Tags * (at least 1 required)</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Add tags (press Enter)"
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddTag();
                    }
                  }}
                  className="flex-1"
                />
                <Button 
                  type="button" 
                  variant="outline"
                  onClick={handleAddTag}
                  disabled={!newTag.trim()}
                >
                  <Tag className="h-4 w-4 mr-2" />
                  Add
                </Button>
              </div>
              
              {submission.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {submission.tags.map((tag) => (
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
          </TabsContent>

          <TabsContent value="details" className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="setup-instructions">Setup Instructions *</Label>
                <Textarea
                  id="setup-instructions"
                  placeholder="Provide step-by-step instructions for setting up and running this stack..."
                  value={submission.setupInstructions}
                  onChange={(e) => handleInputChange('setupInstructions', e.target.value)}
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="requirements">Requirements *</Label>
                <Textarea
                  id="requirements"
                  placeholder="List any prerequisites, minimum system requirements, or dependencies..."
                  value={submission.requirements}
                  onChange={(e) => handleInputChange('requirements', e.target.value)}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label>Use Cases * (select at least 1)</Label>
                <div className="grid grid-cols-3 gap-2 mb-2">
                  {SUGGESTED_USE_CASES.map((useCase) => (
                    <label key={useCase} className="flex items-center space-x-2 cursor-pointer p-2 rounded hover:bg-muted">
                      <Checkbox
                        checked={submission.useCases.includes(useCase)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            handleAddUseCase(useCase);
                          } else {
                            handleRemoveUseCase(useCase);
                          }
                        }}
                      />
                      <span className="text-sm">{useCase}</span>
                    </label>
                  ))}
                </div>

                <div className="flex gap-2">
                  <Input
                    placeholder="Add custom use case"
                    value={newUseCase}
                    onChange={(e) => setNewUseCase(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddCustomUseCase();
                      }
                    }}
                    className="flex-1"
                  />
                  <Button 
                    type="button" 
                    variant="outline"
                    onClick={handleAddCustomUseCase}
                    disabled={!newUseCase.trim()}
                  >
                    Add Custom
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="author-notes">Author Notes (optional)</Label>
                <Textarea
                  id="author-notes"
                  placeholder="Any additional notes, tips, or context you'd like to share with users..."
                  value={submission.authorNotes}
                  onChange={(e) => handleInputChange('authorNotes', e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="guidelines" className="space-y-6">
            <div className="space-y-4">
              <div className="bg-info/10 border border-info/30 rounded-lg p-4">
                <div className="flex items-center gap-2 font-medium text-info mb-2">
                  <Info className="h-4 w-4" />
                  Submission Guidelines
                </div>
                <ul className="space-y-2 text-sm text-info">
                  <li>• Templates must be fully functional and tested</li>
                  <li>• Include clear setup instructions and documentation</li>
                  <li>• Use appropriate service versions and configurations</li>
                  <li>• Ensure your template serves a clear purpose</li>
                  <li>• Follow naming conventions and best practices</li>
                  <li>• Templates undergo community review before publication</li>
                </ul>
              </div>

              <div className="space-y-4">
                <h3 className="font-semibold">Legal & Attribution</h3>
                
                <label className="flex items-start space-x-3 cursor-pointer">
                  <Checkbox
                    checked={submission.isOriginalWork}
                    onCheckedChange={(checked) => handleInputChange('isOriginalWork', checked)}
                  />
                  <div className="space-y-1">
                    <p className="text-sm font-medium">
                      I confirm this is my original work *
                    </p>
                    <p className="text-xs text-muted-foreground">
                      This template is created by me and doesn't infringe on any copyrights or licenses
                    </p>
                  </div>
                </label>

                <label className="flex items-start space-x-3 cursor-pointer">
                  <Checkbox
                    checked={submission.allowCommercialUse}
                    onCheckedChange={(checked) => handleInputChange('allowCommercialUse', checked)}
                  />
                  <div className="space-y-1">
                    <p className="text-sm font-medium">
                      Allow commercial use
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Users can use this template in commercial projects
                    </p>
                  </div>
                </label>

                <label className="flex items-start space-x-3 cursor-pointer">
                  <Checkbox
                    checked={submission.hasDocumentation}
                    onCheckedChange={(checked) => handleInputChange('hasDocumentation', checked)}
                  />
                  <div className="space-y-1">
                    <p className="text-sm font-medium">
                      Includes documentation
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Template includes README or other documentation files
                    </p>
                  </div>
                </label>

                <label className="flex items-start space-x-3 cursor-pointer">
                  <Checkbox
                    checked={submission.hasExampleData}
                    onCheckedChange={(checked) => handleInputChange('hasExampleData', checked)}
                  />
                  <div className="space-y-1">
                    <p className="text-sm font-medium">
                      Includes example data
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Template includes sample data or example configurations
                    </p>
                  </div>
                </label>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="preview" className="space-y-4">
            <div className="border rounded-lg p-6 space-y-4">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <h3 className="font-semibold text-xl">{submission.title || 'Template Title'}</h3>
                  <p className="text-muted-foreground">
                    {submission.description || 'Template description will appear here...'}
                  </p>
                </div>
                <Badge className={getDifficultyColor(submission.difficulty)}>
                  {submission.difficulty}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Tag className="h-4 w-4 text-muted-foreground" />
                  <span>Category: {submission.category}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span>Setup: ~{submission.estimatedSetupTime} minutes</span>
                </div>
                <div className="flex items-center gap-2">
                  <Settings className="h-4 w-4 text-muted-foreground" />
                  <span>Services: {currentStack.services.length}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span>Use Cases: {submission.useCases.length}</span>
                </div>
              </div>

              {submission.tags.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium text-sm">Tags</h4>
                  <div className="flex flex-wrap gap-1">
                    {submission.tags.map((tag) => (
                      <Badge key={tag} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {submission.useCases.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium text-sm">Use Cases</h4>
                  <div className="flex flex-wrap gap-1">
                    {submission.useCases.map((useCase) => (
                      <Badge key={useCase} variant="secondary" className="text-xs">
                        {useCase}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <h4 className="font-medium text-sm">Services ({currentStack.services.length})</h4>
                <div className="grid grid-cols-3 gap-2">
                  {currentStack.services.map((service, idx) => (
                    <div key={service.id || idx} className="flex items-center gap-2 p-2 bg-muted rounded">
                      <span className="text-xs font-medium">{service.service?.name ?? 'Service'}</span>
                      {service.service?.category?.name && (
                        <span className="text-xs text-muted-foreground">({service.service.category.name})</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t">
                <div className="flex items-center gap-4">
                  {submission.hasDocumentation && (
                    <Badge variant="outline" className="text-xs">
                      <FileText className="h-3 w-3 mr-1" />
                      Documentation
                    </Badge>
                  )}
                  {submission.hasExampleData && (
                    <Badge variant="outline" className="text-xs">
                      <Star className="h-3 w-3 mr-1" />
                      Examples
                    </Badge>
                  )}
                  {submission.allowCommercialUse && (
                    <Badge variant="outline" className="text-xs">
                      <Shield className="h-3 w-3 mr-1" />
                      Commercial OK
                    </Badge>
                  )}
                </div>
                
                <div className="text-xs text-muted-foreground">
                  Pending Review
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="flex items-center justify-between">
          <div className="text-xs text-muted-foreground">
            {currentStack.services.length} services • Submission will be reviewed within 24-48 hours
          </div>
          
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              // Keep clickable while invalid — handleSubmit surfaces the
              // validation errors; a silently disabled button explains nothing.
              onClick={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Submitting..." : "Submit Template"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Save-first: persist the builder stack before submitting for review. */}
    {showSaveModal && (
      <SaveStackModal
        isOpen={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        stackServices={stackBuilder.services}
        onSaved={handleSavedThenSubmit}
      />
    )}
    </>
  );
};

export default SubmitTemplateModal;