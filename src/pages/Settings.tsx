import React from 'react';
import { useForm } from 'react-hook-form';
import {
  User, 
  Bell, 
  Shield,
  Download, 
  Upload,
  Trash2,
  Save,
  AlertTriangle,
  Smartphone,
  Wifi,
  WifiOff,
  Settings2,
  Lock,
  Fingerprint
  // Eye, // DISABLED - no longer needed
  // UserCheck, // DISABLED - no longer needed
  // CheckCircle // DISABLED - no longer needed
} from 'lucide-react';
import { useMedicationStore } from '@/store';
import { UserProfile, SecurityPreferences } from '@/types';
// import { AnonymousReportingPreferences } from '@/types'; // DISABLED
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ExportModal } from '@/components/ui/ExportModal';
import { ImportModal } from '@/components/ui/ImportModal';
import { notificationService, NotificationPermissionState } from '@/services/notificationService';
import { biometricService } from '@/services/biometricService';
import { isNative, supportsBiometrics } from '@/utils/platform';
// import { PrivacyDashboardModal } from '@/components/modals/PrivacyDashboardModal'; // DISABLED
// import { ConsentManagementModal } from '@/components/modals/ConsentManagementModal'; // DISABLED  
// import { anonymousReportingService } from '@/services/anonymousReportingService'; // DISABLED
// import { generateCSV, downloadFile } from '@/utils/helpers';
import { NotificationDiagnosticModal } from '@/components/modals/NotificationDiagnosticModal';
import { consoleCapture } from '@/utils/consoleCapture';
import toast from 'react-hot-toast';

