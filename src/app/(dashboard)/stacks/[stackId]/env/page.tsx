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
  const [showValue, setShowValue] = useState(false)
  const [copied, setCopied] = useState(false)

  const { toast } = useToast()
  
  const handleCopy = async () => {
    await navigator.clipboard.writeText(envVar.value)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    toast({ title: 'Copied to clipboard' })
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
              aria-label={showValue ? 'Hide value' : 'Show value'}
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
            aria-label="Copy value"
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
            aria-label="Edit variable"
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive"
            onClick={() => onDelete(envVar.key)}
            aria-label="Delete variable"
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
  const [key, setKey] = useState(editingVar?.key || '')
  const [value, setValue] = useState(editingVar?.value || '')
  const [isSecret, setIsSecret] = useState(editingVar?.isSecret || false)

  const { toast } = useToast()
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!key.trim()) {
      toast({ title: 'Key is required', variant: 'destructive' })
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
            {editingVar ? 'Edit Environment Variable' : 'Add Environment Variable'}
          </DialogTitle>
          <DialogDescription>
            Environment variables are passed to your services at runtime.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="key">Key</Label>
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
              <Label htmlFor="value">Value</Label>
              <Input
                id="value"
                placeholder="value"
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
                Mark as secret (value will be masked)
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">
              {editingVar ? 'Save Changes' : 'Add Variable'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default function StackEnvPage() {
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
    onError: (e) => toast({ title: 'Failed to save', description: e.message, variant: 'destructive' }),
  })
  // Every change persists the full list — the query is the source of truth.
  const persist = (next: EnvVar[]) => setEnv.mutate({ stackId, envVars: next })

  const handleAdd = (envVar: EnvVar) => {
    if (editingVar) {
      persist(envVars.map(v => v.key === editingVar.key ? envVar : v))
      toast({ title: 'Environment variable updated' })
    } else {
      if (envVars.some(v => v.key === envVar.key)) {
        toast({ title: 'Variable with this key already exists', variant: 'destructive' })
        return
      }
      persist([...envVars, envVar])
      toast({ title: 'Environment variable added' })
    }
    setEditingVar(null)
  }

  const handleEdit = (envVar: EnvVar) => {
    setEditingVar(envVar)
    setDialogOpen(true)
  }

  const handleDelete = (key: string) => {
    persist(envVars.filter(v => v.key !== key))
    toast({ title: 'Environment variable deleted' })
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
          <h2 className="text-xl font-semibold">Environment Variables</h2>
          <p className="text-muted-foreground">
            Configure environment variables for your stack services
          </p>
        </div>
        <Button onClick={() => { setEditingVar(null); setDialogOpen(true) }}>
          <Plus className="h-4 w-4 mr-2" />
          Add Variable
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Key className="h-5 w-5" />
            Variables ({envVars.length})
          </CardTitle>
          <CardDescription>
            Saved with your stack. Secret values are masked in this list.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {envVars.length === 0 ? (
            <div className="text-center py-8">
              <Key className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold">No environment variables</h3>
              <p className="text-muted-foreground mt-2">
                Add environment variables to configure your services
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Key</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead className="w-[150px]">Actions</TableHead>
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
