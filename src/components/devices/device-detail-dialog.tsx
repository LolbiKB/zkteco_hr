// Refactored DeviceDetailDialog using centralized hooks
import { useState, useEffect, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/animate-ui/components/radix/tabs'
import { 
  Wifi, 
  WifiOff, 
  Users, 
  CheckCircle2, 
  AlertCircle,
  Loader2,
  RotateCcw,
  Zap,
  History,
  Fingerprint,
  ScanFace,
  Image,
  Clock,
  Search,
  XCircle,
  ChevronDown,
} from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { supabase } from '@/lib/supabase'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'
import { 
  useDeviceWithUsers, 
  useForceSync,
  useRealtimeCommands,
  useDeviceUsersPaginated,
  useDeviceBatches,
} from '@/hooks'

interface DeviceDetailDialogProps {
  deviceSn: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

// Batch history row component with accordion
function BatchHistoryRow({ batch }: { batch: any }) {
  const [isExpanded, setIsExpanded] = useState(false)
  
  const statusConfig: Record<string, { icon: any; color: string; bgColor: string, label: string }> = {
    pending: { icon: Clock, color: 'text-amber-500', bgColor: 'bg-amber-500/10', label: 'Pending' },
    processing: { icon: Loader2, color: 'text-blue-500', bgColor: 'bg-blue-500/10', label: 'Processing' },
    completed: { icon: CheckCircle2, color: 'text-green-500', bgColor: 'bg-green-500/10', label: 'Completed' },
    failed: { icon: XCircle, color: 'text-red-500', bgColor: 'bg-red-500/10', label: 'Failed' },
  }
  const config = statusConfig[batch.status] || statusConfig.pending
  const Icon = config.icon

  const timeAgo = useMemo(() => {
    const date = new Date(batch.created_at)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    if (diffMins < 1) return 'just now'
    if (diffMins < 60) return `${diffMins}m ago`
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours}h ago`
    return format(date, 'MMM d, h:mm a')
  }, [batch.created_at])

  const commandTypeLabels: Record<string, string> = {
    sync_user: 'User',
    upload_photo: 'Photo',
    enroll_fingerprint: 'Fingerprint',
    enroll_face: 'Face',
    enroll_fingerprint_confirm: 'FP Confirm',
    enroll_face_confirm: 'Face Confirm',
  }

  const getCommandBadge = (type: string) => commandTypeLabels[type] || type

  // Show user ID short when name not available
  const displayName = batch.userName || batch.user_id?.slice(0, 8) || 'Unknown'
  
return (
    <div className="border rounded-lg bg-card overflow-hidden">
      {/* Header - clickable accordion toggle */}
      <div 
        className="flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <Icon className={`h-4 w-4 ${config.color} ${batch.status === 'processing' ? 'animate-spin' : ''}`} />
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <span className="font-medium text-sm text-foreground">
            {displayName}
          </span>
          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${config.color} ${config.bgColor}`}>
            {config.label}
          </span>
          <span className="text-xs text-muted-foreground">
            {batch.commands_count} cmd
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground whitespace-nowrap">{timeAgo}</span>
          <ChevronDown className={`h-3 w-3 text-muted-foreground transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
        </div>
      </div>
      
      {/* Animated expand content */}
      <div className={`overflow-hidden transition-all duration-200 ease-in-out ${isExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="px-3 pb-3 pt-2 border-t bg-muted/20">
          {/* Components summary */}
          <div className="flex flex-wrap gap-1 mt-2">
            {(batch.commands || []).map((cmd: any) => (
              <span 
                key={cmd.id}
                className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded ${
                  cmd.status === 'completed' ? 'bg-green-500/10 text-green-600' :
                  cmd.status === 'failed' ? 'bg-red-500/10 text-red-600' :
                  'bg-amber-500/10 text-amber-600'
                }`}
              >
                {cmd.status === 'completed' ? (
                  <CheckCircle2 className="h-2.5 w-2.5" />
                ) : cmd.status === 'failed' ? (
                  <XCircle className="h-2.5 w-2.5" />
                ) : (
                  <Loader2 className="h-2.5 w-2.5 animate-spin" />
                )}
                {commandTypeLabels[cmd.type] || cmd.type}
              </span>
            ))}
          </div>
          
          {/* Individual command details */}
          {(batch.commands || []).length > 0 && (
            <div className="mt-3 space-y-1.5">
              {batch.commands.map((cmd: any) => (
                <div 
                  key={cmd.id} 
                  className={`flex items-start gap-2 p-1.5 rounded text-xs ${
                    cmd.status === 'completed' ? 'bg-green-500/5' : 
                    cmd.status === 'failed' ? 'bg-red-500/5' : 'bg-amber-500/5'
                  }`}
                >
                  {cmd.status === 'completed' ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500 mt-0.5" />
                  ) : cmd.status === 'failed' ? (
                    <XCircle className="h-3.5 w-3.5 text-red-500 mt-0.5" />
                  ) : (
                    <Loader2 className="h-3.5 w-3.5 text-amber-500 mt-0.5 animate-spin" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-foreground">{commandTypeLabels[cmd.type] || cmd.type}</span>
                      <span className="text-muted-foreground text-[10px]">#{cmd.id}</span>
                    </div>
                    {cmd.preview && (
                      <div className="text-muted-foreground font-mono text-[10px] truncate mt-0.5">
                        {cmd.preview}...
                      </div>
                    )}
                    {cmd.error && (
                      <div className="text-red-500 text-[10px] truncate mt-0.5">{cmd.error}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {/* Timestamps */}
          <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
            <div>Started: {format(new Date(batch.created_at), 'h:mm a')}</div>
            {batch.completed_at && (
              <div>Finished: {format(new Date(batch.completed_at), 'h:mm a')}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// Component to show individual sync component status
// Simple icon-only status indicator
function StatusIcon({
  hasData = true,
  status = 'never'
}: {
  hasData?: boolean
  status?: 'never' | 'syncing' | 'synced' | 'failed'
}) {
  if (!hasData) {
    return <span className="text-gray-300">-</span>
  }

  switch (status) {
    case 'failed':
      return <AlertCircle className="h-5 w-5 text-red-500 mx-auto" />
    case 'syncing':
      return <Loader2 className="h-5 w-5 text-blue-500 animate-spin mx-auto" />
    case 'synced':
      return <CheckCircle2 className="h-5 w-5 text-green-500 mx-auto" />
    case 'never':
    default:
      return (
        <div className="h-5 w-5 mx-auto flex items-center justify-center">
          <div className="w-4 h-4 rounded-full border-2 border-dashed border-gray-400" />
        </div>
      )
  }
}

// User row component with detailed sync breakdown
function UserSyncRow({
  user,
  onForceSync,
  isSyncing
}: {
  user: any
  onForceSync: (userId: string) => void
  isSyncing: boolean
}) {
  return (
    <tr className="hover:bg-muted/50">
      <td className="px-4 py-3">
        <div className="flex flex-col">
          <span className="text-sm font-medium">{user.userName}</span>
          <span className="text-xs text-muted-foreground">
            PIN: {user.userPin}
            {user.employeeId && ` · ${user.employeeId}`}
          </span>
        </div>
      </td>
      <td className="px-4 py-3 text-center">
        <StatusIcon
          hasData={true}
          status={user.userStatus}
        />
      </td>
      <td className="px-4 py-3 text-center">
        <StatusIcon
          hasData={user.hasFingerprint}
          status={user.fingerprintStatus}
        />
      </td>
      <td className="px-4 py-3 text-center">
        <StatusIcon
          hasData={user.hasFace}
          status={user.faceStatus}
        />
      </td>
      <td className="px-4 py-3 text-center">
        <StatusIcon
          hasData={user.hasPhoto}
          status={user.photoStatus}
        />
      </td>
      <td className="px-4 py-3 text-right">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onForceSync(user.userId)}
          disabled={isSyncing}
          title={isSyncing ? 'Sync in progress - wait for completion' : 'Force sync this user'}
        >
          {isSyncing ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <RotateCcw className="h-3 w-3" />
          )}
        </Button>
      </td>
    </tr>
  )
}

export function DeviceDetailDialog({ deviceSn, open, onOpenChange }: DeviceDetailDialogProps) {
  const [activeTab, setActiveTab] = useState('users')
  const [searchQuery, setSearchQuery] = useState('')
  
  // Use centralized hooks - single source of truth
  const { 
    device, 
    users, 
    stats,
    batches,
  } = useDeviceWithUsers(deviceSn || '')
  
  const queryClient = useQueryClient()
  
  // Batch history for activity tab
  const batchHistory = useDeviceBatches(deviceSn || '')
  
  // Infinite query for users (TanStack)
  const paginatedUsers = useDeviceUsersPaginated(deviceSn || '', {
    limit: 20,
    search: searchQuery || undefined,
  })
  
  // Flatten pages into single array
  const allUsers = useMemo(() => {
    if (!paginatedUsers.data?.pages) return []
    const flatUsers = paginatedUsers.data.pages.flatMap(page => page.data || [])
    
    // Create batch map for quick lookup
    const batchMap = new Map((batches || []).map(b => [b.user_id, b]))
    
    // Use batch status as single source of truth
    return flatUsers.map(user => {
      const batch = batchMap.get(user.userId)
      
      let userStatus: 'never' | 'syncing' | 'synced' | 'failed' = 'never'
      if (batch) {
        if (batch.status === 'pending' || batch.status === 'processing') {
          userStatus = 'syncing'
        } else if (batch.status === 'completed') {
          userStatus = 'synced'
        } else if (batch.status === 'failed') {
          userStatus = 'failed'
        }
      }
      
      return {
        ...user,
        // User-level status from batch (primary - single source of truth)
        userStatus: userStatus,
        // Batch in-progress from API - used to block sync button
        isUserInProgress: user.isBatchInProgress || userStatus === 'syncing',
        // Component status still from persistent flags for now
        fingerprintStatus: user.hasFingerprint ? (user.fingerprintSynced ? 'synced' : 'never') : 'never',
        faceStatus: user.hasFace ? (user.faceSynced ? 'synced' : 'never') : 'never',
        photoStatus: user.hasPhoto ? (user.photoSynced ? 'synced' : 'never') : 'never',
      }
    })
  }, [paginatedUsers.data, batches])
  
  // Reset when search changes
  useEffect(() => {
    paginatedUsers.refetch()
  }, [searchQuery])
  
  // Load more on scroll
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement
    const nearBottom = target.scrollHeight - target.scrollTop <= target.clientHeight + 100
    if (nearBottom && !paginatedUsers.isLoading && paginatedUsers.hasNextPage) {
      paginatedUsers.fetchNextPage()
    }
  }
  
  // Real-time updates for commands
  useRealtimeCommands(deviceSn || undefined)

  // Real-time updates for batches, batch_commands, and sync_status
  useEffect(() => {
    if (!deviceSn) return
    const channel = supabase
      .channel('device-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sync_batches', filter: `device_sn=eq.${deviceSn}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ['batches-detailed', deviceSn] })
          // Also invalidate sync status queries
          queryClient.invalidateQueries({ queryKey: ['sync-status', 'all'] })
          queryClient.invalidateQueries({ queryKey: queryKeys.devices.users(deviceSn, '') })
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'batch_commands' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['batches-detailed', deviceSn] })
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_device_sync_status', filter: `device_sn=eq.${deviceSn}` },
        () => {
          // Invalidate all relevant queries when sync status changes
          queryClient.invalidateQueries({ queryKey: ['sync-status', 'all'] })
          queryClient.invalidateQueries({ queryKey: queryKeys.devices.users(deviceSn, '') })
          queryClient.invalidateQueries({ queryKey: ['batches-detailed', deviceSn] })
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [deviceSn, queryClient])

  // Mutations
  const forceSync = useForceSync()

  const handleForceSyncUser = async (userId: string) => {
    if (!deviceSn) return
    
    try {
      const result = await forceSync.mutateAsync({
        userId,
        deviceSns: [deviceSn],
      })
      
      if (result.success) {
        toast.success(`Force sync initiated for user`)
      }
    } catch (error) {
      console.error('Error forcing sync:', error)
      toast.error('Failed to force sync user')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-3">
            {device?.isOnline ? (
              <Wifi className="h-5 w-5 text-green-500" />
            ) : (
              <WifiOff className="h-5 w-5 text-red-500" />
            )}
            <div>
              <DialogTitle className="text-lg">
                {device?.name || deviceSn}
              </DialogTitle>
              <DialogDescription className="text-xs">
                {device?.location || 'No location'} · {deviceSn}
                {device?.isOnline && (
                  <span className="ml-2 text-green-600">Online</span>
                )}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="users" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Users ({stats.total})
            </TabsTrigger>
            <TabsTrigger value="activity" className="flex items-center gap-2">
              <History className="h-4 w-4" />
              Activity
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="flex-1 flex flex-col min-h-0 mt-4">
            <div className="flex items-center justify-between mb-4 gap-4">
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span>{stats.synced} synced</span>
                </div>
                <div className="flex items-center gap-2">
                  <Loader2 className={`h-4 w-4 text-blue-500 ${stats.syncing > 0 ? 'animate-spin' : ''}`} />
                  <span>{stats.syncing} syncing</span>
                </div>
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-red-500" />
                  <span>{stats.failed} failed</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search user to sync..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 h-8 w-64 text-sm"
                  />
                </div>
              </div>
            </div>

            <div className="flex-1 min-h-0">
              {(paginatedUsers.isLoading || paginatedUsers.isFetching) && allUsers.length === 0 ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : allUsers.length === 0 ? (
                <div className="flex items-center justify-center h-32 text-muted-foreground">
                  {searchQuery ? 'No matching users found' : 'No users synced to this device'}
                </div>
              ) : (
                <div 
                  className="h-[300px] overflow-y-auto border rounded-lg"
                  onScroll={handleScroll}
                >
                  <table className="w-full">
                    <thead className="bg-muted sticky top-0">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium">User</th>
                        <th className="px-4 py-2 text-center text-xs font-medium w-12">
                          <Users className="h-4 w-4 mx-auto" />
                        </th>
                        <th className="px-4 py-2 text-center text-xs font-medium w-12">
                          <Fingerprint className="h-4 w-4 mx-auto" />
                        </th>
                        <th className="px-4 py-2 text-center text-xs font-medium w-12">
                          <ScanFace className="h-4 w-4 mx-auto" />
                        </th>
                        <th className="px-4 py-2 text-center text-xs font-medium w-12">
                          <Image className="h-4 w-4 mx-auto" />
                        </th>
                        <th className="px-4 py-2 text-right text-xs font-medium w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {allUsers.map((user: any) => (
                        <UserSyncRow 
                          key={user.userId}
                          user={user}
                          onForceSync={handleForceSyncUser}
                          isSyncing={user.isUserInProgress || user.isFingerprintInProgress || user.isFaceInProgress || user.isPhotoInProgress}
                        />
                      ))}
                    </tbody>
                  </table>
                  {paginatedUsers.isFetchingNextPage && (
                    <div className="flex justify-center py-4">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  )}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="activity" className="flex-1 flex flex-col min-h-0 mt-4">
            {batchHistory.data && batchHistory.data.length > 0 && (
              <div className="flex items-center gap-4 mb-3 text-sm">
                <div className="flex items-center gap-1.5">
                  <Loader2 className="h-4 w-4 text-blue-500" />
                  <span className="text-muted-foreground">
                    {batchHistory.data.filter((b: any) => b.status === 'processing' || b.status === 'pending').length} active
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span className="text-muted-foreground">
                    {batchHistory.data.filter((b: any) => b.status === 'completed').length} completed
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <XCircle className="h-4 w-4 text-red-500" />
                  <span className="text-muted-foreground">
                    {batchHistory.data.filter((b: any) => b.status === 'failed').length} failed
                  </span>
                </div>
              </div>
            )}
            <div className="flex-1 overflow-y-auto">
              {batchHistory.isLoading ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : batchHistory.data && batchHistory.data.length > 0 ? (
                <div className="space-y-2">
                  {batchHistory.data.slice(0, 20).map((batch: any) => (
                    <BatchHistoryRow key={batch.id} batch={batch} />
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center h-32 text-muted-foreground">
                  <div className="text-center">
                    <History className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                    <p>No recent batch activity</p>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
