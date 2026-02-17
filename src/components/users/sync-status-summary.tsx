// Sync Status Summary Component
// Shows overall sync status for a user across all devices

import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Check, X, Loader2, AlertTriangle, HelpCircle } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { UserService } from '@/services/user-service'

interface SyncStatusSummaryProps {
  userId: string
  variant?: 'badge' | 'detailed'
}

export function SyncStatusSummary({ userId, variant = 'badge' }: SyncStatusSummaryProps) {
  const { data: summary, isLoading } = useQuery({
    queryKey: ['user-sync-summary', userId],
    queryFn: () => UserService.getUserSyncSummary(userId),
    enabled: !!userId,
    refetchInterval: 10000, // Refetch every 10 seconds
  })

  if (isLoading || !summary) {
    return (
      <Badge variant="outline" className="gap-1.5">
        <Loader2 className="h-3 w-3 animate-spin" />
        <span className="text-xs">Checking sync...</span>
      </Badge>
    )
  }

  const { total_devices, synced, not_synced, syncing, failed, drift_detected } = summary
  const hasIssues = failed > 0 || drift_detected > 0
  const isFullySynced = synced === total_devices && total_devices > 0
  const isSyncing = syncing > 0

  // Badge variant
  if (variant === 'badge') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge
              className={`gap-1.5 cursor-help ${isFullySynced
                  ? 'bg-green-100 text-green-800 hover:bg-green-100 dark:bg-green-950 dark:text-green-400'
                  : hasIssues
                    ? 'bg-red-100 text-red-800 hover:bg-red-100 dark:bg-red-950 dark:text-red-400'
                    : 'bg-gray-100 text-gray-800 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-300'
                }`}
            >
              {isFullySynced && <Check className="h-3 w-3" />}
              {hasIssues && <AlertTriangle className="h-3 w-3" />}
              {isSyncing && !hasIssues && <Loader2 className="h-3 w-3 animate-spin" />}
              {!isFullySynced && !hasIssues && !isSyncing && <X className="h-3 w-3" />}
              <span className="text-xs">
                {synced}/{total_devices}
              </span>
            </Badge>
          </TooltipTrigger>
          <TooltipContent className="bg-popover text-popover-foreground border shadow-md">
            <div className="space-y-1 text-xs">
              <div className="font-semibold">Sync Status</div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                <span className="text-muted-foreground">Synced:</span>
                <span className="text-green-600 font-medium">{synced}</span>

                {not_synced > 0 && (
                  <>
                    <span className="text-muted-foreground">Not synced:</span>
                    <span>{not_synced}</span>
                  </>
                )}

                {syncing > 0 && (
                  <>
                    <span className="text-muted-foreground">Syncing:</span>
                    <span className="text-blue-600">{syncing}</span>
                  </>
                )}

                {failed > 0 && (
                  <>
                    <span className="text-muted-foreground">Failed:</span>
                    <span className="text-destructive font-medium">{failed}</span>
                  </>
                )}

                {drift_detected > 0 && (
                  <>
                    <span className="text-muted-foreground">Drift:</span>
                    <span className="text-orange-600 font-medium">{drift_detected}</span>
                  </>
                )}
              </div>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  // Detailed variant
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">Sync Status:</span>
        {isFullySynced && (
          <Badge className="gap-1.5 bg-green-100 text-green-800 hover:bg-green-100 dark:bg-green-950 dark:text-green-400">
            <Check className="h-3 w-3" />
            All devices synced
          </Badge>
        )}
        {!isFullySynced && (
          <Badge className="gap-1.5 bg-gray-100 text-gray-800 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-300">
            {synced}/{total_devices} devices
          </Badge>
        )}
      </div>

      {(not_synced > 0 || syncing > 0 || failed > 0 || drift_detected > 0) && (
        <div className="grid grid-cols-2 gap-2 text-xs">
          {not_synced > 0 && (
            <div className="flex items-center gap-1.5">
              <X className="h-3 w-3 text-muted-foreground" />
              <span>{not_synced} not synced</span>
            </div>
          )}

          {syncing > 0 && (
            <div className="flex items-center gap-1.5">
              <Loader2 className="h-3 w-3 animate-spin text-blue-600" />
              <span>{syncing} syncing</span>
            </div>
          )}

          {failed > 0 && (
            <div className="flex items-center gap-1.5">
              <AlertTriangle className="h-3 w-3 text-destructive" />
              <span>{failed} failed</span>
            </div>
          )}

          {drift_detected > 0 && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1.5 cursor-help">
                    <HelpCircle className="h-3 w-3 text-orange-600" />
                    <span>{drift_detected} drift detected</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs max-w-xs">
                    Drift means the device has different data than expected.
                    <br />
                    This will be automatically corrected.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      )}
    </div>
  )
}
