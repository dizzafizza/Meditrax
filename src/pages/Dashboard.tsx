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
    addSmartMessage
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

  // Psychological warnings for dose deviations
  const getDoseDeviationWarnings = () => {
    const warnings: Array<{id: string; medication: string; message: string; severity: 'warning' | 'critical'}> = [];
    const processedLogIds = new Set(); // Track which logs we've already processed
    
    todaysLogs.forEach(log => {
      // Skip if we've already processed this log
      if (processedLogIds.has(log.id)) return;
      processedLogIds.add(log.id);

      const medication = medications.find(med => med.id === log.medicationId);
      if (!medication) return;

      // Skip warnings for first doses - check if this is the first log for this medication
      const medicationLogs = logs.filter(l => l.medicationId === log.medicationId && l.adherence === 'taken');
      if (medicationLogs.length <= 1) return; // First dose, no warnings

      const expectedDose = getCurrentDose(medication.id);
      let actualDose = log.dosageTaken;
      
      // For multiple pill medications, calculate equivalent dose from pill logs if available
      if (medication.useMultiplePills && log.pillLogs && log.pillLogs.length > 0) {
        actualDose = log.pillLogs.reduce((total, pillLog) => {
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
      
      const deviation = ((actualDose - expectedDose.dose) / expectedDose.dose) * 100;
      const absDeviation = Math.abs(deviation);
      
      // Only report significant deviations (more than 15% threshold)
      if (absDeviation < 15) return;

      // Check for tapering medications
      if (medication.tapering?.isActive) {
        if (deviation > 25) {
          warnings.push({
            id: log.id,
            medication: medication.name,
            message: `You took ${Math.round(deviation)}% more than your tapering schedule. This can disrupt your withdrawal plan.`,
            severity: 'critical'
          });
        } else if (deviation < -25) {
          warnings.push({
            id: log.id,
            medication: medication.name,
            message: `You took ${Math.round(Math.abs(deviation))}% less than scheduled. Sudden reductions can cause withdrawal symptoms.`,
            severity: 'critical'
          });
        }
      }

      // Check for high-risk medications with more stringent thresholds
      if (medication.riskLevel === 'high' && absDeviation > 30) {
        // Check if this is a pattern (more than one significant deviation in recent days)
        const recentLogs = logs.filter(recentLog => 
          recentLog.medicationId === medication.id &&
          recentLog.id !== log.id && // Don't include current log
          new Date(recentLog.timestamp).getTime() > Date.now() - (3 * 24 * 60 * 60 * 1000) // Last 3 days
        );
        
        if (recentLogs.length > 0) {
          warnings.push({
            id: log.id,
            medication: medication.name,
            message: `Significant dose variation pattern detected (${Math.round(absDeviation)}% deviation). This high-risk medication requires careful monitoring.`,
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

  // Debug: Check if we have any data at all
  React.useEffect(() => {
    console.log('🔍 Dashboard Data Check:', {
      totalMedications: medications.length,
      activeMedications: activeMedications.length,
      allMedications: medications.map(med => ({
        id: med.id,
        name: med.name,
        isActive: med.isActive,
        dosage: med.dosage,
        unit: med.unit
      }))
    });
  }, [medications.length]);


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

      {/* Dose Deviation Warnings */}
      {doseDeviationWarnings.length > 0 && (
        <div className="card">
          <div className="card-header">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900 flex items-center">
                <Brain className="h-5 w-5 text-red-500 mr-2" />
                Psychological Safety Alerts
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
              {taperingMedications.map((medication) => {
                const currentDose = getCurrentDose(medication.id);
                const originalDose = parseFloat(medication.dosage);
                const progress = ((originalDose - currentDose.dose) / originalDose) * 100;
                const daysElapsed = medication.tapering?.startDate 
                  ? Math.floor((Date.now() - new Date(medication.tapering.startDate).getTime()) / (1000 * 60 * 60 * 24))
                  : 0;
                
                return (
                  <div key={medication.id} className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: medication.color }}
                        />
                        <div>
                          <h4 className="font-medium text-gray-900">{medication.name}</h4>
                          <p className="text-sm text-gray-600">
                            {currentDose.dose} {medication.unit} (down from {originalDose} {medication.unit})
                          </p>
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
                      <span>Original: {originalDose} {medication.unit}</span>
                      <span>Target: 0 {medication.unit}</span>
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
              {withdrawalTrackingMedications.map((medication) => {
                const activeWithdrawal = medication.dependencePrevention?.withdrawalHistory.find(event => !event.endDate);
                const daysSinceStart = activeWithdrawal?.startDate 
                  ? Math.floor((Date.now() - new Date(activeWithdrawal.startDate).getTime()) / (1000 * 60 * 60 * 24))
                  : 0;
                
                return (
                  <div key={medication.id} className="bg-orange-50 border border-orange-200 rounded-lg p-4">
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
                {activeMedications.slice(0, 5).map((medication) => {
                  const adherence = getMedicationAdherence(medication.id, 7);
                  return (
                    <div
                      key={medication.id}
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
