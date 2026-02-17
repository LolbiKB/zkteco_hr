import { useState, useEffect, useMemo } from 'react'
import { BaseModal, ConfirmationDialog } from '@/components/ui/base-modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2 } from 'lucide-react'
import { UserService, API_BASE_URL } from '@/services/user-service'
import type { UserEntry } from '@/services/user-service'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

interface EditUserDialogProps {
  userId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

interface UserFormData {
  pin: string
  name: string
  card_number: string
  privilege: string
  notes: string
}

export function EditUserDialog({ userId, open, onOpenChange, onSuccess }: EditUserDialogProps) {
  const [formData, setFormData] = useState<UserFormData>({
    pin: '',
    name: '',
    card_number: '',
    privilege: '0',
    notes: '',
  })
  const [initialData, setInitialData] = useState<UserFormData>({
    pin: '',
    name: '',
    card_number: '',
    privilege: '0',
    notes: '',
  })
  const [isCheckingPin, setIsCheckingPin] = useState(false)
  const [pinError, setPinError] = useState('')
  const [showSaveConfirmation, setShowSaveConfirmation] = useState(false)
  const [showDiscardConfirmation, setShowDiscardConfirmation] = useState(false)
  const queryClient = useQueryClient()

  // Fetch user data
  const {
    data: user,
    isLoading: isFetchingUser,
    error: fetchError,
    refetch: refetchUser,
  } = useQuery<UserEntry>({
    queryKey: ['user', userId],
    queryFn: async () => {
      if (!userId) throw new Error('No user ID provided')
      const response = await fetch(
        `${API_BASE_URL}/api-users/${userId}`
      )
      const data = await response.json()
      if (!data.success) throw new Error(data.error || 'Failed to fetch user')
      return data.data
    },
    enabled: !!userId && open,
  })

  // Prevent stale data display
  const isCorrectUserLoaded = !userId || (user && user.id === userId)

  // Populate form when user data is loaded
  useEffect(() => {
    if (user && isCorrectUserLoaded) {
      const data = {
        pin: user.pin || '',
        name: user.name || '',
        card_number: user.card_number || '',
        privilege: (user.privilege ?? 0).toString(),
        notes: user.notes || '',
      }
      setFormData(data)
      setInitialData(data)
      setPinError('')
    }
  }, [user, isCorrectUserLoaded])

  // Track changes
  const hasChanges = useMemo(() => {
    return (
      formData.pin !== initialData.pin ||
      formData.name !== initialData.name ||
      formData.card_number !== initialData.card_number ||
      formData.privilege !== initialData.privilege ||
      formData.notes !== initialData.notes
    )
  }, [formData, initialData])

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error('No user ID')

      const response = await fetch(
        `${API_BASE_URL}/api-users/${userId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pin: formData.pin,
            name: formData.name,
            card_number: formData.card_number || null,
            privilege: parseInt(formData.privilege),
            notes: formData.notes || null,
          }),
        }
      )

      const data = await response.json()
      if (!data.success) {
        throw new Error(data.error || 'Failed to update user')
      }
      return data.data
    },
    onSuccess: () => {
      toast.success('User Updated', {
        description: 'User information has been updated successfully.',
      })

      // Invalidate queries to refresh the user list
      queryClient.invalidateQueries({ queryKey: ['users'] })
      queryClient.invalidateQueries({ queryKey: ['user', userId] })

      // Close modal
      onOpenChange(false)

      // Call success callback for parent to handle (e.g., refetch)
      onSuccess?.()
    },
    onError: (error: Error) => {
      toast.error('Update Failed', {
        description: error.message || 'Failed to update user',
      })
    },
  })

  // Validate PIN in real-time
  useEffect(() => {
    if (!formData.pin || formData.pin === initialData.pin) {
      setPinError('')
      return
    }

    // Check if PIN is numeric
    if (!/^\d+$/.test(formData.pin)) {
      setPinError('PIN must be numeric')
      return
    }

    // Check if PIN already exists
    const checkPin = async () => {
      setIsCheckingPin(true)
      try {
        const users = await UserService.listUsers()
        const exists = users.some(
          (u: UserEntry) => u.pin === formData.pin && u.id !== userId
        )

        if (exists) {
          setPinError('PIN already in use')
        } else {
          setPinError('')
        }
      } catch (error) {
        console.error('Failed to check PIN:', error)
      } finally {
        setIsCheckingPin(false)
      }
    }

    const debounce = setTimeout(checkPin, 300)
    return () => clearTimeout(debounce)
  }, [formData.pin, initialData.pin, userId])

  // Handle close with unsaved changes
  const handleCloseModal = () => {
    if (hasChanges && !updateMutation.isPending) {
      setShowDiscardConfirmation(true)
    } else {
      onOpenChange(false)
    }
  }

  // Handle discard confirmation
  const handleConfirmDiscard = () => {
    setShowDiscardConfirmation(false)
    setFormData(initialData)
    setPinError('')
    onOpenChange(false)
  }

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (pinError || !formData.pin || !formData.name || updateMutation.isPending) {
      return
    }
    setShowSaveConfirmation(true)
  }

  // Handle save confirmation
  const handleConfirmSave = () => {
    setShowSaveConfirmation(false)
    updateMutation.mutate()
  }

  const isLoading = isFetchingUser || isCheckingPin || updateMutation.isPending

  // Show loading state
  if (isFetchingUser && !isCorrectUserLoaded) {
    return (
      <BaseModal
        isOpen={open}
        onOpenChange={handleCloseModal}
        title="Loading..."
        footer={null}
      >
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </BaseModal>
    )
  }

  // Show error state with retry
  if (fetchError) {
    return (
      <BaseModal
        isOpen={open}
        onOpenChange={handleCloseModal}
        title="Error Loading User"
        footer={
          <>
            <Button variant="ghost" onClick={handleCloseModal}>
              Cancel
            </Button>
            <Button onClick={() => refetchUser()}>Retry</Button>
          </>
        }
      >
        <div className="text-center py-8">
          <p className="text-destructive mb-4">
            {fetchError.message || 'Failed to load user data'}
          </p>
        </div>
      </BaseModal>
    )
  }

  // Don't show form if wrong user data is loaded
  if (!isCorrectUserLoaded) {
    return null
  }

  return (
    <>
      <BaseModal
        isOpen={open}
        onOpenChange={handleCloseModal}
        title="Edit User"
        description="Update user information and sync to devices"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={handleCloseModal}
              disabled={updateMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              form="edit-user-form"
              type="submit"
              disabled={isLoading || !!pinError || !hasChanges}
            >
              {updateMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  Save Changes
                  {!hasChanges && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      (No Changes)
                    </span>
                  )}
                </>
              )}
            </Button>
          </>
        }
      >
        <form id="edit-user-form" onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="pin" className="text-sm font-medium">
              PIN <span className="text-destructive">*</span>
            </label>
            <Input
              id="pin"
              value={formData.pin}
              onChange={(e) =>
                setFormData({ ...formData, pin: e.target.value })
              }
              placeholder="Enter PIN"
              disabled={updateMutation.isPending}
            />
            {isCheckingPin && (
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Loader2 className="h-3 w-3 animate-spin" />
                Checking PIN...
              </p>
            )}
            {pinError && !isCheckingPin && (
              <p className="text-sm text-destructive">{pinError}</p>
            )}
            {!pinError && !isCheckingPin && formData.pin && formData.pin !== initialData.pin && (
              <p className="text-sm text-green-600">PIN is available</p>
            )}
          </div>

          <div className="space-y-2">
            <label htmlFor="name" className="text-sm font-medium">
              Name <span className="text-destructive">*</span>
            </label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              placeholder="Enter name"
              disabled={updateMutation.isPending}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="card_number" className="text-sm font-medium">Card Number</label>
            <Input
              id="card_number"
              value={formData.card_number}
              onChange={(e) =>
                setFormData({ ...formData, card_number: e.target.value })
              }
              placeholder="Enter card number"
              disabled={updateMutation.isPending}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="privilege" className="text-sm font-medium">Privilege Level</label>
            <Select
              value={formData.privilege}
              onValueChange={(value) =>
                setFormData({ ...formData, privilege: value })
              }
              disabled={updateMutation.isPending}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select privilege" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">User</SelectItem>
                <SelectItem value="14">Administrator</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              User: Regular attendance user | Administrator: Device admin access
            </p>
          </div>

          <div className="space-y-2">
            <label htmlFor="notes" className="text-sm font-medium">Notes</label>
            <textarea
              id="notes"
              className="flex min-h-16 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              value={formData.notes}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                setFormData({ ...formData, notes: e.target.value })
              }
              placeholder="Optional notes"
              rows={3}
              disabled={updateMutation.isPending}
            />
          </div>
        </form>
      </BaseModal>

      {/* Save Confirmation */}
      <ConfirmationDialog
        isOpen={showSaveConfirmation}
        title="Save Changes?"
        message="This will update the user information. Changes will need to be synced to devices separately."
        confirmLabel="Save"
        variant="default"
        onConfirm={handleConfirmSave}
        onCancel={() => setShowSaveConfirmation(false)}
      />

      {/* Discard Confirmation */}
      <ConfirmationDialog
        isOpen={showDiscardConfirmation}
        title="Discard Changes?"
        message="You have unsaved changes. Are you sure you want to discard them?"
        confirmLabel="Discard"
        cancelLabel="Keep Editing"
        variant="destructive"
        onConfirm={handleConfirmDiscard}
        onCancel={() => setShowDiscardConfirmation(false)}
      />
    </>
  )
}
