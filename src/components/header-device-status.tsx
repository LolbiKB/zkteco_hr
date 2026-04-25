import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useDeviceStatus } from '@/hooks/use-device-status'
import { Wifi, WifiOff, RefreshCw } from 'lucide-react'
import { useNavigate } from 'react-router'

export function HeaderDeviceStatus() {
  const navigate = useNavigate()
  const { data, isFetching } = useDeviceStatus()

  const online = data?.onlineDevices ?? 0
  const total = data?.totalDevices ?? 0

  const handleClick = () => {
    navigate('/devices')
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={handleClick}
            className="flex items-center gap-2 group"
            disabled={isFetching}
          >
            <span className="flex items-center gap-1">
              {/* Online count */}
              <span className="text-green-500 font-medium">{online}</span>
              <span className="text-muted-foreground">/</span>
              <span className="text-muted-foreground">{total}</span>
            </span>
            <RefreshCw className={`h-3 w-3 text-muted-foreground ${isFetching ? 'animate-spin' : ''}`} />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          <div className="space-y-1 min-w-[150px]">
            <p className="font-medium flex items-center gap-1">
              <Wifi className="h-3 w-3 text-green-500" /> Devices Online
            </p>
            <div className="border-t pt-1">
              {data?.devices?.length === 0 && (
                <p className="text-muted-foreground">No devices registered</p>
              )}
              {data?.devices?.slice(0, 10).map(d => (
                <div key={d.serial_number} className="flex items-center justify-between gap-2 py-0.5">
                  <span className="truncate max-w-[100px] text-muted-foreground">
                    {d.name || d.serial_number}
                  </span>
                  {d.status === 'online' ? (
                    <Wifi className="h-3 w-3 text-green-500" />
                  ) : (
                    <WifiOff className="h-3 w-3 text-muted-foreground" />
                  )}
                </div>
              ))}
              {data && data.devices.length > 10 && (
                <p className="text-muted-foreground text-[10px] pt-1">
                  +{data.devices.length - 10} more
                </p>
              )}
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}