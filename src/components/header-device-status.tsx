import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useNavigate } from 'react-router'
import { useDevices, useSyncStatus, useCommandQueue } from '@/hooks/use-core-data'
import { useMemo, useState } from 'react'
import {
  Server,
  Activity,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  ChevronRight,
} from 'lucide-react'

const COMMAND_FRESHNESS_MS = 2 * 60 * 1000
const FAILED_COMMAND_WINDOW_MS = 60 * 60 * 1000
/** Tooltip-only: recent auto-cancelled housekeeping (does not affect chip color). */
const CANCELLED_COMMAND_WINDOW_MS = 30 * 60 * 1000

const ENROLLMENT_INCOMPLETE_MSG = 'Template upload not received from device'

function isReconcileLegacyFailed(c: { status: string; error_message?: string | null }) {
  return (
    c.status === 'failed' &&
    typeof c.error_message === 'string' &&
    c.error_message.includes('Cancelled by reconcile')
  )
}

function isEnrollmentIncompleteFailed(c: {
  status: string
  error_message?: string | null
  command_type?: string
}) {
  if (c.status !== 'failed') return false
  if (
    c.command_type === 'enroll_fingerprint' ||
    c.command_type === 'enroll_face'
  ) {
    return true
  }
  return (
    typeof c.error_message === 'string' &&
    c.error_message.includes(ENROLLMENT_INCOMPLETE_MSG)
  )
}

/** Auto-healed cancels — must not count as issues or "needs cleanup" rows. */
function isSupersededCancelled(c: { status: string; error_message?: string | null }) {
  if (c.status !== 'cancelled') return false
  const msg = (c.error_message ?? '').toLowerCase()
  const patterns = [
    'superseded',
    'duplicate',
    'cancelled by reconcile',
    'verification loop',
    'stale',
    'superseded by newer',
  ]
  return patterns.some((p) => msg.includes(p))
}

/** Failures that should turn the header red (retry-worthy system failures). */
function isActionableFailed(
  c: {
    status: string
    error_message?: string | null
    created_at: string
    command_type?: string
  },
  now: number
) {
  if (c.status !== 'failed' || isReconcileLegacyFailed(c)) return false
  if (isEnrollmentIncompleteFailed(c)) return false
  return now - new Date(c.created_at).getTime() < FAILED_COMMAND_WINDOW_MS
}

function isEnrollmentIncompleteInWindow(
  c: { status: string; error_message?: string | null; created_at: string; command_type?: string },
  now: number
) {
  if (!isEnrollmentIncompleteFailed(c)) return false
  return now - new Date(c.created_at).getTime() < FAILED_COMMAND_WINDOW_MS
}

type Status = 'healthy' | 'syncing' | 'warning' | 'critical'

const STATUS_COLORS: Record<
  Status,
  { dot: string; icon: typeof CheckCircle2; label: string }
> = {
  healthy: { dot: 'bg-green-500', icon: CheckCircle2, label: 'All operational' },
  syncing: { dot: 'bg-blue-500', icon: RefreshCw, label: 'Sync in progress' },
  warning: { dot: 'bg-amber-500', icon: Activity, label: 'Minor issues' },
  critical: { dot: 'bg-red-500', icon: AlertTriangle, label: 'Issues detected' },
}

