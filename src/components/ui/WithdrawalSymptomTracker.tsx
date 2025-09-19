import React from 'react';
import { Activity, TrendingDown, TrendingUp, Minus, Plus, X } from 'lucide-react';
import { useMedicationStore } from '@/store';
import { Medication, WithdrawalSymptom } from '@/types';
import { generateId } from '@/utils/helpers';
import toast from 'react-hot-toast';

interface WithdrawalSymptomTrackerProps {
  medication: Medication;
  isOpen: boolean;
  onClose: () => void;
}

export function WithdrawalSymptomTracker({ medication, isOpen, onClose }: WithdrawalSymptomTrackerProps) {
  const { updateMedication, addSmartMessage } = useMedicationStore();

  const [symptoms, setSymptoms] = React.useState<Record<string, number>>({});
  const [newSymptom, setNewSymptom] = React.useState('');
  const [mood, setMood] = React.useState<number>(5);
  const [notes, setNotes] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Common withdrawal symptoms by medication category
  const commonSymptoms = {
    'benzodiazepine': [
      'Anxiety', 'Panic attacks', 'Insomnia', 'Tremor', 'Sweating',
      'Nausea', 'Headache', 'Muscle tension', 'Concentration problems',
      'Memory issues', 'Irritability', 'Light sensitivity'
    ],
    'opioid': [
      'Muscle aches', 'Runny nose', 'Nausea', 'Vomiting', 'Diarrhea',
      'Insomnia', 'Restlessness', 'Anxiety', 'Depression', 'Cravings',
      'Hot/cold flashes', 'Fatigue'
    ],
    'antidepressant': [
      'Brain zaps', 'Dizziness', 'Nausea', 'Headache', 'Fatigue',
      'Irritability', 'Anxiety', 'Vivid dreams', 'Flu-like symptoms',
      'Emotional lability', 'Confusion'
    ],
    'stimulant': [
      'Fatigue', 'Depression', 'Increased appetite', 'Sleep problems',
      'Anxiety', 'Concentration problems', 'Cravings', 'Mood swings',
      'Lack of motivation'
    ],
    'sleep-aid': [
      'Rebound insomnia', 'Anxiety', 'Panic attacks', 'Sweating',
      'Tremor', 'Nausea', 'Confusion', 'Memory problems',
      'Muscle tension', 'Nightmares'
    ]
  };

  const category = medication.dependencyRiskCategory;
  const symptomList = commonSymptoms[category as keyof typeof commonSymptoms] || commonSymptoms['benzodiazepine'];

  const activeWithdrawal = medication.dependencePrevention?.withdrawalHistory.find(event => !event.endDate && !event.successfullyCompleted);
  const daysSinceStart = activeWithdrawal?.startDate 
    ? Math.floor((Date.now() - new Date(activeWithdrawal.startDate).getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  React.useEffect(() => {
    if (isOpen) {
      // Initialize with existing symptoms from today
      const today = new Date().toDateString();
      const todaysSymptoms: Record<string, number> = {};
      
      if (activeWithdrawal?.symptoms) {
        activeWithdrawal.symptoms.forEach(symptom => {
          if (new Date(symptom.peak).toDateString() === today) {
            todaysSymptoms[symptom.symptom] = symptom.severity;
          }
        });
      }
      
      setSymptoms(todaysSymptoms);
    }
  }, [isOpen, activeWithdrawal]);

  const updateSymptomSeverity = (symptom: string, severity: number) => {
    setSymptoms(prev => ({
      ...prev,
      [symptom]: severity
    }));
  };

  const addCustomSymptom = () => {
    if (newSymptom.trim() && !symptoms[newSymptom.trim()]) {
      setSymptoms(prev => ({
        ...prev,
        [newSymptom.trim()]: 1
      }));
      setNewSymptom('');
    }
  };

  const removeSymptom = (symptom: string) => {
    setSymptoms(prev => {
      const updated = { ...prev };
      delete updated[symptom];
      return updated;
    });
  };

  const getSymptomTrend = (symptom: string) => {
    if (!activeWithdrawal?.symptoms) return 'stable';
    
    const symptomHistory = activeWithdrawal.symptoms
      .filter(s => s.symptom === symptom)
      .sort((a, b) => new Date(a.peak).getTime() - new Date(b.peak).getTime())
      .slice(-3); // Last 3 entries
    
    if (symptomHistory.length < 2) return 'stable';
    
    const recent = symptomHistory[symptomHistory.length - 1].severity;
    const previous = symptomHistory[symptomHistory.length - 2].severity;
    
    if (recent > previous + 1) return 'worsening';
    if (recent < previous - 1) return 'improving';
    return 'stable';
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving': return <TrendingDown className="h-3 w-3 text-green-500" />;
      case 'worsening': return <TrendingUp className="h-3 w-3 text-red-500" />;
      default: return <Minus className="h-3 w-3 text-gray-400" />;
    }
  };

  const getSeverityColor = (severity: number) => {
    if (severity <= 2) return 'text-green-600 bg-green-100';
    if (severity <= 4) return 'text-yellow-600 bg-yellow-100';
    if (severity <= 7) return 'text-orange-600 bg-orange-100';
    return 'text-red-600 bg-red-100';
  };

  const getMoodColor = (mood: number) => {
    if (mood <= 2) return 'text-red-600';
    if (mood <= 4) return 'text-orange-600';
    if (mood <= 6) return 'text-yellow-600';
    if (mood <= 8) return 'text-blue-600';
    return 'text-green-600';
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    
    try {
      const now = new Date();
      const newSymptoms: WithdrawalSymptom[] = Object.entries(symptoms).map(([symptom, severity]) => ({
        symptom,
        severity,
        duration: 24, // Assume symptoms lasted most of the day
        peak: now,
        managementStrategies: [],
        resolved: severity === 0
      }));

      // Update the active withdrawal event
      if (activeWithdrawal && medication.dependencePrevention) {
        const updatedWithdrawal = {
          ...activeWithdrawal,
          symptoms: [
            ...activeWithdrawal.symptoms.filter(s => 
              new Date(s.peak).toDateString() !== now.toDateString()
            ),
            ...newSymptoms
          ]
        };

        const updatedHistory = medication.dependencePrevention.withdrawalHistory.map(event =>
          event.id === activeWithdrawal.id ? updatedWithdrawal : event
        );

        updateMedication(medication.id, {
          dependencePrevention: {
            ...medication.dependencePrevention,
            withdrawalHistory: updatedHistory
          }
        });
      } else {
        // No active withdrawal found, but user is trying to log symptoms
        toast.error('No active withdrawal tracking found. Please start withdrawal tracking first from the medications page.');
        onClose();
        return;
      }

        // Generate support message based on symptoms
        const totalSeverity = Object.values(symptoms).reduce((sum, severity) => sum + severity, 0);
        const avgSeverity = totalSeverity / Object.keys(symptoms).length;

        if (avgSeverity > 6) {
          addSmartMessage({
            medicationId: medication.id,
            type: 'risk-alert',
            priority: 'high',
            title: 'Withdrawal Symptoms Tracked',
            message: `Your symptoms today seem intense. Remember, this is temporary and you're doing great. Consider contacting your healthcare provider if symptoms become unbearable.`,
            psychologicalApproach: 'empathetic-support',
            scheduledTime: now,
            expiresAt: new Date(now.getTime() + 12 * 60 * 60 * 1000) // 12 hours
          });
        } else if (avgSeverity > 3) {
          addSmartMessage({
            medicationId: medication.id,
            type: 'motivation',
            priority: 'medium',
            title: 'Managing Withdrawal Well',
            message: `You're tracking your symptoms - that's self-awareness and strength. Each day is progress toward feeling better.`,
            psychologicalApproach: 'positive-reinforcement',
            scheduledTime: now,
            expiresAt: new Date(now.getTime() + 8 * 60 * 60 * 1000) // 8 hours
          });
        } else {
          addSmartMessage({
            medicationId: medication.id,
            type: 'celebration',
            priority: 'low',
            title: 'Feeling Better!',
            message: `Your symptoms are mild today - that's wonderful progress! You're showing real resilience.`,
            psychologicalApproach: 'positive-reinforcement',
            scheduledTime: now,
            expiresAt: new Date(now.getTime() + 6 * 60 * 60 * 1000) // 6 hours
          });
        }

      toast.success('Withdrawal symptoms logged successfully');
      onClose();
    } catch (error) {
      console.error('Error logging withdrawal symptoms:', error);
      toast.error('Failed to log symptoms');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !activeWithdrawal) return null;

  return (
    <div className="fixed inset-0 glass-overlay flex items-center justify-center p-4 z-50">
      <div className="glass-panel rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="sticky top-0 bg-white/70 backdrop-blur-md border-b border-gray-200/70 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Activity className="h-6 w-6 text-orange-600" />
              <div>
                <h3 className="text-lg font-medium text-gray-900">
                  Daily Withdrawal Check-in
                </h3>
                <p className="text-sm text-gray-500">
                  {medication.name} • Day {daysSinceStart}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        <div className="px-6 py-4 space-y-6">

          {/* Overall Mood */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Overall Mood Today (1-10)
            </label>
            <div className="flex items-center space-x-4">
              <input
                type="range"
                min="1"
                max="10"
                value={mood}
                onChange={(e) => setMood(parseInt(e.target.value))}
                className="flex-1"
              />
              <span className={`text-lg font-semibold ${getMoodColor(mood)}`}>
                {mood}/10
              </span>
            </div>
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>Very Low</span>
              <span>Excellent</span>
            </div>
          </div>

          {/* Common Symptoms */}
          <div>
            <h4 className="font-medium text-gray-900 mb-4">Common Withdrawal Symptoms</h4>
            <div className="grid grid-cols-1 gap-3">
              {symptomList.map((symptom) => {
                const severity = symptoms[symptom] || 0;
                const trend = getSymptomTrend(symptom);
                
                return (
                  <div key={symptom} className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-medium text-gray-900">{symptom}</span>
                        {getTrendIcon(trend)}
                      </div>
                      <div className="flex items-center space-x-2">
                        {severity > 0 && (
                          <span className={`text-xs px-2 py-1 rounded-full ${getSeverityColor(severity)}`}>
                            {severity}/10
                          </span>
                        )}
                        <button
                          onClick={() => removeSymptom(symptom)}
                          className="text-gray-400 hover:text-red-500"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs text-gray-500">None</span>
                      <input
                        type="range"
                        min="0"
                        max="10"
                        value={severity}
                        onChange={(e) => updateSymptomSeverity(symptom, parseInt(e.target.value))}
                        className="flex-1"
                      />
                      <span className="text-xs text-gray-500">Severe</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Add Custom Symptom */}
          <div>
            <h4 className="font-medium text-gray-900 mb-4">Add Custom Symptom</h4>
            <div className="flex space-x-2">
              <input
                type="text"
                value={newSymptom}
                onChange={(e) => setNewSymptom(e.target.value)}
                placeholder="Enter a symptom you're experiencing"
                className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
              <button
                onClick={addCustomSymptom}
                disabled={!newSymptom.trim() || symptoms[newSymptom.trim()]}
                className="bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Additional Notes (Optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="How are you feeling overall? Any coping strategies that helped today?"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              rows={3}
            />
          </div>

          {/* Encouragement */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h4 className="text-sm font-medium text-green-800 mb-2">🌟 You're Doing Great!</h4>
            <p className="text-sm text-green-700">
              Tracking your symptoms shows self-awareness and commitment to your recovery. 
              Each day you monitor your progress is a step toward feeling better. 
              Remember, withdrawal symptoms are temporary, but your strength is lasting.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 px-6 py-4 border-t border-gray-200">
          <div className="flex justify-end space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || Object.keys(symptoms).length === 0}
              className="px-6 py-2 text-sm font-medium text-white bg-orange-600 border border-transparent rounded-md hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Saving...' : 'Log Symptoms'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

