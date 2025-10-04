/**
 * Biometric Authentication Service
 * Handles fingerprint and face ID authentication
 */

import { NativeBiometric, BiometryType, BiometricOptions } from 'capacitor-native-biometric';
import { supportsBiometrics, isNative } from '@/utils/platform';
import { hapticsSuccess, hapticsError } from '@/utils/haptics';

export interface BiometricAvailability {
  isAvailable: boolean;
  biometryType: BiometryType;
  hasEnrolledBiometrics: boolean;
}

export interface BiometricCredentials {
  username: string;
  password: string;
}

class BiometricService {
  private readonly SERVER_NAME = 'com.meditrax.app';

  /**
   * Check if biometric authentication is available
   */
  async isAvailable(): Promise<BiometricAvailability> {
    if (!isNative() || !supportsBiometrics()) {
      return {
        isAvailable: false,
        biometryType: BiometryType.NONE,
        hasEnrolledBiometrics: false,
      };
    }

    try {
      const result = await NativeBiometric.isAvailable();
      return {
        isAvailable: result.isAvailable,
        biometryType: result.biometryType,
        hasEnrolledBiometrics: result.isAvailable,
      };
    } catch (error) {
      console.error('Failed to check biometric availability:', error);
      return {
        isAvailable: false,
        biometryType: BiometryType.NONE,
        hasEnrolledBiometrics: false,
      };
    }
  }

  /**
   * Get friendly name for biometry type
   */
  getBiometryTypeName(type: BiometryType): string {
    switch (type) {
      case BiometryType.FACE_ID:
        return 'Face ID';
      case BiometryType.TOUCH_ID:
        return 'Touch ID';
      case BiometryType.FINGERPRINT:
        return 'Fingerprint';
      case BiometryType.FACE_AUTHENTICATION:
        return 'Face Authentication';
      case BiometryType.IRIS_AUTHENTICATION:
        return 'Iris Authentication';
      case BiometryType.MULTIPLE:
        return 'Multiple Biometric Options';
      default:
        return 'Biometric Authentication';
    }
  }

  /**
   * Authenticate user with biometrics
   */
  async authenticate(reason: string = 'Authenticate to access Meditrax'): Promise<boolean> {
    if (!isNative() || !supportsBiometrics()) {
      console.warn('Biometric authentication not available');
      return false;
    }

    try {
      const options: BiometricOptions = {
        reason,
        title: 'Meditrax Authentication',
        subtitle: 'Verify your identity',
        description: 'Use biometrics to unlock the app',
        negativeButtonText: 'Cancel',
        maxAttempts: 3,
        useFallback: true,
        fallbackTitle: 'Use PIN',
      };

      await NativeBiometric.verifyIdentity(options);
      
      // Success haptic feedback
      await hapticsSuccess();
      
      return true;
    } catch (error: any) {
      console.error('Biometric authentication failed:', error);
      
      // Error haptic feedback
      await hapticsError();
      
      // Check for specific error codes
      if (error.code === 10) {
        // User cancelled
        console.log('User cancelled biometric authentication');
      } else if (error.code === 13) {
        // Too many attempts
        console.log('Too many failed biometric attempts');
      }
      
      return false;
    }
  }

  /**
   * Save credentials securely with biometric protection
   */
  async saveCredentials(username: string, password: string): Promise<boolean> {
    if (!isNative() || !supportsBiometrics()) {
      console.warn('Biometric authentication not available');
      return false;
    }

    try {
      await NativeBiometric.setCredentials({
        username,
        password,
        server: this.SERVER_NAME,
      });

      return true;
    } catch (error) {
      console.error('Failed to save credentials:', error);
      return false;
    }
  }

  /**
   * Get saved credentials with biometric authentication
   */
  async getCredentials(reason: string = 'Authenticate to retrieve credentials'): Promise<BiometricCredentials | null> {
    if (!isNative() || !supportsBiometrics()) {
      console.warn('Biometric authentication not available');
      return null;
    }

    try {
      const credentials = await NativeBiometric.getCredentials({
        server: this.SERVER_NAME,
      });

      return {
        username: credentials.username,
        password: credentials.password,
      };
    } catch (error) {
      console.error('Failed to get credentials:', error);
      return null;
    }
  }

  /**
   * Delete saved credentials
   */
  async deleteCredentials(): Promise<boolean> {
    if (!isNative() || !supportsBiometrics()) {
      return false;
    }

    try {
      await NativeBiometric.deleteCredentials({
        server: this.SERVER_NAME,
      });

      return true;
    } catch (error) {
      console.error('Failed to delete credentials:', error);
      return false;
    }
  }

  /**
   * Authenticate for app unlock
   */
  async authenticateForUnlock(): Promise<boolean> {
    return this.authenticate('Unlock Meditrax to view your medications');
  }

  /**
   * Authenticate for sensitive action
   */
  async authenticateForAction(action: string): Promise<boolean> {
    return this.authenticate(`Authenticate to ${action}`);
  }

  /**
   * Check if credentials are saved
   */
  async hasStoredCredentials(): Promise<boolean> {
    if (!isNative() || !supportsBiometrics()) {
      return false;
    }

    try {
      const credentials = await NativeBiometric.getCredentials({
        server: this.SERVER_NAME,
      });

      return !!(credentials && credentials.username);
    } catch (error) {
      return false;
    }
  }

  /**
   * Setup biometric authentication for the first time
   */
  async setupBiometrics(username: string = 'user', password: string = 'meditrax_app_lock'): Promise<{
    success: boolean;
    message: string;
  }> {
    // Check availability
    const availability = await this.isAvailable();

    if (!availability.isAvailable) {
      return {
        success: false,
        message: 'Biometric authentication is not available on this device',
      };
    }

    if (!availability.hasEnrolledBiometrics) {
      return {
        success: false,
        message: 'No biometrics enrolled. Please set up biometrics in your device settings first.',
      };
    }

    // Test authentication
    const authenticated = await this.authenticate('Set up biometric authentication for Meditrax');

    if (!authenticated) {
      return {
        success: false,
        message: 'Biometric authentication failed. Please try again.',
      };
    }

    // Save credentials
    const saved = await this.saveCredentials(username, password);

    if (!saved) {
      return {
        success: false,
        message: 'Failed to save biometric credentials',
      };
    }

    return {
      success: true,
      message: `${this.getBiometryTypeName(availability.biometryType)} successfully set up`,
    };
  }

  /**
   * Disable biometric authentication
   */
  async disableBiometrics(): Promise<boolean> {
    return this.deleteCredentials();
  }

  /**
   * Get biometric status for UI display
   */
  async getStatus(): Promise<{
    available: boolean;
    enabled: boolean;
    type: string;
  }> {
    const availability = await this.isAvailable();
    const hasCredentials = await this.hasStoredCredentials();

    return {
      available: availability.isAvailable,
      enabled: hasCredentials,
      type: this.getBiometryTypeName(availability.biometryType),
    };
  }
}

export const biometricService = new BiometricService();
export default biometricService;


