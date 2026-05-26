export type AttlogClosureStatus =
  | 'pending_verify'
  | 'backfill_running'
  | 'closed'
  | 'deferred_offline'
  | 'closure_failed'

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

export function attlogClosureBadgeClass(status: AttlogClosureStatus | string | null | undefined): string {
  switch (status) {
    case 'closed':
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
    case 'deferred_offline':
      return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
    case 'backfill_running':
    case 'pending_verify':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
    case 'closure_failed':
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
    default:
      return 'bg-muted text-muted-foreground'
  }
}
