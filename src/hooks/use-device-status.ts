import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface DeviceStatusEntry {
  serial_number: string
  name: string | null
  location: string | null
  last_seen: string | null
  status: 'online' | 'offline'
  last_seen_minutes: number | null
}

export interface DeviceStatusStats {
  totalDevices: number
  onlineDevices: number
  offlineDevices: number
}

export function useDeviceStatus() {
  return useQuery({
    queryKey: ['device-status'],
    queryFn: async (): Promise<DeviceStatusStats & { devices: DeviceStatusEntry[] }> => {
      const { data: devices, error } = await supabase
        .from('devices')
        .select('serial_number, name, location, last_seen')
        .order('last_seen', { ascending: false })

      if (error) {
        throw new Error(`Failed to fetch device status: ${error.message}`)
      }

      const now = Date.now()
const entries: DeviceStatusEntry[] = (devices || []).map(d => {
        const lastSeenMinutes = d.last_seen
          ? Math.floor((now - new Date(d.last_seen).getTime()) / 60000)
          : null

        return {
          serial_number: d.serial_number,
          name: d.name,
          location: d.location,
          last_seen: d.last_seen,
          status: lastSeenMinutes !== null && lastSeenMinutes < 1 ? 'online' : 'offline',
          last_seen_minutes: lastSeenMinutes,
        }
      })

      const onlineDevices = entries.filter(e => e.status === 'online').length
      const offlineDevices = entries.filter(e => e.status === 'offline').length

      return {
        totalDevices: entries.length,
        onlineDevices,
        offlineDevices,
        devices: entries,
      }
    },
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
    staleTime: 2000,
    retry: 3,
    retryDelay: 1000,
  })
}