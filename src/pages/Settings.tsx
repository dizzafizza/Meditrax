import React from 'react';
import { useForm } from 'react-hook-form';
import { 
  User, 
  Bell, 
  // Shield, // DISABLED - no longer needed
  Download, 
  Upload,
  Trash2,
  Save,
  AlertTriangle,
  Moon,
  Sun,
  Monitor
  // Eye, // DISABLED - no longer needed
  // UserCheck, // DISABLED - no longer needed
  // CheckCircle // DISABLED - no longer needed
} from 'lucide-react';
import { useMedicationStore } from '@/store';
import { UserProfile } from '@/types';
// import { AnonymousReportingPreferences } from '@/types'; // DISABLED
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ExportModal } from '@/components/ui/ExportModal';
import { ImportModal } from '@/components/ui/ImportModal';
// import { PrivacyDashboardModal } from '@/components/modals/PrivacyDashboardModal'; // DISABLED
// import { ConsentManagementModal } from '@/components/modals/ConsentManagementModal'; // DISABLED  
// import { anonymousReportingService } from '@/services/anonymousReportingService'; // DISABLED
// import { generateCSV, downloadFile } from '@/utils/helpers';
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

  const [activeTab, setActiveTab] = React.useState<'profile' | 'notifications' | 'data'>('profile');
  const [showClearDataDialog, setShowClearDataDialog] = React.useState(false);
  const [showExportModal, setShowExportModal] = React.useState(false);
  const [showImportModal, setShowImportModal] = React.useState(false);
  // const [showPrivacyDashboard, setShowPrivacyDashboard] = React.useState(false); // DISABLED
  // const [showConsentModal, setShowConsentModal] = React.useState(false); // DISABLED
  // const [anonymousReportingPrefs, setAnonymousReportingPrefs] = React.useState<AnonymousReportingPreferences | null>(null); // DISABLED
  // const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Load anonymous reporting preferences on component mount
  // React.useEffect(() => { // DISABLED
  //   loadAnonymousReportingPreferences();
  // }, []);

  // const loadAnonymousReportingPreferences = async () => { // DISABLED
  //   try {
  //     const prefs = await anonymousReportingService.getConsentStatus();
  //     setAnonymousReportingPrefs(prefs);
  //   } catch (error) {
  //     console.error('Error loading anonymous reporting preferences:', error);
  //   }
  // };

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
      reminderAdvance: 15,
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
        reminderAdvance: userProfile.preferences?.notifications?.reminderAdvance ?? 15,
        timeFormat: userProfile.preferences?.display?.timeFormat || '12h',
        dateFormat: userProfile.preferences?.display?.dateFormat || 'MM/DD/YYYY',
        defaultView: userProfile.preferences?.display?.defaultView || 'dashboard',
      });
    }
  }, [userProfile, reset]);

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
          reminderAdvance: data.reminderAdvance,
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
  //     downloadFile(jsonData, `medtrack-export-${new Date().toISOString().split('T')[0]}.json`, 'application/json');
  //     toast.success('Data exported successfully');
  //   } catch (error) {
  //     toast.error('Failed to export data');
  //   }
  // };

  // const handleExportCSV = () => {
  //   try {
  //     const csvData = generateCSV(logs, ['timestamp', 'medicationId', 'dosageTaken', 'adherence']);
  //     downloadFile(csvData, `medtrack-logs-${new Date().toISOString().split('T')[0]}.csv`, 'text/csv');
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

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    // { id: 'privacy', label: 'Privacy', icon: Shield }, // DISABLED
    { id: 'data', label: 'Data', icon: Download },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-white rounded-lg shadow">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200">
            <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
            <p className="text-gray-600">Manage your account and application preferences</p>
          </div>

          {/* Tab Navigation */}
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              ))}
            </nav>
          </div>

          {/* Content */}
          <form onSubmit={handleSubmit(onSubmit)} className="p-6">
            {/* Profile Tab */}
            {activeTab === 'profile' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Personal Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Full Name
                      </label>
                      <input
                        type="text"
                        {...register('name', { required: 'Name is required' })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Emergency Contact</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Contact Name
                      </label>
                      <input
                        type="text"
                        {...register('emergencyContactName')}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Relationship
                      </label>
                      <input
                        type="text"
                        {...register('emergencyContactRelationship')}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Phone Number
                      </label>
                      <input
                        type="tel"
                        {...register('emergencyContactPhone')}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Email
                      </label>
                      <input
                        type="email"
                        {...register('emergencyContactEmail')}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Notification Settings</h3>
                  <div className="space-y-4">
                    <div className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        id="pushNotifications"
                        {...register('pushNotifications')}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <label htmlFor="pushNotifications" className="text-sm text-gray-700">
                        Enable push notifications
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
                        Enable vibration for notifications
                      </label>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Reminder advance time (minutes)
                      </label>
                      <select
                        {...register('reminderAdvance')}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value={5}>5 minutes</option>
                        <option value={10}>10 minutes</option>
                        <option value={15}>15 minutes</option>
                        <option value={30}>30 minutes</option>
                        <option value={60}>1 hour</option>
                      </select>
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
                      className="flex items-center justify-center space-x-2 p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-gray-400 transition-colors"
                    >
                      <Download className="w-5 h-5 text-gray-600" />
                      <span>Export Data</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowImportModal(true)}
                      className="flex items-center justify-center space-x-2 p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-gray-400 transition-colors"
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
                          className="flex items-center space-x-2 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
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

            {/* Save Button */}
            <div className="flex justify-end pt-6 border-t border-gray-200">
              <button
                type="submit"
                className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Save className="w-4 h-4" />
                <span>Save Settings</span>
              </button>
            </div>
          </form>
        </div>
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