export function Settings() {
  const { 
    userProfile, 
    updateProfile, 
    createProfile, 
    clearAllData
    // exportData, 
    // importData,
    // medications,
    // logs,
    // backupData
  } = useMedicationStore();

  const [activeTab, setActiveTab] = React.useState<'profile' | 'notifications' | 'pwa' | 'data' | 'diagnostics' | 'security'>('profile');
  const [showClearDataDialog, setShowClearDataDialog] = React.useState(false);
  const [showExportModal, setShowExportModal] = React.useState(false);
  const [showImportModal, setShowImportModal] = React.useState(false);
  const [showNotificationDiagnostic, setShowNotificationDiagnostic] = React.useState(false);
  const [notificationPermission, setNotificationPermission] = React.useState<NotificationPermissionState>({ status: 'default', supported: false });
  const [consoleLogs, setConsoleLogs] = React.useState<Array<{ timestamp: string; type: string; message: string }>>([]);
  const [consoleCaptureEnabled, setConsoleCaptureEnabled] = React.useState(false);
  const [isPWAInstalled, setIsPWAInstalled] = React.useState(false);
  const [isOnline, setIsOnline] = React.useState(navigator.onLine);
  // const [showPrivacyDashboard, setShowPrivacyDashboard] = React.useState(false); // DISABLED
  // const [showConsentModal, setShowConsentModal] = React.useState(false); // DISABLED
  // const [anonymousReportingPrefs, setAnonymousReportingPrefs] = React.useState<AnonymousReportingPreferences | null>(null); // DISABLED
  // const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Load PWA and notification state on component mount
  React.useEffect(() => {
    loadPWAState();
    checkNotificationPermission();
    
    // Listen for online/offline events
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const loadPWAState = () => {
    // Check if app is installed as PWA
    const isInstalled = window.matchMedia('(display-mode: standalone)').matches ||
                       (window.navigator as any).standalone === true ||
                       document.referrer.includes('android-app://');
    setIsPWAInstalled(isInstalled);
  };

  const checkNotificationPermission = async () => {
    const permission = await notificationService.getPermissionState();
    console.log('Settings - Permission state received:', permission);
    setNotificationPermission(permission);
  };

  const { register, handleSubmit, formState: { errors }, reset } = useForm({
    defaultValues: {
      name: '',
      dateOfBirth: '',
      allergies: '',
      conditions: '',
      emergencyContactName: '',
      emergencyContactRelationship: '',
      emergencyContactPhone: '',
      emergencyContactEmail: '',
      theme: 'system',
      pushNotifications: true,
      soundNotifications: true,
      vibrationNotifications: true,
      timeFormat: '12h',
      dateFormat: 'MM/DD/YYYY',
      defaultView: 'dashboard',
    }
  });

  // Update form values when userProfile changes
  React.useEffect(() => {
    if (userProfile) {
      reset({
        name: userProfile.name || '',
        dateOfBirth: userProfile.dateOfBirth?.toISOString().split('T')[0] || '',
        allergies: userProfile.allergies?.join(', ') || '',
        conditions: userProfile.conditions?.join(', ') || '',
        emergencyContactName: userProfile.emergencyContact?.name || '',
        emergencyContactRelationship: userProfile.emergencyContact?.relationship || '',
        emergencyContactPhone: userProfile.emergencyContact?.phone || '',
        emergencyContactEmail: userProfile.emergencyContact?.email || '',
        theme: userProfile.preferences?.theme || 'system',
        pushNotifications: userProfile.preferences?.notifications?.push ?? true,
        soundNotifications: userProfile.preferences?.notifications?.sound ?? true,
        vibrationNotifications: userProfile.preferences?.notifications?.vibration ?? true,
        timeFormat: userProfile.preferences?.display?.timeFormat || '12h',
        dateFormat: userProfile.preferences?.display?.dateFormat || 'MM/DD/YYYY',
        defaultView: userProfile.preferences?.display?.defaultView || 'dashboard',
      });
    }
  }, [userProfile, reset]);

  // Console capture for PWA debugging - using global service that persists across pages
  React.useEffect(() => {
    // Load initial state from global service
    setConsoleLogs(consoleCapture.getLogs());
    setConsoleCaptureEnabled(consoleCapture.isActive());

    // Listen for new log entries
    const handleLogCaptured = () => {
      setConsoleLogs(consoleCapture.getLogs());
    };

    // Listen for logs cleared
    const handleLogsCleared = () => {
      setConsoleLogs([]);
    };

    window.addEventListener('console-log-captured', handleLogCaptured);
    window.addEventListener('console-logs-cleared', handleLogsCleared);
    
    return () => {
      window.removeEventListener('console-log-captured', handleLogCaptured);
      window.removeEventListener('console-logs-cleared', handleLogsCleared);
    };
  }, []);

  // Handle console capture toggle
  const handleConsoleCaptureToggle = (enabled: boolean) => {
    setConsoleCaptureEnabled(enabled);
    
    if (enabled) {
      consoleCapture.startCapture();
    } else {
      consoleCapture.stopCapture();
    }
  };

  const onSubmit = (data: any) => {
    const profileData: Partial<UserProfile> = {
      name: data.name.trim(),
      dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : undefined,
      allergies: data.allergies ? data.allergies.split(',').map((s: string) => s.trim()).filter(Boolean) : undefined,
      conditions: data.conditions ? data.conditions.split(',').map((s: string) => s.trim()).filter(Boolean) : undefined,
      emergencyContact: (data.emergencyContactName || data.emergencyContactPhone) ? {
        name: data.emergencyContactName,
        relationship: data.emergencyContactRelationship,
        phone: data.emergencyContactPhone,
        email: data.emergencyContactEmail || undefined,
      } : undefined,
      preferences: {
        theme: data.theme,
        notifications: {
          push: data.pushNotifications,
          sound: data.soundNotifications,
          vibration: data.vibrationNotifications,
        },
        privacy: {
          shareData: false,
          analytics: true,
          anonymousReporting: {
            enabled: false,
            consentGiven: false,
            dataTypesAllowed: [],
            privacyLevel: 'minimal',
            granularControls: {
              includeAdherence: false,
              includeSideEffects: false,
              includeMedicationPatterns: false,
              includeRiskAssessments: false,
              allowTemporalAnalysis: false,
              allowDemographicAnalysis: false
            }
          }
        },
        display: {
          timeFormat: data.timeFormat,
          dateFormat: data.dateFormat,
          defaultView: data.defaultView,
        },
      },
    };

    if (userProfile) {
      updateProfile(profileData);
    } else {
      createProfile({
        ...profileData,
        name: profileData.name!,
        preferences: profileData.preferences!,
      });
    }

    toast.success('Settings updated successfully');
  };

  // const handleConsentUpdated = (preferences: AnonymousReportingPreferences) => { // DISABLED
  //   setAnonymousReportingPrefs(preferences);
  //   toast.success('Anonymous reporting preferences updated');
  // };

  // const handleExportData = () => {
  //   try {
  //     const data = exportData();
  //     const jsonData = JSON.stringify(data, null, 2);
  //     downloadFile(jsonData, `meditrax-export-${new Date().toISOString().split('T')[0]}.json`, 'application/json');
  //     toast.success('Data exported successfully');
  //   } catch (error) {
  //     toast.error('Failed to export data');
  //   }
  // };

  // const handleExportCSV = () => {
  //   try {
  //     const csvData = generateCSV(logs, ['timestamp', 'medicationId', 'dosageTaken', 'adherence']);
  //     downloadFile(csvData, `meditrax-logs-${new Date().toISOString().split('T')[0]}.csv`, 'text/csv');
  //     toast.success('CSV exported successfully');
  //   } catch (error) {
  //     toast.error('Failed to export CSV');
  //   }
  // };

  // const handleImportData = (event: React.ChangeEvent<HTMLInputElement>) => {
  //   const file = event.target.files?.[0];
  //   if (!file) return;

  //   const reader = new FileReader();
  //   reader.onload = (e) => {
  //     try {
  //       const content = e.target?.result as string;
  //       const data = JSON.parse(content);
  //       importData(data);
  //       toast.success('Data imported successfully');
  //     } catch (error) {
  //       toast.error('Failed to import data');
  //     }
  //   };
  //   reader.readAsText(file);
  // };

  const handleClearData = () => {
    clearAllData();
    setShowClearDataDialog(false);
    toast.success('All data cleared');
  };

  const handleRequestNotificationPermission = async () => {
    try {
      const granted = await notificationService.requestPermission();
      if (granted) {
        toast.success('Notification permission granted! You can now receive medication reminders.');
      } else {
        toast.error('Notification permission denied. Please enable in device settings.');
      }
      await checkNotificationPermission();
    } catch (error) {
      toast.error('Failed to request notification permission');
      console.error('Failed to request notification permission:', error);
    }
  };

  const handleTestNotification = async () => {
    try {
      await notificationService.sendImmediateNotification({
        title: 'Test Notification',
        body: 'This is a test notification from Meditrax! If you see this, notifications are working correctly.',
        icon: '/icons/icon-192x192.png',
      });
      toast.success('Test notification sent!');
    } catch (error) {
      toast.error('Failed to send test notification');
      console.error('Failed to send test notification:', error);
    }
  };

  const handleTestScheduledNotification = async () => {
    try {
      // Schedule a test notification for 1 minute from now
      const testTime = new Date(Date.now() + 60 * 1000);
      await notificationService.sendImmediateNotification({
        title: 'Scheduled Test Notification',
        body: `This notification was scheduled for ${testTime.toLocaleTimeString()}. Close the app to test background delivery!`,
        icon: '/icons/icon-192x192.png',
      });
      
      toast.success('Test notification will appear in ~1 second. On native apps, close the app to test background delivery!', {
        duration: 5000,
      });
    } catch (error) {
      console.error('Failed to create test notification:', error);
      toast.error('❌ Failed to send test notification');
    }
  };


  const handleInstallPWA = () => {
    // This would be handled by the PWA install prompt
    // The actual install prompt is triggered by the browser
    toast('Look for the "Add to Home Screen" or "Install App" option in your browser menu', {
      icon: 'ℹ️',
      duration: 4000,
    });
  };


  const NotificationDiagnostics = () => {
    const [pendingCount, setPendingCount] = React.useState(0);
    const [showDetails, setShowDetails] = React.useState(false);

    React.useEffect(() => {
      const loadDiagnostics = async () => {
        try {
          const pending = await notificationService.getPendingNotifications();
          setPendingCount(pending.notifications.length);
        } catch (error) {
          // Ignore errors on web platform
        }
      };
      
      loadDiagnostics();
      const interval = setInterval(loadDiagnostics, 10000); // Update every 10 seconds
      
      return () => clearInterval(interval);
    }, []);

    if (!showDetails) return null;

    return (
      <div className="mt-4 p-3 bg-gray-50 rounded-lg">
        <button
          type="button"
          onClick={() => setShowDetails(!showDetails)}
          className="flex items-center justify-between w-full text-sm text-gray-600 hover:text-gray-800"
        >
          <span>Notification System Status</span>
          <Settings2 className={`w-4 h-4 transform transition-transform ${showDetails ? 'rotate-90' : ''}`} />
        </button>
        
        {showDetails && (
          <div className="mt-3 space-y-2 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <div className="flex justify-between">
                <span>Scheduled:</span>
                <span className="font-mono">{diagnostics.scheduledCount}</span>
              </div>
              <div className="flex justify-between">
                <span>Queued:</span>
                <span className="font-mono">{diagnostics.queuedCount}</span>
              </div>
              <div className="flex justify-between">
                <span>Badge Count:</span>
                <span className="font-mono text-blue-600">{diagnostics.badgeCount}</span>
              </div>
              <div className="flex justify-between">
                <span>Badge Support:</span>
                <span className={`font-mono ${diagnostics.badgeSupported ? 'text-green-600' : 'text-yellow-600'}`}>
                  {diagnostics.badgeSupported ? 'Yes' : 'No'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Using Firebase:</span>
                <span className={`font-mono ${diagnostics.usingFirebase ? 'text-green-600' : 'text-blue-600'}`}>
                  {diagnostics.usingFirebase ? 'FCM' : 'Service Worker'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Firebase Config:</span>
                <span className={`font-mono ${diagnostics.firebaseConfigured ? 'text-green-600' : 'text-yellow-600'}`}>
                  {diagnostics.firebaseConfigured ? 'Configured' : 'Not Set'}
                </span>
              </div>
              {diagnostics.fcmToken && (
                <div className="flex justify-between">
                  <span>FCM Token:</span>
                  <span className="font-mono text-green-600 text-xs">{diagnostics.fcmToken}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Browser Support:</span>
                <span className={`font-mono ${diagnostics.browserSupportsNotifications ? 'text-green-600' : 'text-red-600'}`}>
                  {diagnostics.browserSupportsNotifications ? 'Yes' : 'No'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Permission:</span>
                <span className={`font-mono ${
                  diagnostics.notificationPermission === 'granted' ? 'text-green-600' : 
                  diagnostics.notificationPermission === 'denied' ? 'text-red-600' : 'text-yellow-600'
                }`}>
                  {diagnostics.notificationPermission}
                </span>
              </div>
              <div className="flex justify-between">
                <span>iOS Device:</span>
                <span className={`font-mono ${diagnostics.isIOSDevice ? 'text-blue-600' : 'text-gray-500'}`}>
                  {diagnostics.isIOSDevice ? 'Yes' : 'No'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>iOS PWA:</span>
                <span className={`font-mono ${diagnostics.isIOSPWA ? 'text-green-600' : 'text-yellow-600'}`}>
                  {diagnostics.isIOSPWA ? 'Yes' : 'No'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>iOS Push Support:</span>
                <span className={`font-mono ${diagnostics.iosWebPushSupported ? 'text-green-600' : 'text-red-600'}`}>
                  {diagnostics.iosWebPushSupported ? 'Yes' : 'No'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Service Worker:</span>
                <span className={`font-mono ${diagnostics.serviceWorkerActive ? 'text-green-600' : 'text-red-600'}`}>
                  {diagnostics.serviceWorkerActive ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
            <div className="pt-2 border-t border-gray-200">
              <div className="flex justify-between text-xs">
                <span>Last Check:</span>
                <span className="font-mono">{diagnostics.lastVisibilityCheck}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const PlatformGuidance = () => {
    const [showGuidance, setShowGuidance] = React.useState(false);

    // Show guidance for web/PWA users
    if (isNative()) {
      return (
        <div className="mt-4 p-3 bg-green-50 rounded-lg border border-green-200">
          <div className="flex items-center">
            <Smartphone className="w-4 h-4 mr-2 text-green-600" />
            <span className="text-sm font-medium text-green-900">Native App - Full notification support</span>
          </div>
        </div>
      );
    }

    return (
      <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
        <button
          type="button"
          onClick={() => setShowGuidance(!showGuidance)}
          className="flex items-center justify-between w-full text-sm text-blue-800 hover:text-blue-900 font-medium"
        >
          <span className="flex items-center">
            <Smartphone className="w-4 h-4 mr-2" />
            Web/PWA Platform Info
          </span>
          <Settings2 className={`w-4 h-4 transform transition-transform ${showGuidance ? 'rotate-90' : ''}`} />
        </button>
        
        {showGuidance && (
          <div className="mt-3 space-y-2 text-xs text-gray-700">
            <div className="p-2 bg-white border border-blue-100 rounded">
              <p className="font-medium text-blue-900 mb-1">✅ What Works on Web/PWA:</p>
              <ul className="list-disc ml-5 space-y-0.5">
                <li>Immediate notifications (when app is open)</li>
                <li>All medication tracking features</li>
                <li>Offline functionality</li>
                <li>Data export/import</li>
              </ul>
            </div>
            <div className="p-2 bg-yellow-50 border border-yellow-200 rounded">
              <p className="font-medium text-yellow-800 mb-1">⚠️ Web/PWA Limitations:</p>
              <ul className="list-disc ml-5 space-y-0.5 text-yellow-700">
                <li>Scheduled notifications not reliable (browser dependent)</li>
                <li>No background tracking when app is closed</li>
                <li>No biometric authentication</li>
                <li>No camera/barcode scanning</li>
              </ul>
            </div>
            <div className="p-2 bg-blue-50 border border-blue-100 rounded">
              <p className="font-medium text-blue-900 mb-1">💡 For Best Experience:</p>
              <p className="text-blue-700">Install the native iOS or Android app for reliable scheduled reminders, background notifications, and all features.</p>
            </div>
          </div>
        )}
      </div>
    );
  };

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'pwa', label: 'App Settings', icon: Smartphone },
    { id: 'data', label: 'Data', icon: Download },
    { id: 'diagnostics', label: 'Diagnostics', icon: Settings2 },
  ];

  return (
    <div className="max-w-4xl space-y-6">
        <div className="bg-white rounded-lg shadow">
          {/* Header */}
          <div className="px-4 py-4 sm:px-6 border-b border-gray-200">
            <h1 className="mobile-title text-gray-900">Settings</h1>
            <p className="text-gray-600 mobile-text mt-1">Manage your account and application preferences</p>
          </div>

          {/* Tab Navigation */}
          <div className="border-b border-gray-200">
            <nav className="flex space-x-4 sm:space-x-8 px-4 sm:px-6 overflow-x-auto scrollbar-hide">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center space-x-2 py-3 sm:py-4 px-2 sm:px-1 border-b-2 font-medium text-sm whitespace-nowrap touch-manipulation min-h-[44px] ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <tab.icon className="w-4 h-4 flex-shrink-0" />
                  <span className="hidden sm:inline">{tab.label}</span>
                  <span className="sm:hidden">{tab.label.split(' ')[0]}</span>
                </button>
              ))}
            </nav>
          </div>

          {/* Content */}
          <form onSubmit={handleSubmit(onSubmit)} className="p-4 sm:p-6">
            {/* Profile Tab */}
            {activeTab === 'profile' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Personal Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Full Name
                      </label>
                      <input
                        type="text"
                        {...register('name', { required: 'Name is required' })}
                        className="mobile-input w-full border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                      {errors.name && (
                        <p className="text-red-600 text-sm mt-1">{errors.name.message}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Date of Birth
                      </label>
                      <input
                        type="date"
                        {...register('dateOfBirth')}
                        className="mobile-input w-full border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        style={{ fontSize: '16px' }}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Allergies
                      </label>
                      <input
                        type="text"
                        placeholder="Separate with commas"
                        {...register('allergies')}
                        className="mobile-input w-full border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Medical Conditions
                      </label>
                      <input
                        type="text"
                        placeholder="Separate with commas"
                        {...register('conditions')}
                        className="mobile-input w-full border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Emergency Contact</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Contact Name
                      </label>
                      <input
                        type="text"
                        {...register('emergencyContactName')}
                        className="mobile-input w-full border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Relationship
                      </label>
                      <input
                        type="text"
                        {...register('emergencyContactRelationship')}
                        className="mobile-input w-full border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Phone Number
                      </label>
                      <input
                        type="tel"
                        {...register('emergencyContactPhone')}
                        className="mobile-input w-full border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Email
                      </label>
                      <input
                        type="email"
                        {...register('emergencyContactEmail')}
                        className="mobile-input w-full border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Notifications Tab */}
            {activeTab === 'notifications' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Push Notification Settings</h3>
                  
                  {/* Permission Status */}
                  <div className="mb-6 p-4 rounded-lg border">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <Bell className="w-5 h-5 text-gray-600" />
                        <span className="font-medium text-gray-900">Notification Permission</span>
                      </div>
                      <div>
                        <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                          notificationPermission.status === 'granted' 
                            ? 'bg-green-100 text-green-800' 
                            : notificationPermission.status === 'denied'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {notificationPermission.status === 'granted' ? 'Enabled' : 
                           notificationPermission.status === 'denied' ? 'Blocked' : 'Not Set'}
                        </div>
                        <div className="text-xs text-gray-500 mt-1 text-center">
                          Raw: {notificationPermission.status}
                        </div>
                      </div>
                    </div>
                    
                    {!notificationPermission.supported && (
                      <p className="text-sm text-red-600 mb-3">
                        Push notifications are not supported in this browser.
                      </p>
                    )}
                    
                    {notificationPermission.supported && notificationPermission.status !== 'granted' && (
                      <div className="space-y-2">
                        <p className="text-sm text-gray-600">
                          {notificationPermission.status === 'denied' 
                            ? 'Notifications are blocked. Please enable them in your browser settings.'
                            : 'Enable notifications to receive medication reminders even when the app is closed.'
                          }
                        </p>
                        {notificationPermission.status !== 'denied' && (
                          <button
                            type="button"
                            onClick={handleRequestNotificationPermission}
                            className="mobile-button px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                          >
                            Enable Notifications
                          </button>
                        )}
                      </div>
                    )}
                    
                    {notificationPermission.status === 'granted' && (
                      <div className="space-y-2">
                        <p className="text-sm text-green-600">
                          Notifications are enabled! You'll receive medication reminders.
                        </p>
                <div className="flex flex-wrap gap-2">
                    <button
                        type="button"
                        onClick={handleTestNotification}
                        className="mobile-button px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    >
                        Test Immediate
                    </button>
                    <button
                        type="button"
                        onClick={handleTestScheduledNotification}
                        className="mobile-button px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                    >
                        Test in 1 min
                    </button>
                    <button
                        type="button"
                        onClick={checkNotificationPermission}
                        className="mobile-button px-2 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                    >
                        Refresh
                    </button>
                </div>
                <p className="text-xs text-gray-600 mt-2">
                    💡 "Test in 1 min" - Close the app after clicking to test closed-app delivery
                </p>
                        <PlatformGuidance />
                      </div>
                    )}
                    
                    {notificationPermission.status !== 'granted' && (
                      <div className="mt-2">
                        <button
                          type="button"
                          onClick={checkNotificationPermission}
                          className="mobile-button px-3 py-1 bg-gray-500 text-white rounded text-xs hover:bg-gray-600 transition-colors"
                        >
                          Refresh Status
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        id="pushNotifications"
                        {...register('pushNotifications')}
                        disabled={notificationPermission.status !== 'granted'}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 disabled:opacity-50"
                      />
                      <label htmlFor="pushNotifications" className="text-sm text-gray-700">
                        Enable push notifications for medication reminders
                      </label>
                    </div>

                    <div className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        id="soundNotifications"
                        {...register('soundNotifications')}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <label htmlFor="soundNotifications" className="text-sm text-gray-700">
                        Play sound for notifications
                      </label>
                    </div>

                    <div className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        id="vibrationNotifications"
                        {...register('vibrationNotifications')}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <label htmlFor="vibrationNotifications" className="text-sm text-gray-700">
                        Enable vibration for notifications (mobile devices)
                      </label>
                    </div>

                  </div>
                </div>

                {/* Alert Notification Preferences */}
                <div className="mt-8 p-4 border rounded-lg bg-gray-50">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Alert Notifications</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Control which types of alerts send notifications to your device.
                  </p>
                  
                  <div className="space-y-3">
                    <div className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        id="enableDependencyAlerts"
                        checked={userProfile?.preferences?.alertNotifications?.enableDependencyAlerts !== false}
                        onChange={(e) => {
                          updateProfile({
                            preferences: {
                              ...userProfile?.preferences,
                              alertNotifications: {
                                ...userProfile?.preferences?.alertNotifications,
                                enableDependencyAlerts: e.target.checked,
                              },
                            },
                          });
                        }}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <label htmlFor="enableDependencyAlerts" className="text-sm text-gray-700">
                        <span className="font-medium">Dependency Alerts</span> - Duration milestones, pattern warnings
                      </label>
                    </div>

                    <div className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        id="enablePsychologicalAlerts"
                        checked={userProfile?.preferences?.alertNotifications?.enablePsychologicalAlerts !== false}
                        onChange={(e) => {
                          updateProfile({
                            preferences: {
                              ...userProfile?.preferences,
                              alertNotifications: {
                                ...userProfile?.preferences?.alertNotifications,
                                enablePsychologicalAlerts: e.target.checked,
                              },
                            },
                          });
                        }}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <label htmlFor="enablePsychologicalAlerts" className="text-sm text-gray-700">
                        <span className="font-medium">Psychological Safety Alerts</span> - Behavioral patterns, tolerance indicators
                      </label>
                    </div>

                    <div className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        id="enableInventoryAlerts"
                        checked={userProfile?.preferences?.alertNotifications?.enableInventoryAlerts !== false}
                        onChange={(e) => {
                          updateProfile({
                            preferences: {
                              ...userProfile?.preferences,
                              alertNotifications: {
                                ...userProfile?.preferences?.alertNotifications,
                                enableInventoryAlerts: e.target.checked,
                              },
                            },
                          });
                        }}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <label htmlFor="enableInventoryAlerts" className="text-sm text-gray-700">
                        <span className="font-medium">Inventory Alerts</span> - Low supply, refill reminders
                      </label>
                    </div>

                    <div className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        id="enableEffectTracking"
                        checked={userProfile?.preferences?.alertNotifications?.enableEffectTracking !== false}
                        onChange={(e) => {
                          updateProfile({
                            preferences: {
                              ...userProfile?.preferences,
                              alertNotifications: {
                                ...userProfile?.preferences?.alertNotifications,
                                enableEffectTracking: e.target.checked,
                              },
                            },
                          });
                        }}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <label htmlFor="enableEffectTracking" className="text-sm text-gray-700">
                        <span className="font-medium">Effect Tracking</span> - Onset, peak, wear-off notifications
                      </label>
                    </div>

                    <div className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        id="enableAdherenceAlerts"
                        checked={userProfile?.preferences?.alertNotifications?.enableAdherenceAlerts !== false}
                        onChange={(e) => {
                          updateProfile({
                            preferences: {
                              ...userProfile?.preferences,
                              alertNotifications: {
                                ...userProfile?.preferences?.alertNotifications,
                                enableAdherenceAlerts: e.target.checked,
                              },
                            },
                          });
                        }}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <label htmlFor="enableAdherenceAlerts" className="text-sm text-gray-700">
                        <span className="font-medium">Adherence Alerts</span> - Missed dose patterns, predictions
                      </label>
                    </div>

                    <div className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        id="enableAchievements"
                        checked={userProfile?.preferences?.alertNotifications?.enableAchievements !== false}
                        onChange={(e) => {
                          updateProfile({
                            preferences: {
                              ...userProfile?.preferences,
                              alertNotifications: {
                                ...userProfile?.preferences?.alertNotifications,
                                enableAchievements: e.target.checked,
                              },
                            },
                          });
                        }}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <label htmlFor="enableAchievements" className="text-sm text-gray-700">
                        <span className="font-medium">Achievement Notifications</span> - Streak milestones, celebrations
                      </label>
                    </div>
                  </div>

                  {/* Quiet Hours */}
                  <div className="mt-6 p-4 border rounded-lg bg-white">
                    <div className="flex items-center space-x-3 mb-4">
                      <input
                        type="checkbox"
                        id="quietHoursEnabled"
                        checked={userProfile?.preferences?.alertNotifications?.quietHours?.enabled || false}
                        onChange={(e) => {
                          updateProfile({
                            preferences: {
                              ...userProfile?.preferences,
                              alertNotifications: {
                                ...userProfile?.preferences?.alertNotifications,
                                quietHours: {
                                  ...userProfile?.preferences?.alertNotifications?.quietHours,
                                  enabled: e.target.checked,
                                  startTime: userProfile?.preferences?.alertNotifications?.quietHours?.startTime || '22:00',
                                  endTime: userProfile?.preferences?.alertNotifications?.quietHours?.endTime || '07:00',
                                },
                              },
                            },
                          });
                        }}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <label htmlFor="quietHoursEnabled" className="text-sm font-medium text-gray-900">
                        Quiet Hours (Critical alerts still delivered)
                      </label>
                    </div>

                    {userProfile?.preferences?.alertNotifications?.quietHours?.enabled && (
                      <div className="grid grid-cols-2 gap-4 ml-7">
                        <div>
                          <label className="block text-xs text-gray-700 mb-1">Start Time</label>
                          <input
                            type="time"
                            value={userProfile?.preferences?.alertNotifications?.quietHours?.startTime || '22:00'}
                            onChange={(e) => {
                              updateProfile({
                                preferences: {
                                  ...userProfile?.preferences,
                                  alertNotifications: {
                                    ...userProfile?.preferences?.alertNotifications,
                                    quietHours: {
                                      ...userProfile?.preferences?.alertNotifications?.quietHours,
                                      enabled: true,
                                      startTime: e.target.value,
                                      endTime: userProfile?.preferences?.alertNotifications?.quietHours?.endTime || '07:00',
                                    },
                                  },
                                },
                              });
                            }}
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-700 mb-1">End Time</label>
                          <input
                            type="time"
                            value={userProfile?.preferences?.alertNotifications?.quietHours?.endTime || '07:00'}
                            onChange={(e) => {
                              updateProfile({
                                preferences: {
                                  ...userProfile?.preferences,
                                  alertNotifications: {
                                    ...userProfile?.preferences?.alertNotifications,
                                    quietHours: {
                                      ...userProfile?.preferences?.alertNotifications?.quietHours,
                                      enabled: true,
                                      startTime: userProfile?.preferences?.alertNotifications?.quietHours?.startTime || '22:00',
                                      endTime: e.target.value,
                                    },
                                  },
                                },
                              });
                            }}
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Security Tab */}
            {activeTab === 'security' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Security Settings</h3>
                  
                  {/* Biometric Authentication */}
                  <div className="mb-6 p-4 rounded-lg border bg-gray-50">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <Fingerprint className="w-5 h-5 text-gray-600" />
                        <div>
                          <span className="font-medium text-gray-900">Biometric Authentication</span>
                          {isNative() && (
                            <p className="text-sm text-gray-600 mt-1">
                              Use fingerprint or face ID to unlock the app
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          checked={userProfile?.preferences?.security?.biometricEnabled || false}
                          onChange={async (e) => {
                            const enabled = e.target.checked;
                            if (enabled) {
                              const result = await biometricService.setupBiometrics();
                              if (result.success) {
                                updateProfile({
                                  preferences: {
                                    ...userProfile?.preferences,
                                    security: {
                                      ...userProfile?.preferences?.security,
                                      biometricEnabled: true,
                                    },
                                  },
                                });
                                toast.success(result.message);
                              } else {
                                toast.error(result.message);
                              }
                            } else {
                              await biometricService.disableBiometrics();
                              updateProfile({
                                preferences: {
                                  ...userProfile?.preferences,
                                  security: {
                                    ...userProfile?.preferences?.security,
                                    biometricEnabled: false,
                                  },
                                },
                              });
                              toast.success('Biometric authentication disabled');
                            }
                          }}
                          disabled={!isNative() || !supportsBiometrics()}
                          className="w-12 h-6 bg-gray-200 rounded-full peer peer-focus:ring-4 peer-focus:ring-blue-300 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                      </div>
                    </div>
                    
                    {!isNative() && (
                      <p className="text-sm text-yellow-600">
                        Biometric authentication is only available on native mobile apps.
                      </p>
                    )}
                    {isNative() && !supportsBiometrics() && (
                      <p className="text-sm text-yellow-600">
                        Biometric authentication is not available on this device.
                      </p>
                    )}
                  </div>

                  {/* App Lock */}
                  <div className="mb-6 p-4 rounded-lg border">
                    <div className="flex items-center space-x-3 mb-4">
                      <Lock className="w-5 h-5 text-gray-600" />
                      <div className="flex-1">
                        <label className="font-medium text-gray-900">App Lock</label>
                        <p className="text-sm text-gray-600 mt-1">
                          Automatically lock the app after a period of inactivity
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={userProfile?.preferences?.security?.appLockEnabled || false}
                        onChange={(e) => {
                          updateProfile({
                            preferences: {
                              ...userProfile?.preferences,
                              security: {
                                ...userProfile?.preferences?.security,
                                appLockEnabled: e.target.checked,
                              },
                            },
                          });
                        }}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                    </div>

                    {userProfile?.preferences?.security?.appLockEnabled && (
                      <div className="ml-8">
                        <label className="block text-sm text-gray-700 mb-2">
                          Auto-lock timeout
                        </label>
                        <select
                          value={userProfile?.preferences?.security?.appLockTimeout || 5}
                          onChange={(e) => {
                            updateProfile({
                              preferences: {
                                ...userProfile?.preferences,
                                security: {
                                  ...userProfile?.preferences?.security,
                                  appLockTimeout: parseInt(e.target.value),
                                },
                              },
                            });
                          }}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        >
                          <option value={1}>1 minute</option>
                          <option value={5}>5 minutes</option>
                          <option value={15}>15 minutes</option>
                          <option value={30}>30 minutes</option>
                          <option value={60}>1 hour</option>
                        </select>
                      </div>
                    )}
                  </div>

                  {/* Auto-lock on Background */}
                  <div className="flex items-center space-x-3 p-4 rounded-lg border">
                    <input
                      type="checkbox"
                      id="autoLockOnBackground"
                      checked={userProfile?.preferences?.security?.autoLockOnBackground !== false}
                      onChange={(e) => {
                        updateProfile({
                          preferences: {
                            ...userProfile?.preferences,
                            security: {
                              ...userProfile?.preferences?.security,
                              autoLockOnBackground: e.target.checked,
                            },
                          },
                        });
                      }}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="autoLockOnBackground" className="flex-1">
                      <span className="text-sm font-medium text-gray-900">Lock when app goes to background</span>
                      <p className="text-xs text-gray-600 mt-1">
                        Require authentication when returning to the app
                      </p>
                    </label>
                  </div>

                  {/* Require PIN for Sensitive Actions */}
                  <div className="flex items-center space-x-3 p-4 rounded-lg border">
                    <input
                      type="checkbox"
                      id="requirePinForSensitiveActions"
                      checked={userProfile?.preferences?.security?.requirePinForSensitiveActions || false}
                      onChange={(e) => {
                        updateProfile({
                          preferences: {
                            ...userProfile?.preferences,
                            security: {
                              ...userProfile?.preferences?.security,
                              requirePinForSensitiveActions: e.target.checked,
                            },
                          },
                        });
                      }}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="requirePinForSensitiveActions" className="flex-1">
                      <span className="text-sm font-medium text-gray-900">Require authentication for sensitive actions</span>
                      <p className="text-xs text-gray-600 mt-1">
                        Require PIN or biometric for deleting data or changing settings
                      </p>
                    </label>
                  </div>

                  {/* Security Status */}
                  <div className="mt-6 p-4 rounded-lg border bg-blue-50">
                    <div className="flex items-start space-x-3">
                      <Shield className="w-5 h-5 text-blue-600 mt-0.5" />
                      <div>
                        <h4 className="font-medium text-blue-900">Security Status</h4>
                        <ul className="mt-2 space-y-1 text-sm text-blue-800">
                          <li>
                            • Biometric: {userProfile?.preferences?.security?.biometricEnabled ? '✅ Enabled' : '❌ Disabled'}
                          </li>
                          <li>
                            • App Lock: {userProfile?.preferences?.security?.appLockEnabled ? '✅ Enabled' : '❌ Disabled'}
                          </li>
                          <li>
                            • Auto-lock on Background: {userProfile?.preferences?.security?.autoLockOnBackground !== false ? '✅ Enabled' : '❌ Disabled'}
                          </li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* PWA Tab */}
            {activeTab === 'pwa' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Progressive Web App Settings</h3>
                  
                  {/* PWA Installation Status */}
                  <div className="mb-6 p-4 rounded-lg border">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <Smartphone className="w-5 h-5 text-gray-600" />
                        <span className="font-medium text-gray-900">App Installation</span>
                      </div>
                      <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                        isPWAInstalled 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {isPWAInstalled ? 'Installed' : 'Web Version'}
                      </div>
                    </div>
                    
                    {!isPWAInstalled && (
                      <div className="space-y-2">
                        <p className="text-sm text-gray-600">
                          Install Meditrax as a mobile app for the best experience:
                        </p>
                        <ul className="text-sm text-gray-600 ml-4 space-y-1">
                          <li>• Works offline</li>
                          <li>• Faster loading</li>
                          <li>• Reliable push notifications</li>
                          <li>• Native app-like experience</li>
                        </ul>
                        <button
                          type="button"
                          onClick={handleInstallPWA}
                          className="mobile-button px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          Install App
                        </button>
                      </div>
                    )}
                    
                    {isPWAInstalled && (
                      <p className="text-sm text-green-600">
                        Great! You're using the installed version of Meditrax.
                      </p>
                    )}
                  </div>

                  {/* Offline Status */}
                  <div className="mb-6 p-4 rounded-lg border">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        {isOnline ? (
                          <Wifi className="w-5 h-5 text-green-600" />
                        ) : (
                          <WifiOff className="w-5 h-5 text-red-600" />
                        )}
                        <span className="font-medium text-gray-900">Connection Status</span>
                      </div>
                      <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                        isOnline 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {isOnline ? 'Online' : 'Offline'}
                      </div>
                    </div>
                    
                    <p className="text-sm text-gray-600">
                      {isOnline 
                        ? 'Your data will sync automatically and you can receive push notifications.'
                        : 'You can still use the app offline. Data will sync when connection is restored.'
                      }
                    </p>
                  </div>

                  {/* Display Preferences */}
                  <div>
                    <h4 className="text-base font-medium text-gray-900 mb-4">Display Preferences</h4>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Theme
                        </label>
                        <select
                          {...register('theme')}
                          className="mobile-input w-full border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value="light">Light</option>
                          <option value="system">System (Auto)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Time Format
                        </label>
                        <select
                          {...register('timeFormat')}
                          className="mobile-input w-full border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value="12h">12 hour (AM/PM)</option>
                          <option value="24h">24 hour</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Date Format
                        </label>
                        <select
                          {...register('dateFormat')}
                          className="mobile-input w-full border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                          <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                          <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Default Page on Open
                        </label>
                        <select
                          {...register('defaultView')}
                          className="mobile-input w-full border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value="dashboard">Dashboard</option>
                          <option value="medications">Medications</option>
                          <option value="calendar">Calendar</option>
                          <option value="analytics">Analytics</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Privacy Tab - DISABLED - Completely removed to prevent parsing errors */}

            {/* Data Tab */}
            {activeTab === 'data' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Data Management</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => setShowExportModal(true)}
                      className="mobile-button flex items-center justify-center space-x-2 p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-gray-400 transition-colors bg-white"
                    >
                      <Download className="w-5 h-5 text-gray-600" />
                      <span>Export Data</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowImportModal(true)}
                      className="mobile-button flex items-center justify-center space-x-2 p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-gray-400 transition-colors bg-white"
                    >
                      <Upload className="w-5 h-5 text-gray-600" />
                      <span>Import Data</span>
                    </button>
                  </div>

                  <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-start space-x-3">
                      <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <h4 className="font-medium text-red-900 mb-2">Danger Zone</h4>
                        <p className="text-sm text-red-700 mb-3">
                          This will permanently delete all your data including medications, logs, and settings.
                        </p>
                        <button
                          type="button"
                          onClick={() => setShowClearDataDialog(true)}
                          className="mobile-button flex items-center space-x-2 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                          <span>Clear All Data</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Diagnostics Tab */}
            {activeTab === 'diagnostics' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">System Diagnostics</h3>
                  <p className="text-gray-600 mb-6">Debug tools and system information for troubleshooting PWA issues.</p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Console Log Capture */}
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <Settings2 className="h-5 w-5 text-gray-600" />
                          <h4 className="font-medium">Console Capture</h4>
                        </div>
                        <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={consoleCaptureEnabled}
                          onChange={(e) => handleConsoleCaptureToggle(e.target.checked)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                          <span className="ml-2 text-sm">Enable</span>
                        </label>
                      </div>
                      <p className="text-sm text-gray-600 mb-4">
                        Capture console logs for debugging. Enable this before testing notifications.
                      </p>
                      {consoleCaptureEnabled && (
                        <div className="bg-white rounded border max-h-64 overflow-y-auto p-3">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-medium text-gray-500">
                              {consoleLogs.length} logs captured
                            </span>
                            <button
                              type="button"
                              onClick={() => consoleCapture.clearLogs()}
                              className="text-xs text-red-600 hover:text-red-700"
                            >
                              Clear
                            </button>
                          </div>
                          {consoleLogs.length === 0 ? (
                            <div className="text-xs text-gray-400 text-center py-4">
                              No logs captured yet. Logs will appear here when console capture is enabled.
                            </div>
                          ) : (
                            <div className="space-y-1">
                              {consoleLogs.slice(-20).map((log, index) => (
                                <div key={index} className="text-xs border-b border-gray-100 pb-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                                      log.type === 'error' ? 'bg-red-100 text-red-700' :
                                      log.type === 'warn' ? 'bg-yellow-100 text-yellow-700' :
                                      log.type === 'info' ? 'bg-blue-100 text-blue-700' :
                                      'bg-gray-100 text-gray-700'
                                    }`}>
                                      {log.type}
                                    </span>
                                    <span className="text-gray-400">
                                      {new Date(log.timestamp).toLocaleTimeString()}
                                    </span>
                                  </div>
                                  <div className="font-mono text-gray-800 whitespace-pre-wrap break-all">
                                    {log.message}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* System Information */}
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <div className="flex items-center gap-2 mb-4">
                        <Smartphone className="h-5 w-5 text-gray-600" />
                        <h4 className="font-medium">System Info</h4>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>Platform:</span>
                          <span className="font-mono">{navigator.platform}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>User Agent:</span>
                          <span className="font-mono text-xs truncate max-w-[200px]" title={navigator.userAgent}>
                            {navigator.userAgent.slice(0, 30)}...
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Online:</span>
                          <span className={`font-medium ${isOnline ? 'text-green-600' : 'text-red-600'}`}>
                            {isOnline ? 'Yes' : 'No'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>PWA Installed:</span>
                          <span className={`font-medium ${isPWAInstalled ? 'text-green-600' : 'text-gray-600'}`}>
                            {isPWAInstalled ? 'Yes' : 'No'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Service Worker:</span>
                          <span className={`font-medium ${
                            'serviceWorker' in navigator ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {'serviceWorker' in navigator ? 'Supported' : 'Not Supported'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Diagnostic Actions */}
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <h4 className="font-medium mb-4 flex items-center gap-2">
                      <Bell className="h-5 w-5 text-blue-600" />
                      Notification Diagnostics
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <button
                        type="button"
                        onClick={() => setShowNotificationDiagnostic(true)}
                        className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        <Settings2 className="h-4 w-4" />
                        Run Full Diagnostic
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          notificationService.debugTestNotification();
                          toast.success('Test notification sent');
                        }}
                        className="flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                      >
                        <Bell className="h-4 w-4" />
                        Test Notification
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await notificationService.implementMissedDoseRecovery();
                            toast.success('Missed dose recovery completed');
                          } catch (error) {
                            toast.error('Recovery failed');
                          }
                        }}
                        className="flex items-center justify-center gap-2 px-4 py-3 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
                      >
                        <AlertTriangle className="h-4 w-4" />
                        Recovery Check
                      </button>
                    </div>
                  </div>

                  {/* iOS PWA Information */}
                  <div className="bg-amber-50 p-4 rounded-lg border border-amber-200">
                    <h4 className="font-semibold text-gray-900 mb-2">🍎 iOS PWA Limitations</h4>
                    <div className="text-sm text-gray-700 space-y-2">
                      <p><strong>Background Notifications:</strong> iOS Safari severely limits service worker execution when PWA is closed.</p>
                      <p><strong>What This Means:</strong> Push notifications may not work reliably when the app is closed.</p>
                      <p><strong>Workarounds:</strong></p>
                      <ul className="ml-4 mt-2 space-y-1 list-disc">
                        <li>Keep the app open when expecting notifications</li>
                        <li>Check the app regularly - we show missed dose alerts when you open it</li>
                        <li>Use iOS Calendar/Reminders as backup</li>
                        <li>Badge count shows missed medications</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Save Button */}
            <div className="flex justify-end pt-6 border-t border-gray-200">
              <button
                type="submit"
                className="btn-primary flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Save className="w-4 h-4" />
                <span>Save Settings</span>
              </button>
            </div>
          </form>
        </div>

        {/* Modals */}
      <ConfirmDialog
        isOpen={showClearDataDialog}
        onClose={() => setShowClearDataDialog(false)}
        onConfirm={handleClearData}
        title="Clear All Data"
        message="Are you sure you want to delete all your data? This action cannot be undone."
        confirmText="Clear All Data"
      />

      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
      />

      <ImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
      />

      <NotificationDiagnosticModal
        isOpen={showNotificationDiagnostic}
        onClose={() => setShowNotificationDiagnostic(false)}
      />

      {/* Privacy Dashboard Modal - DISABLED */}
      {/* <PrivacyDashboardModal
        isOpen={showPrivacyDashboard}
        onClose={() => setShowPrivacyDashboard(false)}
        title="Privacy Dashboard"
        onManageConsent={() => {
          setShowPrivacyDashboard(false);
          setShowConsentModal(true);
        }}
      /> */}

      {/* Consent Management Modal - DISABLED */}
      {/* <ConsentManagementModal
        isOpen={showConsentModal}
        onClose={() => setShowConsentModal(false)}
        title="Manage Data Sharing Consent"
        onConsentUpdated={handleConsentUpdated}
      /> */}
    </div>
  );
}