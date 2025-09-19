import { useState, useEffect } from 'react';
import {
  Shield,
  Eye,
  Database,
  Users,
  CheckCircle,
  AlertCircle,
  Settings,
  X,
  Info,
  BarChart3,
  Lock
} from 'lucide-react';
import { ModalProps, PrivacyDashboardData, AnonymousDataType } from '@/types';
import { anonymousReportingService } from '@/services/anonymousReportingService';
import toast from 'react-hot-toast';

interface PrivacyDashboardModalProps extends Omit<ModalProps, 'children'> {
  onManageConsent: () => void;
}

export function PrivacyDashboardModal({ 
  isOpen, 
  onClose, 
  title = "Privacy Dashboard",
  onManageConsent 
}: PrivacyDashboardModalProps) {
  const [dashboardData, setDashboardData] = useState<PrivacyDashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      loadDashboardData();
    }
  }, [isOpen]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const data = await anonymousReportingService.getPrivacyDashboard();
      setDashboardData(data);
    } catch (error) {
      console.error('Error loading privacy dashboard:', error);
      toast.error('Failed to load privacy dashboard');
    } finally {
      setLoading(false);
    }
  };

  const getConsentStatusColor = (status: string) => {
    switch (status) {
      case 'granted': return 'text-green-600 bg-green-50';
      case 'revoked': return 'text-red-600 bg-red-50';
      case 'never_granted': return 'text-gray-600 bg-gray-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getConsentStatusIcon = (status: string) => {
    switch (status) {
      case 'granted': return <CheckCircle className="w-5 h-5" />;
      case 'revoked': return <AlertCircle className="w-5 h-5" />;
      case 'never_granted': return <Info className="w-5 h-5" />;
      default: return <Info className="w-5 h-5" />;
    }
  };

  const formatDataType = (type: AnonymousDataType): string => {
    const typeMap = {
      adherence: 'Medication Adherence',
      side_effects: 'Side Effects',
      medication_patterns: 'Medication Patterns',
      risk_assessments: 'Risk Assessments'
    };
    return typeMap[type] || type;
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
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-gray-600">Loading privacy dashboard...</span>
            </div>
          ) : dashboardData ? (
            <div className="space-y-6">
              {/* Consent Status */}
              <div className="bg-gray-50 rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900 flex items-center">
                    <Eye className="w-5 h-5 mr-2" />
                    Consent Status
                  </h3>
                  <button
                    onClick={onManageConsent}
                    className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Settings className="w-4 h-4" />
                    <span>Manage Consent</span>
                  </button>
                </div>
                
                <div className={`flex items-center space-x-3 p-4 rounded-lg ${getConsentStatusColor(dashboardData.consentStatus)}`}>
                  {getConsentStatusIcon(dashboardData.consentStatus)}
                  <div>
                    <p className="font-medium">
                      {dashboardData.consentStatus === 'granted' && 'Consent Granted'}
                      {dashboardData.consentStatus === 'revoked' && 'Consent Revoked'}
                      {dashboardData.consentStatus === 'never_granted' && 'No Consent Given'}
                    </p>
                    <p className="text-sm opacity-75">
                      {dashboardData.consentStatus === 'granted' && 'You have consented to anonymous data sharing for research'}
                      {dashboardData.consentStatus === 'revoked' && 'Your consent has been revoked - no data is being shared'}
                      {dashboardData.consentStatus === 'never_granted' && 'You have not yet consented to anonymous data sharing'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Data Sharing Summary */}
              <div className="bg-gray-50 rounded-lg p-6">
                <h3 className="text-lg font-medium text-gray-900 flex items-center mb-4">
                  <Database className="w-5 h-5 mr-2" />
                  Data Sharing Summary
                </h3>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div className="bg-white p-4 rounded-lg text-center">
                    <div className="text-2xl font-bold text-blue-600 mb-1">
                      {dashboardData.dataShared.totalSubmissions}
                    </div>
                    <div className="text-sm text-gray-600">Total Submissions</div>
                  </div>
                  
                  <div className="bg-white p-4 rounded-lg text-center">
                    <div className="text-2xl font-bold text-green-600 mb-1">
                      {dashboardData.privacyScore}%
                    </div>
                    <div className="text-sm text-gray-600">Privacy Score</div>
                  </div>
                  
                  <div className="bg-white p-4 rounded-lg text-center">
                    <div className="text-2xl font-bold text-purple-600 mb-1">
                      {Object.keys(dashboardData.dataShared.byType).length}
                    </div>
                    <div className="text-sm text-gray-600">Data Types</div>
                  </div>
                  
                  <div className="bg-white p-4 rounded-lg text-center">
                    <div className="text-2xl font-bold text-orange-600 mb-1">
                      {dashboardData.dataShared.lastSubmission ? 
                        new Date(dashboardData.dataShared.lastSubmission).toLocaleDateString() : 'Never'
                      }
                    </div>
                    <div className="text-sm text-gray-600">Last Submission</div>
                  </div>
                </div>

                {/* Data by Type */}
                {Object.keys(dashboardData.dataShared.byType).length > 0 && (
                  <div>
                    <h4 className="text-md font-medium text-gray-800 mb-3 flex items-center">
                      <BarChart3 className="w-4 h-4 mr-2" />
                      Submissions by Data Type
                    </h4>
                    <div className="space-y-2">
                      {Object.entries(dashboardData.dataShared.byType).map(([type, count]) => (
                        <div key={type} className="flex items-center justify-between p-3 bg-white rounded-lg">
                          <span className="text-gray-700">{formatDataType(type as AnonymousDataType)}</span>
                          <span className="font-medium text-gray-900">{count} submissions</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Privacy Protections */}
              <div className="bg-gray-50 rounded-lg p-6">
                <h3 className="text-lg font-medium text-gray-900 flex items-center mb-4">
                  <Lock className="w-5 h-5 mr-2" />
                  Privacy Protections
                </h3>
                
                <div className="grid gap-3">
                  {dashboardData.protections.map((protection, index) => (
                    <div key={index} className="flex items-start space-x-3 p-3 bg-white rounded-lg">
                      <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                      <span className="text-gray-700">{protection}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* User Rights */}
              <div className="bg-gray-50 rounded-lg p-6">
                <h3 className="text-lg font-medium text-gray-900 flex items-center mb-4">
                  <Users className="w-5 h-5 mr-2" />
                  Your Rights
                </h3>
                
                <div className="grid gap-3">
                  {dashboardData.userRights.map((right, index) => (
                    <div key={index} className="flex items-start space-x-3 p-3 bg-white rounded-lg">
                      <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                      <span className="text-gray-700">{right}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Important Note */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-yellow-800">
                    <p className="font-medium mb-1">Important Privacy Notice</p>
                    <p>
                      All shared data is completely anonymized using multiple privacy-preserving techniques. 
                      Your personal information cannot be identified from the anonymized data. 
                      You can revoke consent at any time, but previously anonymized data cannot be deleted 
                      due to its anonymous nature.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">Unable to load privacy dashboard data</p>
              <button
                onClick={loadDashboardData}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Retry
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end space-x-3 p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Close
          </button>
          {dashboardData?.consentStatus === 'granted' && (
            <button
              onClick={onManageConsent}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Manage Preferences
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
