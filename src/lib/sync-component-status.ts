export type SyncComponent = 'user' | 'fingerprint' | 'face' | 'photo'

export type SyncComponentState =
  | 'not_enrolled'
  | 'pending'
  | 'syncing'
  | 'synced'
  | 'failed'

export interface SyncStatusRow {
  user_synced?: boolean
  fingerprint_synced?: boolean
  fingerprint_mask?: number
  face_synced?: boolean
  photo_synced?: boolean
  has_fingerprint?: boolean
  has_face?: boolean
  has_photo_in_db?: boolean
  has_fingerprint_in_db?: boolean
  actual_state?: string
  error_message?: string | null
}

export interface FingerprintBio {
  finger_id?: number | null
  type?: string
}

export interface GetComponentSyncOptions {
  hasActiveCommands?: boolean
  fingerprints?: FingerprintBio[]
  hasFaceInDb?: boolean
  hasPhotoInDb?: boolean
}

export const SYNC_COMPONENT_LABELS: Record<SyncComponentState, string> = {
  not_enrolled: 'Not enrolled',
  pending: 'Pending',
  syncing: 'Syncing',
  synced: 'Synced',
  failed: 'Failed',
}

function fingerprintExpectedMask(fingerprints: FingerprintBio[]): number {
  return fingerprints
    .filter((b) => b.type === 'fingerprint' || b.type === undefined)
    .reduce((mask, fp) => mask | (1 << (fp.finger_id || 0)), 0)
}

function hasFingerprintInCloud(
  status: SyncStatusRow,
  fingerprints: FingerprintBio[]
): boolean {
  const fpCount = fingerprints.filter(
    (b) => b.type === 'fingerprint' || b.type === undefined
  ).length
  return !!(status.has_fingerprint_in_db || status.has_fingerprint || fpCount > 0)
}

function hasFingerprintOnDeviceMask(status: SyncStatusRow): boolean {
  return (status.fingerprint_mask ?? 0) > 0
}

/** Cloud is source of truth; device mask alone is transient cleanup, not enrollment. */
function hasFingerprintInCloudOnly(
  status: SyncStatusRow,
  fingerprints: FingerprintBio[]
): boolean {
  return hasFingerprintInCloud(status, fingerprints)
}

function isDeviceCleanupInProgress(
  status: SyncStatusRow,
  hasActiveCommands: boolean
): boolean {
  return (
    hasActiveCommands ||
    status.actual_state === 'syncing' ||
    status.actual_state === 'cleaning'
  )
}

function deviceCleanupSyncState(
  status: SyncStatusRow,
  hasActiveCommands: boolean
): SyncComponentState {
  return isDeviceCleanupInProgress(status, hasActiveCommands) ? 'syncing' : 'pending'
}

function isFingerprintComponentApplicable(
  status: SyncStatusRow,
  fingerprints: FingerprintBio[]
): boolean {
  return (
    hasFingerprintInCloudOnly(status, fingerprints) ||
    hasFingerprintOnDeviceMask(status)
  )
}

function hasFaceInCloud(
  status: SyncStatusRow,
  hasFaceInDb?: boolean
): boolean {
  return !!(hasFaceInDb ?? status.has_face)
}

function hasPhotoInCloud(
  status: SyncStatusRow,
  hasPhotoInDb?: boolean
): boolean {
  return !!(hasPhotoInDb ?? status.has_photo_in_db)
}

export function isComponentApplicable(
  component: SyncComponent,
  status: SyncStatusRow,
  options: GetComponentSyncOptions = {}
): boolean {
  const { fingerprints = [], hasFaceInDb, hasPhotoInDb } = options

  switch (component) {
    case 'user':
      return true
    case 'fingerprint':
      return isFingerprintComponentApplicable(status, fingerprints)
    case 'face':
      return hasFaceInCloud(status, hasFaceInDb) || !!status.face_synced
    case 'photo':
      return hasPhotoInCloud(status, hasPhotoInDb) || !!status.photo_synced
    default:
      return false
  }
}

