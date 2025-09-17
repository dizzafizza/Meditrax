import React from 'react';
import { Calendar, Clock, AlertTriangle, CheckCircle2, Plus } from 'lucide-react';
import { useMedicationStore } from '@/store';
import { QuickMedicationLog } from './QuickMedicationLog';
import { formatTime, formatPillDisplay, formatPillDisplayShort, calculateRemainingDosesForDay, getProgressDisplayText } from '@/utils/helpers';

export function TodaysMedications() {
  const { 
    getTodaysReminders, 
    getTodaysLogs, 
    medications,
    smartMessages,
    getCurrentDose,
    markMessageAsRead,
    getOverallStreak,
    getCurrentStreak,
    areAllScheduledMedicationsComplete
  } = useMedicationStore();

  const todaysReminders = getTodaysReminders();
  const todaysLogs = getTodaysLogs();
  const activeMedications = medications.filter(med => med.isActive);
  
  
  // Separate medications that don't have reminders into scheduled and as-needed
  const medicationsWithoutReminders = activeMedications.filter(med => 
    !todaysReminders.some(reminder => reminder.medicationId === med.id)
  );
  
  const scheduledMedicationsWithoutReminders = medicationsWithoutReminders.filter(med => 
    med.frequency !== 'as-needed'
  );

  // Calculate total medications for today
  const getTotalMedicationsForToday = () => {
    return todaysReminders.length + scheduledMedicationsWithoutReminders.length;
  };
  
  const asNeededMedications = medicationsWithoutReminders.filter(med => 
    med.frequency === 'as-needed'
  );

  // Check which medications have been logged today
  const loggedMedicationIds = new Set(todaysLogs.map(log => log.medicationId));

  // Get urgent smart messages for today's medications
  const urgentMessages = smartMessages.filter(msg => 
    msg.priority === 'urgent' || msg.priority === 'high'
  );

  const getTimeBasedGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning! ☀️";
    if (hour < 17) return "Good afternoon! 🌤️";
    return "Good evening! 🌙";
  };

  const getCompletedCount = () => {
    return todaysReminders.filter(reminder => 
      loggedMedicationIds.has(reminder.medicationId)
    ).length + medicationsWithoutReminders.filter(med => 
      loggedMedicationIds.has(med.id)
    ).length;
  };

  // Enhanced completion tracking for multiple doses per day
  const getDailyCompletionStatus = (medication: any) => {
    return calculateRemainingDosesForDay(medication, todaysLogs);
  };

  const getCompletionPercentage = () => {
    const total = getTotalMedicationsForToday();
    if (total === 0) return 0;
    return Math.round((getCompletedCount() / total) * 100);
  };

  const getMotivationalMessage = () => {
    const percentage = getCompletionPercentage();
    const completed = getCompletedCount();
    const total = getTotalMedicationsForToday();
    const overallStreak = getOverallStreak();
    const allScheduledComplete = areAllScheduledMedicationsComplete();
    
    // Only show milestone/celebration when ALL scheduled medications are complete
    if (allScheduledComplete && overallStreak > 0) {
      const streakEmoji = overallStreak >= 30 ? "🔥🔥🔥" : overallStreak >= 7 ? "🔥🔥" : overallStreak >= 3 ? "🔥" : "✨";
      return {
        message: `🎉 Milestone reached! ${streakEmoji} ${overallStreak} day streak! All medications completed!`,
        color: "text-green-600 bg-green-50 border-green-200"
      };
    } else if (percentage === 100) {
      return {
        message: "🎉 Perfect! You've completed all your medications for today!",
        color: "text-green-600 bg-green-50 border-green-200"
      };
    } else if (percentage >= 75) {
      const streakDisplay = overallStreak > 0 ? ` 🔥 ${overallStreak} day streak!` : "";
      return {
        message: `🌟 Great progress! ${completed}/${total} completed.${streakDisplay} You're doing amazing!`,
        color: "text-blue-600 bg-blue-50 border-blue-200"
      };
    } else if (percentage >= 50) {
      return {
        message: `💪 Keep going! ${completed}/${total} completed. You've got this!`,
        color: "text-orange-600 bg-orange-50 border-orange-200"
      };
    } else if (completed > 0) {
      return {
        message: `✨ Good start! ${completed}/${total} completed. Every step counts!`,
        color: "text-purple-600 bg-purple-50 border-purple-200"
      };
    } else {
      return {
        message: `${getTimeBasedGreeting()} Ready to start your wellness routine?`,
        color: "text-gray-600 bg-gray-50 border-gray-200"
      };
    }
  };

  const motivationalMsg = getMotivationalMessage();

  if (getTotalMedicationsForToday() === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="text-center">
          <Calendar className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No medications for today</h3>
          <p className="mt-1 text-sm text-gray-500">
            Enjoy your medication-free day! 
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with Progress */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-900">Today's Medications</h2>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600">
              {getCompletedCount()}/{getTotalMedicationsForToday()}
            </span>
            <div className="w-16 bg-gray-200 rounded-full h-2">
              <div 
                className="bg-green-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${getCompletionPercentage()}%` }}
              />
            </div>
          </div>
        </div>
        
        {/* Motivational Message */}
        <div className={`p-3 rounded-lg border ${motivationalMsg.color}`}>
          <p className="text-sm font-medium">{motivationalMsg.message}</p>
        </div>
      </div>

      {/* Urgent Messages */}
      {urgentMessages.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center space-x-2 mb-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <h3 className="font-medium text-red-900">Important Alerts</h3>
          </div>
          <div className="space-y-2">
            {urgentMessages.map((message) => (
              <div key={message.id} className="bg-white p-3 rounded border border-red-200">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-medium text-red-900 text-sm">{message.title}</h4>
                    <p className="text-red-700 text-sm mt-1">{message.message}</p>
                  </div>
                  <button
                    onClick={() => markMessageAsRead(message.id)}
                    className="ml-4 text-xs text-red-400 hover:text-red-600"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Scheduled Reminders */}
      {todaysReminders.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-medium text-gray-900 flex items-center space-x-2">
            <Clock className="h-4 w-4" />
            <span>Scheduled for Today</span>
          </h3>
          {todaysReminders.map((reminder) => {
            const completionStatus = getDailyCompletionStatus(reminder.medication);
            const progressText = getProgressDisplayText(
              completionStatus.remaining,
              completionStatus.total,
              completionStatus.completed,
              reminder.medication.frequency
            );
            
            return (
              <div key={reminder.id} className="relative">
                <div className="absolute top-2 right-2 z-10 flex flex-col items-end space-y-1">
                  {completionStatus.completed ? (
                    <div className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full flex items-center space-x-1">
                      <CheckCircle2 className="h-3 w-3" />
                      <span>All Complete</span>
                    </div>
                  ) : completionStatus.remaining > 0 && completionStatus.total > 0 ? (
                    <div className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                      {progressText}
                    </div>
                  ) : null}
                </div>
                <div className={completionStatus.completed ? 'opacity-60' : ''}>
                  <QuickMedicationLog
                    medication={reminder.medication}
                    reminder={{ time: reminder.time, id: reminder.id }}
                    onAction={(action) => {
                      if (action === 'taken') {
                        // Refresh will happen automatically via store updates
                      }
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Scheduled Medications without Reminders */}
      {scheduledMedicationsWithoutReminders.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-medium text-gray-900 flex items-center space-x-2">
            <Calendar className="h-4 w-4" />
            <span>Scheduled for Today</span>
          </h3>
          {scheduledMedicationsWithoutReminders.map((medication) => {
            const completionStatus = getDailyCompletionStatus(medication);
            const progressText = getProgressDisplayText(
              completionStatus.remaining,
              completionStatus.total,
              completionStatus.completed,
              medication.frequency
            );
            
            return (
              <div key={medication.id} className="relative">
                <div className="absolute top-2 right-2 z-10 flex flex-col items-end space-y-1">
                  {completionStatus.completed ? (
                    <div className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full flex items-center space-x-1">
                      <CheckCircle2 className="h-3 w-3" />
                      <span>All Complete</span>
                    </div>
                  ) : completionStatus.remaining > 0 && completionStatus.total > 0 ? (
                    <div className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                      {progressText}
                    </div>
                  ) : null}
                </div>
                <div className={completionStatus.completed ? 'opacity-60' : ''}>
                  <QuickMedicationLog
                    medication={medication}
                    onAction={(action) => {
                      if (action === 'taken') {
                        // Refresh will happen automatically via store updates
                      }
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* As-Needed Medications */}
      {asNeededMedications.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-medium text-gray-900 flex items-center space-x-2">
            <Plus className="h-4 w-4" />
            <span>As Needed</span>
          </h3>
          {asNeededMedications.map((medication) => {
            const completionStatus = getDailyCompletionStatus(medication);
            const progressText = getProgressDisplayText(
              completionStatus.remaining,
              completionStatus.total,
              completionStatus.completed,
              medication.frequency
            );
            
            return (
              <div key={medication.id} className="relative">
                <div className="absolute top-2 right-2 z-10 flex flex-col items-end space-y-1">
                  {completionStatus.completed ? (
                    <div className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full flex items-center space-x-1">
                      <CheckCircle2 className="h-3 w-3" />
                      <span>{medication.frequency === 'as-needed' ? 'Taken Today' : 'All Complete'}</span>
                    </div>
                  ) : completionStatus.remaining > 0 && completionStatus.total > 0 ? (
                    <div className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                      {progressText}
                    </div>
                  ) : (
                    <div className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded-full">
                      As needed
                    </div>
                  )}
                </div>
                <div>
                  <QuickMedicationLog
                    medication={medication}
                    onAction={(action) => {
                      if (action === 'taken') {
                        // Refresh will happen automatically via store updates
                      }
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Weekly Adherence Insight */}
      {medications.length > 0 && (
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-medium text-gray-900 mb-2">💡 Adherence Insight</h3>
          <p className="text-sm text-gray-700">
            {getCompletionPercentage() >= 80 
              ? "Your consistency is excellent! This level of adherence supports optimal treatment outcomes."
              : getCompletionPercentage() >= 60
              ? "Good adherence! Try setting more reminders to reach your health goals even better."
              : "Remember, consistency is key to getting the most benefit from your medications. Consider setting up more reminders."
            }
          </p>
        </div>
      )}
    </div>
  );
}
