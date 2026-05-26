import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { addDays, format } from 'date-fns'

export interface DeviceAttlogClosureRow {
  device_sn: string
  local_date: string
  status: string
  device_sum: number | null
  server_sum: number | null
  attempt_count: number
  last_error: string | null
  closed_at: string | null
}

/** Map device_sn → yesterday closure status for Devices table badges */
export function useYesterdayAttlogClosure() {
  const yesterday = format(addDays(new Date(), -1), 'yyyy-MM-dd')

  return useQuery({
    queryKey: ['attlog-closure', 'yesterday', yesterday] as const,
    queryFn: async (): Promise<Map<string, DeviceAttlogClosureRow>> => {
      const { data, error } = await supabase
        .from('device_attlog_closure')
        .select(
          'device_sn, local_date, status, device_sum, server_sum, attempt_count, last_error, closed_at'
        )
        .eq('local_date', yesterday)

      if (error) throw new Error(error.message)

      const map = new Map<string, DeviceAttlogClosureRow>()
      for (const row of data || []) {
        map.set(row.device_sn, row as DeviceAttlogClosureRow)
      }
      return map
    },
    staleTime: 60_000,
    refetchInterval: 120_000,
  })
}
