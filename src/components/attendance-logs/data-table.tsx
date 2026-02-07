import { Download } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import { Button } from '@/components/ui/button'
import {
  GenericDataTable,
  type BaseTableMeta,
} from '@/components/ui/generic-data-table'
import type {
  AttendanceLogEntry,
  AttendanceLogFilters,
} from '@/services/attendance-log-service'

interface AttendanceLogDataTableProps {
  columns: ColumnDef<AttendanceLogEntry, any>[]
  data: AttendanceLogEntry[]
  meta?: BaseTableMeta
  loading?: boolean
  isFetching?: boolean
  filters: AttendanceLogFilters
  onFiltersChange: (filters: AttendanceLogFilters) => void
  onRefresh?: () => void
  onExportLogs?: () => void
  isExporting?: boolean
}

export function AttendanceLogDataTable({
  columns,
  data,
  meta,
  loading,
  isFetching,
  filters,
  onFiltersChange,
  onRefresh,
  onExportLogs,
  isExporting = false,
}: AttendanceLogDataTableProps) {
  return (
    <GenericDataTable
      columns={columns}
      data={data}
      meta={meta}
      loading={loading || isFetching}
      filters={filters}
      onFiltersChange={onFiltersChange}
      config={{
        entityName: 'attendance logs',
        entityNameSingular: 'attendance log',
        searchPlaceholder: 'Search by user PIN or device...',
      }}
      actions={{
        onRefresh,
      }}
      toolbarActions={
        onExportLogs && (
          <Button
            variant="outline"
            onClick={onExportLogs}
            disabled={isExporting}
          >
            <Download className="mr-2 h-4 w-4" />
            {isExporting ? 'Exporting...' : 'Export CSV'}
          </Button>
        )
      }
    />
  )
}
