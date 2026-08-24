/**
 * Platform and Device Capabilities Utility for POS Web
 * Detects iOS (iPhone, iPad, iPod), Android, Web Bluetooth support, and Web Share.
 */

export interface PlatformCapabilities {
  isIOS: boolean;
  isAndroid: boolean;
  isMobile: boolean;
  isWebBluetoothSupported: boolean;
  isWebShareSupported: boolean;
  platformName: 'iOS' | 'Android' | 'Windows' | 'macOS' | 'Linux' | 'Other';
  browserName: string;
  recommendedPrintMethod: 'bluetooth' | 'airprint' | 'rawbt' | 'system';
}

/**
 * Check if current device is running iOS (iPhone, iPad, iPod)
 * Includes iPadOS 13+ which reports as Macintosh with multi-touch.
 */
export function isIOS(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;

  const ua = navigator.userAgent || '';
  const isStandardIOS = /iPad|iPhone|iPod/.test(ua);
  const isIPadOS = navigator.platform === 'MacIntel' && (navigator.maxTouchPoints || 0) > 1;

  return isStandardIOS || isIPadOS;
}

/**
 * Check if current device is running Android
 */
export function isAndroid(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  return /Android/.test(navigator.userAgent || '');
}

/**
 * Check if device is mobile or tablet
 */
export function isMobileDevice(): boolean {
  return isIOS() || isAndroid() || (typeof window !== 'undefined' && window.innerWidth < 768);
}

/**
 * Check if Web Bluetooth API is natively supported in the current browser
 */
export function isWebBluetoothSupported(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  return (
    'bluetooth' in navigator &&
    typeof (navigator as any).bluetooth?.requestDevice === 'function'
  );
}

/**
 * Check if Web Share API is supported (for sharing receipts on mobile)
 */
export function isWebShareSupported(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  return typeof navigator.share === 'function';
}

/**
 * Detect friendly browser name
 */
export function getBrowserName(): string {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return 'Unknown';
  const ua = navigator.userAgent;

  if (/Bluefy/i.test(ua)) return 'Bluefy (Web BLE)';
  if (/WebBLE/i.test(ua)) return 'WebBLE';
  if (/CriOS/i.test(ua)) return 'Chrome for iOS';
  if (/FxiOS/i.test(ua)) return 'Firefox for iOS';
  if (/EdgiOS/i.test(ua)) return 'Edge for iOS';
  if (/Chrome/i.test(ua) && !/Edg/i.test(ua)) return 'Google Chrome';
  if (/Edg/i.test(ua)) return 'Microsoft Edge';
  if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) return 'Safari';
  if (/Firefox/i.test(ua)) return 'Firefox';
  return 'Browser';
}

/**
 * Get comprehensive platform capabilities summary
 */
export function getPlatformCapabilities(): PlatformCapabilities {
  const ios = isIOS();
  const android = isAndroid();
  const mobile = isMobileDevice();
  const bluetooth = isWebBluetoothSupported();
  const share = isWebShareSupported();
  const browser = getBrowserName();

  let platformName: 'iOS' | 'Android' | 'Windows' | 'macOS' | 'Linux' | 'Other' = 'Other';
  if (ios) platformName = 'iOS';
  else if (android) platformName = 'Android';
  else if (typeof navigator !== 'undefined') {
    const ua = navigator.userAgent;
    if (/Windows/i.test(ua)) platformName = 'Windows';
    else if (/Macintosh|Mac OS X/i.test(ua)) platformName = 'macOS';
    else if (/Linux/i.test(ua)) platformName = 'Linux';
  }

  let recommendedPrintMethod: 'bluetooth' | 'airprint' | 'rawbt' | 'system' = 'system';
  if (bluetooth) {
    recommendedPrintMethod = 'bluetooth';
  } else if (ios) {
    recommendedPrintMethod = 'airprint';
  } else if (android) {
    recommendedPrintMethod = 'rawbt';
  }

  return {
    isIOS: ios,
    isAndroid: android,
    isMobile: mobile,
    isWebBluetoothSupported: bluetooth,
    isWebShareSupported: share,
    platformName,
    browserName: browser,
    recommendedPrintMethod,
  };
}
