import React from 'react';
import { Link } from 'react-router-dom';
import { 
  Pill, 
  Clock, 
  AlertTriangle, 
  Plus,
  CheckCircle,
  XCircle,
  Calendar as CalendarIcon,
  MessageSquare,
  ShieldAlert,
  Star,
  TrendingUp,
  Activity,
  Brain,
  Heart,
  Zap
} from 'lucide-react';
import { useMedicationStore } from '@/store';
import { formatTime, getAdherenceColor, formatPillDisplayShort } from '@/utils/helpers';
import { generateListItemKey } from '@/utils/reactKeyHelper';
import { TodaysMedications } from '@/components/ui/TodaysMedications';
import '@/utils/fixKratomData'; // Import the fix utility
import { WithdrawalSymptomTracker } from '@/components/ui/WithdrawalSymptomTracker';

export function Dashboard() {
  const {
    medications,
    logs,
    getTodaysReminders,
    getTodaysLogs,
    getMissedDoses,
    getUpcomingRefills,
    getMedicationAdherence,
    markMedicationTaken,
    markMedicationMissed,
    smartMessages,
    getSmartInsights,
    getHighRiskMedications,
    markMessageAsRead,
    getCurrentDose,
    addSmartMessage,
    generatePsychologicalSafetyAlerts,
    getActivePsychologicalSafetyAlerts,
    acknowledgePsychologicalAlert
  } = useMedicationStore();

  const todaysReminders = getTodaysReminders();
  const todaysLogs = getTodaysLogs();
  const recentMissedDoses = getMissedDoses(7);
  const upcomingRefills = getUpcomingRefills();
  const activeMedications = medications.filter(med => med.isActive);
  const smartInsights = getSmartInsights();
  const highRiskMedications = getHighRiskMedications();
  const priorityMessages = smartMessages.filter(msg => msg.priority === 'high' || msg.priority === 'urgent');

  // Enhanced dashboard data
  const taperingMedications = activeMedications.filter(med => med.tapering?.isActive);
  const withdrawalTrackingMedications = activeMedications.filter(med => 
    med.dependencePrevention?.withdrawalHistory.some(event => !event.endDate)
  );
  const cyclicDosingMedications = activeMedications.filter(med => med.cyclicDosing?.isActive);
  const prnMedications = activeMedications.filter(med => med.frequency === 'as-needed');
  const recreationalMedications = activeMedications.filter(med => med.category === 'recreational');

  // Enhanced Psychological Safety Alerts (with 7-day minimum requirement)
  React.useEffect(() => {
    // Regenerate alerts when medications or logs change
    generatePsychologicalSafetyAlerts();
  }, [medications, logs, generatePsychologicalSafetyAlerts]);

  // Enhanced dose deviation warnings with improved accuracy
  const getDoseDeviationWarnings = () => {
    const warnings: Array<{id: string; medication: string; message: string; severity: 'warning' | 'critical'}> = [];
    const processedLogIds = new Set(); // Track which logs we've already processed
    const medicationHistory = new Map(); // Track medication history for better context
    
    // Build medication history for better context
    medications.forEach(medication => {
      const medLogs = logs
        .filter(l => l.medicationId === medication.id && l.adherence === 'taken')
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      medicationHistory.set(medication.id, medLogs);
    });
    
    todaysLogs.forEach(log => {
      // Skip if we've already processed this log
      if (processedLogIds.has(log.id)) return;
      processedLogIds.add(log.id);

      const medication = medications.find(med => med.id === log.medicationId);
      if (!medication) return;

      // Skip warnings for first few doses - need at least 3 doses for pattern recognition
      const medicationLogs = medicationHistory.get(medication.id) || [];
      if (medicationLogs.length <= 3) return; // Need more history for accurate warnings

      // Skip as-needed medications - they don't have fixed doses
      if (medication.frequency === 'as-needed') return;

      const expectedDose = getCurrentDose(medication.id);
      let actualDose = log.dosageTaken;
      
      // For multiple pill medications, calculate equivalent dose from pill logs if available
      if (medication.useMultiplePills && log.pillsLogged && log.pillsLogged.length > 0) {
        actualDose = log.pillsLogged.reduce((total, pillLog) => {
          const pillConfig = medication.pillConfigurations?.find(config => 
            config.id === pillLog.pillConfigurationId
          );
          return total + (pillConfig ? pillConfig.strength * pillLog.quantityTaken : 0);
        }, 0);
      } else if (medication.useMultiplePills && log.dosageTaken) {
        // For backward compatibility, check if this is actually a total dose amount
        const defaultConfig = medication.doseConfigurations?.find(
          config => config.id === medication.defaultDoseConfigurationId
        ) || medication.doseConfigurations?.[0];
        
        if (defaultConfig && Math.abs(log.dosageTaken - defaultConfig.totalDoseAmount) < 0.1) {
          actualDose = log.dosageTaken; // This is already the correct total dose
        }
      }

      // Only check for deviations if we have meaningful dose values
      if (expectedDose.dose <= 0 || actualDose <= 0) return;
      
      // Calculate baseline from recent doses to account for gradual changes
      const recentLogs = medicationLogs
        .filter(recentLog => 
          new Date(recentLog.timestamp).getTime() > Date.now() - (7 * 24 * 60 * 60 * 1000) // Last 7 days
        )
        .slice(-5); // Last 5 doses
      
      if (recentLogs.length < 2) return; // Need at least 2 recent doses for comparison
      
      const recentDoses = recentLogs.map(recentLog => {
        if (medication.useMultiplePills && recentLog.pillsLogged) {
          return recentLog.pillsLogged.reduce((total, pillLog) => {
            const pillConfig = medication.pillConfigurations?.find(config => 
              config.id === pillLog.pillConfigurationId
            );
            return total + (pillConfig ? pillConfig.strength * pillLog.quantityTaken : 0);
          }, 0);
        }
        return recentLog.dosageTaken || 0;
      });
      
      const averageRecentDose = recentDoses.reduce((a, b) => a + b, 0) / recentDoses.length;
      const recentDoseVariation = Math.max(...recentDoses) - Math.min(...recentDoses);
      
      // Use recent average as baseline instead of theoretical expected dose
      const baselineDose = Math.abs(averageRecentDose - expectedDose.dose) < expectedDose.dose * 0.1 
        ? expectedDose.dose  // Use expected if recent doses are close
        : averageRecentDose; // Use recent average if there's been a pattern change
      
      const deviation = ((actualDose - baselineDose) / baselineDose) * 100;
      const absDeviation = Math.abs(deviation);
      
      // Adaptive threshold based on recent variation and medication type
      let warningThreshold = 20; // Base threshold
      
      // Increase threshold if recent doses have been variable (patient adjusting)
      if (recentDoseVariation > baselineDose * 0.15) {
        warningThreshold = 30;
      }
      
      // Decrease threshold for tapering medications (more sensitive)
      if (medication.tapering?.isActive) {
        warningThreshold = 15;
      }
      
      // Only report significant deviations above adaptive threshold
      if (absDeviation < warningThreshold) return;

      // Check for tapering medications with more context-aware warnings
      if (medication.tapering?.isActive) {
        if (deviation > 25) {
          warnings.push({
            id: log.id,
            medication: medication.name,
            message: `Dose ${Math.round(deviation)}% higher than tapering schedule (${actualDose} vs ${baselineDose} expected). This may disrupt your withdrawal plan.`,
            severity: 'critical'
          });
        } else if (deviation < -25) {
          warnings.push({
            id: log.id,
            medication: medication.name,
            message: `Dose ${Math.round(Math.abs(deviation))}% lower than schedule (${actualDose} vs ${baselineDose} expected). Sudden reductions can cause withdrawal symptoms.`,
            severity: 'critical'
          });
        }
      }

      // Check for high-risk medications with pattern-based warnings
      else if (medication.riskLevel === 'high' && absDeviation > 35) {
        // Check for concerning patterns in recent history
        const significantDeviations = recentLogs.filter(recentLog => {
          const recentActualDose = medication.useMultiplePills && recentLog.pillsLogged 
            ? recentLog.pillsLogged.reduce((total, pillLog) => {
                const pillConfig = medication.pillConfigurations?.find(config => 
                  config.id === pillLog.pillConfigurationId
                );
                return total + (pillConfig ? pillConfig.strength * pillLog.quantityTaken : 0);
              }, 0)
            : recentLog.dosageTaken || 0;
          
          const recentDeviation = Math.abs((recentActualDose - baselineDose) / baselineDose * 100);
          return recentDeviation > 25;
        });
        
        if (significantDeviations.length > 1) {
          warnings.push({
            id: log.id,
            medication: medication.name,
            message: `Pattern of dose variations detected (${Math.round(absDeviation)}% deviation). High-risk medications require consistent dosing.`,
            severity: 'warning'
          });
        }
      }
    });

    return warnings;
  };

  const doseDeviationWarnings = getDoseDeviationWarnings();

  // State for withdrawal tracking modal
  const [selectedWithdrawalMedication, setSelectedWithdrawalMedication] = React.useState<Medication | null>(null);

  // Enhanced Psychological Safety Alerts (with 7-day minimum requirement)
  React.useEffect(() => {
    // Regenerate alerts when medications or logs change
    if (medications.length > 0) {
      generatePsychologicalSafetyAlerts();
    }
  }, [medications, logs]); // Remove generatePsychologicalSafetyAlerts from deps to prevent infinite loop


  const stats = [
    {
      name: 'Active Medications',
      value: activeMedications.length,
      icon: Pill,
      color: 'bg-blue-500',
      href: '/medications',
    },
    {
      name: "Today's Reminders",
      value: todaysReminders.length,
      icon: Clock,
      color: 'bg-green-500',
      href: '/calendar',
    },
    {
      name: 'Taken Today',
      value: todaysLogs.filter(log => log.adherence === 'taken').length,
      icon: CheckCircle,
      color: 'bg-green-500',
      href: '/analytics',
    },
    {
      name: 'Tapering Plans',
      value: taperingMedications.length,
      icon: TrendingUp,
      color: 'bg-purple-500',
      href: '/medications',
      description: 'Active withdrawal schedules'
    },
    {
      name: 'PRN/As-Needed',
      value: prnMedications.length,
      icon: Zap,
      color: 'bg-orange-500',
      href: '/medications',
      description: 'Flexible dosing medications'
    },
    {
      name: 'Dose Warnings',
      value: doseDeviationWarnings.length,
      icon: AlertTriangle,
      color: doseDeviationWarnings.some(w => w.severity === 'critical') ? 'bg-red-500' : 'bg-yellow-500',
      href: '/analytics',
      description: 'Psychological safety alerts'
    },
  ];

  const handleMedicationAction = (medicationId: string, action: 'taken' | 'missed') => {
    if (action === 'taken') {
      markMedicationTaken(medicationId);
    } else {
      markMedicationMissed(medicationId);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">
            Overview of your medications and health tracking
          </p>
        </div>
        <div className="mt-4 sm:mt-0">
          <Link
            to="/medications"
            className="btn-primary inline-flex items-center space-x-2"
          >
            <Plus className="h-4 w-4" />
            <span>Add Medication</span>
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((stat) => (
          <Link
            key={stat.name}
            to={stat.href}
            className="card hover:shadow-md transition-shadow cursor-pointer"
          >
            <div className="card-content p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className={`${stat.color} rounded-md p-3`}>
                    <stat.icon className="h-6 w-6 text-white" />
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      {stat.name}
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {stat.value}
                    </dd>
                    {stat.description && (
                      <dd className="text-xs text-gray-400 mt-1">
                        {stat.description}
                      </dd>
                    )}
                  </dl>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Smart Messages Section */}
      {priorityMessages.length > 0 && (
        <div className="card">
          <div className="card-header">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900 flex items-center">
                <MessageSquare className="h-5 w-5 text-blue-500 mr-2" />
                Smart Health Insights
              </h3>
              <span className="badge badge-primary">{priorityMessages.length}</span>
            </div>
          </div>
          <div className="card-content">
            <div className="space-y-3">
              {priorityMessages.slice(0, 3).map((message) => (
                <div
                  key={message.id}
                  className={`p-4 rounded-lg border-l-4 ${
                    message.priority === 'urgent' ? 'border-red-500 bg-red-50' :
                    message.priority === 'high' ? 'border-orange-500 bg-orange-50' :
                    'border-blue-500 bg-blue-50'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        {message.type === 'risk-alert' && <ShieldAlert className="h-4 w-4 text-red-500" />}
                        {message.type === 'celebration' && <Star className="h-4 w-4 text-yellow-500" />}
                        {message.type === 'motivation' && <TrendingUp className="h-4 w-4 text-green-500" />}
                        <h4 className="text-sm font-medium text-gray-900">{message.title}</h4>
                      </div>
                      <p className="mt-1 text-sm text-gray-600">{message.message}</p>
                    </div>
                    <button
                      onClick={() => markMessageAsRead(message.id)}
                      className="ml-4 text-xs text-gray-400 hover:text-gray-600"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              ))}
              {priorityMessages.length > 3 && (
                <div className="text-center">
                  <p className="text-sm text-gray-500">
                    {priorityMessages.length - 3} more insights available
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Enhanced Psychological Safety Alerts */}
      {getActivePsychologicalSafetyAlerts().length > 0 && (
        <div className="card">
          <div className="card-header">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900 flex items-center">
                <Brain className="h-5 w-5 text-purple-500 mr-2" />
                Psychological Safety Alerts
              </h3>
              <span className={`badge ${
                getActivePsychologicalSafetyAlerts().some(a => a.priority === 'urgent') ? 'badge-danger' : 
                getActivePsychologicalSafetyAlerts().some(a => a.priority === 'high') ? 'badge-warning' : 'badge-info'
              }`}>
                {getActivePsychologicalSafetyAlerts().length}
              </span>
            </div>
          </div>
          <div className="card-content">
            <div className="space-y-4">
              {getActivePsychologicalSafetyAlerts().map((alert, index) => {
                const medication = medications.find(med => med.id === alert.medicationId);
                const priorityColors = {
                  urgent: 'border-red-500 bg-red-50',
                  high: 'border-orange-500 bg-orange-50',
                  medium: 'border-yellow-500 bg-yellow-50',
                  low: 'border-blue-500 bg-blue-50'
                };
                const iconColors = {
                  urgent: 'text-red-500',
                  high: 'text-orange-500',
                  medium: 'text-yellow-500',
                  low: 'text-blue-500'
                };

                return (
                  <div
                    key={generateListItemKey(alert, index, 'safety-alert')}
                    className={`p-4 rounded-lg border-l-4 ${priorityColors[alert.priority]}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <Brain className={`h-4 w-4 ${iconColors[alert.priority]}`} />
                          <h4 className="text-sm font-semibold text-gray-900">{alert.title}</h4>
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                            alert.priority === 'urgent' ? 'bg-red-100 text-red-800' :
                            alert.priority === 'high' ? 'bg-orange-100 text-orange-800' :
                            alert.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-blue-100 text-blue-800'
                          }`}>
                            {alert.priority.toUpperCase()}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700 mb-2">{alert.message}</p>
                        {medication && (
                          <p className="text-xs text-gray-500 mb-2">
                            <span className="font-medium">Medication:</span> {medication.name}
                          </p>
                        )}
                        <div className="text-xs text-gray-600 mb-3">
                          <span className="font-medium">Psychological Impact:</span> {alert.psychologicalImpact}
                        </div>
                        {alert.recommendedActions && alert.recommendedActions.length > 0 && (
                          <div className="mt-3">
                            <h5 className="text-xs font-medium text-gray-700 mb-1">Recommended Actions:</h5>
                            <ul className="text-xs text-gray-600 list-disc list-inside space-y-1">
                              {alert.recommendedActions.map((action, actionIndex) => (
                                <li key={`action-${alert.id}-${actionIndex}`}>{action}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col space-y-2 ml-4">
                        <button
                          onClick={() => acknowledgePsychologicalAlert(alert.id, 'helpful')}
                          className="text-xs px-3 py-1 bg-green-100 text-green-700 rounded-md hover:bg-green-200 transition-colors"
                        >
                          Helpful
                        </button>
                        <button
                          onClick={() => acknowledgePsychologicalAlert(alert.id, 'not-helpful')}
                          className="text-xs px-3 py-1 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
                        >
                          Not Helpful
                        </button>
                        <button
                          onClick={() => acknowledgePsychologicalAlert(alert.id, 'dismissed')}
                          className="text-xs px-3 py-1 bg-red-100 text-red-700 rounded-md hover:bg-red-200 transition-colors"
                        >
                          Dismiss
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 p-3 bg-purple-50 rounded-lg border border-purple-200">
              <div className="flex items-start space-x-2">
                <Brain className="h-4 w-4 text-purple-500 mt-0.5" />
                <div className="text-xs text-purple-700">
                  <p className="font-medium mb-1">Understanding Psychological Safety Alerts</p>
                  <p>These alerts are only shown for medications you've been taking for at least 7 days. They help identify patterns that may indicate psychological concerns, tolerance development, or dependency risks. Each alert is based on your usage patterns and medical research.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Legacy Dose Deviation Warnings (for immediate safety) */}
      {doseDeviationWarnings.length > 0 && (
        <div className="card">
          <div className="card-header">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900 flex items-center">
                <AlertTriangle className="h-5 w-5 text-red-500 mr-2" />
                Immediate Safety Alerts
              </h3>
              <span className={`badge ${doseDeviationWarnings.some(w => w.severity === 'critical') ? 'badge-danger' : 'badge-warning'}`}>
                {doseDeviationWarnings.length}
              </span>
            </div>
          </div>
          <div className="card-content">
            <div className="space-y-3">
              {doseDeviationWarnings.map((warning) => (
                <div
                  key={warning.id}
                  className={`p-4 rounded-lg border-l-4 ${
                    warning.severity === 'critical' 
                      ? 'border-red-500 bg-red-50' 
                      : 'border-yellow-500 bg-yellow-50'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <AlertTriangle className={`h-4 w-4 ${warning.severity === 'critical' ? 'text-red-500' : 'text-yellow-500'}`} />
                        <h4 className="text-sm font-medium text-gray-900">{warning.medication}</h4>
                      </div>
                      <p className="mt-1 text-sm text-gray-600">{warning.message}</p>
                      <div className="mt-2 text-xs text-gray-500">
                        <strong>Remember:</strong> Consistent dosing is important for your mental and physical well-being, especially during tapering.
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tapering Progress Section */}
      {taperingMedications.length > 0 && (
        <div className="card">
          <div className="card-header">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900 flex items-center">
                <TrendingUp className="h-5 w-5 text-purple-600 mr-2" />
                Tapering Progress
              </h3>
              <span className="badge badge-primary">{taperingMedications.length}</span>
            </div>
          </div>
          <div className="card-content">
            <div className="space-y-4">
              {taperingMedications.map((medication, index) => {
                const currentDose = getCurrentDose(medication.id);
                
                // Get original dose - handle multiple pills vs single dosage
                let originalDose = parseFloat(medication.dosage);
                if (medication.useMultiplePills && medication.doseConfigurations) {
                  const defaultConfig = medication.doseConfigurations.find(
                    config => config.id === medication.defaultDoseConfigurationId
                  ) || medication.doseConfigurations[0];
                  
                  if (defaultConfig) {
                    originalDose = defaultConfig.totalDoseAmount;
                  }
                }
                
                // Fix: Calculate progress correctly to avoid negative values on day 1
                const reductionAmount = Math.max(0, originalDose - currentDose.dose);
                const progress = originalDose > 0 ? (reductionAmount / originalDose) * 100 : 0;
                const daysElapsed = medication.tapering?.startDate 
                  ? Math.floor((Date.now() - new Date(medication.tapering.startDate).getTime()) / (1000 * 60 * 60 * 24))
                  : 0;
                
                return (
                  <div key={generateListItemKey(medication, index, 'tapering-med')} className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: medication.color }}
                        />
                        <div>
                          <h4 className="font-medium text-gray-900">{medication.name}</h4>
                          <p className="text-sm text-gray-600">
                            Current: {currentDose.dose} {medication.useMultiplePills && medication.doseConfigurations?.find(config => config.id === medication.defaultDoseConfigurationId)?.totalDoseUnit || medication.unit}
                          </p>
                          <p className="text-xs text-gray-500">
                            Original: {originalDose} {medication.useMultiplePills && medication.doseConfigurations?.find(config => config.id === medication.defaultDoseConfigurationId)?.totalDoseUnit || medication.unit}
                          </p>
                          {medication.useMultiplePills && medication.pillConfigurations && currentDose.pillBreakdown && (
                            <div className="mt-1">
                              <p className="text-xs text-purple-600 font-medium">
                                📋 Current pills: {Object.entries(currentDose.pillBreakdown).map(([pillId, count]) => {
                                  const pillConfig = medication.pillConfigurations?.find(config => config.id === pillId);
                                  if (!pillConfig || count === 0) return '';
                                  return `${count}x ${pillConfig.strength}${pillConfig.unit}`;
                                }).filter(Boolean).join(' + ')}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium text-purple-600">{Math.round(progress)}% reduced</div>
                        <div className="text-xs text-gray-500">Day {daysElapsed}</div>
                      </div>
                    </div>
                    
                    <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                      <div 
                        className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(progress, 100)}%` }}
                      />
                    </div>
                    
                    <div className="flex items-center justify-between text-xs text-gray-600">
                      <span>Original: {originalDose} {medication.useMultiplePills && medication.doseConfigurations?.find(config => config.id === medication.defaultDoseConfigurationId)?.totalDoseUnit || medication.unit}</span>
                      <span>Target: 0 {medication.useMultiplePills && medication.doseConfigurations?.find(config => config.id === medication.defaultDoseConfigurationId)?.totalDoseUnit || medication.unit}</span>
                    </div>
                    
                    {medication.tapering?.isPaused && (
                      <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
                        ⏸️ Tapering paused - Resume when ready or contact your healthcare provider
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

          {/* Recreational Substances - Simplified View */}
          {recreationalMedications.length > 0 && (
            <div className="card">
              <div className="card-header">
                <div className="flex items-center space-x-2">
                  <ShieldAlert className="h-5 w-5 text-orange-600" />
                  <h3 className="text-lg font-medium text-gray-900">Recreational Substances</h3>
                  <span className="badge bg-orange-100 text-orange-800">{recreationalMedications.length}</span>
                </div>
              </div>
              <div className="card-content">
                <div className="space-y-3">
                  {recreationalMedications.map((medication) => (
                    <div key={medication.id} className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: medication.color }}
                          />
                          <div>
                            <h4 className="font-medium text-gray-900">{medication.name}</h4>
                            <div className="flex items-center space-x-2 text-sm text-gray-600">
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                                Risk: {medication.riskLevel}
                              </span>
                              <span className="text-gray-500">•</span>
                              <span>{medication.category}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Withdrawal Tracking Section */}
          {withdrawalTrackingMedications.length > 0 && (
        <div className="card">
          <div className="card-header">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900 flex items-center">
                <Activity className="h-5 w-5 text-orange-600 mr-2" />
                Active Withdrawal Monitoring
              </h3>
              <span className="badge badge-warning">{withdrawalTrackingMedications.length}</span>
            </div>
          </div>
          <div className="card-content">
            <div className="space-y-4">
              {withdrawalTrackingMedications.map((medication, index) => {
                const activeWithdrawal = medication.dependencePrevention?.withdrawalHistory.find(event => !event.endDate);
                const daysSinceStart = activeWithdrawal?.startDate 
                  ? Math.floor((Date.now() - new Date(activeWithdrawal.startDate).getTime()) / (1000 * 60 * 60 * 24))
                  : 0;
                
                return (
                  <div key={generateListItemKey(medication, index, 'cyclicmeds')} className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: medication.color }}
                        />
                        <div>
                          <h4 className="font-medium text-gray-900">{medication.name}</h4>
                          <p className="text-sm text-gray-600">
                            Withdrawal monitoring • Day {daysSinceStart}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`text-sm font-medium ${
                          activeWithdrawal?.severity === 'severe' ? 'text-red-600' :
                          activeWithdrawal?.severity === 'moderate' ? 'text-orange-600' :
                          'text-green-600'
                        }`}>
                          {activeWithdrawal?.severity || 'mild'} symptoms
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-sm text-gray-600 mb-2">
                      Symptoms tracked: {activeWithdrawal?.symptoms.length || 0}
                    </div>
                    
                    <button 
                      onClick={() => setSelectedWithdrawalMedication(medication)}
                      className="w-full mt-2 text-sm bg-orange-100 hover:bg-orange-200 text-orange-800 px-3 py-2 rounded transition-colors"
                    >
                      Log Today's Symptoms
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Today's Medications */}
        <div className="lg:col-span-1">
          <TodaysMedications />
        </div>

        {/* Active Medications */}
        <div className="card">
          <div className="card-header">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">Active Medications</h3>
              <Link
                to="/medications"
                className="text-sm text-primary-600 hover:text-primary-700"
              >
                Manage all
              </Link>
            </div>
          </div>
          <div className="card-content">
            {activeMedications.length === 0 ? (
              <div className="text-center py-6">
                <Pill className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No medications yet</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Add your first medication to get started.
                </p>
                <div className="mt-4">
                  <Link to="/medications" className="btn-primary">
                    Add Medication
                  </Link>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {activeMedications.slice(0, 5).map((medication, index) => {
                  const adherence = getMedicationAdherence(medication.id, 7);
                  return (
                    <div
                      key={generateListItemKey(medication, index, 'adherence-med')}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex items-center space-x-3">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: medication.color }}
                        />
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {medication.name}
                          </p>
                          <p className="text-xs text-gray-500">
                            {medication.useMultiplePills ? formatPillDisplayShort(medication) : `${medication.dosage} ${medication.unit}`} • {medication.frequency.replace('-', ' ')}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-medium ${getAdherenceColor(adherence)}`}>
                          {adherence}%
                        </p>
                        <p className="text-xs text-gray-500">adherence</p>
                      </div>
                    </div>
                  );
                })}
                {activeMedications.length > 5 && (
                  <div className="text-center">
                    <Link
                      to="/medications"
                      className="text-sm text-primary-600 hover:text-primary-700"
                    >
                      View {activeMedications.length - 5} more medications
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Alerts and Notifications */}
      {(upcomingRefills.length > 0 || recentMissedDoses.length > 0 || smartInsights.length > 0) && (
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-medium text-gray-900 flex items-center">
              <AlertTriangle className="h-5 w-5 text-yellow-500 mr-2" />
              Alerts & Notifications
            </h3>
          </div>
          <div className="card-content">
            <div className="space-y-4">
              {/* Refill Alerts */}
              {upcomingRefills.length > 0 && (
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-start">
                    <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
                    <div className="ml-3">
                      <h4 className="text-sm font-medium text-yellow-800">
                        Refill Reminders
                      </h4>
                      <div className="mt-2 text-sm text-yellow-700">
                        <ul className="list-disc list-inside space-y-1">
                          {upcomingRefills.map((med) => (
                            <li key={med.id}>
                              {med.name} - {med.pillsRemaining} pills remaining
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Missed Doses */}
              {recentMissedDoses.length > 0 && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-start">
                    <XCircle className="h-5 w-5 text-red-600 mt-0.5" />
                    <div className="ml-3">
                      <h4 className="text-sm font-medium text-red-800">
                        Recent Missed Doses
                      </h4>
                      <p className="mt-1 text-sm text-red-700">
                        You've missed {recentMissedDoses.length} doses this week. 
                        <Link to="/analytics" className="font-medium underline ml-1">
                          View details
                        </Link>
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Smart Insights */}
              {smartInsights.map((insight, index) => (
                <div key={index} className={`p-4 rounded-lg border ${
                  insight.priority === 'high' ? 'border-red-200 bg-red-50' :
                  insight.priority === 'medium' ? 'border-yellow-200 bg-yellow-50' :
                  'border-blue-200 bg-blue-50'
                }`}>
                  <div className="flex items-start">
                    {insight.type === 'risk-alert' && <ShieldAlert className="h-5 w-5 text-red-600 mt-0.5" />}
                    {insight.type === 'adherence-concern' && <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />}
                    {insight.type === 'celebration' && <Star className="h-5 w-5 text-blue-600 mt-0.5" />}
                    <div className="ml-3">
                      <h4 className={`text-sm font-medium ${
                        insight.priority === 'high' ? 'text-red-800' :
                        insight.priority === 'medium' ? 'text-yellow-800' :
                        'text-blue-800'
                      }`}>
                        {insight.title}
                      </h4>
                      <p className={`mt-1 text-sm ${
                        insight.priority === 'high' ? 'text-red-700' :
                        insight.priority === 'medium' ? 'text-yellow-700' :
                        'text-blue-700'
                      }`}>
                        {insight.description}
                      </p>
                      {insight.medications && (
                        <div className="mt-2 text-xs text-gray-600">
                          <strong>Medications:</strong> {insight.medications.join(', ')}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Withdrawal Symptom Tracker Modal */}
      {selectedWithdrawalMedication && (
        <WithdrawalSymptomTracker
          medication={selectedWithdrawalMedication}
          isOpen={!!selectedWithdrawalMedication}
          onClose={() => setSelectedWithdrawalMedication(null)}
        />
      )}
    </div>
  );
}
