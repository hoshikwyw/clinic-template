/**
 * native — wrappers around Capacitor plugins (push, camera, storage, biometrics).
 *
 * Only the Patient/Staff app is wrapped into Android by Capacitor. Native
 * features go through THIS interface so the web build degrades gracefully
 * (e.g. web-push instead of native push) and we are never locked into Capacitor.
 *
 * See docs/05-web-mobile-strategy.md ("Vendor wrapping").
 * NOTE: Phase 0 stub.
 */

export function isNativePlatform(): boolean {
  // Capacitor.isNativePlatform() once @capacitor/core is wired
  return false;
}

export async function registerPushNotifications(): Promise<void> {
  // native push on Android via Capacitor; web-push fallback on browser
  throw new Error("registerPushNotifications: not implemented");
}
