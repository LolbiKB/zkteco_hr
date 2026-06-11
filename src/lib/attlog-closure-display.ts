import type { LucideIcon } from 'lucide-react'
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
  MinusCircle,
} from 'lucide-react'

export type AttlogClosureStatus =
  | 'pending_verify'
  | 'backfill_running'
  | 'closed'
  | 'deferred_offline'
  | 'closure_failed'

export type AttlogClosureBadgeConfig = {
  label: string
  className: string
  icon: LucideIcon
}

/** Text-on-secondary badge style (matches HR sync / verify columns). */
export function attlogClosureBadgeConfig(
  status: AttlogClosureStatus | string | null | undefined
): AttlogClosureBadgeConfig {
  switch (status) {
    case 'closed':
      return {
        label: 'Closed',
        className: 'text-green-700 dark:text-green-400',
        icon: CheckCircle2,
      }
    case 'deferred_offline':
      return {
        label: 'Deferred (offline)',
        className: 'text-amber-700 dark:text-amber-400',
        icon: Clock,
      }
    case 'backfill_running':
      return {
        label: 'Backfill',
        className: 'text-blue-700 dark:text-blue-400',
        icon: Loader2,
      }
    case 'pending_verify':
      return {
        label: 'Verifying',
        className: 'text-blue-700 dark:text-blue-400',
        icon: Loader2,
      }
    case 'closure_failed':
      return {
        label: 'Failed',
        className: 'text-destructive',
        icon: AlertCircle,
      }
    default:
      return {
        label: 'Not started',
        className: 'text-muted-foreground',
        icon: MinusCircle,
      }
  }
}

export function attlogClosureLabel(status: AttlogClosureStatus | string | null | undefined): string {
  switch (status) {
    case 'closed':
      return 'Closed'
    case 'deferred_offline':
      return 'Deferred (offline)'
    case 'backfill_running':
      return 'Backfill'
    case 'closure_failed':
      return 'Failed'
    case 'pending_verify':
      return 'Verifying'
    default:
      return 'Not started'
  }
}

/** @deprecated Use attlogClosureBadgeConfig + variant secondary badges */
export function attlogClosureBadgeClass(status: AttlogClosureStatus | string | null | undefined): string {
  return attlogClosureBadgeConfig(status).className
}

const LEGEND_STATUSES: (AttlogClosureStatus | 'not_started')[] = [
  'closed',
  'pending_verify',
  'closure_failed',
  'deferred_offline',
  'not_started',
]

/** Ring/bar colors for closeout calendar cells (matches badge semantics). */
export function attlogClosureCellRingClass(
  status: AttlogClosureStatus | string | null | undefined
): string {
  switch (status) {
    case 'closed':
      return 'ring-2 ring-green-700/40 bg-green-500/20'
    case 'closure_failed':
      return 'ring-2 ring-destructive/40 bg-destructive/15'
    case 'deferred_offline':
      return 'ring-2 ring-amber-700/40 bg-amber-500/20'
    case 'backfill_running':
    case 'pending_verify':
      return 'ring-2 ring-blue-700/40 bg-blue-500/20'
    default:
      return 'bg-muted'
  }
}

export const ATTLOG_CLOSURE_LEGEND_STATUSES = LEGEND_STATUSES
