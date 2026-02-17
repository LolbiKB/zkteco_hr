import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { DeviceService, type DeviceFilters } from '@/services/device-service'

/**
 * Hook to fetch devices with filters and pagination
 */
export function useDevices(filters: DeviceFilters = {}) {
  return useQuery({
    queryKey: ['devices', filters],
    queryFn: () => DeviceService.getDevices(filters),
  })
}

/**
 * Hook to set master device
 */
export function useSetMasterDevice() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (serialNumber: string) => DeviceService.setMasterDevice(serialNumber),
    onSuccess: () => {
      // Invalidate devices query to refetch data
      queryClient.invalidateQueries({ queryKey: ['devices'] })
    },
  })
}
