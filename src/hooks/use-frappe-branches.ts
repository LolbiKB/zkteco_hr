import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

const API_BASE_URL = import.meta.env.VITE_SUPABASE_URL + '/functions/v1'

interface FrappeBranchesResponse {
  branches: string[]
}

export const frappeBranchKeys = {
  all: ['frappe-branches'] as const,
}

export function useFrappeBranches() {
  return useQuery({
    queryKey: frappeBranchKeys.all,
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession()
      
      const response = await fetch(`${API_BASE_URL}/api-frappe-branches`, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || ''}`,
        },
      })

      if (!response.ok) {
        throw new Error('Failed to fetch branches')
      }

      const data: FrappeBranchesResponse = await response.json()
      
      // Transform to value/label format
      return (data.branches || []).map(branch => ({
        value: branch,
        label: branch,
      }))
    },
    staleTime: 1000 * 60 * 30, // 30 minutes - branches rarely change
    gcTime: 1000 * 60 * 60, // 1 hour
  })
}
