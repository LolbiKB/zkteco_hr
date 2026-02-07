import type { BaseFilters } from '@/components/ui/generic-data-table'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'

// Attendance Log Filters
export interface AttendanceLogFilters extends BaseFilters {
  device_sn?: string
  user_pin?: string
  status?: number
  verify_type?: number
  dateFrom?: string // ISO format
  dateTo?: string // ISO format
}

// Attendance Log Entry (matches database schema)
export interface AttendanceLogEntry {
  id: number
  device_sn: string
  user_pin: string
  check_time: string // ISO timestamp
  status: number
  verify_type: number
  raw_data: string
  created_at: string
  // Joined data (if available)
  devices?: {
    serial_number: string
    name?: string
    location?: string
  }
}

// API Response
export interface AttendanceLogsResponse {
  success: boolean
  data: AttendanceLogEntry[]
  meta: {
    total: number
    page: number
    limit: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
}

/**
 * Build query string from filters
 */
function buildQueryString(filters: AttendanceLogFilters): string {
  const params = new URLSearchParams()

  if (filters.page) params.append('page', filters.page.toString())
  if (filters.limit) params.append('limit', filters.limit.toString())
  if (filters.sort) params.append('sort', filters.sort)
  if (filters.order) params.append('order', filters.order)
  if (filters.search) params.append('search', filters.search)
  if (filters.device_sn) params.append('device_sn', filters.device_sn)
  if (filters.user_pin) params.append('user_pin', filters.user_pin)
  if (filters.status !== undefined) params.append('status', filters.status.toString())
  if (filters.verify_type !== undefined) params.append('verify_type', filters.verify_type.toString())
  if (filters.dateFrom) params.append('dateFrom', filters.dateFrom)
  if (filters.dateTo) params.append('dateTo', filters.dateTo)

  return params.toString()
}

/**
 * Get auth headers for API requests
 */
function getAuthHeaders(): HeadersInit {
  return {
    'Content-Type': 'application/json',
  }
}

/**
 * Handle API response with error checking
 */
async function handleApiResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({
      message: 'An error occurred while fetching data'
    }))
    throw new Error(error.message || `HTTP ${response.status}: ${response.statusText}`)
  }

  return response.json()
}

/**
 * Fetch attendance logs from API
 */
export async function fetchAttendanceLogs(
  filters: AttendanceLogFilters
): Promise<AttendanceLogsResponse> {
  const queryString = buildQueryString(filters)
  const response = await fetch(`${API_BASE_URL}/api-attendance-logs?${queryString}`, {
    headers: getAuthHeaders(),
  })

  return handleApiResponse<AttendanceLogsResponse>(response)
}

/**
 * Export attendance logs as CSV
 */
export async function exportAttendanceLogs(
  filters: AttendanceLogFilters
): Promise<Blob> {
  const queryString = buildQueryString(filters)
  const response = await fetch(`${API_BASE_URL}/api-attendance-logs/export?${queryString}`, {
    headers: {
      ...getAuthHeaders(),
      'Accept': 'text/csv',
    },
  })

  if (!response.ok) {
    throw new Error(`Export failed: ${response.statusText}`)
  }

  return response.blob()
}
