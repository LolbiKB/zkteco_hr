import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { format, parseISO, subDays, differenceInMinutes } from 'date-fns'
import {
  AlertTriangle,
  Calendar,
  Download,
  ExternalLink,
  Loader2,
  RefreshCw,
  Upload,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
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
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { useQueryClient } from '@tanstack/react-query'
import {
  useDeviceAttlogClosureHistory,
  useDeviceAttlogMeta,
  useDeviceAttlogInFlightCommands,
  useDeviceRecentPunches,
  useRetryAttlogClosure,
  useAttlogForceLog,
  useAttlogForceSync,
  useAttlogPurge,
} from '@/hooks/use-attlog-closure'
import { useExportAttendanceLogs } from '@/hooks/use-attendance-logs'
import { attlogClosureLabel } from '@/lib/attlog-closure-display'
import { useAuth } from '@/contexts/auth-context'
import {
  formatCheckTimeForLog,
  formatIngestedTime,
  getLocalDateStringFromUtc,
} from '@/lib/attendance-log-display'
import {
  AttlogClosureBadge,
  AttlogCommandTypeBadge,
  CommandQueueStatusBadge,
  HrSyncBadge,
  LedgerTrustBadge,
} from '@/components/shared/status-badges'
import { ATTLOG_CATCH_UP_DAYS } from '@/lib/attlog-constants'
import { toast } from 'sonner'

interface DeviceAttlogTabProps {
  deviceSn: string
  isOnline: boolean
  enabled: boolean
}

/** Heatmap cells — tone-aligned with text-on-secondary badges. */
function closureCalendarCellClass(status: string | undefined): string {
  switch (status) {
    case 'closed':
      return 'ring-2 ring-green-700/40 bg-secondary'
    case 'closure_failed':
      return 'ring-2 ring-destructive/40 bg-secondary'
    case 'deferred_offline':
      return 'ring-2 ring-amber-700/40 bg-secondary'
    case 'backfill_running':
    case 'pending_verify':
      return 'ring-2 ring-blue-700/40 bg-secondary'
    default:
      return 'bg-muted'
  }
}

export function DeviceAttlogTab({ deviceSn, isOnline, enabled }: DeviceAttlogTabProps) {
  const [purgeOpen, setPurgeOpen] = useState(false)
  const { isSuperAdmin } = useAuth()
  const queryClient = useQueryClient()
  const { data: meta } = useDeviceAttlogMeta(deviceSn, enabled)
  const { data: closureHistory = [], isLoading: closureLoading } = useDeviceAttlogClosureHistory(
    deviceSn,
    enabled
  )
  const { data: inFlight = [] } = useDeviceAttlogInFlightCommands(deviceSn, enabled)
  const { data: recentPunches = [], isLoading: punchesLoading } = useDeviceRecentPunches(
    deviceSn,
    enabled
  )

  const retryMutation = useRetryAttlogClosure(deviceSn)
  const forceLog = useAttlogForceLog(deviceSn)
  const forceSync = useAttlogForceSync(deviceSn)
  const purgeMutation = useAttlogPurge(deviceSn)
  const exportLogs = useExportAttendanceLogs()

  const timezone = meta?.timezone || 'Asia/Phnom_Penh'

  const closureByDate = useMemo(() => {
    const m = new Map<string, (typeof closureHistory)[0]>()
    for (const row of closureHistory) {
      m.set(row.local_date, row)
    }
    return m
  }, [closureHistory])

  const calendarDays = useMemo(() => {
    const days: { localDate: string; status?: string }[] = []
    for (let i = ATTLOG_CATCH_UP_DAYS - 1; i >= 0; i--) {
      const d = format(subDays(new Date(), i), 'yyyy-MM-dd')
      days.push({ localDate: d, status: closureByDate.get(d)?.status })
    }
    return days
  }, [closureByDate])

  const catchUpDepth = useMemo(
    () => closureHistory.filter((r) => r.status !== 'closed').length,
    [closureHistory]
  )

  const lastPunch = recentPunches[0]?.check_time

  const avgIngestLagMin = useMemo(() => {
    if (recentPunches.length === 0) return null
    let total = 0
    let n = 0
    for (const p of recentPunches.slice(0, 20)) {
      const lag = differenceInMinutes(parseISO(p.created_at), parseISO(p.check_time))
      if (lag >= 0) {
        total += lag
        n++
      }
    }
    return n > 0 ? Math.round(total / n) : null
  }, [recentPunches])

  const postPurgeRecent = useMemo(() => {
    if (!meta?.attlog_last_device_purge_at) return false
    const days = (Date.now() - new Date(meta.attlog_last_device_purge_at).getTime()) / 86400000
    return days <= 7
  }, [meta?.attlog_last_device_purge_at])

  useEffect(() => {
    if (!enabled || !deviceSn) return
    const channel = supabase
      .channel(`attlog-punches-${deviceSn}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'attendance_logs',
          filter: `device_sn=eq.${deviceSn}`,
        },
        () => {
          void queryClient.invalidateQueries({
            queryKey: ['attlog-closure', 'recent-punches', deviceSn],
          })
        }
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [deviceSn, enabled, queryClient])

  const handleRetry = async (localDate: string) => {
    try {
      await retryMutation.mutateAsync(localDate)
      toast.success(`Verify queued for ${localDate}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Retry failed')
    }
  }

  const openAttendanceLogsUrl = (localDate: string) => {
    const params = new URLSearchParams({
      device_sn: deviceSn,
      dateFrom: `${localDate}T00:00:00.000Z`,
      dateTo: `${localDate}T23:59:59.999Z`,
    })
    return `/attendance-logs?${params.toString()}`
  }

  return (
    <div className="flex flex-col gap-4 min-h-0 overflow-y-auto pr-1">
      {postPurgeRecent && (
        <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/40 px-3 py-2 text-sm text-amber-900 dark:text-amber-100">
          Device log buffer was cleared recently — bridge is the source of truth for archived days.
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
        <div className="p-2 rounded-lg border bg-muted/30">
          <div className="text-xs text-muted-foreground">Last closed day</div>
          <div className="font-medium">{meta?.attlog_last_closed_date || '—'}</div>
        </div>
        <div className="p-2 rounded-lg border bg-muted/30">
          <div className="text-xs text-muted-foreground">Catch-up backlog</div>
          <div className="font-medium">
            {catchUpDepth > 0 ? `${catchUpDepth} day(s) open` : 'None'}
          </div>
        </div>
        <div className="p-2 rounded-lg border bg-muted/30">
          <div className="text-xs text-muted-foreground">Last punch (device)</div>
          <div className="font-medium text-xs">
            {lastPunch
              ? formatCheckTimeForLog(lastPunch, timezone).date +
                ' ' +
                formatCheckTimeForLog(lastPunch, timezone).time
              : '—'}
          </div>
        </div>
        <div className="p-2 rounded-lg border bg-muted/30">
          <div className="text-xs text-muted-foreground">Avg ingest lag</div>
          <div className="font-medium">
            {avgIngestLagMin != null ? `${avgIngestLagMin} min` : '—'}
          </div>
        </div>
        <div className="p-2 rounded-lg border bg-muted/30">
          <div className="text-xs text-muted-foreground">Time drift</div>
          <div className="font-medium flex items-center gap-1">
            {meta?.attlog_time_drift_suspected ? (
              <>
                <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                Suspected
              </>
            ) : (
              'OK'
            )}
          </div>
        </div>
        <div className="p-2 rounded-lg border bg-muted/30">
          <div className="text-xs text-muted-foreground">Last device purge</div>
          <div className="font-medium text-xs">
            {meta?.attlog_last_device_purge_at
              ? format(parseISO(meta.attlog_last_device_purge_at), 'MMM d, yyyy')
              : 'Never'}
          </div>
        </div>
      </div>

      {inFlight.length > 0 && (
        <div className="rounded-md border px-3 py-2 text-sm space-y-1">
          <div className="font-medium text-muted-foreground">In-flight ATTLOG commands</div>
          {inFlight.map((cmd) => (
            <div key={cmd.id} className="flex flex-wrap gap-2 items-center text-xs">
              <AttlogCommandTypeBadge commandType={cmd.command_type} />
              <span className="text-muted-foreground truncate max-w-md">{cmd.command}</span>
              <CommandQueueStatusBadge status={cmd.status} />
            </div>
          ))}
        </div>
      )}

      <div>
        <div className="flex items-center gap-2 mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
          <Calendar className="h-3.5 w-3.5" />
          {ATTLOG_CATCH_UP_DAYS}-day closeout
        </div>
        <div className="flex gap-1 flex-wrap">
          {calendarDays.map(({ localDate, status }) => (
            <div
              key={localDate}
              title={`${localDate}: ${attlogClosureLabel(status)}`}
              className={cn(
                'h-6 w-6 rounded-sm',
                closureCalendarCellClass(status)
              )}
            />
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={!isOnline || forceLog.isPending}
          onClick={() => {
            forceLog.mutate(undefined, {
              onSuccess: () => toast.success('LOG command queued'),
              onError: (e) => toast.error(e.message),
            })
          }}
        >
          {forceLog.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
          ) : (
            <Upload className="h-3.5 w-3.5 mr-1" />
          )}
          Force LOG
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={!isOnline || forceSync.isPending}
          onClick={() => {
            forceSync.mutate(undefined, {
              onSuccess: () => toast.success('Reconnect sync queued'),
              onError: (e) => toast.error(e.message),
            })
          }}
        >
          <RefreshCw className="h-3.5 w-3.5 mr-1" />
          Force sync
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={exportLogs.isPending}
          onClick={() => {
            exportLogs.mutate(
              { device_sn: deviceSn, limit: 5000 },
              {
                onSuccess: () => toast.success('Export started'),
                onError: (e) => toast.error(e.message),
              }
            )
          }}
        >
          <Download className="h-3.5 w-3.5 mr-1" />
          Export CSV
        </Button>
        {isSuperAdmin && (
        <Dialog open={purgeOpen} onOpenChange={setPurgeOpen}>
          <DialogTrigger asChild>
            <Button
              size="sm"
              variant="destructive"
              disabled={!isOnline || purgeMutation.isPending}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" />
              CLEAR LOG
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Clear device ATTLOG buffer?</DialogTitle>
              <DialogDescription>
                This queues CLEAR LOG on the device and wipes all on-terminal attendance
                records. Bridge closed days remain the archive. Purge gate must pass.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPurgeOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  purgeMutation.mutate(undefined, {
                    onSuccess: () => {
                      setPurgeOpen(false)
                      toast.success('CLEAR LOG queued')
                    },
                    onError: (e) => toast.error(e.message),
                  })
                }}
              >
                Confirm
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        )}
      </div>

      <div>
        <h4 className="text-sm font-medium mb-2">Daily closeout</h4>
        {closureLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Counts</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {closureHistory.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                      No closeout rows yet
                    </TableCell>
                  </TableRow>
                ) : (
                  closureHistory.map((row) => (
                    <TableRow key={row.local_date}>
                      <TableCell className="font-mono text-xs">{row.local_date}</TableCell>
                      <TableCell>
                        <AttlogClosureBadge
                          status={row.status}
                          label={
                            row.status === 'backfill_running' &&
                            row.backfill_chunks_total != null
                              ? `${attlogClosureLabel(row.status)} (${row.backfill_chunks_done ?? 0}/${row.backfill_chunks_total})`
                              : undefined
                          }
                        />
                        {row.last_error && (
                          <p className="text-xs text-muted-foreground mt-1 truncate max-w-[200px]">
                            {row.last_error}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        device={row.device_sum ?? '—'} / bridge={row.server_sum ?? '—'}
                        {row.status === 'closure_failed' &&
                          row.device_sum != null &&
                          row.server_sum != null &&
                          row.device_sum !== row.server_sum && (
                            <span className="block text-red-600">
                              Δ {Math.abs(row.device_sum - row.server_sum)}
                            </span>
                          )}
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button variant="ghost" size="sm" asChild>
                          <Link to={openAttendanceLogsUrl(row.local_date)}>
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Link>
                        </Button>
                        {(row.status === 'closure_failed' ||
                          row.status === 'deferred_offline' ||
                          row.status === 'pending_verify') && (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={retryMutation.isPending}
                            onClick={() => void handleRetry(row.local_date)}
                          >
                            Retry
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <div>
        <h4 className="text-sm font-medium mb-2">Recent punches</h4>
        {punchesLoading ? (
          <Loader2 className="h-5 w-5 animate-spin mx-auto" />
        ) : (
          <div className="border rounded-lg overflow-hidden max-h-64 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>PIN</TableHead>
                  <TableHead>Check time</TableHead>
                  <TableHead>Ledger</TableHead>
                  <TableHead>ERP</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentPunches.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-4">
                      No punches
                    </TableCell>
                  </TableRow>
                ) : (
                  recentPunches.map((p) => {
                    const tz =
                      (p.devices as { timezone?: string } | null)?.timezone || timezone
                    const localDate = getLocalDateStringFromUtc(p.check_time, tz)
                    const closureStatus = closureByDate.get(localDate)?.status
                    const check = formatCheckTimeForLog(p.check_time, tz)
                    const ingested = formatIngestedTime(p.created_at)
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="font-mono text-xs">{p.user_pin}</TableCell>
                        <TableCell className="text-xs">
                          {check.date} {check.time}
                          <div className="text-muted-foreground">Ingested {ingested.time}</div>
                        </TableCell>
                        <TableCell>
                          <LedgerTrustBadge closureStatus={closureStatus} />
                        </TableCell>
                        <TableCell>
                          <HrSyncBadge syncStatus={p.sync_status} />
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  )
}
