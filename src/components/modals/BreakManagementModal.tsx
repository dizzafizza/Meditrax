import React from 'react';
import { X, Clock, AlertTriangle, Calendar, Heart, Pause, Coffee, Shield } from 'lucide-react';
import { useMedicationStore } from '@/store';
import { Medication } from '@/types';
import { toast } from 'react-hot-toast';

interface BreakManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  medication: Medication;
}

export function BreakManagementModal({ isOpen, onClose, medication }: BreakManagementModalProps) {
  const { startTaperingBreak, endTaperingBreak } = useMedicationStore();
  const [selectedBreakType, setSelectedBreakType] = React.useState<'stabilization' | 'tolerance' | 'emergency' | 'planned' | 'temporary' | 'withdrawal_management'>('temporary');
  const [reason, setReason] = React.useState('');
  const [plannedDuration, setPlannedDuration] = React.useState<number>(7);
  const [userChangedDuration, setUserChangedDuration] = React.useState(false);
  const [withdrawalSeverity, setWithdrawalSeverity] = React.useState<'mild' | 'moderate' | 'severe'>('moderate');
  const [notes, setNotes] = React.useState('');
  const [autoResumeEnabled, setAutoResumeEnabled] = React.useState(false);
  const [reminderEnabled, setReminderEnabled] = React.useState(true);
  const [reminderFrequency, setReminderFrequency] = React.useState<'daily' | 'weekly' | 'none'>('weekly');

  if (!isOpen) return null;

  const currentBreak = medication.tapering?.currentBreak;
  const isOnBreak = medication.tapering?.isPaused && currentBreak?.isActive;

  const breakTypes = [
    {
      type: 'stabilization' as const,
      icon: <Heart className="h-5 w-5 text-blue-600" />,
      title: 'Stabilization Break',
      description: 'Pause to let your body adjust to the current dose',
      color: 'blue',
      defaultDuration: 7,
      defaultReason: 'Body adjustment and stabilization period'
    },
    {
      type: 'tolerance' as const,
      icon: <Shield className="h-5 w-5 text-green-600" />,
      title: 'Tolerance Break',
      description: 'Prevent tolerance buildup and maintain effectiveness',
      color: 'green',
      defaultDuration: 14,
      defaultReason: 'Preventing tolerance development'
    },
    {
      type: 'emergency' as const,
      icon: <AlertTriangle className="h-5 w-5 text-red-600" />,
      title: 'Emergency Break',
      description: 'Severe withdrawal symptoms requiring immediate pause',
      color: 'red',
      defaultDuration: 21,
      defaultReason: 'Emergency break due to severe symptoms'
    },
    {
      type: 'planned' as const,
      icon: <Calendar className="h-5 w-5 text-purple-600" />,
      title: 'Planned Break',
      description: 'Scheduled break for life events, travel, or medical procedures',
      color: 'purple',
      defaultDuration: 10,
      defaultReason: 'Planned break for life circumstances'
    },
    {
      type: 'temporary' as const,
      icon: <Pause className="h-5 w-5 text-gray-600" />,
      title: 'Temporary Pause',
      description: 'Short-term pause for any reason',
      color: 'gray',
      defaultDuration: 3,
      defaultReason: 'Temporary pause'
    },
    {
      type: 'withdrawal_management' as const,
      icon: <Coffee className="h-5 w-5 text-orange-600" />,
      title: 'Withdrawal Management',
      description: 'Managing withdrawal symptoms with extended stabilization',
      color: 'orange',
      defaultDuration: 14,
      defaultReason: 'Managing withdrawal symptoms'
    }
  ];

  const selectedBreakInfo = breakTypes.find(bt => bt.type === selectedBreakType);

  React.useEffect(() => {
    if (selectedBreakInfo) {
      // Only set default duration if user hasn't manually changed it
      if (!userChangedDuration) {
        setPlannedDuration(selectedBreakInfo.defaultDuration);
      }
      setReason(selectedBreakInfo.defaultReason);
    }
  }, [selectedBreakType, selectedBreakInfo, userChangedDuration]);

  // Reset user interaction flags when modal opens
  React.useEffect(() => {
    if (isOpen) {
      setUserChangedDuration(false);
    }
  }, [isOpen]);

  const handleStartBreak = () => {
    if (!reason.trim()) {
      toast.error('Please provide a reason for the break');
      return;
    }

    startTaperingBreak(medication.id, selectedBreakType, reason, {
      withdrawalSeverity,
      plannedDuration,
      notes: notes.trim() || undefined,
      autoResumeEnabled,
      reminderEnabled,
      reminderFrequency
    });

    toast.success(`${selectedBreakInfo?.title} started for ${medication.name}`);
    onClose();
  };

  const handleEndBreak = () => {
    if (currentBreak) {
      endTaperingBreak(medication.id, true);
      toast.success(`Break ended for ${medication.name}. Tapering resumed.`);
      onClose();
    }
  };

  const breakDuration = currentBreak ? 
    Math.floor((new Date().getTime() - (currentBreak.startDate instanceof Date ? currentBreak.startDate : new Date(currentBreak.startDate)).getTime()) / (1000 * 60 * 60 * 24)) : 0;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
      <div className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            {isOnBreak ? 'Manage Active Break' : 'Start Tapering Break'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {isOnBreak && currentBreak ? (
            // Show current break status
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center mb-3">
                <Clock className="h-5 w-5 text-blue-600 mr-2" />
                <h3 className="text-lg font-medium text-blue-800">Current Break</h3>
              </div>
              <div className="space-y-2 text-sm">
                <p><strong>Type:</strong> {breakTypes.find(bt => bt.type === currentBreak.type)?.title}</p>
                <p><strong>Reason:</strong> {currentBreak.reason}</p>
                <p><strong>Duration:</strong> {breakDuration} days (planned: {currentBreak.plannedDuration} days)</p>
                <p><strong>Dose maintained:</strong> {currentBreak.doseAtBreak} {medication.unit}</p>
                {currentBreak.notes && <p><strong>Notes:</strong> {currentBreak.notes}</p>}
              </div>
              <div className="mt-4">
                <button
                  onClick={handleEndBreak}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
                >
                  End Break & Resume Tapering
                </button>
              </div>
            </div>
          ) : (
            // Show break type selection and configuration
            <>
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Select Break Type</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {breakTypes.map((breakType) => (
                    <button
                      key={breakType.type}
                      onClick={() => setSelectedBreakType(breakType.type)}
                      className={`p-4 border rounded-lg text-left transition-all ${
                        selectedBreakType === breakType.type
                          ? `border-${breakType.color}-500 bg-${breakType.color}-50`
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center mb-2">
                        {breakType.icon}
                        <span className="ml-2 font-medium text-gray-900">{breakType.title}</span>
                      </div>
                      <p className="text-sm text-gray-600">{breakType.description}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Reason for Break
                  </label>
                  <input
                    type="text"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Describe why you're taking this break..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Planned Duration (days)
                    </label>
                    <input
                      type="number"
                      value={plannedDuration}
                      onChange={(e) => {
                        setPlannedDuration(parseInt(e.target.value) || 1);
                        setUserChangedDuration(true);
                      }}
                      min="1"
                      max="90"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {(selectedBreakType === 'emergency' || selectedBreakType === 'withdrawal_management') && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Withdrawal Severity
                      </label>
                      <select
                        value={withdrawalSeverity}
                        onChange={(e) => setWithdrawalSeverity(e.target.value as 'mild' | 'moderate' | 'severe')}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="mild">Mild</option>
                        <option value="moderate">Moderate</option>
                        <option value="severe">Severe</option>
                      </select>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Additional Notes (optional)
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Any additional information about this break..."
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="space-y-3">
                  <h4 className="text-md font-medium text-gray-900">Break Settings</h4>
                  
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="autoResume"
                      checked={autoResumeEnabled}
                      onChange={(e) => setAutoResumeEnabled(e.target.checked)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="autoResume" className="ml-2 text-sm text-gray-700">
                      Auto-resume tapering after planned duration
                    </label>
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="reminders"
                      checked={reminderEnabled}
                      onChange={(e) => setReminderEnabled(e.target.checked)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="reminders" className="ml-2 text-sm text-gray-700">
                      Send reminders about break status
                    </label>
                  </div>

                  {reminderEnabled && (
                    <div className="ml-6">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Reminder Frequency
                      </label>
                      <select
                        value={reminderFrequency}
                        onChange={(e) => setReminderFrequency(e.target.value as 'daily' | 'weekly' | 'none')}
                        className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="none">None</option>
                      </select>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex">
                  <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                  <div className="ml-3">
                    <h4 className="text-sm font-medium text-yellow-800">Important</h4>
                    <p className="text-sm text-yellow-700 mt-1">
                      During the break, you'll maintain your current dose of {medication.dosage} {medication.unit}. 
                      The tapering schedule will automatically extend to account for the break duration.
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {!isOnBreak && (
          <div className="flex justify-end space-x-3 px-6 py-4 border-t border-gray-200">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleStartBreak}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Start Break
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
