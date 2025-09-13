import crypto from 'crypto';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { AdminUser } from '../models/adminUser';
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'logs/admin-auth.log' })
  ]
});

/**
 * Secret Authentication Service for Admin Panel Access
 * Uses encrypted UI patterns and multi-layer security
 */
export class SecretAuthService {
  private readonly secretKey: string;
  private readonly jwtSecret: string;
  private readonly maxAttempts: number = 3;
  private readonly lockoutDuration: number = 15 * 60 * 1000; // 15 minutes
  
  // Track failed attempts by IP
  private failedAttempts = new Map<string, { count: number; lastAttempt: number }>();

  constructor() {
    this.secretKey = process.env.ADMIN_SECRET || 'default-admin-secret-change-in-production';
    this.jwtSecret = process.env.JWT_SECRET || 'default-jwt-secret-change-in-production';
  }

  /**
   * Validate UI click sequence for admin access
   */
  async validateSequence(sequence: string[], clientIP: string): Promise<{ valid: boolean; token?: string; message?: string }> {
    try {
      // Check if IP is locked out
      if (this.isLockedOut(clientIP)) {
        const lockoutTime = this.getLockoutTimeRemaining(clientIP);
        logger.warn('Admin access attempt during lockout', { clientIP, lockoutTime });
        return {
          valid: false,
          message: `Too many failed attempts. Try again in ${Math.ceil(lockoutTime / 60000)} minutes.`
        };
      }

      // Convert sequence to string
      const sequenceString = sequence.join('-');
      
      // Generate expected hash
      const expectedHash = crypto.createHmac('sha256', this.secretKey)
        .update(sequenceString)
        .digest('hex');

      // Find admin user with matching sequence
      const adminUser = await AdminUser.findOne({
        secretSequence: expectedHash,
        isActive: true
      });

      if (!adminUser) {
        this.recordFailedAttempt(clientIP);
        logger.warn('Invalid admin sequence attempt', { 
          clientIP, 
          sequence: sequence.map(s => s.substring(0, 3) + '***'), // Partial logging for security
          attempts: this.getFailedAttempts(clientIP)
        });
        return {
          valid: false,
          message: 'Invalid access sequence'
        };
      }

      // Clear failed attempts on success
      this.clearFailedAttempts(clientIP);

      // Generate admin JWT token
      const token = this.generateAdminToken(adminUser);

      // Update last login
      await AdminUser.findByIdAndUpdate(adminUser._id, {
        lastLogin: new Date(),
        $inc: { loginCount: 1 }
      });

      logger.info('Successful admin authentication', {
        adminId: adminUser._id,
        username: adminUser.username,
        accessLevel: adminUser.accessLevel,
        clientIP
      });

      return {
        valid: true,
        token,
        message: 'Access granted'
      };

    } catch (error) {
      logger.error('Error validating admin sequence:', error);
      return {
        valid: false,
        message: 'Authentication service error'
      };
    }
  }

  /**
   * Generate secure admin JWT token
   */
  private generateAdminToken(adminUser: any): string {
    const payload = {
      adminId: adminUser._id.toString(),
      username: adminUser.username,
      accessLevel: adminUser.accessLevel,
      permissions: adminUser.permissions || [],
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (4 * 60 * 60) // 4 hours
    };

    return jwt.sign(payload, this.jwtSecret, {
      algorithm: 'HS256',
      issuer: 'medtrack-admin',
      audience: 'medtrack-admin-panel'
    });
  }

  /**
   * Verify admin JWT token
   */
  async verifyAdminToken(token: string): Promise<{ valid: boolean; decoded?: any; message?: string }> {
    try {
      const decoded = jwt.verify(token, this.jwtSecret, {
        issuer: 'medtrack-admin',
        audience: 'medtrack-admin-panel'
      });

      // Verify admin user still exists and is active
      const adminUser = await AdminUser.findById(decoded.adminId);
      if (!adminUser || !adminUser.isActive) {
        return {
          valid: false,
          message: 'Admin user no longer active'
        };
      }

      return {
        valid: true,
        decoded
      };

    } catch (error) {
      logger.warn('Invalid admin token verification', { error: error.message });
      return {
        valid: false,
        message: 'Invalid or expired token'
      };
    }
  }

  /**
   * Create new admin user with encrypted sequence
   */
  async createAdminUser(
    username: string,
    password: string,
    accessLevel: 'research' | 'admin' | 'superadmin',
    uiSequence: string[]
  ): Promise<{ success: boolean; user?: any; message?: string }> {
    try {
      // Check if username already exists
      const existingUser = await AdminUser.findOne({ username });
      if (existingUser) {
        return {
          success: false,
          message: 'Username already exists'
        };
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 12);

      // Encrypt UI sequence
      const sequenceString = uiSequence.join('-');
      const encryptedSequence = crypto.createHmac('sha256', this.secretKey)
        .update(sequenceString)
        .digest('hex');

      // Create admin user
      const adminUser = await AdminUser.create({
        username,
        passwordHash,
        accessLevel,
        secretSequence: encryptedSequence,
        isActive: true,
        createdAt: new Date(),
        permissions: this.getDefaultPermissions(accessLevel)
      });

      logger.info('New admin user created', {
        adminId: adminUser._id,
        username,
        accessLevel
      });

      return {
        success: true,
        user: {
          id: adminUser._id,
          username: adminUser.username,
          accessLevel: adminUser.accessLevel
        },
        message: 'Admin user created successfully'
      };

    } catch (error) {
      logger.error('Error creating admin user:', error);
      return {
        success: false,
        message: 'Failed to create admin user'
      };
    }
  }

