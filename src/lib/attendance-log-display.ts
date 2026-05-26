import { parseISO } from 'date-fns'
import type { AttendanceLogEntry } from '@/services/attendance-log-service'

const DEFAULT_DEVICE_TZ = 'Asia/Phnom_Penh'

/** Format a UTC instant in a specific IANA timezone (device site time). */
export function formatInstantInTimeZone(
  iso: string,
  timeZone: string = DEFAULT_DEVICE_TZ
): { date: string; time: string } {
  const d = new Date(iso)
  const dateFmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
  const timeFmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
  return { date: dateFmt.format(d), time: timeFmt.format(d) }
}

/**
 * Legacy ingest bug: device wall clock was saved as a UTC instant (no offset subtracted).
 * Heuristic: check_time is ~7h ahead of created_at for Asia/Phnom_Penh sites.
 */
function isLegacyLocalWallClockStoredAsUtc(
  checkIso: string,
  createdIso?: string | null
): boolean {
  if (!createdIso) return false
  const deltaMs = new Date(checkIso).getTime() - new Date(createdIso).getTime()
  const hours = deltaMs / (3600 * 1000)
  return hours > 5 && hours < 9
}

/** Show UTC calendar components (matches device LCD when mis-stored). */
function formatLegacyWallClockAsUtc(iso: string): { date: string; time: string } {
  const d = new Date(iso)
  const dateFmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
  const timeFmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
  return { date: dateFmt.format(d), time: timeFmt.format(d) }
}

/** Device punch time — uses device timezone when available. */
export function formatCheckTimeForLog(
  iso: string,
  deviceTimeZone?: string | null,
  createdAtIso?: string | null
): { date: string; time: string; timeZoneLabel: string } {
  const tz = deviceTimeZone || DEFAULT_DEVICE_TZ
  if (isLegacyLocalWallClockStoredAsUtc(iso, createdAtIso)) {
    const { date, time } = formatLegacyWallClockAsUtc(iso)
    return { date, time, timeZoneLabel: `${tz} (device clock)` }
  }
  const { date, time } = formatInstantInTimeZone(iso, tz)
  return { date, time, timeZoneLabel: tz }
}

/** When the bridge stored the row (browser local — usually when upload arrived). */
export function formatIngestedTime(iso: string): { date: string; time: string } {
  const d = new Date(iso)
  const dateFmt = new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
  const timeFmt = new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
  return { date: dateFmt.format(d), time: timeFmt.format(d) }
}

/** @deprecated Use formatCheckTimeForLog */
export function formatCheckTimeLocal(iso: string): { date: string; time: string } {
  return formatInstantInTimeZone(iso, DEFAULT_DEVICE_TZ)
}

export function normalizeStatus(status: number | string | null | undefined): number {
  if (status === null || status === undefined) return 255
  const n = typeof status === 'string' ? parseInt(status, 10) : status
  return Number.isNaN(n) ? 255 : n
}

export function erpPairingPreviewLabel(sequenceIndex: number): 'IN' | 'OUT' {
  return sequenceIndex % 2 === 1 ? 'IN' : 'OUT'
}

export function computeSequenceMap(logs: AttendanceLogEntry[]): Map<number, number> {
  const sorted = [...logs].sort(
    (a, b) => parseISO(a.check_time).getTime() - parseISO(b.check_time).getTime()
  )
  const map = new Map<number, number>()
  sorted.forEach((log, i) => map.set(log.id, i + 1))
  return map
}

export function daySequenceWarnings(logs: AttendanceLogEntry[]): string[] {
  if (logs.length === 0) return []
  const warnings: string[] = []
  if (logs.length % 2 !== 0) {
    warnings.push('Odd punch count for this day — ERP may treat the day as an exception.')
  }
  const byDevice = new Map<string, number>()
  for (const log of logs) {
    byDevice.set(log.device_sn, (byDevice.get(log.device_sn) || 0) + 1)
  }
  for (const [sn, count] of byDevice) {
    if (count % 2 !== 0) {
      const label = logs.find((l) => l.device_sn === sn)?.devices?.name || sn
      warnings.push(`Location ${label}: unclosed loop (${count} punches).`)
    }
  }
  return warnings
}
