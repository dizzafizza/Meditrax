/**
 * Haptic Feedback Utilities
 * Provides haptic feedback for various user interactions
 */

import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { supportsHaptics } from './platform';

/**
 * Trigger a light impact haptic (for subtle feedback)
 */
export const hapticsLight = async (): Promise<void> => {
  if (!supportsHaptics()) return;
  
  try {
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch (error) {
    console.warn('Haptics light impact failed:', error);
  }
};

/**
 * Trigger a medium impact haptic (for standard interactions)
 */
export const hapticsMedium = async (): Promise<void> => {
  if (!supportsHaptics()) return;
  
  try {
    await Haptics.impact({ style: ImpactStyle.Medium });
  } catch (error) {
    console.warn('Haptics medium impact failed:', error);
  }
};

/**
 * Trigger a heavy impact haptic (for important actions)
 */
export const hapticsHeavy = async (): Promise<void> => {
  if (!supportsHaptics()) return;
  
  try {
    await Haptics.impact({ style: ImpactStyle.Heavy });
  } catch (error) {
    console.warn('Haptics heavy impact failed:', error);
  }
};

/**
 * Trigger a success notification haptic
 */
export const hapticsSuccess = async (): Promise<void> => {
  if (!supportsHaptics()) return;
  
  try {
    await Haptics.notification({ type: NotificationType.Success });
  } catch (error) {
    console.warn('Haptics success notification failed:', error);
  }
};

/**
 * Trigger a warning notification haptic
 */
export const hapticsWarning = async (): Promise<void> => {
  if (!supportsHaptics()) return;
  
  try {
    await Haptics.notification({ type: NotificationType.Warning });
  } catch (error) {
    console.warn('Haptics warning notification failed:', error);
  }
};

/**
 * Trigger an error notification haptic
 */
export const hapticsError = async (): Promise<void> => {
  if (!supportsHaptics()) return;
  
  try {
    await Haptics.notification({ type: NotificationType.Error });
  } catch (error) {
    console.warn('Haptics error notification failed:', error);
  }
};

/**
 * Trigger a selection change haptic (for sliders, pickers, etc.)
 */
export const hapticsSelection = async (): Promise<void> => {
  if (!supportsHaptics()) return;
  
  try {
    await Haptics.selectionStart();
    await Haptics.selectionChanged();
    await Haptics.selectionEnd();
  } catch (error) {
    console.warn('Haptics selection failed:', error);
  }
};

/**
 * Trigger a custom vibration pattern (in milliseconds)
 */
export const hapticsVibrate = async (duration: number = 200): Promise<void> => {
  if (!supportsHaptics()) return;
  
  try {
    await Haptics.vibrate({ duration });
  } catch (error) {
    console.warn('Haptics vibration failed:', error);
  }
};

/**
 * Context-specific haptic feedback helpers
 */
export const hapticsFeedback = {
  // Medication taken successfully
  medicationTaken: () => hapticsSuccess(),
  
  // Medication marked as missed
  medicationMissed: () => hapticsWarning(),
  
  // Medication deleted
  medicationDeleted: () => hapticsHeavy(),
  
  // Button press
  buttonPress: () => hapticsLight(),
  
  // Important button press (save, confirm)
  buttonPressImportant: () => hapticsMedium(),
  
  // Toggle switch
  toggleSwitch: () => hapticsLight(),
  
  // Form validation error
  validationError: () => hapticsError(),
  
  // Success action
  successAction: () => hapticsSuccess(),
  
  // Error action
  errorAction: () => hapticsError(),
  
  // Notification received
  notificationReceived: () => hapticsMedium(),
  
  // Scanning started
  scanningStarted: () => hapticsLight(),
  
  // Scanning success
  scanningSuccess: () => hapticsSuccess(),
  
  // Biometric authentication success
  biometricSuccess: () => hapticsSuccess(),
  
  // Biometric authentication failed
  biometricFailed: () => hapticsError(),
};

export default {
  light: hapticsLight,
  medium: hapticsMedium,
  heavy: hapticsHeavy,
  success: hapticsSuccess,
  warning: hapticsWarning,
  error: hapticsError,
  selection: hapticsSelection,
  vibrate: hapticsVibrate,
  feedback: hapticsFeedback,
};


