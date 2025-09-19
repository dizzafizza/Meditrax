import React from 'react';
import { X, Shield, ShieldAlert, AlertTriangle, Clock, TrendingUp, Activity, Brain, Calendar, CheckCircle, XCircle } from 'lucide-react';
import { useMedicationStore } from '@/store';
import { Medication, DependencePrevention, DependenceAlert } from '@/types';
import { DependencePreventionService } from '@/services/dependencePreventionService';
import { formatDate, formatTime } from '@/utils/helpers';
import toast from 'react-hot-toast';

interface DependencyPreventionModalProps {
  isOpen: boolean;
  onClose: () => void;
  medication: Medication;
}

export function DependencyPreventionModal({ isOpen, onClose, medication }: DependencyPreventionModalProps) {
  const { updateMedication, addSmartMessage, logs } = useMedicationStore();
  const [activeTab, setActiveTab] = React.useState<'overview' | 'alerts' | 'timeline' | 'recommendations'>('overview');
  
  // Get or initialize dependency prevention data
  const dependencyPrevention = React.useMemo(() => {
    if (medication.dependencePrevention) {
      return medication.dependencePrevention;
    }
    return DependencePreventionService.initializePrevention(medication);
  }, [medication]);

  // Get usage patterns from medication logs
  const usagePatterns = React.useMemo(() => {
    const medicationLogs = logs.filter(log => log.medicationId === medication.id);
    return medicationLogs.slice(-30).map(log => ({
      date: log.timestamp,
      doseTaken: log.dosage || parseFloat(medication.dosage),
      selfAdjustment: log.dosage !== parseFloat(medication.dosage),
      cravingLevel: log.adherenceDetails?.cravingLevel,
      anxietyBeforeDose: log.adherenceDetails?.anxietyBeforeDose,
      effectivenessRating: log.adherenceDetails?.effectivenessRating,
      sideEffects: log.adherenceDetails?.sideEffects || []
    }));
  }, [logs, medication.id, medication.dosage]);

  // Calculate current risk assessment
  const currentAssessment = React.useMemo(() => {
    return DependencePreventionService.assessCurrentRisk(medication, usagePatterns);
  }, [medication, usagePatterns]);

  // Get tapering recommendation
  const taperingRecommendation = React.useMemo(() => {
    return DependencePreventionService.generateTaperingRecommendation(medication);
  }, [medication]);

  const unacknowledgedAlerts = currentAssessment.alerts.filter(alert => !alert.acknowledged);
  const acknowledgedAlerts = currentAssessment.alerts.filter(alert => alert.acknowledged);

  const handleAcknowledgeAlert = (alertId: string) => {
    const updatedAlerts = currentAssessment.alerts.map(alert =>
      alert.id === alertId ? { ...alert, acknowledged: true } : alert
    );

    updateMedication(medication.id, {
      dependencePrevention: {
        ...currentAssessment,
        alerts: updatedAlerts
      }
    });

    toast.success('Alert acknowledged');
  };

  const handleUpdatePreventionData = () => {
    updateMedication(medication.id, {
      dependencePrevention: {
        ...currentAssessment,
        lastUpdated: new Date()
      }
    });

    addSmartMessage({
      medicationId: medication.id,
      type: 'risk-alert',
      priority: currentAssessment.riskLevel === 'very-high' ? 'urgent' : 'high',
      title: 'Dependency Prevention Assessment Updated',
      message: `Risk level: ${currentAssessment.riskLevel}. ${currentAssessment.taperingRecommended ? 'Tapering is recommended.' : 'Continue monitoring usage patterns.'}`,
      psychologicalApproach: 'informative-support',
      scheduledTime: new Date()
    });

    toast.success('Dependency prevention data updated');
  };

  const getRiskColor = (riskLevel: string) => {
    switch (riskLevel) {
      case 'very-high': return 'text-red-700 bg-red-100 border-red-300';
      case 'high': return 'text-red-600 bg-red-50 border-red-200';
      case 'moderate': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'low': return 'text-green-600 bg-green-50 border-green-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'text-red-700 bg-red-100 border-red-300';
      case 'high': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      default: return 'text-blue-600 bg-blue-50 border-blue-200';
    }
  };

  const getCurrentDuration = () => {
    const now = new Date();
    const start = new Date(medication.startDate);
    return Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 glass-overlay flex items-center justify-center p-4 z-[60]">
      <div className="glass-panel rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="sticky top-0 bg-white/70 backdrop-blur-md border-b border-gray-200/70 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Shield className="h-6 w-6 text-blue-600" />
              <div>
                <h3 className="text-lg font-medium text-gray-900">
                  Dependency Prevention Dashboard
                </h3>
                <p className="text-sm text-gray-500">
                  {medication.name} • {medication.dependencyRiskCategory.replace('-', ' ')} category
                </p>
              </div>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Tab Navigation */}
          <div className="mt-4 border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              {[
                { id: 'overview', label: 'Overview', icon: Activity },
                { id: 'alerts', label: 'Alerts', icon: AlertTriangle, badge: unacknowledgedAlerts.length },
                { id: 'timeline', label: 'Timeline', icon: Clock },
                { id: 'recommendations', label: 'Recommendations', icon: Brain }
              ].map(({ id, label, icon: Icon, badge }) => (
                <button
                  key={id}
                  onClick={() => setActiveTab(id as any)}
                  className={`flex items-center space-x-2 py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{label}</span>
                  {badge && badge > 0 && (
                    <span className="bg-red-100 text-red-800 text-xs rounded-full px-2 py-0.5">
                      {badge}
                    </span>
                  )}
                </button>
              ))}
            </nav>
          </div>
        </div>

        <div className="px-6 py-4">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Current Status */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="flex items-center space-x-2 mb-2">
                    <Shield className="h-5 w-5 text-blue-600" />
                    <span className="font-medium text-gray-900">Current Risk Level</span>
                  </div>
                  <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getRiskColor(currentAssessment.riskLevel)}`}>
                    {currentAssessment.riskLevel.replace('-', ' ').toUpperCase()}
                  </div>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="flex items-center space-x-2 mb-2">
                    <Calendar className="h-5 w-5 text-green-600" />
                    <span className="font-medium text-gray-900">Duration</span>
                  </div>
                  <div className="text-lg font-semibold text-gray-900">
                    {getCurrentDuration()} days
                  </div>
                  <div className="text-sm text-gray-500">
                    Recommended max: {currentAssessment.recommendedMaxDuration} days
                  </div>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="flex items-center space-x-2 mb-2">
                    <TrendingUp className="h-5 w-5 text-orange-600" />
                    <span className="font-medium text-gray-900">Tapering Status</span>
                  </div>
                  <div className={`text-sm font-medium ${
                    currentAssessment.taperingRecommended ? 'text-orange-600' : 'text-green-600'
                  }`}>
                    {currentAssessment.taperingRecommended 
                      ? `${currentAssessment.taperingUrgency.replace('-', ' ')} recommended`
                      : 'Not needed'
                    }
                  </div>
                </div>
              </div>

              {/* Risk Factors */}
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-3">Risk Assessment Factors</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <span className="text-sm font-medium text-gray-700">Medication Category:</span>
                    <p className="text-sm text-gray-900">{medication.dependencyRiskCategory.replace('-', ' ')}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-700">Dependence Type:</span>
                    <p className="text-sm text-gray-900">{currentAssessment.dependenceType}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-700">Usage Patterns Analyzed:</span>
                    <p className="text-sm text-gray-900">{usagePatterns.length} entries</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-700">Doctor Review Required:</span>
                    <p className={`text-sm font-medium ${currentAssessment.doctorReviewRequired ? 'text-orange-600' : 'text-green-600'}`}>
                      {currentAssessment.doctorReviewRequired ? 'Yes' : 'No'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Educational Resources */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-medium text-blue-900 mb-3">Educational Resources</h4>
                <div className="space-y-2">
                  {currentAssessment.educationalResources.map((resource, index) => (
                    <div key={index} className="flex items-start space-x-2">
                      <Brain className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-blue-800">{resource}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Alerts Tab */}
          {activeTab === 'alerts' && (
            <div className="space-y-6">
              {/* Unacknowledged Alerts */}
              {unacknowledgedAlerts.length > 0 && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-4 flex items-center space-x-2">
                    <AlertTriangle className="h-5 w-5 text-red-500" />
                    <span>Active Alerts ({unacknowledgedAlerts.length})</span>
                  </h4>
                  <div className="space-y-3">
                    {unacknowledgedAlerts.map((alert) => (
                      <div key={alert.id} className={`border rounded-lg p-4 ${getPriorityColor(alert.priority)}`}>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-2">
                              <span className="font-medium">{alert.type.replace('-', ' ').toUpperCase()}</span>
                              <span className={`px-2 py-1 rounded text-xs font-medium ${getPriorityColor(alert.priority)}`}>
                                {alert.priority}
                              </span>
                            </div>
                            <p className="text-sm mb-2">{alert.message}</p>
                            <div className="text-xs text-gray-600">
                              <span>Triggered: {formatDate(alert.timestamp)} at {formatTime(alert.timestamp)}</span>
                              <span className="ml-4">Source: {alert.trigger}</span>
                            </div>
                          </div>
                          <button
                            onClick={() => handleAcknowledgeAlert(alert.id)}
                            className="ml-4 px-3 py-1 text-sm bg-white border border-gray-300 rounded hover:bg-gray-50"
                          >
                            Acknowledge
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Acknowledged Alerts */}
              {acknowledgedAlerts.length > 0 && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-4 flex items-center space-x-2">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <span>Acknowledged Alerts ({acknowledgedAlerts.length})</span>
                  </h4>
                  <div className="space-y-3">
                    {acknowledgedAlerts.slice(0, 5).map((alert) => (
                      <div key={alert.id} className="border border-gray-200 bg-gray-50 rounded-lg p-4">
                        <div className="flex items-start space-x-3">
                          <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-1">
                              <span className="text-sm font-medium text-gray-700">{alert.type.replace('-', ' ')}</span>
                              <span className="text-xs text-gray-500">{alert.priority}</span>
                            </div>
                            <p className="text-sm text-gray-600">{alert.message}</p>
                            <div className="text-xs text-gray-500 mt-1">
                              {formatDate(alert.timestamp)}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {currentAssessment.alerts.length === 0 && (
                <div className="text-center py-8">
                  <CheckCircle className="mx-auto h-12 w-12 text-green-500" />
                  <h3 className="mt-4 text-lg font-medium text-gray-900">No Alerts</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    All dependency prevention indicators are within normal ranges.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Timeline Tab */}
          {activeTab === 'timeline' && (
            <div className="space-y-6">
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-3">Medication Timeline</h4>
                <div className="space-y-4">
                  <div className="flex items-center space-x-4">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    <div>
                      <div className="text-sm font-medium text-gray-900">Started Medication</div>
                      <div className="text-xs text-gray-500">{formatDate(medication.startDate)}</div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-4">
                    <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                    <div>
                      <div className="text-sm font-medium text-gray-900">Reached Review Period</div>
                      <div className="text-xs text-gray-500">
                        {getCurrentDuration()} days (Review every {currentAssessment.reviewFrequency} days)
                      </div>
                    </div>
                  </div>

                  {getCurrentDuration() > currentAssessment.recommendedMaxDuration && (
                    <div className="flex items-center space-x-4">
                      <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                      <div>
                        <div className="text-sm font-medium text-gray-900">Exceeded Recommended Duration</div>
                        <div className="text-xs text-gray-500">
                          {getCurrentDuration() - currentAssessment.recommendedMaxDuration} days over recommended
                        </div>
                      </div>
                    </div>
                  )}

                  {currentAssessment.alerts.map((alert) => (
                    <div key={alert.id} className="flex items-center space-x-4">
                      <div className={`w-3 h-3 rounded-full ${
                        alert.priority === 'critical' ? 'bg-red-500' :
                        alert.priority === 'high' ? 'bg-orange-500' :
                        'bg-yellow-500'
                      }`}></div>
                      <div>
                        <div className="text-sm font-medium text-gray-900">Alert: {alert.type.replace('-', ' ')}</div>
                        <div className="text-xs text-gray-500">{formatDate(alert.timestamp)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Recommendations Tab */}
          {activeTab === 'recommendations' && (
            <div className="space-y-6">
              {/* Tapering Recommendation */}
              <div className="border border-gray-200 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-3 flex items-center space-x-2">
                  <TrendingUp className="h-5 w-5 text-blue-600" />
                  <span>Tapering Assessment</span>
                </h4>
                
                {taperingRecommendation.recommended ? (
                  <div className="space-y-4">
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                      <p className="text-sm text-orange-800 font-medium">Tapering is recommended for this medication.</p>
                      {taperingRecommendation.schedule && (
                        <div className="mt-2 text-sm text-orange-700">
                          <p><strong>Duration:</strong> {taperingRecommendation.schedule.totalDuration} weeks</p>
                          <p><strong>Reduction Rate:</strong> {taperingRecommendation.schedule.reductionRate}% per step</p>
                        </div>
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      <h5 className="font-medium text-gray-900">Warnings & Precautions:</h5>
                      {taperingRecommendation.warnings.map((warning, index) => (
                        <div key={index} className="flex items-start space-x-2">
                          <AlertTriangle className="h-4 w-4 text-orange-500 mt-0.5 flex-shrink-0" />
                          <span className="text-sm text-gray-700">{warning}</span>
                        </div>
                      ))}
                    </div>

                    <div className="space-y-2">
                      <h5 className="font-medium text-gray-900">Monitoring Requirements:</h5>
                      {taperingRecommendation.monitoring.map((item, index) => (
                        <div key={index} className="flex items-start space-x-2">
                          <Activity className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                          <span className="text-sm text-gray-700">{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <p className="text-sm text-green-800">Tapering is not currently recommended for this medication.</p>
                    <p className="text-sm text-green-700 mt-1">Continue regular monitoring and follow-up with your healthcare provider.</p>
                  </div>
                )}
              </div>

              {/* General Recommendations */}
              <div className="border border-gray-200 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-3">General Recommendations</h4>
                <div className="space-y-3">
                  <div className="flex items-start space-x-3">
                    <Clock className="h-4 w-4 text-blue-500 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">Regular Monitoring</p>
                      <p className="text-sm text-gray-600">
                        Review dependency risk every {currentAssessment.reviewFrequency} days with usage pattern analysis.
                      </p>
                    </div>
                  </div>

                  {currentAssessment.doctorReviewRequired && (
                    <div className="flex items-start space-x-3">
                      <AlertTriangle className="h-4 w-4 text-orange-500 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">Doctor Review Required</p>
                        <p className="text-sm text-gray-600">
                          Schedule an appointment with your healthcare provider to discuss your medication plan.
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="flex items-start space-x-3">
                    <Brain className="h-4 w-4 text-purple-500 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">Educational Resources</p>
                      <p className="text-sm text-gray-600">
                        Review the educational materials in the Overview tab to better understand your medication.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 px-6 py-4 border-t border-gray-200">
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-500">
              Last updated: {formatDate(currentAssessment.lastUpdated)}
            </div>
            <div className="flex space-x-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Close
              </button>
              <button
                onClick={handleUpdatePreventionData}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700"
              >
                Update Assessment
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