export function getComponentSyncStatus(
  component: SyncComponent,
  status: SyncStatusRow,
  options: GetComponentSyncOptions = {}
): { state: SyncComponentState; label: string; isApplicable: boolean } {
  const { hasActiveCommands = false, fingerprints = [] } = options

  const applicable = isComponentApplicable(component, status, options)
  if (!applicable) {
    return {
      state: 'not_enrolled',
      label: SYNC_COMPONENT_LABELS.not_enrolled,
      isApplicable: false,
    }
  }

  if (status.actual_state === 'not_synced' && status.error_message) {
    return {
      state: 'failed',
      label: SYNC_COMPONENT_LABELS.failed,
      isApplicable: true,
    }
  }

  if (component === 'fingerprint') {
    const fpList = fingerprints.filter(
      (b) => b.type === 'fingerprint' || b.type === undefined
    )
    const fpCount = fpList.length
    const inCloud = hasFingerprintInCloudOnly(status, fingerprints)
    const deviceMask = status.fingerprint_mask ?? 0

    // Cloud empty but device still has templates — cleanup in progress, not a steady state
    if (fpCount === 0 && deviceMask > 0) {
      const state = deviceCleanupSyncState(status, hasActiveCommands)
      return { state, label: SYNC_COMPONENT_LABELS[state], isApplicable: true }
    }

    if (fpCount === 0 && deviceMask === 0) {
      return {
        state: 'not_enrolled',
        label: SYNC_COMPONENT_LABELS.not_enrolled,
        isApplicable: false,
      }
    }

    const expectedMask = fingerprintExpectedMask(fpList)
    const hasExpectedOnDevice = (deviceMask & expectedMask) === expectedMask
    const maskMatchesExactly = deviceMask === expectedMask

    if (maskMatchesExactly && inCloud) {
      return {
        state: 'synced',
        label: SYNC_COMPONENT_LABELS.synced,
        isApplicable: true,
      }
    }

    if (hasExpectedOnDevice && !maskMatchesExactly) {
      const state = deviceCleanupSyncState(status, hasActiveCommands)
      return { state, label: SYNC_COMPONENT_LABELS[state], isApplicable: true }
    }

    const state = deviceCleanupSyncState(status, hasActiveCommands)
    return { state, label: SYNC_COMPONENT_LABELS[state], isApplicable: true }
  }

  if (component === 'face') {
    const inCloud = hasFaceInCloud(status, options.hasFaceInDb)
    if (!inCloud && status.face_synced) {
      const state = deviceCleanupSyncState(status, hasActiveCommands)
      return { state, label: SYNC_COMPONENT_LABELS[state], isApplicable: true }
    }
  }

  if (component === 'photo') {
    const inCloud = hasPhotoInCloud(status, options.hasPhotoInDb)
    if (!inCloud && status.photo_synced) {
      const state = deviceCleanupSyncState(status, hasActiveCommands)
      return { state, label: SYNC_COMPONENT_LABELS[state], isApplicable: true }
    }
  }

  const fieldMap: Record<Exclude<SyncComponent, 'fingerprint'>, keyof SyncStatusRow> = {
    user: 'user_synced',
    face: 'face_synced',
    photo: 'photo_synced',
  }

  const field = fieldMap[component as Exclude<SyncComponent, 'fingerprint'>]
  if (status[field]) {
    return {
      state: 'synced',
      label: SYNC_COMPONENT_LABELS.synced,
      isApplicable: true,
    }
  }

  const state = deviceCleanupSyncState(status, hasActiveCommands)
  return { state, label: SYNC_COMPONENT_LABELS[state], isApplicable: true }
}

/** Counts toward "fully synced" aggregate — only cloud-synced or N/A. */
export function isComponentSatisfiedForAggregate(state: SyncComponentState): boolean {
  return state === 'synced' || state === 'not_enrolled'
}

export function isDeviceAllComponentsSynced(
  status: SyncStatusRow,
  options: GetComponentSyncOptions = {}
): boolean {
  const components: SyncComponent[] = ['user', 'fingerprint', 'face', 'photo']
  return components.every((c) => {
    const { state } = getComponentSyncStatus(c, status, options)
    return isComponentSatisfiedForAggregate(state)
  })
}

export function syncComponentTileClass(state: SyncComponentState): string {
  switch (state) {
    case 'synced':
      return 'bg-green-50 border border-green-200 dark:bg-green-950/30 dark:border-green-800'
    case 'syncing':
      return 'bg-blue-50 border border-blue-200 dark:bg-blue-950/30 dark:border-blue-800'
    case 'pending':
      return 'bg-amber-50 border border-amber-200 dark:bg-amber-950/30 dark:border-amber-800'
    case 'failed':
      return 'bg-red-50 border border-red-200 dark:bg-red-950/30 dark:border-red-800'
    default:
      return 'bg-gray-50 dark:bg-muted/30'
  }
}
