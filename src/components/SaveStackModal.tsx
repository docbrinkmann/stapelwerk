import React, { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Loader2, Save } from 'lucide-react'
import { trpc } from '@/trpc/react-client'
import { stackConfigToApiShape } from '@/lib/stack-persistence'
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
  const [stackName, setStackName] = useState('')
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
    if (!stackName.trim()) return

    setIsSaving(true)
    
    try {
      await createStackMutation.mutateAsync({
        name: stackName.trim(),
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
          <DialogTitle>Save Your Stack</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Stack Name */}
          <div className="space-y-2">
            <Label htmlFor="stack-name">Stack Name *</Label>
            <Input
              id="stack-name"
              placeholder="My Development Stack"
              value={stackName}
              onChange={(e) => setStackName(e.target.value)}
              disabled={isSaving}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Describe what this stack is for..."
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
              Make this stack public (visible to other users)
            </Label>
          </div>

          {/* Stack Summary */}
          <div className="bg-muted rounded-lg p-3">
            <p className="text-sm font-medium text-foreground mb-2">
              Stack Summary
            </p>
            <p className="text-sm text-muted-foreground">
              {stackServices.length} service{stackServices.length !== 1 ? 's' : ''}:
            </p>
            <ul className="text-sm text-muted-foreground mt-1">
              {stackServices.map((stackService) => (
                <li key={stackService.id} className="flex items-center">
                  • {stackService.service?.name ?? 'Service'}
                </li>
              ))}
            </ul>
          </div>

          {/* Error Display */}
          {createStackMutation.error && (
            <div className="text-sm text-destructive bg-destructive/10 p-2 rounded">
              Failed to save stack: {createStackMutation.error.message}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!stackName.trim() || isSaving}
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Stack
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}