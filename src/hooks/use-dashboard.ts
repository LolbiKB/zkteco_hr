import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useDeviceStatus } from './use-device-status'

interface DashboardStats {
  totalUsers: number
  registeredUsers: number
  onlineDevices: number
  totalDevices: number
  syncsToday: number
  attendanceToday: number
}

export function useDashboardStats() {
  // Use shared device status hook for real-time device counts
  const { data: deviceData } = useDeviceStatus()

  return useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: async (): Promise<DashboardStats> => {
      const now = new Date()
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()

      // Get total users from bridge
      const { count: totalUsers } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })

      // Get registered users (is_registered = true from Frappe merge)
      // Since we don't have is_registered in local DB, we'll count all users with pin
      const { count: registeredUsers } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .not('pin', 'is', null)

      // Get syncs today (successful commands)
      const { count: syncsToday } = await supabase
        .from('command_queue')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'success')
        .gte('completed_at', todayStart)

      // Get attendance logs today
      const { count: attendanceToday } = await supabase
        .from('attendance_logs')
        .select('*', { count: 'exact', head: true })
        .gte('check_time', todayStart)

      return {
        totalUsers: totalUsers || 0,
        registeredUsers: registeredUsers || 0,
        onlineDevices: deviceData?.onlineDevices ?? 0,
        totalDevices: deviceData?.totalDevices ?? 0,
        syncsToday: syncsToday || 0,
        attendanceToday: attendanceToday || 0,
      }
    },
    staleTime: 30000,
  })
}
