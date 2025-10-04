/**
 * Platform Detection Utilities for Capacitor
 * Provides helpers to detect the current platform and conditionally execute code
 */

import { Capacitor } from '@capacitor/core';

/**
 * Check if the app is running as a native app (iOS, Android, or Electron)
 */
export const isNative = (): boolean => {
  return Capacitor.isNativePlatform();
};

/**
 * Check if the app is running in a web browser
 */
export const isWeb = (): boolean => {
  return Capacitor.getPlatform() === 'web';
};

/**
 * Check if the app is running on iOS (native or PWA)
 */
export const isIOS = (): boolean => {
  return Capacitor.getPlatform() === 'ios';
};

/**
 * Check if the app is running on Android (native or PWA)
 */
export const isAndroid = (): boolean => {
  return Capacitor.getPlatform() === 'android';
};

/**
 * Check if the app is running on Electron (desktop)
 */
export const isElectron = (): boolean => {
  return Capacitor.getPlatform() === 'electron';
};

/**
 * Check if the app is running on a mobile device (iOS or Android)
 */
export const isMobile = (): boolean => {
  return isIOS() || isAndroid();
};

/**
 * Check if the app is running on desktop (web or Electron)
 */
export const isDesktop = (): boolean => {
  return isElectron() || isWeb();
};

/**
 * Get the current platform name
 */
export const getPlatform = (): string => {
  return Capacitor.getPlatform();
};

/**
 * Check if a specific Capacitor plugin is available
 */
export const isPluginAvailable = (pluginName: string): boolean => {
  try {
    return Capacitor.isPluginAvailable(pluginName);
  } catch {
    return false;
  }
};

/**
 * Execute platform-specific code
 */
export const platformSwitch = <T>(options: {
  ios?: () => T;
  android?: () => T;
  electron?: () => T;
  web?: () => T;
  default?: () => T;
}): T | undefined => {
  const platform = getPlatform();

  if (platform === 'ios' && options.ios) {
    return options.ios();
  }
  if (platform === 'android' && options.android) {
    return options.android();
  }
  if (platform === 'electron' && options.electron) {
    return options.electron();
  }
  if (platform === 'web' && options.web) {
    return options.web();
  }
  if (options.default) {
    return options.default();
  }

  return undefined;
};

/**
 * Check if device supports biometric authentication
 */
export const supportsBiometrics = (): boolean => {
  return isNative() && isPluginAvailable('NativeBiometric');
};

/**
 * Check if device supports camera
 */
export const supportsCamera = (): boolean => {
  return isPluginAvailable('Camera');
};

/**
 * Check if device supports haptic feedback
 */
export const supportsHaptics = (): boolean => {
  return isPluginAvailable('Haptics');
};

/**
 * Check if device supports local notifications
 */
export const supportsLocalNotifications = (): boolean => {
  return isPluginAvailable('LocalNotifications');
};

/**
 * Get safe area insets for iOS notch/home indicator
 */
export const getSafeAreaInsets = (): {
  top: number;
  right: number;
  bottom: number;
  left: number;
} => {
  if (isIOS() && isNative()) {
    // In a real implementation, you might use SafeArea plugin
    // For now, return reasonable defaults
    return {
      top: 44,
      right: 0,
      bottom: 34,
      left: 0,
    };
  }

  return {
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  };
};

/**
 * Platform-specific class name generator
 */
export const platformClass = (base: string): string => {
  const platform = getPlatform();
  return `${base} ${base}--${platform}`;
};

export default {
  isNative,
  isWeb,
  isIOS,
  isAndroid,
  isElectron,
  isMobile,
  isDesktop,
  getPlatform,
  isPluginAvailable,
  platformSwitch,
  supportsBiometrics,
  supportsCamera,
  supportsHaptics,
  supportsLocalNotifications,
  getSafeAreaInsets,
  platformClass,
};


