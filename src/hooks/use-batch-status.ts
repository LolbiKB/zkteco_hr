import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface BatchStatus {
  id: string
  user_id: string
  device_sn: string
  batch_type: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  success_mode: string
  commands_count: number
  completed_count: number
  failed_count: number
  created_at: string
  completed_at: string | null
  error_message: string | null
}

export function useLatestBatch(userId: string, deviceSn: string) {
  return useQuery({
    queryKey: ['batch', userId, deviceSn],
    queryFn: async () => {
      if (!userId || !deviceSn) return null
      
      const { data, error } = await supabase
        .from('sync_batches')
        .select('*')
        .eq('user_id', userId)
        .eq('device_sn', deviceSn)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
      
      if (error && error.code !== 'PGRST116') throw error
      return data as BatchStatus | null
    },
    enabled: !!userId && !!deviceSn,
    staleTime: 5000,
  })
}

export function useDeviceBatches(deviceSn: string) {
  return useQuery({
    queryKey: ['batches', deviceSn],
    queryFn: async () => {
      if (!deviceSn) return []
      
      // Get batches with actual command counts from batch_commands
      const { data: batches, error } = await supabase
        .from('sync_batches')
        .select('*')
        .eq('device_sn', deviceSn)
        .order('created_at', { ascending: false })
        .limit(20)
      
      if (error) throw error
      if (!batches) return []
      
      // Get command counts for each batch
      const batchIds = batches.map(b => b.id)
      const { data: batchCommands } = await supabase
        .from('batch_commands')
        .select('batch_id, completed, failed')
        .in('batch_id', batchIds)
      
      // Calculate actual counts per batch
      const commandCounts = new Map<string, { commands: number; completed: number; failed: number }>()
      for (const bc of (batchCommands || [])) {
        const current = commandCounts.get(bc.batch_id) || { commands: 0, completed: 0, failed: 0 }
        current.commands++
        if (bc.completed === true) current.completed++
        if (bc.failed === true) current.failed++
        commandCounts.set(bc.batch_id, current)
      }
      
      // Merge counts into batches
      return batches.map(batch => ({
        ...batch,
        commands_count: commandCounts.get(batch.id)?.commands || 0,
        completed_count: commandCounts.get(batch.id)?.completed || 0,
        failed_count: commandCounts.get(batch.id)?.failed || 0,
      })) as BatchStatus[]
    },
    enabled: !!deviceSn,
    staleTime: 5000,
  })
}