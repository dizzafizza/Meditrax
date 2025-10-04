/**
 * Camera Service
 * Handles camera operations for taking photos of medications
 */

import { Camera, CameraResultType, CameraSource, Photo } from '@capacitor/camera';
import { supportsCamera } from '@/utils/platform';
import { hapticsLight } from '@/utils/haptics';

export interface CameraPhoto {
  dataUrl: string;
  format: string;
  saved: boolean;
}

class CameraService {
  /**
   * Check if camera is available on this device
   */
  async isCameraAvailable(): Promise<boolean> {
    return supportsCamera();
  }

  /**
   * Request camera permissions
   */
  async requestPermissions(): Promise<boolean> {
    if (!supportsCamera()) {
      console.warn('Camera not supported on this platform');
      return false;
    }

    try {
      const permissions = await Camera.requestPermissions();
      return permissions.camera === 'granted' || permissions.photos === 'granted';
    } catch (error) {
      console.error('Failed to request camera permissions:', error);
      return false;
    }
  }

  /**
   * Check camera permissions
   */
  async checkPermissions(): Promise<{
    camera: string;
    photos: string;
  }> {
    if (!supportsCamera()) {
      return { camera: 'denied', photos: 'denied' };
    }

    try {
      const permissions = await Camera.checkPermissions();
      return {
        camera: permissions.camera,
        photos: permissions.photos,
      };
    } catch (error) {
      console.error('Failed to check camera permissions:', error);
      return { camera: 'denied', photos: 'denied' };
    }
  }

  /**
   * Take a photo using the device camera
   */
  async takePhoto(): Promise<CameraPhoto | null> {
    if (!supportsCamera()) {
      console.warn('Camera not supported on this platform');
      return null;
    }

    try {
      // Trigger haptic feedback
      await hapticsLight();

      const photo: Photo = await Camera.getPhoto({
        quality: 80,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Camera,
      });

      if (!photo.dataUrl) {
        throw new Error('No image data returned from camera');
      }

      return {
        dataUrl: photo.dataUrl,
        format: photo.format,
        saved: photo.saved || false,
      };
    } catch (error) {
      console.error('Failed to take photo:', error);
      return null;
    }
  }

  /**
   * Pick a photo from the device gallery
   */
  async pickPhoto(): Promise<CameraPhoto | null> {
    if (!supportsCamera()) {
      console.warn('Camera not supported on this platform');
      return null;
    }

    try {
      // Trigger haptic feedback
      await hapticsLight();

      const photo: Photo = await Camera.getPhoto({
        quality: 80,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Photos,
      });

      if (!photo.dataUrl) {
        throw new Error('No image data returned from gallery');
      }

      return {
        dataUrl: photo.dataUrl,
        format: photo.format,
        saved: photo.saved || false,
      };
    } catch (error) {
      console.error('Failed to pick photo:', error);
      return null;
    }
  }

  /**
   * Show a prompt to choose between camera and gallery
   */
  async choosePhotoSource(): Promise<CameraPhoto | null> {
    if (!supportsCamera()) {
      console.warn('Camera not supported on this platform');
      return null;
    }

    try {
      // Trigger haptic feedback
      await hapticsLight();

      const photo: Photo = await Camera.getPhoto({
        quality: 80,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Prompt, // Prompts user to choose camera or gallery
      });

      if (!photo.dataUrl) {
        throw new Error('No image data returned');
      }

      return {
        dataUrl: photo.dataUrl,
        format: photo.format,
        saved: photo.saved || false,
      };
    } catch (error) {
      console.error('Failed to get photo:', error);
      return null;
    }
  }

  /**
   * Convert data URL to blob
   */
  dataUrlToBlob(dataUrl: string): Blob {
    const arr = dataUrl.split(',');
    const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    
    return new Blob([u8arr], { type: mime });
  }

  /**
   * Resize image data URL
   */
  async resizeImage(
    dataUrl: string,
    maxWidth: number = 800,
    maxHeight: number = 800
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Calculate new dimensions
        if (width > height) {
          if (width > maxWidth) {
            height = height * (maxWidth / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = width * (maxHeight / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };

      img.onerror = () => {
        reject(new Error('Failed to load image'));
      };

      img.src = dataUrl;
    });
  }
}

export const cameraService = new CameraService();
export default cameraService;


