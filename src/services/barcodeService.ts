/**
 * Barcode Scanning Service
 * Handles barcode and QR code scanning for medication identification
 */

import { BarcodeScanner, BarcodeFormat } from '@capacitor-mlkit/barcode-scanning';
import { isNative, isPluginAvailable } from '@/utils/platform';
import { hapticsSuccess, hapticsLight } from '@/utils/haptics';

export interface ScannedBarcode {
  rawValue: string;
  format: string;
  displayValue: string;
  cornerPoints?: Array<{ x: number; y: number }>;
}

class BarcodeService {
  private isScanning = false;

  /**
   * Check if barcode scanning is available on this device
   */
  async isScanningAvailable(): Promise<boolean> {
    if (!isNative()) {
      return false;
    }

    try {
      const result = await BarcodeScanner.isSupported();
      return result.supported;
    } catch (error) {
      console.warn('Barcode scanning check failed:', error);
      return false;
    }
  }

  /**
   * Check if Google Barcode Scanner module is available
   */
  async isGoogleBarcodeScannerModuleAvailable(): Promise<boolean> {
    if (!isNative()) {
      return false;
    }

    try {
      const result = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable();
      return result.available;
    } catch (error) {
      console.warn('Google Barcode Scanner module check failed:', error);
      return false;
    }
  }

  /**
   * Install Google Barcode Scanner module if needed
   */
  async installGoogleBarcodeScannerModule(): Promise<void> {
    if (!isNative()) {
      return;
    }

    try {
      await BarcodeScanner.installGoogleBarcodeScannerModule();
    } catch (error) {
      console.error('Failed to install Google Barcode Scanner module:', error);
      throw error;
    }
  }

  /**
   * Request camera permissions for barcode scanning
   */
  async requestPermissions(): Promise<boolean> {
    if (!isNative()) {
      console.warn('Barcode scanning not supported on web platform');
      return false;
    }

    try {
      const result = await BarcodeScanner.requestPermissions();
      return result.camera === 'granted';
    } catch (error) {
      console.error('Failed to request barcode scanner permissions:', error);
      return false;
    }
  }

  /**
   * Check camera permissions
   */
  async checkPermissions(): Promise<{ camera: string }> {
    if (!isNative()) {
      return { camera: 'denied' };
    }

    try {
      const result = await BarcodeScanner.checkPermissions();
      return { camera: result.camera };
    } catch (error) {
      console.error('Failed to check barcode scanner permissions:', error);
      return { camera: 'denied' };
    }
  }

  /**
   * Scan a barcode or QR code
   */
  async scan(): Promise<ScannedBarcode | null> {
    if (this.isScanning) {
      console.warn('Scan already in progress');
      return null;
    }

    if (!isNative()) {
      console.warn('Barcode scanning not supported on web platform');
      return null;
    }

    try {
      this.isScanning = true;

      // Haptic feedback when starting scan
      await hapticsLight();

      // Start scanning
      const result = await BarcodeScanner.scan({
        formats: [
          BarcodeFormat.QrCode,
          BarcodeFormat.Code128,
          BarcodeFormat.Code39,
          BarcodeFormat.Code93,
          BarcodeFormat.Ean13,
          BarcodeFormat.Ean8,
          BarcodeFormat.Upc a,
          BarcodeFormat.UpcE,
        ],
      });

      if (result.barcodes && result.barcodes.length > 0) {
        const barcode = result.barcodes[0];
        
        // Haptic feedback on successful scan
        await hapticsSuccess();

        return {
          rawValue: barcode.rawValue,
          format: barcode.format,
          displayValue: barcode.displayValue,
          cornerPoints: barcode.cornerPoints,
        };
      }

      return null;
    } catch (error) {
      console.error('Barcode scanning failed:', error);
      return null;
    } finally {
      this.isScanning = false;
    }
  }

  /**
   * Scan from an image file (not live camera)
   */
  async scanFromImage(imageUrl: string): Promise<ScannedBarcode[]> {
    if (!isNative()) {
      console.warn('Barcode scanning not supported on web platform');
      return [];
    }

    try {
      // Note: This would require the image to be loaded as a file path
      // Implementation depends on how images are handled in your app
      console.warn('Scan from image not yet implemented');
      return [];
    } catch (error) {
      console.error('Failed to scan from image:', error);
      return [];
    }
  }

  /**
   * Check if currently scanning
   */
  getIsScanningStatus(): boolean {
    return this.isScanning;
  }

  /**
   * Lookup medication information by barcode
   * This is a placeholder - you would integrate with a medication database API
   */
  async lookupMedicationByBarcode(barcode: string): Promise<{
    found: boolean;
    medication?: {
      name: string;
      genericName?: string;
      dosage?: string;
      manufacturer?: string;
      ndc?: string; // National Drug Code
    };
  }> {
    try {
      // TODO: Integrate with a real medication database API
      // For now, return a placeholder response
      console.log('Looking up medication for barcode:', barcode);

      // Example: FDA NDC API or similar service
      // const response = await fetch(`https://api.fda.gov/drug/ndc.json?search=product_ndc:"${barcode}"`);
      // const data = await response.json();

      return {
        found: false,
      };
    } catch (error) {
      console.error('Failed to lookup medication:', error);
      return {
        found: false,
      };
    }
  }

  /**
   * Validate barcode format
   */
  validateBarcode(barcode: string, expectedFormat?: string): boolean {
    if (!barcode || barcode.length === 0) {
      return false;
    }

    // Basic validation - check if barcode contains only valid characters
    const validPattern = /^[0-9A-Za-z\-_]+$/;
    return validPattern.test(barcode);
  }

  /**
   * Parse NDC (National Drug Code) from barcode
   * NDC format: XXXXX-XXXX-XX or XXXXX-XXX-XX
   */
  parseNDC(barcode: string): string | null {
    // Remove any non-numeric characters
    const numeric = barcode.replace(/\D/g, '');

    // NDC should be 10 or 11 digits
    if (numeric.length === 10) {
      return `${numeric.slice(0, 5)}-${numeric.slice(5, 9)}-${numeric.slice(9)}`;
    } else if (numeric.length === 11) {
      return `${numeric.slice(0, 5)}-${numeric.slice(5, 8)}-${numeric.slice(8)}`;
    }

    return null;
  }
}

export const barcodeService = new BarcodeService();
export default barcodeService;


