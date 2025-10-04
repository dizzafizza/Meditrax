import React from 'react';
import { IonPage, IonHeader, IonToolbar, IonTitle, IonContent } from '@ionic/react';
import { 
  Plus, 
  Bell, 
  Clock, 
  Edit2, 
  Trash2, 
  ToggleLeft, 
  ToggleRight,
  Calendar,
  Brain,
  AlertTriangle,
  TrendingUp,
  Target,
  Shield,
  Lightbulb,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { useMedicationStore } from '@/store';
import { ReminderModal } from '@/components/modals/ReminderModal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { formatTime, cn } from '@/utils/helpers';
import { Reminder, DayOfWeek } from '@/types';
import { SmartAdherenceService } from '@/services/smartAdherenceService';
import toast from 'react-hot-toast';

export function Reminders() {
  const {
    reminders,
    medications,
    logs,
    addReminder,
    updateReminder,
    deleteReminder,
    toggleReminderActive,
    snoozeReminder
  } = useMedicationStore();

  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [editingReminder, setEditingReminder] = React.useState<Reminder | null>(null);
  const [confirmDelete, setConfirmDelete] = React.useState<string | null>(null);
  const [showInsights, setShowInsights] = React.useState(true);

  const activeMedications = medications.filter(med => med.isActive);
  const activeReminders = reminders.filter(reminder => reminder.isActive);
  const inactiveReminders = reminders.filter(reminder => !reminder.isActive);

  // Smart adherence analysis
  const adherencePatterns = React.useMemo(() => {
    return SmartAdherenceService.analyzeAdherencePatterns(medications, logs, 30);
  }, [medications, logs]);

  const adherenceInsights = React.useMemo(() => {
    return SmartAdherenceService.getAdherenceInsights(adherencePatterns);
  }, [adherencePatterns]);

  const smartNotifications = React.useMemo(() => {
    return SmartAdherenceService.generateSmartNotifications(adherencePatterns, medications, reminders);
  }, [adherencePatterns, medications, reminders]);

  const getReminderMedication = (medicationId: string) => {
    return medications.find(med => med.id === medicationId);
  };

  const handleAddReminder = () => {
    setEditingReminder(null);
    setIsModalOpen(true);
  };

  const handleEditReminder = (reminder: Reminder) => {
    setEditingReminder(reminder);
    setIsModalOpen(true);
  };

  const handleDeleteReminder = (id: string) => {
    deleteReminder(id);
    setConfirmDelete(null);
    toast.success('Reminder deleted successfully');
  };

  const handleToggleActive = (id: string) => {
    toggleReminderActive(id);
    toast.success('Reminder status updated');
  };

  const handleSnooze = (id: string, minutes: number) => {
    snoozeReminder(id, minutes);
    toast.success(`Reminder snoozed for ${minutes} minutes`);
  };

  const formatDays = (days: DayOfWeek[]) => {
    const dayMap = {
      'monday': 'Mon',
      'tuesday': 'Tue',
      'wednesday': 'Wed',
      'thursday': 'Thu',
      'friday': 'Fri',
      'saturday': 'Sat',
      'sunday': 'Sun'
    };
    
    if (days.length === 7) return 'Daily';
    if (days.length === 5 && !days.includes('saturday') && !days.includes('sunday')) return 'Weekdays';
    if (days.length === 2 && days.includes('saturday') && days.includes('sunday')) return 'Weekends';
    
    return days.map(day => dayMap[day]).join(', ');
  };

  const ReminderCard = ({ reminder }: { reminder: Reminder }) => {
    const medication = getReminderMedication(reminder.medicationId);
    if (!medication) return null;

    return (
      <div className="card">
        <div className="card-content p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-4">
              <div className={`p-3 rounded-lg ${reminder.isActive ? 'bg-blue-100' : 'bg-gray-100'}`}>
                <Bell className={`h-6 w-6 ${reminder.isActive ? 'text-blue-600' : 'text-gray-400'}`} />
              </div>
              
              <div className="flex-1">
                <div className="flex items-center space-x-3">
                  <h3 className="text-lg font-semibold text-gray-900">{medication.name}</h3>
                  <span 
                    className="h-3 w-3 rounded-full" 
                    style={{ backgroundColor: medication.color }}
                  />
                </div>
                
                <div className="mt-2 space-y-2">
                  <div className="flex items-center space-x-2 text-sm text-gray-600">
                    <Clock className="h-4 w-4" />
                    <span>{reminder.time}</span>
                  </div>
                  
                  <div className="flex items-center space-x-2 text-sm text-gray-600">
                    <Calendar className="h-4 w-4" />
                    <span>{formatDays(reminder.days)}</span>
                  </div>
                  
                  {reminder.customMessage && (
                    <p className="text-sm text-gray-500 italic">"{reminder.customMessage}"</p>
                  )}
                  
                  {reminder.snoozeUntil && new Date(reminder.snoozeUntil) > new Date() && (
                    <div className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-yellow-100 text-yellow-800">
                      Snoozed until {formatTime(new Date(reminder.snoozeUntil))}
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <button
                onClick={() => handleToggleActive(reminder.id)}
                className={cn(
                  'p-2 rounded-lg transition-colors',
                  reminder.isActive 
                    ? 'text-green-600 hover:bg-green-50' 
                    : 'text-gray-400 hover:bg-gray-50'
                )}
                title={reminder.isActive ? 'Disable reminder' : 'Enable reminder'}
              >
                {reminder.isActive ? (
                  <ToggleRight className="h-5 w-5" />
                ) : (
                  <ToggleLeft className="h-5 w-5" />
                )}
              </button>
              
              <button
                onClick={() => handleEditReminder(reminder)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                title="Edit reminder"
              >
                <Edit2 className="h-4 w-4" />
              </button>
              
              <button
                onClick={() => setConfirmDelete(reminder.id)}
                className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title="Delete reminder"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
          
          {reminder.isActive && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-500">Quick snooze:</span>
                <button
                  onClick={() => handleSnooze(reminder.id, 15)}
                  className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                >
                  15m
                </button>
                <button
                  onClick={() => handleSnooze(reminder.id, 30)}
                  className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                >
                  30m
                </button>
                <button
                  onClick={() => handleSnooze(reminder.id, 60)}
                  className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                >
                  1h
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <IonPage>
      <IonHeader translucent>
        <IonToolbar>
          <IonTitle size="large">Reminders</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen className="bg-gray-50">
        <div className="max-w-7xl mx-auto p-3 sm:p-4 lg:p-6 space-y-6">
        {/* Page Header */}
        <div className="bg-white rounded-lg shadow p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="mobile-title text-gray-900">Reminders</h1>
              <p className="mobile-text text-gray-500 mt-1">
                Manage your medication reminders and notifications
              </p>
            </div>
            <div>
              <button
                onClick={handleAddReminder}
                disabled={activeMedications.length === 0}
                className="mobile-button btn-primary inline-flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
              >
                <Plus className="h-4 w-4" />
                <span>Add Reminder</span>
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="p-4 sm:p-6 max-h-[calc(100vh-300px)] overflow-y-auto mobile-scroll">
            {/* Smart Adherence Insights */}
            {adherencePatterns.length > 0 && showInsights && (
        <div className="space-y-4">
          {/* Insights Overview */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="card">
              <div className="card-content p-4">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className={`w-8 h-8 rounded-md flex items-center justify-center ${
                      adherenceInsights.overallRisk === 'critical' ? 'bg-red-100' :
                      adherenceInsights.overallRisk === 'high' ? 'bg-orange-100' :
                      adherenceInsights.overallRisk === 'moderate' ? 'bg-yellow-100' :
                      'bg-green-100'
                    }`}>
                      <Shield className={`h-5 w-5 ${
                        adherenceInsights.overallRisk === 'critical' ? 'text-red-600' :
                        adherenceInsights.overallRisk === 'high' ? 'text-orange-600' :
                        adherenceInsights.overallRisk === 'moderate' ? 'text-yellow-600' :
                        'text-green-600'
                      }`} />
                    </div>
                  </div>
                  <div className="ml-4 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Adherence Risk
                      </dt>
                      <dd className={`text-lg font-medium ${
                        adherenceInsights.overallRisk === 'critical' ? 'text-red-600' :
                        adherenceInsights.overallRisk === 'high' ? 'text-orange-600' :
                        adherenceInsights.overallRisk === 'moderate' ? 'text-yellow-600' :
                        'text-green-600'
                      }`}>
                        {adherenceInsights.overallRisk.charAt(0).toUpperCase() + adherenceInsights.overallRisk.slice(1)}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-content p-4">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-blue-100 rounded-md flex items-center justify-center">
                      <Target className="h-5 w-5 text-blue-600" />
                    </div>
                  </div>
                  <div className="ml-4 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Avg Adherence
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {adherenceInsights.avgAdherence}%
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-content p-4">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-orange-100 rounded-md flex items-center justify-center">
                      <AlertTriangle className="h-5 w-5 text-orange-600" />
                    </div>
                  </div>
                  <div className="ml-4 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        At Risk Meds
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {adherenceInsights.medicationsAtRisk}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-content p-4">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-red-100 rounded-md flex items-center justify-center">
                      <XCircle className="h-5 w-5 text-red-600" />
                    </div>
                  </div>
                  <div className="ml-4 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Urgent Actions
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {adherenceInsights.urgentActions}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Smart Notifications */}
          {smartNotifications.length > 0 && (
            <div className="card">
              <div className="card-header">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium text-gray-900 flex items-center space-x-2">
                    <Brain className="h-5 w-5 text-purple-600" />
                    <span>Smart Adherence Insights</span>
                  </h3>
                  <button
                    onClick={() => setShowInsights(false)}
                    className="text-sm text-gray-500 hover:text-gray-700"
                  >
                    Hide
                  </button>
                </div>
              </div>
              <div className="card-content">
                <div className="space-y-3">
                  {smartNotifications.slice(0, 3).map((notification) => (
                    <div
                      key={notification.id}
                      className={`p-4 rounded-lg border-l-4 ${
                        notification.priority === 'high' ? 'border-red-500 bg-red-50' :
                        notification.priority === 'medium' ? 'border-orange-500 bg-orange-50' :
                        'border-blue-500 bg-blue-50'
                      }`}
                    >
                      <div className="flex items-start space-x-3">
                        {notification.type === 'predictive-reminder' && <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5" />}
                        {notification.type === 'adherence-support' && <TrendingUp className="h-5 w-5 text-orange-500 mt-0.5" />}
                        {notification.type === 'pattern-alert' && <Brain className="h-5 w-5 text-blue-500 mt-0.5" />}
                        {notification.type === 'encouragement' && <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />}
                        
                        <div className="flex-1">
                          <h4 className={`text-sm font-medium ${
                            notification.priority === 'high' ? 'text-red-800' :
                            notification.priority === 'medium' ? 'text-orange-800' :
                            'text-blue-800'
                          }`}>
                            {notification.title}
                          </h4>
                          <p className={`mt-1 text-sm ${
                            notification.priority === 'high' ? 'text-red-700' :
                            notification.priority === 'medium' ? 'text-orange-700' :
                            'text-blue-700'
                          }`}>
                            {notification.message}
                          </p>
                          {notification.context && (
                            <div className="mt-2 text-xs text-gray-600">
                              {notification.context.riskScore && `Risk Score: ${notification.context.riskScore}%`}
                              {notification.context.missedCount && `Consecutive Missed: ${notification.context.missedCount}`}
                              {notification.context.pattern && `Pattern: ${notification.context.pattern}`}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {smartNotifications.length > 3 && (
                    <div className="text-center">
                      <p className="text-sm text-gray-500">
                        {smartNotifications.length - 3} more insights available
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Personalized Recommendations */}
          {adherenceInsights.topRecommendations.length > 0 && (
            <div className="card">
              <div className="card-header">
                <h3 className="text-lg font-medium text-gray-900 flex items-center space-x-2">
                  <Lightbulb className="h-5 w-5 text-yellow-600" />
                  <span>Personalized Recommendations</span>
                </h3>
              </div>
              <div className="card-content">
                <div className="space-y-3">
                  {adherenceInsights.topRecommendations.map((recommendation, index) => (
                    <div
                      key={index}
                      className={`p-3 rounded border-l-4 ${
                        recommendation.priority === 'urgent' ? 'border-red-500 bg-red-50' :
                        recommendation.priority === 'high' ? 'border-orange-500 bg-orange-50' :
                        'border-blue-500 bg-blue-50'
                      }`}
                    >
                      <div className="flex items-start space-x-3">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              recommendation.priority === 'urgent' ? 'bg-red-100 text-red-800' :
                              recommendation.priority === 'high' ? 'bg-orange-100 text-orange-800' :
                              'bg-blue-100 text-blue-800'
                            }`}>
                              {recommendation.type.replace('-', ' ')}
                            </span>
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              recommendation.priority === 'urgent' ? 'bg-red-200 text-red-900' :
                              recommendation.priority === 'high' ? 'bg-orange-200 text-orange-900' :
                              'bg-blue-200 text-blue-900'
                            }`}>
                              {recommendation.priority}
                            </span>
                          </div>
                          <p className={`mt-2 text-sm font-medium ${
                            recommendation.priority === 'urgent' ? 'text-red-800' :
                            recommendation.priority === 'high' ? 'text-orange-800' :
                            'text-blue-800'
                          }`}>
                            {recommendation.message}
                          </p>
                          {recommendation.details && (
                            <p className={`mt-1 text-xs ${
                              recommendation.priority === 'urgent' ? 'text-red-600' :
                              recommendation.priority === 'high' ? 'text-orange-600' :
                              'text-blue-600'
                            }`}>
                              {recommendation.details}
                            </p>
                          )}
                        </div>
                        {recommendation.actionable && (
                          <CheckCircle className="h-4 w-4 text-green-500 mt-1" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Medication-Specific Patterns */}
          <div className="card">
            <div className="card-header">
              <h3 className="text-lg font-medium text-gray-900">Medication Adherence Patterns</h3>
            </div>
            <div className="card-content">
              <div className="space-y-4">
                {adherencePatterns.map((pattern) => (
                  <div key={pattern.medicationId} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium text-gray-900">{pattern.medicationName}</h4>
                      <div className="flex items-center space-x-2">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          pattern.adherencePercentage >= 95 ? 'bg-green-100 text-green-800' :
                          pattern.adherencePercentage >= 85 ? 'bg-yellow-100 text-yellow-800' :
                          pattern.adherencePercentage >= 70 ? 'bg-orange-100 text-orange-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {pattern.adherencePercentage}% adherence
                        </span>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          pattern.riskLevel === 'critical' ? 'bg-red-100 text-red-800' :
                          pattern.riskLevel === 'high' ? 'bg-orange-100 text-orange-800' :
                          pattern.riskLevel === 'moderate' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                          {pattern.riskLevel} risk
                        </span>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-medium text-gray-700">Miss Pattern:</span>
                        <span className="ml-2 text-gray-600">{pattern.missedDosePattern}</span>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">Miss Risk:</span>
                        <span className={`ml-2 font-medium ${
                          pattern.predictedMissRisk >= 70 ? 'text-red-600' :
                          pattern.predictedMissRisk >= 40 ? 'text-orange-600' :
                          'text-green-600'
                        }`}>
                          {pattern.predictedMissRisk}%
                        </span>
                      </div>
                      {pattern.consecutiveMissedDoses > 0 && (
                        <div>
                          <span className="font-medium text-gray-700">Consecutive Missed:</span>
                          <span className="ml-2 text-red-600 font-medium">{pattern.consecutiveMissedDoses}</span>
                        </div>
                      )}
                      {pattern.frequentMissTimeSlots.length > 0 && (
                        <div>
                          <span className="font-medium text-gray-700">Problem Times:</span>
                          <span className="ml-2 text-gray-600">{pattern.frequentMissTimeSlots.join(', ')}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Show insights toggle when hidden */}
      {adherencePatterns.length > 0 && !showInsights && (
        <div className="card">
          <div className="card-content p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Brain className="h-5 w-5 text-purple-600" />
                <span className="text-sm font-medium text-gray-900">Smart Adherence Insights Available</span>
              </div>
              <button
                onClick={() => setShowInsights(true)}
                className="px-3 py-1 text-sm bg-purple-100 text-purple-700 rounded hover:bg-purple-200"
              >
                Show Insights
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {activeMedications.length === 0 && (
        <div className="text-center py-12">
          <Bell className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No active medications</h3>
          <p className="mt-1 text-sm text-gray-500">
            Add some medications first to create reminders.
          </p>
        </div>
      )}

      {reminders.length === 0 && activeMedications.length > 0 && (
        <div className="text-center py-12">
          <Bell className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No reminders yet</h3>
          <p className="mt-1 text-sm text-gray-500">
            Create your first reminder to stay on track with your medications.
          </p>
          <div className="mt-6">
            <button
              onClick={handleAddReminder}
              className="btn-primary inline-flex items-center space-x-2"
            >
              <Plus className="h-4 w-4" />
              <span>Add First Reminder</span>
            </button>
          </div>
        </div>
      )}

      {/* Active Reminders */}
      {activeReminders.length > 0 && (
        <div>
          <h2 className="text-lg font-medium text-gray-900 mb-4">
            Active Reminders ({activeReminders.length})
          </h2>
          <div className="space-y-4">
            {activeReminders.map((reminder) => (
              <ReminderCard key={reminder.id} reminder={reminder} />
            ))}
          </div>
        </div>
      )}

      {/* Inactive Reminders */}
      {inactiveReminders.length > 0 && (
        <div>
          <h2 className="text-lg font-medium text-gray-900 mb-4">
            Inactive Reminders ({inactiveReminders.length})
          </h2>
          <div className="space-y-4">
            {inactiveReminders.map((reminder) => (
              <ReminderCard key={reminder.id} reminder={reminder} />
            ))}
          </div>
        </div>
      )}

          </div>
        </div>

        {/* Confirm Delete Dialog */}
        <ConfirmDialog
          isOpen={!!confirmDelete}
          onClose={() => setConfirmDelete(null)}
          onConfirm={() => confirmDelete && handleDeleteReminder(confirmDelete)}
          title="Delete Reminder"
          message="Are you sure you want to delete this reminder? This action cannot be undone."
          confirmText="Delete"
        />
        </div>

        {/* Reminder Modal - Moved outside scrollable container to appear on top */}
        <ReminderModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setEditingReminder(null);
          }}
          reminder={editingReminder}
        />
      </IonContent>
    </IonPage>
  );
}
