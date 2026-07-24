import React, { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Loader2, Save } from 'lucide-react'
import { useT } from '@/lib/i18n/client'
import { trpc } from '@/trpc/react-client'
import { stackConfigToApiShape } from '@/lib/stack-persistence'
import { useStackBuilderStore } from '@/stores/stack-builder'
import type { StackService } from '@/types/stack'

interface SaveStackModalProps {
  isOpen: boolean
  onClose: () => void
  stackServices: StackService[]
  /** Called with the persisted stack after a successful save (e.g. to chain a submit-for-review flow). */
  onSaved?: (stack: { id: string; name: string }) => void
}

export const SaveStackModal: React.FC<SaveStackModalProps> = ({
  isOpen,
  onClose,
  stackServices,
  onSaved,
}) => {
  const t = useT()
  // Prefill from the builder draft's current name so re-opening shows it, and
  // write the chosen name back on save (the "Stack name is required" check reads
  // the store name — without this it never clears after saving).
  const storeName = useStackBuilderStore(s => s.name)
  const updateName = useStackBuilderStore(s => s.updateName)
  const [stackName, setStackName] = useState(storeName ?? '')
  const [description, setDescription] = useState('')
  const [isPublic, setIsPublic] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

const createStackMutation = trpc.stacks.create.useMutation({
    onSuccess: (stack: any) => {
      if (stack?.id) onSaved?.({ id: stack.id, name: stack.name })
      onClose()
      setStackName('')
      setDescription('')
      setIsPublic(false)
    },
    onError: (error: any) => {
      console.error('Failed to save stack:', error)
    },
  })

  const handleSave = async () => {
    const name = stackName.trim()
    if (!name) return

    setIsSaving(true)

    try {
      await createStackMutation.mutateAsync({
        name,
        description: description.trim(),
        isPublic,
        services: stackServices.map((service, index) => ({
          serviceId: service.serviceId ?? service.service?.id,
          // Store orders are 0-based; the API schema requires a positive order
          order: index + 1,
          // Builder config is the ARRAY shape; the API schema is RECORD.
          configuration: stackConfigToApiShape(service.configuration),
        })),
      })
      // Name the builder draft too, so the "Stack name is required" check clears.
      updateName(name)
    } catch (error) {
      console.error('Error saving stack:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleClose = () => {
    if (!isSaving) {
      onClose()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md" data-testid="save-stack-modal">
        <DialogHeader>
          <DialogTitle>{t('deploy.save.title')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Stack Name */}
          <div className="space-y-2">
            <Label htmlFor="stack-name">{t('deploy.save.nameLabel')}</Label>
            <Input
              id="stack-name"
              placeholder={t('deploy.save.namePlaceholder')}
              value={stackName}
              onChange={(e) => setStackName(e.target.value)}
              disabled={isSaving}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">{t('common.description')}</Label>
            <Textarea
              id="description"
              placeholder={t('deploy.save.descriptionPlaceholder')}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isSaving}
              rows={3}
            />
          </div>

          {/* Public/Private Toggle */}
          <div className="flex items-center space-x-2">
            <Switch
              id="is-public"
              checked={isPublic}
              onCheckedChange={setIsPublic}
              disabled={isSaving}
            />
            <Label htmlFor="is-public" className="text-sm">
              {t('deploy.save.publicLabel')}
            </Label>
          </div>

          {/* Stack Summary */}
          <div className="bg-muted rounded-lg p-3">
            <p className="text-sm font-medium text-foreground mb-2">
              {t('deploy.save.summary')}
            </p>
            <p className="text-sm text-muted-foreground">
              {t(
                stackServices.length === 1
                  ? 'deploy.save.serviceCountOne'
                  : 'deploy.save.serviceCountOther',
                { count: stackServices.length },
              )}
            </p>
            <ul className="text-sm text-muted-foreground mt-1">
              {stackServices.map((stackService) => (
                <li key={stackService.id} className="flex items-center">
                  • {stackService.service?.name ?? t('deploy.save.serviceFallback')}
                </li>
              ))}
            </ul>
          </div>

          {/* Error Display */}
          {createStackMutation.error && (
            <div className="text-sm text-destructive bg-destructive/10 p-2 rounded">
              {t('deploy.save.error', { message: createStackMutation.error.message })}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isSaving}
          >
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleSave}
            disabled={!stackName.trim() || isSaving}
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {t('deploy.save.saving')}
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                {t('deploy.save.submit')}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}