import { format, parseISO } from 'date-fns'
import type { ColumnDef } from '@tanstack/react-table'
import {
  SelectFilterHeader,
  DateFilterHeader,
  TwoLineTextCell,
  BadgeCell,
} from '@/components/ui/table-components'
import type { AttendanceLogEntry } from '@/services/attendance-log-service'

interface CreateAttendanceLogColumnsProps {
  onFilterByDevice?: (device: string) => void
  onFilterByStatus?: (status: string) => void
  onFilterByVerifyType?: (type: string) => void
  onFilterByDate?: (date: Date | undefined) => void
  currentDeviceFilter?: string
  currentStatusFilter?: string
  currentVerifyTypeFilter?: string
  currentDateFilter?: Date
  availableDevices?: Array<{ value: string; label: string }>
}

// Verify type mapping
const VERIFY_TYPES: Record<number, { label: string; variant: 'default' | 'secondary' }> = {
  0: { label: 'Password', variant: 'secondary' },
  1: { label: 'Fingerprint', variant: 'default' },
  15: { label: 'Face', variant: 'default' },
  255: { label: 'Other', variant: 'secondary' },
}

// Status mapping
const STATUS_TYPES: Record<number, { label: string; variant: 'default' | 'secondary' | 'destructive' }> = {
  0: { label: 'Check-In', variant: 'default' },
  1: { label: 'Check-Out', variant: 'secondary' },
  255: { label: 'Unknown', variant: 'destructive' },
}

export function createAttendanceLogColumns({
  onFilterByDevice,
  onFilterByStatus,
  onFilterByVerifyType,
  onFilterByDate,
  currentDeviceFilter,
  currentStatusFilter,
  currentVerifyTypeFilter,
  currentDateFilter,
  availableDevices = [],
}: CreateAttendanceLogColumnsProps): ColumnDef<AttendanceLogEntry>[] {
  return [
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
        const timestamp = parseISO(row.getValue('check_time'))
        return (
          <div className="py-2">
            <TwoLineTextCell
              mainText={format(timestamp, 'MMM d, yyyy')}
              secondaryText={format(timestamp, 'h:mm a')}
              mainClassName="font-medium"
            />
          </div>
        )
      },
    },
    {
      id: 'device_sn',
      accessorKey: 'device_sn',
      header: onFilterByDevice && availableDevices.length > 0
        ? () => (
          <SelectFilterHeader
            title="Device"
            options={availableDevices}
            currentFilter={currentDeviceFilter}
            onFilterChange={onFilterByDevice}
          />
        )
        : 'Device',
      cell: ({ row }) => {
        const device = row.original.devices
        return (
          <div className="py-2 space-y-1">
            <div className="font-mono text-sm font-medium">{row.getValue('device_sn')}</div>
            {device?.name && (
              <div className="text-sm text-muted-foreground">{device.name}</div>
            )}
            {device?.location && (
              <div className="text-xs text-muted-foreground">{device.location}</div>
            )}
          </div>
        )
      },
    },
    {
      id: 'user_pin',
      accessorKey: 'user_pin',
      header: 'User PIN',
      cell: ({ row }) => (
        <div className="py-2">
          <span className="font-semibold text-base">{row.getValue('user_pin')}</span>
        </div>
      ),
    },
    {
      id: 'verify_type',
      accessorKey: 'verify_type',
      header: onFilterByVerifyType
        ? () => (
          <SelectFilterHeader
            title="Verify Type"
            options={[
              { value: '1', label: 'Fingerprint' },
              { value: '15', label: 'Face' },
              { value: '0', label: 'Password' },
            ]}
            currentFilter={currentVerifyTypeFilter}
            onFilterChange={onFilterByVerifyType}
          />
        )
        : 'Verify Type',
      cell: ({ row }) => {
        const type = row.getValue('verify_type') as number
        const config = VERIFY_TYPES[type] || { label: `Type ${type}`, variant: 'secondary' as const }
        return (
          <div className="py-2">
            <BadgeCell text={config.label} variant={config.variant} />
          </div>
        )
      },
    },
    {
      id: 'status',
      accessorKey: 'status',
      header: onFilterByStatus
        ? () => (
          <SelectFilterHeader
            title="Status"
            options={[
              { value: '0', label: 'Check-In' },
              { value: '1', label: 'Check-Out' },
              { value: '255', label: 'Unknown' },
            ]}
            currentFilter={currentStatusFilter}
            onFilterChange={onFilterByStatus}
          />
        )
        : 'Status',
      cell: ({ row }) => {
        const status = row.getValue('status') as number
        const config = STATUS_TYPES[status] || { label: `Status ${status}`, variant: 'secondary' as const }
        return (
          <div className="py-2">
            <BadgeCell text={config.label} variant={config.variant} />
          </div>
        )
      },
    },
  ]
}
