import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

const API_URL = import.meta.env.VITE_API_URL || ''

interface BranchOption {
  value: string
  label: string
}

export const frappeBranchKeys = {
  all: ['frappe-branches'] as const,
}

export function useFrappeBranches() {
  return useQuery({
    queryKey: frappeBranchKeys.all,
    queryFn: async (): Promise<BranchOption[]> => {
      const { data: { session } } = await supabase.auth.getSession()
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        ...(session?.access_token && { 'Authorization': `Bearer ${session.access_token}` }),
      }
      const response = await fetch(`${API_URL}/admin/frappe-branches`, { headers })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const result = await response.json()
      if (!result.success) throw new Error(result.error || 'Failed to fetch branches')
      return result.data
    },
    staleTime: 1000 * 60 * 60,
    gcTime: 1000 * 60 * 24,
  })
}