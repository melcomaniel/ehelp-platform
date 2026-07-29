const DEVICE_STORAGE_KEY = "ehelp_device_fingerprint"

export function getOrCreateDeviceFingerprint(): string {
  const existing = window.localStorage.getItem(DEVICE_STORAGE_KEY)
  if (existing) return existing

  const fingerprint = `web:${crypto.randomUUID()}`
  window.localStorage.setItem(DEVICE_STORAGE_KEY, fingerprint)
  return fingerprint
}
