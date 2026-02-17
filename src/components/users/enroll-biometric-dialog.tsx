import { useState, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Fingerprint,
  ScanFace,
  Loader2,
  Wifi,
  WifiOff,
} from 'lucide-react'
import { useUserBiometrics, useSyncStatus, useStartEnrollment } from '@/hooks/use-users'
import type { UserEntry } from '@/services/user-service'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface EnrollBiometricDialogProps {
  user: UserEntry | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function EnrollBiometricDialog({
  user,
  open,
  onOpenChange,
}: EnrollBiometricDialogProps) {
  const { data: bioData, isLoading: bioLoading } = useUserBiometrics(user?.id || '')
  const { data: syncData } = useSyncStatus(user?.id || '')
  const startEnrollment = useStartEnrollment()

  const [biometricType, setBiometricType] = useState<'fingerprint' | 'face'>('fingerprint')
  const [deviceSn, setDeviceSn] = useState<string>('')

  const biometrics = bioData?.data || []
  const syncStatus = syncData?.data || []

  const onlineDevices = useMemo(
    () => syncStatus.filter((s) => s.is_online),
    [syncStatus],
  )

  const hasFingerprint = biometrics.some((b) => b.type === 'fingerprint')
  const hasFace = biometrics.some((b) => b.type === 'face')

  const handleStartEnrollment = () => {
    if (!user?.id || !deviceSn) return
    startEnrollment.mutate(
      {
        userId: user.id,
        deviceSn,
        biometricType,
        fingerId: biometricType === 'fingerprint' ? 0 : undefined,
      },
      { onSuccess: () => { } },
    )
  }

  if (!user) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Enroll Biometric</DialogTitle>
          <DialogDescription>
            {user.name} (PIN: {user.pin})
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* ── Current biometrics ── */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Current Biometrics</h4>

            {bioLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Fingerprint className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Fingerprint</span>
                  <Badge
                    variant="outline"
                    className={cn(
                      'h-5 px-1.5 text-[10px]',
                      hasFingerprint && 'bg-green-50 text-green-700 border-green-200',
                    )}
                  >
                    {hasFingerprint ? 'Enrolled' : 'Not enrolled'}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <ScanFace className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Face</span>
                  <Badge
                    variant="outline"
                    className={cn(
                      'h-5 px-1.5 text-[10px]',
                      hasFace && 'bg-green-50 text-green-700 border-green-200',
                    )}
                  >
                    {hasFace ? 'Enrolled' : 'Not enrolled'}
                  </Badge>
                </div>
              </div>
            )}
          </div>

          {/* ── Enrollment form ── */}
          <div className="space-y-4 border-t pt-4">
            <h4 className="text-sm font-medium">New Enrollment</h4>

            {/* Biometric Type */}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setBiometricType('fingerprint')}
                className={cn(
                  'flex items-center gap-2 rounded-lg border p-3 transition-all text-left',
                  biometricType === 'fingerprint'
                    ? 'border-primary bg-primary/5 ring-1 ring-primary'
                    : 'border-border hover:border-muted-foreground/30',
                )}
              >
                <Fingerprint className="h-5 w-5 shrink-0" />
                <div>
                  <div className="text-sm font-medium">Fingerprint</div>
                  <div className="text-[10px] text-muted-foreground">
                    {hasFingerprint ? 'Enrolled' : 'Not enrolled'}
                  </div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setBiometricType('face')}
                className={cn(
                  'flex items-center gap-2 rounded-lg border p-3 transition-all text-left',
                  biometricType === 'face'
                    ? 'border-primary bg-primary/5 ring-1 ring-primary'
                    : 'border-border hover:border-muted-foreground/30',
                )}
              >
                <ScanFace className="h-5 w-5 shrink-0" />
                <div>
                  <div className="text-sm font-medium">Face</div>
                  <div className="text-[10px] text-muted-foreground">
                    {hasFace ? 'Enrolled' : 'Not enrolled'}
                  </div>
                </div>
              </button>
            </div>

            {/* Overwrite warning */}
            {((biometricType === 'fingerprint' && hasFingerprint) ||
              (biometricType === 'face' && hasFace)) && (
                <p className="text-[11px] text-yellow-600">
                  Already enrolled — re-enrolling will overwrite the existing {biometricType}.
                </p>
              )}

            {/* Device selection */}
            <div className="space-y-1.5">
              <Label className="text-xs">Device</Label>
              {onlineDevices.length === 0 ? (
                <div className="flex items-center gap-2 rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                  <WifiOff className="h-4 w-4" />
                  No online devices available
                </div>
              ) : (
                <Select value={deviceSn} onValueChange={setDeviceSn}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Select a device…" />
                  </SelectTrigger>
                  <SelectContent>
                    {onlineDevices.map((s) => (
                      <SelectItem key={s.device_sn} value={s.device_sn}>
                        <span className="flex items-center gap-2">
                          <Wifi className="h-3 w-3 text-green-600" />
                          {s.devices?.name || s.device_sn}
                          <span className="text-muted-foreground text-[10px]">
                            {s.devices?.name ? s.device_sn : ''}
                          </span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Enrollment info */}
            <div className="rounded-md bg-muted/40 p-3 text-xs text-muted-foreground space-y-1">
              <p>
                <strong>How it works:</strong> A command will be sent to the device.
                When the device picks it up, it will prompt the user to{' '}
                {biometricType === 'fingerprint' ? 'place their finger on the sensor' : 'look at the camera'}.
              </p>
              <p>
                The user must be physically at the device for enrollment to succeed.
              </p>
            </div>
          </div>

          {/* ── Action ── */}
          <div className="flex justify-end gap-2 border-t pt-4">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <Button
              onClick={handleStartEnrollment}
              disabled={!deviceSn || startEnrollment.isPending || onlineDevices.length === 0}
            >
              {startEnrollment.isPending && (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              )}
              Start Enrollment
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
