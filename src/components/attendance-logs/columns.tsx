import type { ColumnDef } from '@tanstack/react-table'
import { Badge } from '@/components/ui/badge'
import {
  Fingerprint,
  ScanFace,
  KeyRound,
  Monitor,
  MapPin,
  AlertTriangle,
  CloudUpload,
  CloudOff,
  Clock,
} from 'lucide-react'
import {
  SelectFilterHeader,
  DateFilterHeader,
} from '@/components/ui/table-components'
import type { AttendanceLogEntry } from '@/services/attendance-log-service'
import {
  formatCheckTimeForLog,
  formatIngestedTime,
  erpPairingPreviewLabel,
} from '@/lib/attendance-log-display'

interface CreateAttendanceLogColumnsProps {
  onFilterByVerifyType?: (type: string) => void
  onFilterByDate?: (date: Date | undefined) => void
  currentVerifyTypeFilter?: string
  currentDateFilter?: Date
  showSequence?: boolean
  sequenceMap?: Map<number, number>
}

export function createAttendanceLogColumns({
  onFilterByVerifyType,
  onFilterByDate,
  currentVerifyTypeFilter,
  currentDateFilter,
  showSequence = false,
  sequenceMap = new Map(),
}: CreateAttendanceLogColumnsProps): ColumnDef<AttendanceLogEntry>[] {
  const cols: ColumnDef<AttendanceLogEntry>[] = []

  if (showSequence) {
    cols.push({
      id: 'seq',
      header: 'Seq #',
      cell: ({ row }) => {
        const seq = sequenceMap.get(row.original.id)
        if (!seq) return <span className="text-muted-foreground">—</span>
        const preview = erpPairingPreviewLabel(seq)
        return (
          <div className="flex flex-col gap-0.5">
            <span className="font-mono font-medium">{seq}</span>
            <Badge variant="outline" className="text-[10px] w-fit pointer-events-none">
              ERP {preview} (preview)
            </Badge>
          </div>
        )
      },
    })
  }

  cols.push(
    {
      id: 'check_time',
      accessorKey: 'check_time',
      header: onFilterByDate
        ? () => (
            <DateFilterHeader
              title="Check Time"
              currentFilter={currentDateFilter}
              onFilterChange={onFilterByDate}
            />
          )
        : 'Check Time',
      cell: ({ row }) => {
        const { date, time, timeZoneLabel } = formatCheckTimeForLog(
          row.getValue('check_time') as string,
          row.original.devices?.timezone,
          row.original.created_at
        )
        return (
          <div className="flex flex-col" title={`Device clock (${timeZoneLabel})`}>
            <span className="font-medium">{date}</span>
            <span className="text-sm text-muted-foreground">{time}</span>
          </div>
        )
      },
    },
    {
      id: 'location',
      accessorKey: 'device_sn',
      header: 'Location',
      cell: ({ row }) => {
        const device = row.original.devices
        const sn = row.original.device_sn
        const deviceName = device?.name || sn
        const deviceDisplay =
          device?.location && device?.location !== device?.name
            ? `${deviceName} (${device.location})`
            : deviceName
        return (
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Monitor className="h-4 w-4 text-primary" />
            </div>
            <div className="flex flex-col">
              <span className="font-medium flex items-center gap-1">
                {deviceDisplay}
                {device?.location && device?.location !== device?.name && (
                  <MapPin className="h-3 w-3 text-muted-foreground" />
                )}
              </span>
              <span className="text-sm text-muted-foreground font-mono">{sn}</span>
            </div>
          </div>
        )
      },
    },
    {
      id: 'user',
      header: 'User',
      cell: ({ row }) => {
        const pin = row.original.user_pin
        const user = row.original.users
        return (
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <KeyRound className="h-4 w-4 text-primary" />
            </div>
            <div className="flex flex-col">
              {user?.name ? (
                <>
                  <span className="font-medium">{user.name}</span>
                  <span className="text-sm text-muted-foreground">
                    {user.frappe_employee_id || `PIN: ${pin}`}
                  </span>
                </>
              ) : (
                <>
                  <code className="font-mono font-medium">{pin}</code>
                  <span className="text-xs text-amber-600">Unknown PIN</span>
                </>
              )}
            </div>
          </div>
        )
      },
    },
    {
      id: 'verify_type',
      accessorKey: 'verify_type',
      header: onFilterByVerifyType
        ? () => (
            <SelectFilterHeader
              title="Verify"
              options={[
                { value: '1', label: 'Fingerprint' },
                { value: '15', label: 'Face' },
                { value: '0', label: 'Password' },
              ]}
              currentFilter={currentVerifyTypeFilter}
              onFilterChange={onFilterByVerifyType}
            />
          )
        : 'Verify',
      cell: ({ row }) => {
        const type = row.getValue('verify_type') as number
        const config: Record<
          number,
          { label: string; className: string; icon: typeof KeyRound }
        > = {
          0: { label: 'Password', className: 'text-gray-600', icon: KeyRound },
          1: { label: 'Fingerprint', className: 'text-blue-700', icon: Fingerprint },
          15: { label: 'Face', className: 'text-purple-700', icon: ScanFace },
          255: { label: 'Other', className: 'text-slate-600', icon: KeyRound },
        }
        const { label, className, icon: Icon } = config[type] || config[255]
        return (
          <Badge variant="secondary" className={`${className} pointer-events-none`}>
            <Icon className="h-3 w-3 mr-1" />
            {label}
          </Badge>
        )
      },
    },
    {
      id: 'hr_sync',
      header: 'HR sync',
      cell: ({ row }) => {
        const log = row.original
        const status = (log.sync_status || 'PENDING').toUpperCase()
        const config: Record<string, { label: string; className: string; icon: typeof Clock }> =
          {
            SUCCESS: {
              label: 'Delivered',
              className: 'text-green-700',
              icon: CloudUpload,
            },
            FAILED: {
              label: 'Failed',
              className: 'text-destructive',
              icon: CloudOff,
            },
            PENDING: {
              label: 'Pending',
              className: 'text-amber-700',
              icon: Clock,
            },
          }
        const { label, className, icon: Icon } = config[status] || config.PENDING
        return (
          <div className="flex flex-col gap-0.5 max-w-[200px]">
            <Badge variant="secondary" className={`${className} w-fit pointer-events-none`}>
              <Icon className="h-3 w-3 mr-1" />
              {label}
            </Badge>
            {log.frappe_checkin_id && (
              <span className="text-[10px] text-muted-foreground font-mono truncate">
                {log.frappe_checkin_id}
              </span>
            )}
            {log.last_error_message && status === 'FAILED' && (
              <span className="text-[10px] text-destructive line-clamp-2">
                {log.last_error_message}
              </span>
            )}
          </div>
        )
      },
    },
    {
      id: 'suspicious',
      header: 'Suspicious',
      cell: ({ row }) => {
        const log = row.original
        if (!log.is_suspicious) {
          return <span className="text-muted-foreground text-sm">—</span>
        }
        const reason =
          log.suspicious_reason === 'multi_device_same_time'
            ? 'Same time, different device'
            : log.suspicious_reason === 'duplicate_punch_window'
              ? 'Duplicate within 10 min'
              : log.suspicious_reason || 'Flagged'
        return (
          <Badge variant="destructive" className="pointer-events-none gap-1">
            <AlertTriangle className="h-3 w-3" />
            {reason}
          </Badge>
        )
      },
    },
    {
      id: 'created_at',
      accessorKey: 'created_at',
      header: 'Ingested',
      cell: ({ row }) => {
        const { date, time } = formatIngestedTime(row.getValue('created_at') as string)
        return (
          <div
            className="flex flex-col text-sm text-muted-foreground"
            title="When the bridge stored this punch (your browser timezone — may differ from device check time if upload was delayed)"
          >
            <span>{date}</span>
            <span>{time}</span>
          </div>
        )
      },
    }
  )

  return cols
}
