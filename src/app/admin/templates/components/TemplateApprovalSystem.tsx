'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/components/ui/use-toast';
import { trpc } from '@/utils/trpc';
import { useT } from '@/lib/i18n/client';
import {
  CheckCircle2,
  XCircle,
  Clock,
  Eye,
  MessageCircle,
  User,
  Calendar,
  Tag,
  FileText,
  AlertTriangle,
  Layers3,
  Server,
  Search,
  Filter,
  BarChart3
} from 'lucide-react';

interface PendingTemplate {
  id: string;
  title: string;
  description: string;
  category: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  tags: string[];
  author: {
    id: string;
    name: string;
    email: string;
  };
  services: any[];
  setupInstructions: string;
  requirements: string;
  useCases: string[];
  submittedAt: Date;
  status: 'pending' | 'reviewing' | 'approved' | 'rejected';
  reviewNotes?: string;
}

interface ApprovalStats {
  totalPending: number;
  totalApproved: number;
  totalRejected: number;
}

interface TemplateApprovalSystemProps {
  initialTemplates: { templates: PendingTemplate[]; total: number };
  initialStats: ApprovalStats;
}

const TemplateApprovalSystem: React.FC<TemplateApprovalSystemProps> = ({
  initialTemplates,
  initialStats
}) => {
  const t = useT();
  const router = useRouter();
  const { toast } = useToast();
  
  const [templates, setTemplates] = useState(initialTemplates.templates);
  const [stats, setStats] = useState(initialStats);
  const [selectedTemplate, setSelectedTemplate] = useState<PendingTemplate | null>(null);
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject' | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'reviewing'>('pending');

  // tRPC mutation: approve/reject the submitted stack (community template proposal)
  const reviewTemplateMutation = trpc.admin.reviewTemplate.useMutation();

  const filteredTemplates = templates.filter(template => {
    const matchesSearch = template.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         template.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         template.author.name.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || template.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const handleReviewTemplate = (template: PendingTemplate, action: 'approve' | 'reject') => {
    setSelectedTemplate(template);
    setReviewAction(action);
    setReviewNotes('');
    setShowReviewDialog(true);
  };

  const handleSubmitReview = async () => {
    if (!selectedTemplate || !reviewAction) return;

    try {
      const isActive = reviewAction === 'approve';
      await reviewTemplateMutation.mutateAsync({
        stackId: selectedTemplate.id,
        action: reviewAction,
        reviewNotes: reviewNotes.trim() || undefined,
      });

      toast({
        title: isActive ? t('catalog.templateApprovedTitle') : t('catalog.templateRejectedTitle'),
        description: isActive
          ? t('catalog.templateApprovedDesc')
          : t('catalog.templateRejectedDesc'),
        variant: 'default'
      });

      // Update local state
      setTemplates(prev => prev.filter(t => t.id !== selectedTemplate.id));
      setStats(prev => ({
        ...prev,
        totalPending: prev.totalPending - 1,
        totalApproved: reviewAction === 'approve' ? prev.totalApproved + 1 : prev.totalApproved,
        totalRejected: reviewAction === 'reject' ? prev.totalRejected + 1 : prev.totalRejected
      }));
      
      setShowReviewDialog(false);
    } catch (error) {
      toast({
        title: t('common.error'),
        description: t('catalog.templateReviewFailedDesc'),
        variant: 'destructive'
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-warning/10 text-warning border-warning/30';
      case 'reviewing': return 'bg-info/10 text-info border-info/30';
      case 'approved': return 'bg-success/10 text-success border-success/30';
      case 'rejected': return 'bg-destructive/10 text-destructive border-destructive/30';
      default: return 'bg-muted text-foreground border-border';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="h-4 w-4" />;
      case 'reviewing': return <Eye className="h-4 w-4" />;
      case 'approved': return <CheckCircle2 className="h-4 w-4" />;
      case 'rejected': return <XCircle className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
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
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('catalog.pendingReview')}</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">{stats.totalPending}</div>
            <p className="text-xs text-muted-foreground">{t('catalog.templatesAwaitingReview')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('catalog.approvedLabel')}</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">{stats.totalApproved}</div>
            <p className="text-xs text-muted-foreground">{t('catalog.publishedTemplates')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('catalog.rejectedLabel')}</CardTitle>
            <XCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{stats.totalRejected}</div>
            <p className="text-xs text-muted-foreground">{t('catalog.rejectedSubmissions')}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardHeader>
          <CardTitle>{t('catalog.templateQueue')}</CardTitle>
          <CardDescription>{t('catalog.templateQueueDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-6">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t('catalog.searchTemplatesPlaceholder')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-3 py-2 border border-input rounded-md bg-background"
            >
              <option value="all">{t('catalog.allStatus')}</option>
              <option value="pending">{t('catalog.statusPending')}</option>
              <option value="reviewing">{t('catalog.statusReviewing')}</option>
            </select>
          </div>

          <div className="space-y-4">
            {filteredTemplates.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-medium text-foreground mb-2">{t('catalog.noTemplatesFound')}</h3>
                <p className="text-muted-foreground">
                  {searchQuery ? t('catalog.noTemplatesMatch', { query: searchQuery }) : t('catalog.noPendingTemplates')}
                </p>
              </div>
            ) : (
              filteredTemplates.map((template) => (
                <Card key={template.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-xl font-semibold">{template.title}</h3>
                          <Badge className={getStatusColor(template.status)}>
                            {getStatusIcon(template.status)}
                            <span className="ml-1 capitalize">{template.status}</span>
                          </Badge>
                          <Badge className={getDifficultyColor(template.difficulty)}>
                            {template.difficulty}
                          </Badge>
                        </div>
                        
                        <p className="text-muted-foreground mb-3">{template.description}</p>

                        <div className="flex items-center gap-6 text-sm text-muted-foreground mb-4">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4" />
                            <span>{template.author.name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4" />
                            <span>{t('catalog.submittedOn', { date: formatDate(template.submittedAt) })}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Tag className="h-4 w-4" />
                            <span>{template.category}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Layers3 className="h-4 w-4" />
                            <span>{t('catalog.servicesCount', { count: template.services.length })}</span>
                          </div>
                        </div>

                        {template.tags.length > 0 && (
                          <div className="flex flex-wrap gap-2 mb-4">
                            {template.tags.map((tag) => (
                              <Badge key={tag} variant="secondary" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2 ml-4">
                        {template.status === 'pending' && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleReviewTemplate(template, 'reject')}
                            >
                              <XCircle className="h-4 w-4 mr-1" />
                              {t('catalog.reject')}
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handleReviewTemplate(template, 'approve')}
                            >
                              <CheckCircle2 className="h-4 w-4 mr-1" />
                              {t('catalog.approve')}
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Review Dialog */}
      <Dialog open={showReviewDialog} onOpenChange={setShowReviewDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {reviewAction === 'approve' ? t('catalog.approveTemplate') : t('catalog.rejectTemplate')}
            </DialogTitle>
            <DialogDescription>
              {selectedTemplate?.title}
            </DialogDescription>
          </DialogHeader>

          {selectedTemplate && (
            <div className="space-y-6">
              {/* Template Details */}
              <div className="border rounded-lg p-4">
                <h4 className="font-medium mb-3">{t('catalog.templateOverview')}</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">{t('catalog.authorColon')}</span> {selectedTemplate.author.name}
                  </div>
                  <div>
                    <span className="font-medium">{t('catalog.categoryColon')}</span> {selectedTemplate.category}
                  </div>
                  <div>
                    <span className="font-medium">{t('catalog.difficultyColon')}</span> {selectedTemplate.difficulty}
                  </div>
                  <div>
                    <span className="font-medium">{t('catalog.servicesColon')}</span> {selectedTemplate.services.length}
                  </div>
                </div>
                
                <div className="mt-4">
                  <p className="text-sm">{selectedTemplate.description}</p>
                </div>
              </div>

              {/* Services Preview */}
              <div className="border rounded-lg p-4">
                <h4 className="font-medium mb-3">{t('catalog.servicesHeadingCount', { count: selectedTemplate.services.length })}</h4>
                <div className="grid grid-cols-2 gap-2">
                  {selectedTemplate.services.slice(0, 8).map((service, index) => (
                    <div key={index} className="flex items-center gap-2 p-2 bg-muted rounded text-sm">
                      <Server className="h-4 w-4 text-muted-foreground" />
                      <span>{service.name}</span>
                    </div>
                  ))}
                  {selectedTemplate.services.length > 8 && (
                    <div className="col-span-2 text-center text-sm text-muted-foreground py-2">
                      {t('catalog.moreServicesCount', { count: selectedTemplate.services.length - 8 })}
                    </div>
                  )}
                </div>
              </div>

              {/* Review Notes */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  {t('catalog.reviewNotes')} {reviewAction === 'reject' && <span className="text-destructive">*</span>}
                </label>
                <Textarea
                  placeholder={
                    reviewAction === 'approve'
                      ? t('catalog.reviewNotesOptionalPlaceholder')
                      : t('catalog.reviewNotesRejectPlaceholder')
                  }
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  rows={4}
                />
              </div>

              {reviewAction === 'reject' && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    {t('catalog.rejectAlert')}
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setShowReviewDialog(false)}>
                  {t('common.cancel')}
                </Button>
                <Button
                  onClick={handleSubmitReview}
                  disabled={
                    (reviewAction === 'reject' && !reviewNotes.trim()) ||
reviewTemplateMutation.isPending
                  }
                  variant={reviewAction === 'approve' ? 'default' : 'destructive'}
                >
{reviewTemplateMutation.isPending
                    ? t('catalog.processing')
                    : reviewAction === 'approve'
                    ? t('catalog.approveTemplate')
                    : t('catalog.rejectTemplate')
                  }
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TemplateApprovalSystem;