export function HeaderDeviceStatus() {
  const navigate = useNavigate()
  const { data: devices, isLoading: devicesLoading } = useDevices()
  const { data: syncData, isLoading: syncLoading } = useSyncStatus()
  const { data: commands, isLoading: commandsLoading } = useCommandQueue()

  const m = useMemo(() => {
    const list = devices?.devices ?? []
    const total = list.length
    const online = list.filter((d: any) => d.isOnline).length
    const offline = total - online

    const failedUsers = (syncData ?? []).filter(
      (s: any) => s.actual_state === 'not_synced' && s.error_message !== null
    ).length

    const now = Date.now()
    const cmdList = commands ?? []

    const pendingCommands = cmdList.filter((c: any) => {
      const age = now - new Date(c.created_at).getTime()
      return age < COMMAND_FRESHNESS_MS && (c.status === 'pending' || c.status === 'sent')
    }).length

    const failedCommands = cmdList.filter((c: any) => isActionableFailed(c, now)).length

    const enrollmentIncomplete = cmdList.filter((c: any) =>
      isEnrollmentIncompleteInWindow(c, now)
    ).length

    const enrollmentCleanupPending = cmdList.filter((c: any) => {
      const age = now - new Date(c.created_at).getTime()
      return (
        age < COMMAND_FRESHNESS_MS &&
        c.command_type === 'delete_fingerprint' &&
        c.initiated_by === 'enrollment_abort' &&
        (c.status === 'pending' || c.status === 'sent')
      )
    }).length

    const cancelledAll = cmdList.filter((c: any) => {
      if (c.status !== 'cancelled') return false
      return now - new Date(c.created_at).getTime() < CANCELLED_COMMAND_WINDOW_MS
    })
    const cancelledSuperseded = cancelledAll.filter((c: any) => isSupersededCancelled(c)).length
    const autoResolvedCancelled = cancelledSuperseded
    const cancelledCommands = cancelledAll.length - cancelledSuperseded

    const driftCount = list.filter((d: any) => d.stats_drift_detected).length

    const hasCriticalIssues = failedCommands > 0 || failedUsers > 0
    // Cancelled housekeeping is informational only — never amber chip
    const hasMinorIssues =
      enrollmentIncomplete > 0 || offline > 0 || driftCount > 0

    const issueCount =
      failedCommands +
      failedUsers +
      offline +
      driftCount +
      enrollmentIncomplete

    let status: Status = 'healthy'
    if (hasCriticalIssues) status = 'critical'
    else if (pendingCommands > 0) status = 'syncing'
    else if (hasMinorIssues) status = 'warning'

    return {
      total,
      online,
      offline,
      failedUsers,
      pendingCommands,
      failedCommands,
      enrollmentIncomplete,
      enrollmentCleanupPending,
      autoResolvedCancelled,
      cancelledCommands,
      driftCount,
      hasCriticalIssues,
      hasMinorIssues,
      issueCount,
      status,
      loading: devicesLoading || syncLoading || commandsLoading,
    }
  }, [devices, syncData, commands, devicesLoading, syncLoading, commandsLoading])

  const color = STATUS_COLORS[m.status]
  const [open, setOpen] = useState(false)

  if (m.loading) {
    return (
      <div className="flex items-center gap-2 rounded-full border bg-muted/50 px-2.5 py-1 animate-pulse">
        <div className="h-2 w-2 rounded-full bg-muted-foreground/20" />
        <div className="h-3 w-10 rounded bg-muted-foreground/20" />
      </div>
    )
  }

  // Concise command/user breakdown for the detail dashboard.
  const commandStats = [
    { key: 'active', label: 'Active', value: m.pendingCommands, tone: 'text-blue-600 dark:text-blue-400' },
    { key: 'failed', label: 'Failed', value: m.failedCommands, tone: 'text-destructive' },
    { key: 'enroll', label: 'Enrollment incomplete', value: m.enrollmentIncomplete, tone: 'text-amber-600 dark:text-amber-400' },
    { key: 'cleanup', label: 'Enrollment cleanup', value: m.enrollmentCleanupPending, tone: 'text-blue-600 dark:text-blue-400' },
    { key: 'cancelled', label: 'Cancelled', value: m.cancelledCommands, tone: 'text-amber-600 dark:text-amber-400' },
    { key: 'resolved', label: 'Auto-resolved', value: m.autoResolvedCancelled, tone: 'text-muted-foreground' },
  ].filter((s) => s.value > 0)

  const userStats = [
    { key: 'failed', label: 'Failed syncs', value: m.failedUsers, tone: 'text-destructive' },
    { key: 'drift', label: 'Drift detected', value: m.driftCount, tone: 'text-amber-600 dark:text-amber-400' },
  ].filter((s) => s.value > 0)

  return (
    <>
      {/* Simplified indicator: status dot + online count (+ issue count). */}
      <button
        onClick={() => setOpen(true)}
        className="group flex items-center gap-2 rounded-full border bg-background px-2.5 py-1 text-xs font-medium tabular-nums text-muted-foreground transition-colors hover:bg-accent active:scale-[0.97]"
        aria-label={`System status: ${color.label}. ${m.online} of ${m.total} devices online. Open status detail.`}
      >
        <span className="relative flex h-2 w-2">
          <span
            className={cn(
              'absolute inset-0 rounded-full',
              color.dot,
              (m.status === 'critical' || m.status === 'syncing') && 'animate-ping opacity-40'
            )}
          />
          <span className={cn('relative inline-block h-2 w-2 rounded-full', color.dot)} />
        </span>
        <span>
          {m.online}/{m.total}
        </span>
        {m.issueCount > 0 && (
          <span className="text-foreground/70">
            · {m.issueCount} {m.issueCount === 1 ? 'issue' : 'issues'}
          </span>
        )}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent size="screen" className="flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className={cn('h-2.5 w-2.5 rounded-full', color.dot)} />
              {color.label}
            </DialogTitle>
            <DialogDescription>
              {m.online} of {m.total} devices online · refreshed live
            </DialogDescription>
          </DialogHeader>

          <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto">
            {/* Headline stat tiles */}
            <div className="grid shrink-0 grid-cols-2 gap-3 sm:grid-cols-4">
              <StatTile label="Online" value={m.online} dot="bg-green-500" />
              <StatTile label="Offline" value={m.offline} dot="bg-red-400" muted={m.offline === 0} />
              <StatTile label="Active commands" value={m.pendingCommands} dot="bg-blue-500" muted={m.pendingCommands === 0} />
              <StatTile label="Issues" value={m.issueCount} dot={m.issueCount > 0 ? 'bg-amber-500' : 'bg-green-500'} muted={m.issueCount === 0} />
            </div>

            <div className="grid flex-1 auto-rows-fr grid-cols-1 gap-6 lg:grid-cols-2">
              <Section title="Devices" icon={Server}>
                <p className="mb-3 text-xs text-muted-foreground">
                  Online = device polled the bridge within 65 seconds.
                </p>
                <DotRow tone="text-green-600 dark:text-green-400" label="Online" value={m.online} />
                {m.offline > 0 && (
                  <DotRow tone="text-red-500" label="Offline" value={m.offline} />
                )}
              </Section>

              <Section title="Commands" icon={RefreshCw}>
                {commandStats.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No active or recent command activity.</p>
                ) : (
                  commandStats.map((s) => (
                    <DotRow key={s.key} tone={s.tone} label={s.label} value={s.value} />
                  ))
                )}
              </Section>

              <Section title="Users" icon={AlertTriangle}>
                {userStats.length === 0 ? (
                  <p className="text-sm text-muted-foreground">All users in sync.</p>
                ) : (
                  userStats.map((s) => (
                    <DotRow key={s.key} tone={s.tone} label={s.label} value={s.value} />
                  ))
                )}
              </Section>

              <Section title="Status" icon={CheckCircle2}>
                <DotRow
                  tone={
                    m.status === 'critical'
                      ? 'text-destructive'
                      : m.status === 'warning'
                        ? 'text-amber-600 dark:text-amber-400'
                        : m.status === 'syncing'
                          ? 'text-blue-600 dark:text-blue-400'
                          : 'text-green-600 dark:text-green-400'
                  }
                  label={color.label}
                  value={null}
                />
                {m.driftCount > 0 && (
                  <DotRow tone="text-amber-600 dark:text-amber-400" label="Devices with drift" value={m.driftCount} />
                )}
              </Section>
            </div>
          </div>

          <DialogFooter className="sm:justify-between">
            <span className="hidden text-xs text-muted-foreground sm:inline">
              Live from the bridge — updates automatically.
            </span>
            <Button
              onClick={() => {
                setOpen(false)
                navigate('/devices')
              }}
            >
              Open Device Management
              <ChevronRight className="h-4 w-4" />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function StatTile({
  label,
  value,
  dot,
  muted = false,
}: {
  label: string
  value: number
  dot: string
  muted?: boolean
}) {
  return (
    <div className="rounded-xl border p-4">
      <div className="flex items-center gap-2">
        <span className={cn('h-2 w-2 rounded-full', muted ? 'bg-muted-foreground/30' : dot)} />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <div className={cn('mt-1.5 text-2xl font-semibold tabular-nums', muted && 'text-muted-foreground')}>
        {value}
      </div>
    </div>
  )
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string
  icon: typeof Server
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border p-4">
      <div className="mb-3 flex items-center gap-1.5 text-sm font-medium">
        <Icon className="h-4 w-4 text-muted-foreground" />
        {title}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  )
}

function DotRow({
  tone,
  label,
  value,
}: {
  tone: string
  label: string
  value: number | null
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className={cn('inline-flex items-center gap-2', tone)}>
        <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
        <span className="text-foreground/80">{label}</span>
      </span>
      {value !== null && <span className="font-semibold tabular-nums">{value}</span>}
    </div>
  )
}
