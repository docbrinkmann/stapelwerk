'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { trpc } from '@/trpc/react-client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { 
  Plus, 
  Eye, 
  EyeOff, 
  Pencil, 
  Trash2,
  Key,
  Copy,
  Check
} from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import { useT } from '@/lib/i18n/client'

interface EnvVar {
  key: string
  value: string
  isSecret: boolean
}

function EnvVarRow({ 
  envVar, 
  onEdit, 
  onDelete 
}: { 
  envVar: EnvVar
  onEdit: (envVar: EnvVar) => void
  onDelete: (key: string) => void
}) {
  const t = useT()
  const [showValue, setShowValue] = useState(false)
  const [copied, setCopied] = useState(false)

  const { toast } = useToast()

  const handleCopy = async () => {
    await navigator.clipboard.writeText(envVar.value)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    toast({ title: t('ops.copiedToClipboard') })
  }

  const displayValue = showValue 
    ? envVar.value 
    : envVar.isSecret 
      ? '••••••••••••' 
      : envVar.value

  return (
    <TableRow>
      <TableCell className="font-mono text-sm">{envVar.key}</TableCell>
      <TableCell className="font-mono text-sm max-w-xs truncate">
        {displayValue}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          {envVar.isSecret && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setShowValue(!showValue)}
              aria-label={showValue ? t('ops.hideValue') : t('ops.showValue')}
            >
              {showValue ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleCopy}
            aria-label={t('ops.copyValue')}
          >
            {copied ? (
              <Check className="h-4 w-4 text-success" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onEdit(envVar)}
            aria-label={t('ops.editVariable')}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive"
            onClick={() => onDelete(envVar.key)}
            aria-label={t('ops.deleteVariable')}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  )
}

function AddEnvVarDialog({ 
  open, 
  onOpenChange,
  onAdd,
  editingVar
}: { 
  open: boolean
  onOpenChange: (open: boolean) => void
  onAdd: (envVar: EnvVar) => void
  editingVar: EnvVar | null
}) {
  const t = useT()
  const [key, setKey] = useState(editingVar?.key || '')
  const [value, setValue] = useState(editingVar?.value || '')
  const [isSecret, setIsSecret] = useState(editingVar?.isSecret || false)

  const { toast } = useToast()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!key.trim()) {
      toast({ title: t('ops.keyRequired'), variant: 'destructive' })
      return
    }
    onAdd({ key: key.trim(), value, isSecret })
    setKey('')
    setValue('')
    setIsSecret(false)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {editingVar ? t('ops.editEnvVar') : t('ops.addEnvVar')}
          </DialogTitle>
          <DialogDescription>
            {t('ops.envVarDialogDesc')}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="key">{t('ops.keyLabel')}</Label>
              <Input
                id="key"
                placeholder="VARIABLE_NAME"
                value={key}
                onChange={(e) => setKey(e.target.value.toUpperCase())}
                className="font-mono"
                disabled={!!editingVar}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="value">{t('ops.valueLabel')}</Label>
              <Input
                id="value"
                placeholder={t('ops.valuePlaceholder')}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                type={isSecret ? 'password' : 'text'}
                className="font-mono"
              />
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="isSecret"
                checked={isSecret}
                onChange={(e) => setIsSecret(e.target.checked)}
                className="h-4 w-4 rounded border-border"
              />
              <Label htmlFor="isSecret" className="text-sm">
                {t('ops.markAsSecret')}
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit">
              {editingVar ? t('ops.saveChanges') : t('ops.addVariable')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default function StackEnvPage() {
  const t = useT()
  const params = useParams()
  const stackId = params.stackId as string
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingVar, setEditingVar] = useState<EnvVar | null>(null)
  const { toast } = useToast()

  const utils = trpc.useUtils()
  const envQuery = trpc.stacks.getEnvVars.useQuery(
    { stackId },
    { enabled: !!stackId }
  )
  const envVars = envQuery.data ?? []

  const setEnv = trpc.stacks.setEnvVars.useMutation({
    onSuccess: () => { void utils.stacks.getEnvVars.invalidate({ stackId }) },
    onError: (e) => toast({ title: t('ops.saveFailed'), description: e.message, variant: 'destructive' }),
  })
  // Every change persists the full list — the query is the source of truth.
  const persist = (next: EnvVar[]) => setEnv.mutate({ stackId, envVars: next })

  const handleAdd = (envVar: EnvVar) => {
    if (editingVar) {
      persist(envVars.map(v => v.key === editingVar.key ? envVar : v))
      toast({ title: t('ops.envVarUpdated') })
    } else {
      if (envVars.some(v => v.key === envVar.key)) {
        toast({ title: t('ops.envVarExists'), variant: 'destructive' })
        return
      }
      persist([...envVars, envVar])
      toast({ title: t('ops.envVarAdded') })
    }
    setEditingVar(null)
  }

  const handleEdit = (envVar: EnvVar) => {
    setEditingVar(envVar)
    setDialogOpen(true)
  }

  const handleDelete = (key: string) => {
    persist(envVars.filter(v => v.key !== key))
    toast({ title: t('ops.envVarDeleted') })
  }

  if (envQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">{t('ops.envTitle')}</h2>
          <p className="text-muted-foreground">
            {t('ops.envSubtitle')}
          </p>
        </div>
        <Button onClick={() => { setEditingVar(null); setDialogOpen(true) }}>
          <Plus className="h-4 w-4 mr-2" />
          {t('ops.addVariable')}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Key className="h-5 w-5" />
            {t('ops.variablesCount', { count: envVars.length })}
          </CardTitle>
          <CardDescription>
            {t('ops.variablesCardDesc')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {envVars.length === 0 ? (
            <div className="text-center py-8">
              <Key className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold">{t('ops.noEnvVars')}</h3>
              <p className="text-muted-foreground mt-2">
                {t('ops.noEnvVarsHint')}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('ops.keyLabel')}</TableHead>
                  <TableHead>{t('ops.valueLabel')}</TableHead>
                  <TableHead className="w-[150px]">{t('ops.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {envVars.map((envVar) => (
                  <EnvVarRow
                    key={envVar.key}
                    envVar={envVar}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                  />
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AddEnvVarDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onAdd={handleAdd}
        editingVar={editingVar}
      />
    </div>
  )
}
