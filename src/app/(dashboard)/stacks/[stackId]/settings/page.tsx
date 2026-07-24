'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { trpc } from '@/trpc/react-client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { 
  Settings, 
  Save, 
  Trash2, 
  AlertTriangle,
  Globe,
  Lock
} from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import { useT } from '@/lib/i18n/client'

export default function StackSettingsPage() {
  const t = useT()
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const stackId = params.stackId as string

  const { data: stack, isLoading, refetch } = trpc.stacks.get.useQuery(
    { id: stackId },
    { enabled: !!stackId }
  )

  const updateStack = trpc.stacks.update.useMutation({
    onSuccess: () => {
      toast({ title: t('ops.settingsUpdated') })
      refetch()
    },
    onError: (error) => {
      toast({ title: t('ops.updateFailed', { message: error.message }), variant: 'destructive' })
    },
  })

  const deleteStack = trpc.stacks.delete.useMutation({
    onSuccess: () => {
      toast({ title: t('ops.stackDeleted') })
      router.push('/stacks' as any)
    },
    onError: (error) => {
      toast({ title: t('ops.deleteFailed', { message: error.message }), variant: 'destructive' })
    },
  })

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isPublic, setIsPublic] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')

  // Seed the form once the stack data loads (and re-seed after a save refetch).
  useEffect(() => {
    if (stack) {
      setName(stack.name || '')
      setDescription(stack.description || '')
      setIsPublic(stack.isPublic || false)
    }
  }, [stack])

  const handleSave = () => {
    updateStack.mutate({
      id: stackId,
      name: name || undefined,
      description: description || undefined,
      isPublic,
    })
  }

  const handleDelete = () => {
    if (deleteConfirm !== stack?.name) {
      toast({ title: t('ops.typeNameToConfirm'), variant: 'destructive' })
      return
    }
    deleteStack.mutate({ id: stackId })
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64" />
        <Skeleton className="h-48" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">{t('common.settings')}</h2>
        <p className="text-muted-foreground">
          {t('ops.settingsSubtitle')}
        </p>
      </div>

      {/* General Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Settings className="h-5 w-5" />
            {t('ops.generalSettings')}
          </CardTitle>
          <CardDescription>
            {t('ops.generalSettingsDesc')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">{t('ops.stackName')}</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('ops.stackNamePlaceholder')}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">{t('common.description')}</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('ops.describeStackPlaceholder')}
              rows={3}
            />
          </div>
          <Button onClick={handleSave} disabled={updateStack.isPending}>
            <Save className="h-4 w-4 mr-2" />
            {updateStack.isPending ? t('ops.saving') : t('ops.saveChanges')}
          </Button>
        </CardContent>
      </Card>

      {/* Visibility Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            {isPublic ? <Globe className="h-5 w-5" /> : <Lock className="h-5 w-5" />}
            {t('ops.visibility')}
          </CardTitle>
          <CardDescription>
            {t('ops.visibilityDesc')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>{t('ops.publicStack')}</Label>
              <p className="text-sm text-muted-foreground">
                {isPublic
                  ? t('ops.publicStackOn')
                  : t('ops.publicStackOff')
                }
              </p>
            </div>
            <Switch
              checked={isPublic}
              onCheckedChange={(checked) => {
                setIsPublic(checked)
                updateStack.mutate({
                  id: stackId,
                  isPublic: checked,
                })
              }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            {t('ops.dangerZone')}
          </CardTitle>
          <CardDescription>
            {t('ops.dangerZoneDesc')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 rounded-lg border border-destructive/30 bg-destructive/5">
            <div>
              <p className="font-medium">{t('ops.deleteThisStack')}</p>
              <p className="text-sm text-muted-foreground">
                {t('ops.deleteThisStackDesc')}
              </p>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">
                  <Trash2 className="h-4 w-4 mr-2" />
                  {t('ops.deleteStack')}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t('ops.areYouSure')}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {t('ops.deleteConfirmBefore')} <strong>{stack?.name}</strong>{' '}
                    {t('ops.deleteConfirmAfter')}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="py-4">
                  <Label htmlFor="confirm">
                    {t('ops.typeToConfirmBefore')} <strong>{stack?.name}</strong> {t('ops.typeToConfirmAfter')}
                  </Label>
                  <Input
                    id="confirm"
                    value={deleteConfirm}
                    onChange={(e) => setDeleteConfirm(e.target.value)}
                    placeholder={stack?.name}
                    className="mt-2"
                  />
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel onClick={() => setDeleteConfirm('')}>
                    {t('common.cancel')}
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    disabled={deleteConfirm !== stack?.name || deleteStack.isPending}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {deleteStack.isPending ? t('ops.deleting') : t('ops.deleteStack')}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