  /**
   * Update admin user's UI sequence
   */
  async updateAdminSequence(
    adminId: string,
    newSequence: string[]
  ): Promise<{ success: boolean; message?: string }> {
    try {
      const sequenceString = newSequence.join('-');
      const encryptedSequence = crypto.createHmac('sha256', this.secretKey)
        .update(sequenceString)
        .digest('hex');

      await AdminUser.findByIdAndUpdate(adminId, {
        secretSequence: encryptedSequence,
        updatedAt: new Date()
      });

      logger.info('Admin sequence updated', { adminId });

      return {
        success: true,
        message: 'UI sequence updated successfully'
      };

    } catch (error) {
      logger.error('Error updating admin sequence:', error);
      return {
        success: false,
        message: 'Failed to update sequence'
      };
    }
  }

  /**
   * Deactivate admin user
   */
  async deactivateAdmin(adminId: string): Promise<{ success: boolean; message?: string }> {
    try {
      await AdminUser.findByIdAndUpdate(adminId, {
        isActive: false,
        deactivatedAt: new Date()
      });

      logger.info('Admin user deactivated', { adminId });

      return {
        success: true,
        message: 'Admin user deactivated'
      };

    } catch (error) {
      logger.error('Error deactivating admin:', error);
      return {
        success: false,
        message: 'Failed to deactivate admin'
      };
    }
  }

  /**
   * Generate secure random UI sequence for new admin
   */
  generateRandomSequence(): string[] {
    const uiElements = [
      'header-logo',
      'header-settings', 
      'header-notifications',
      'sidebar-dashboard',
      'sidebar-medications',
      'sidebar-calendar',
      'sidebar-reminders',
      'sidebar-analytics',
      'sidebar-reports',
      'sidebar-settings',
      'footer-privacy',
      'footer-help',
      'modal-close',
      'search-button',
      'export-button'
    ];

    // Generate sequence of 5-8 elements
    const sequenceLength = Math.floor(Math.random() * 4) + 5; // 5-8 elements
    const sequence: string[] = [];

    for (let i = 0; i < sequenceLength; i++) {
      const randomElement = uiElements[Math.floor(Math.random() * uiElements.length)];
      sequence.push(randomElement);
    }

    return sequence;
  }

  // Private helper methods

  private recordFailedAttempt(clientIP: string): void {
    const attempts = this.failedAttempts.get(clientIP) || { count: 0, lastAttempt: 0 };
    attempts.count++;
    attempts.lastAttempt = Date.now();
    this.failedAttempts.set(clientIP, attempts);
  }

  private getFailedAttempts(clientIP: string): number {
    const attempts = this.failedAttempts.get(clientIP);
    return attempts ? attempts.count : 0;
  }

  private clearFailedAttempts(clientIP: string): void {
    this.failedAttempts.delete(clientIP);
  }

  private isLockedOut(clientIP: string): boolean {
    const attempts = this.failedAttempts.get(clientIP);
    if (!attempts || attempts.count < this.maxAttempts) {
      return false;
    }

    const timeSinceLastAttempt = Date.now() - attempts.lastAttempt;
    if (timeSinceLastAttempt > this.lockoutDuration) {
      this.clearFailedAttempts(clientIP);
      return false;
    }

    return true;
  }

  private getLockoutTimeRemaining(clientIP: string): number {
    const attempts = this.failedAttempts.get(clientIP);
    if (!attempts) return 0;

    const timeSinceLastAttempt = Date.now() - attempts.lastAttempt;
    return Math.max(0, this.lockoutDuration - timeSinceLastAttempt);
  }

  private getDefaultPermissions(accessLevel: string): string[] {
    switch (accessLevel) {
      case 'research':
        return ['view_reports', 'generate_reports', 'view_aggregated_data'];
      case 'admin':
        return [
          'view_reports', 
          'generate_reports', 
          'view_aggregated_data',
          'view_audit_logs',
          'manage_consent',
          'export_data'
        ];
      case 'superadmin':
        return [
          'view_all_data',
          'generate_reports',
          'manage_users',
          'view_audit_logs',
          'export_data',
          'system_configuration',
          'manage_admin_users',
          'view_raw_data'
        ];
      default:
        return ['view_reports'];
    }
  }
}

// Export singleton instance
export const secretAuthService = new SecretAuthService();
