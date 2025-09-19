import { useState, useEffect } from 'react';
import {
  Shield,
  CheckCircle,
  AlertTriangle,
  Info,
  Eye,
  EyeOff,
  X,
  Save,
  Trash2
} from 'lucide-react';
import { ModalProps, AnonymousReportingPreferences, AnonymousDataType } from '@/types';
import { anonymousReportingService } from '@/services/anonymousReportingService';
import toast from 'react-hot-toast';

interface ConsentManagementModalProps extends Omit<ModalProps, 'children'> {
  onConsentUpdated: (preferences: AnonymousReportingPreferences) => void;
}

export function ConsentManagementModal({ 
  isOpen, 
  onClose, 
  title = "Manage Data Sharing Consent",
  onConsentUpdated 
}: ConsentManagementModalProps) {
  const [preferences, setPreferences] = useState<AnonymousReportingPreferences>({
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
  });
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [privacyInfo, setPrivacyInfo] = useState<any>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadCurrentPreferences();
      loadPrivacyInfo();
    }
  }, [isOpen]);

  const loadCurrentPreferences = async () => {
    try {
      setLoading(true);
      const currentPreferences = await anonymousReportingService.getConsentStatus();
      if (currentPreferences) {
        setPreferences(currentPreferences);
      }
    } catch (error) {
      console.error('Error loading preferences:', error);
      toast.error('Failed to load current preferences');
    } finally {
      setLoading(false);
    }
  };

  const loadPrivacyInfo = async () => {
    try {
      const info = await anonymousReportingService.getPrivacyInfo();
      setPrivacyInfo(info);
    } catch (error) {
      console.error('Error loading privacy info:', error);
    }
  };

  const handleDataTypeChange = (dataType: AnonymousDataType, enabled: boolean) => {
    setPreferences(prev => {
      const newDataTypes = enabled 
        ? [...prev.dataTypesAllowed, dataType]
        : prev.dataTypesAllowed.filter(type => type !== dataType);
      
      // Update granular controls based on data types
      const newGranularControls = { ...prev.granularControls };
      
      switch (dataType) {
        case 'adherence':
          newGranularControls.includeAdherence = enabled;
          break;
        case 'side_effects':
          newGranularControls.includeSideEffects = enabled;
          break;
        case 'medication_patterns':
          newGranularControls.includeMedicationPatterns = enabled;
          break;
        case 'risk_assessments':
          newGranularControls.includeRiskAssessments = enabled;
          break;
      }

      return {
        ...prev,
        dataTypesAllowed: newDataTypes,
        granularControls: newGranularControls,
        enabled: newDataTypes.length > 0,
        consentGiven: newDataTypes.length > 0
      };
    });
  };

  const handlePrivacyLevelChange = (level: 'minimal' | 'standard' | 'detailed') => {
    setPreferences(prev => ({
      ...prev,
      privacyLevel: level,
      granularControls: {
        ...prev.granularControls,
        allowTemporalAnalysis: level !== 'minimal',
        allowDemographicAnalysis: level === 'detailed'
      }
    }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      
      if (preferences.consentGiven && preferences.dataTypesAllowed.length > 0) {
        // Grant or update consent
        const success = preferences.consentDate 
          ? await anonymousReportingService.updateConsent(preferences)
          : await anonymousReportingService.grantConsent(preferences);
        
        if (success) {
          toast.success('Consent preferences saved successfully');
          onConsentUpdated(preferences);
          onClose();
        } else {
          toast.error('Failed to save consent preferences');
        }
      } else {
        // Revoke consent
        const success = await anonymousReportingService.revokeConsent('User disabled data sharing');
        
        if (success) {
          toast.success('Consent revoked successfully');
          onConsentUpdated({
            ...preferences,
            enabled: false,
            consentGiven: false,
            dataTypesAllowed: []
          });
          onClose();
        } else {
          toast.error('Failed to revoke consent');
        }
      }
    } catch (error) {
      console.error('Error saving preferences:', error);
      toast.error('Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  const handleRevokeConsent = async () => {
    if (!confirm('Are you sure you want to revoke consent for anonymous data sharing? This will stop all data collection.')) {
      return;
    }

    try {
      setSaving(true);
      const success = await anonymousReportingService.revokeConsent('User manually revoked consent');
      
      if (success) {
        toast.success('Consent revoked successfully');
        setPreferences(prev => ({
          ...prev,
          enabled: false,
          consentGiven: false,
          dataTypesAllowed: [],
          granularControls: {
            includeAdherence: false,
            includeSideEffects: false,
            includeMedicationPatterns: false,
            includeRiskAssessments: false,
            allowTemporalAnalysis: false,
            allowDemographicAnalysis: false
          }
        }));
        onConsentUpdated({
          ...preferences,
          enabled: false,
          consentGiven: false
        });
      } else {
        toast.error('Failed to revoke consent');
      }
    } catch (error) {
      console.error('Error revoking consent:', error);
      toast.error('Failed to revoke consent');
    } finally {
      setSaving(false);
    }
  };

  const getDataTypeInfo = (dataType: AnonymousDataType) => {
    if (!privacyInfo?.dataTypes) return null;
    return privacyInfo.dataTypes[dataType];
  };

  const getSensitivityColor = (sensitivity: string) => {
    switch (sensitivity) {
      case 'high': return 'text-red-600 bg-red-50';
      case 'medium': return 'text-yellow-600 bg-yellow-50';
      case 'low': return 'text-green-600 bg-green-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 glass-overlay flex items-center justify-center z-[60] p-4">
      <div className="glass-panel rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Shield className="w-6 h-6 text-blue-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-gray-600">Loading consent preferences...</span>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Information Banner */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-blue-800">
                    <p className="font-medium mb-1">Anonymous Medical Research</p>
                    <p>
                      Help improve medication safety and effectiveness by sharing anonymized data for medical research. 
                      Your privacy is protected through multiple layers of anonymization - no personal information 
                      can be identified from the shared data.
                    </p>
                  </div>
                </div>
              </div>

              {/* Privacy Level Selection */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-gray-900">Privacy Level</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {(['minimal', 'standard', 'detailed'] as const).map((level) => (
                    <div key={level} className="relative">
                      <input
                        type="radio"
                        id={`privacy-${level}`}
                        name="privacyLevel"
                        value={level}
                        checked={preferences.privacyLevel === level}
                        onChange={() => handlePrivacyLevelChange(level)}
                        className="sr-only"
                      />
                      <label
                        htmlFor={`privacy-${level}`}
                        className={`block p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                          preferences.privacyLevel === level
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="text-center">
                          <div className="font-medium text-gray-900 capitalize mb-1">{level}</div>
                          <div className="text-sm text-gray-600">
                            {level === 'minimal' && 'Maximum privacy, basic aggregated data only'}
                            {level === 'standard' && 'Balanced privacy with weekly patterns'}
                            {level === 'detailed' && 'More research value, still fully anonymized'}
                          </div>
                        </div>
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Data Types Selection */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-gray-900">Data Types to Share</h3>
                <div className="space-y-3">
                  {(['adherence', 'side_effects', 'medication_patterns', 'risk_assessments'] as AnonymousDataType[]).map((dataType) => {
                    const info = getDataTypeInfo(dataType);
                    const isEnabled = preferences.dataTypesAllowed.includes(dataType);
                    
                    return (
                      <div key={dataType} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-start space-x-3">
                          <div className="flex items-center h-5">
                            <input
                              type="checkbox"
                              id={`dataType-${dataType}`}
                              checked={isEnabled}
                              onChange={(e) => handleDataTypeChange(dataType, e.target.checked)}
                              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            />
                          </div>
                          <div className="flex-1">
                            <label 
                              htmlFor={`dataType-${dataType}`}
                              className="text-sm font-medium text-gray-900 cursor-pointer"
                            >
                              {info?.description || dataType.replace('_', ' ')}
                            </label>
                            {info && (
                              <div className="mt-2 flex items-center space-x-4">
                                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getSensitivityColor(info.sensitivity)}`}>
                                  Sensitivity: {info.sensitivity}
                                </span>
                                <span className="text-xs text-gray-600">
                                  Purpose: {info.purpose}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Advanced Options */}
              <div className="space-y-4">
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="flex items-center space-x-2 text-sm text-blue-600 hover:text-blue-700"
                >
                  {showAdvanced ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  <span>{showAdvanced ? 'Hide' : 'Show'} Advanced Options</span>
                </button>

                {showAdvanced && (
                  <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                    <h4 className="font-medium text-gray-900">Additional Privacy Controls</h4>
                    
                    <div className="space-y-3">
                      <div className="flex items-center space-x-3">
                        <input
                          type="checkbox"
                          id="temporalAnalysis"
                          checked={preferences.granularControls.allowTemporalAnalysis}
                          onChange={(e) => setPreferences(prev => ({
                            ...prev,
                            granularControls: {
                              ...prev.granularControls,
                              allowTemporalAnalysis: e.target.checked
                            }
                          }))}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <label htmlFor="temporalAnalysis" className="text-sm text-gray-700">
                          Allow temporal pattern analysis (time-based trends)
                        </label>
                      </div>
                      
                      <div className="flex items-center space-x-3">
                        <input
                          type="checkbox"
                          id="demographicAnalysis"
                          checked={preferences.granularControls.allowDemographicAnalysis}
                          onChange={(e) => setPreferences(prev => ({
                            ...prev,
                            granularControls: {
                              ...prev.granularControls,
                              allowDemographicAnalysis: e.target.checked
                            }
                          }))}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <label htmlFor="demographicAnalysis" className="text-sm text-gray-700">
                          Allow demographic analysis (age ranges only, no specific ages)
                        </label>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Privacy Protections Summary */}
              {privacyInfo?.protections && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h4 className="font-medium text-green-900 mb-2 flex items-center">
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Privacy Protections Active
                  </h4>
                  <div className="text-sm text-green-800 space-y-1">
                    {privacyInfo.protections.slice(0, 3).map((protection: string, index: number) => (
                      <div key={index} className="flex items-center space-x-2">
                        <div className="w-1 h-1 bg-green-600 rounded-full"></div>
                        <span>{protection}</span>
                      </div>
                    ))}
                    {privacyInfo.protections.length > 3 && (
                      <div className="text-xs text-green-700">
                        +{privacyInfo.protections.length - 3} more protections
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Current Status */}
              {preferences.consentGiven && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <AlertTriangle className="w-5 h-5 text-yellow-600" />
                      <div>
                        <p className="font-medium text-yellow-900">Active Consent</p>
                        <p className="text-sm text-yellow-800">
                          You currently have active consent for anonymous data sharing
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={handleRevokeConsent}
                      disabled={saving}
                      className="flex items-center space-x-2 px-3 py-2 text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Revoke Consent</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center p-6 border-t border-gray-200 bg-gray-50">
          <div className="text-sm text-gray-600">
            {preferences.dataTypesAllowed.length > 0 ? (
              <span className="text-green-600">
                ✓ {preferences.dataTypesAllowed.length} data type(s) selected
              </span>
            ) : (
              <span className="text-gray-500">No data types selected</span>
            )}
          </div>
          
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center space-x-2"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Saving...' : 'Save Preferences'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
