import mongoose, { Schema, Document } from 'mongoose';

export interface IAdminUser extends Document {
  username: string;
  passwordHash: string;
  accessLevel: 'research' | 'admin' | 'superadmin';
  secretSequence: string;
  isActive: boolean;
  permissions: string[];
  createdAt: Date;
  updatedAt?: Date;
  lastLogin?: Date;
  loginCount: number;
  deactivatedAt?: Date;
  twoFactorEnabled: boolean;
  twoFactorSecret?: string;
  ipWhitelist?: string[];
  sessionTimeout: number;
}

const AdminUserSchema = new Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    minlength: 3,
    maxlength: 50,
    trim: true,
    lowercase: true
  },
  passwordHash: {
    type: String,
    required: true,
    minlength: 60 // bcrypt hash length
  },
  accessLevel: {
    type: String,
    required: true,
    enum: ['research', 'admin', 'superadmin'],
    default: 'research'
  },
  secretSequence: {
    type: String,
    required: true,
    unique: true,
    minlength: 32 // Encrypted sequence hash
  },
  isActive: {
    type: Boolean,
    required: true,
    default: true
  },
  permissions: [{
    type: String,
    enum: [
      'view_reports',
      'generate_reports', 
      'view_aggregated_data',
      'view_audit_logs',
      'manage_consent',
      'export_data',
      'view_all_data',
      'manage_users',
      'system_configuration',
      'manage_admin_users',
      'view_raw_data'
    ]
  }],
  createdAt: {
    type: Date,
    default: Date.now,
    required: true
  },
  updatedAt: {
    type: Date
  },
  lastLogin: {
    type: Date
  },
  loginCount: {
    type: Number,
    default: 0,
    min: 0
  },
  deactivatedAt: {
    type: Date
  },
  twoFactorEnabled: {
    type: Boolean,
    default: false
  },
  twoFactorSecret: {
    type: String,
    sparse: true
  },
  ipWhitelist: [{
    type: String,
    validate: {
      validator: function(ip: string) {
        // Basic IP validation
        const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
        return ipRegex.test(ip);
      },
      message: 'Invalid IP address format'
    }
  }],
  sessionTimeout: {
    type: Number,
    default: 4 * 60 * 60 * 1000, // 4 hours in milliseconds
    min: 30 * 60 * 1000, // Minimum 30 minutes
    max: 24 * 60 * 60 * 1000 // Maximum 24 hours
  }
}, {
  timestamps: true,
  versionKey: false
});

// Indexes for performance
AdminUserSchema.index({ username: 1 }, { unique: true });
AdminUserSchema.index({ secretSequence: 1 }, { unique: true });
AdminUserSchema.index({ isActive: 1, accessLevel: 1 });
AdminUserSchema.index({ lastLogin: 1 });

// Virtual for user status
AdminUserSchema.virtual('status').get(function() {
  if (!this.isActive) return 'inactive';
  if (this.deactivatedAt) return 'deactivated';
  
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  if (!this.lastLogin || this.lastLogin < thirtyDaysAgo) {
    return 'dormant';
  }
  
  return 'active';
});

// Method to check if user has specific permission
AdminUserSchema.methods.hasPermission = function(permission: string): boolean {
  return this.permissions.includes(permission);
};

// Method to check if user can access certain data level
AdminUserSchema.methods.canAccessDataLevel = function(level: 'aggregated' | 'anonymized' | 'raw'): boolean {
  switch (level) {
    case 'aggregated':
      return this.hasPermission('view_reports') || this.hasPermission('view_aggregated_data');
    case 'anonymized':
      return this.hasPermission('view_all_data') || this.accessLevel === 'superadmin';
    case 'raw':
      return this.hasPermission('view_raw_data') && this.accessLevel === 'superadmin';
    default:
      return false;
  }
};

// Method to get accessible collections based on permissions
AdminUserSchema.methods.getAccessibleCollections = function(): string[] {
  const collections: string[] = [];
  
  if (this.hasPermission('view_reports')) {
    collections.push('aggregatedreports');
  }
  
  if (this.hasPermission('view_aggregated_data')) {
    collections.push('aggregatedreports', 'anonymousdata');
  }
  
  if (this.hasPermission('view_audit_logs')) {
    collections.push('privacyaudits');
  }
  
  if (this.hasPermission('manage_consent')) {
    collections.push('consents');
  }
  
  if (this.hasPermission('view_all_data')) {
    collections.push('anonymousdata', 'aggregatedreports', 'privacyaudits', 'consents');
  }
  
  if (this.hasPermission('manage_admin_users')) {
    collections.push('adminusers');
  }
  
  return [...new Set(collections)]; // Remove duplicates
};

// Pre-save middleware to update timestamps
AdminUserSchema.pre('save', function(next) {
  if (this.isModified() && !this.isNew) {
    this.updatedAt = new Date();
  }
  next();
});

// Create and export the model
export const AdminUser = mongoose.model<IAdminUser>('AdminUser', AdminUserSchema);
