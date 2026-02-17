import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertTriangle, XCircle, CheckCircle2 } from 'lucide-react'

interface DeleteUserModalProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  userName: string
  canDelete: boolean
  deviceCount: number
  devices: Array<{ sn: string; name: string }>
  confirmText: string
  onConfirmTextChange: (text: string) => void
  onConfirmDelete: () => void
  onOpenSyncStatus: () => void
  isDeleting: boolean
}

export function DeleteUserModal({
  isOpen,
  onOpenChange,
  userName,
  canDelete,
  deviceCount,
  devices,
  confirmText,
  onConfirmTextChange,
  onConfirmDelete,
  onOpenSyncStatus,
  isDeleting
}: DeleteUserModalProps) {
  const isConfirmValid = confirmText === 'DELETE'

  if (!canDelete) {
    // Blocked delete modal - user still on devices
    return (
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              <DialogTitle>Cannot Delete User</DialogTitle>
            </div>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              <span className="font-medium">{userName}</span> still exists on {deviceCount} device{deviceCount !== 1 ? 's' : ''}:
            </p>

            <div className="border rounded-lg max-h-50 overflow-y-auto">
              <div className="divide-y">
                {devices.map((device) => (
                  <div
                    key={device.sn}
                    className="flex items-center gap-2 p-3"
                  >
                    <XCircle className="h-4 w-4 text-red-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">
                        {device.name}
                      </div>
                      <div className="font-mono text-xs text-muted-foreground truncate">
                        {device.sn}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <Alert>
              <AlertDescription>
                Remove the user from all devices before deleting from cloud.
              </AlertDescription>
            </Alert>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={onOpenSyncStatus}>
              Open Sync Status
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  // Allowed delete modal - user not on any device
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Delete {userName}?</DialogTitle>
          <DialogDescription>
            This action cannot be undone. This will permanently delete the user.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Alert className="border-green-500 bg-green-50">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-900">
              Not on any devices (safe to delete)
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <p className="text-sm font-medium">This will permanently delete:</p>
            <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
              <li>User profile and credentials</li>
              <li>Attendance history</li>
              <li>All biometric data (fingerprints & faces)</li>
            </ul>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">
              Type <span className="font-mono font-bold">DELETE</span> to confirm:
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => onConfirmTextChange(e.target.value)}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="DELETE"
              autoComplete="off"
              onPaste={(e) => e.preventDefault()}
              onCopy={(e) => e.preventDefault()}
              onCut={(e) => e.preventDefault()}
              onContextMenu={(e) => e.preventDefault()}
            />
            {confirmText && (
              <div className="flex items-center gap-1.5 text-xs">
                {isConfirmValid ? (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                    <span className="text-green-600">Confirmed</span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-3.5 w-3.5 text-red-600" />
                    <span className="text-red-600">Must type exactly "DELETE"</span>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={!isConfirmValid || isDeleting}
            onClick={onConfirmDelete}
          >
            {isDeleting ? 'Deleting...' : 'Delete User'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
