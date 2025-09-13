import React from 'react';
import { X, Activity, AlertTriangle } from 'lucide-react';
import { useMedicationStore } from '@/store';
import { Medication, WithdrawalEvent, WithdrawalSymptom } from '@/types';
import { generateId } from '@/utils/helpers';
import toast from 'react-hot-toast';

interface WithdrawalTrackingModalProps {
  isOpen: boolean;
  onClose: () => void;
  medication: Medication;
  event?: WithdrawalEvent; // For updating existing event
}

export function WithdrawalTrackingModal({ isOpen, onClose, medication, event }: WithdrawalTrackingModalProps) {
  const { updateMedication } = useMedicationStore();
  
  const [eventData, setEventData] = React.useState<Partial<WithdrawalEvent>>({
    startDate: new Date(),
    severity: 'mild',
    symptoms: [],
    interventions: [],
    medicalSupervision: false,
    successfullyCompleted: false,
    relapsePrevention: []
  });

  const [currentSymptom, setCurrentSymptom] = React.useState({
    symptom: '',
    severity: 5,
    duration: 1,
    peak: new Date(),
    managementStrategies: [] as string[],
    resolved: false
  });

  const [newIntervention, setNewIntervention] = React.useState('');
  const [newPreventionStrategy, setNewPreventionStrategy] = React.useState('');

  // Common withdrawal symptoms by medication category
  const commonSymptoms = {
    'benzodiazepine': [
      'Anxiety', 'Panic attacks', 'Insomnia', 'Seizures', 'Tremor', 'Sweating',
      'Nausea', 'Vomiting', 'Hallucinations', 'Confusion', 'Muscle pain',
      'Light/sound sensitivity', 'Memory problems', 'Concentration difficulty'
    ],
    'opioid': [
      'Muscle aches', 'Runny nose', 'Excessive tearing', 'Abdominal cramping',
      'Diarrhea', 'Nausea', 'Vomiting', 'Dilated pupils', 'Goosebumps',
      'Insomnia', 'Restlessness', 'Anxiety', 'Depression', 'Cravings'
    ],
    'antidepressant': [
      'Brain zaps', 'Dizziness', 'Nausea', 'Headache', 'Fatigue', 'Irritability',
      'Anxiety', 'Confusion', 'Vivid dreams', 'Flu-like symptoms',
      'Emotional lability', 'Sleep disturbances'
    ],
    'stimulant': [
      'Fatigue', 'Depression', 'Increased appetite', 'Sleep problems',
      'Anxiety', 'Concentration problems', 'Cravings', 'Mood swings',
      'Slow thinking', 'Lack of motivation'
    ],
    'sleep-aid': [
      'Rebound insomnia', 'Anxiety', 'Panic attacks', 'Sweating', 'Tremor',
      'Nausea', 'Confusion', 'Memory problems', 'Seizures (rare)',
      'Muscle tension', 'Nightmares'
    ]
  };

  const managementStrategies = [
    'Deep breathing exercises', 'Meditation', 'Progressive muscle relaxation',
    'Light exercise', 'Hydration', 'Hot/cold therapy', 'Distraction techniques',
    'Support group contact', 'Medical intervention', 'Rest', 'Nutritional support',
    'Counseling session', 'Family support', 'Medication adjustment'
  ];

  React.useEffect(() => {
    if (event) {
      setEventData(event);
    }
  }, [event]);

  const addSymptom = () => {
    if (!currentSymptom.symptom.trim()) return;

    const newSymptom: WithdrawalSymptom = {
      ...currentSymptom,
      symptom: currentSymptom.symptom.trim()
    };

    setEventData(prev => ({
      ...prev,
      symptoms: [...(prev.symptoms || []), newSymptom]
    }));

    setCurrentSymptom({
      symptom: '',
      severity: 5,
      duration: 1,
      peak: new Date(),
      managementStrategies: [],
      resolved: false
    });
  };

  const removeSymptom = (index: number) => {
    setEventData(prev => ({
      ...prev,
      symptoms: prev.symptoms?.filter((_, i) => i !== index) || []
    }));
  };

  const updateSymptom = (index: number, updates: Partial<WithdrawalSymptom>) => {
    setEventData(prev => ({
      ...prev,
      symptoms: prev.symptoms?.map((symptom, i) => 
        i === index ? { ...symptom, ...updates } : symptom
      ) || []
    }));
  };

  const addIntervention = () => {
    if (!newIntervention.trim()) return;
    
    setEventData(prev => ({
      ...prev,
      interventions: [...(prev.interventions || []), newIntervention.trim()]
    }));
    setNewIntervention('');
  };

  const addPreventionStrategy = () => {
    if (!newPreventionStrategy.trim()) return;
    
    setEventData(prev => ({
      ...prev,
      relapsePrevention: [...(prev.relapsePrevention || []), newPreventionStrategy.trim()]
    }));
    setNewPreventionStrategy('');
  };

  const handleSubmit = () => {
    const withdrawalEvent: WithdrawalEvent = {
      id: event?.id || generateId(),
      ...eventData,
      startDate: eventData.startDate!,
      severity: eventData.severity!,
      symptoms: eventData.symptoms!,
      interventions: eventData.interventions!,
      medicalSupervision: eventData.medicalSupervision!,
      successfullyCompleted: eventData.successfullyCompleted!
    };

    const prevention = medication.dependencePrevention;
    if (prevention) {
      const existingEventIndex = prevention.withdrawalHistory.findIndex(e => e.id === withdrawalEvent.id);
      const updatedHistory = existingEventIndex >= 0
        ? prevention.withdrawalHistory.map((e, i) => i === existingEventIndex ? withdrawalEvent : e)
        : [...prevention.withdrawalHistory, withdrawalEvent];

      updateMedication(medication.id, {
        dependencePrevention: {
          ...prevention,
          withdrawalHistory: updatedHistory
        }
      });
    }

    toast.success(event ? 'Withdrawal event updated' : 'Withdrawal tracking started');
    onClose();
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'mild': return 'text-green-600 bg-green-50 border-green-200';
      case 'moderate': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'severe': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'dangerous': return 'text-red-600 bg-red-50 border-red-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getSymptomSeverityColor = (severity: number) => {
    if (severity <= 3) return 'text-green-600';
    if (severity <= 6) return 'text-yellow-600';
    if (severity <= 8) return 'text-orange-600';
    return 'text-red-600';
  };

  if (!isOpen) return null;

  const category = medication.dependencyRiskCategory;
  const symptomList = commonSymptoms[category] || commonSymptoms['benzodiazepine'];

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Activity className="h-6 w-6 text-purple-600" />
              <div>
                <h3 className="text-lg font-medium text-gray-900">
                  {event ? 'Update' : 'Track'} Withdrawal Symptoms
                </h3>
                <p className="text-sm text-gray-500">
                  {medication.name} • Monitor and manage withdrawal process
                </p>
              </div>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        <div className="px-6 py-4 space-y-6">
          
          {/* Basic Information */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Start Date
              </label>
              <input
                type="date"
                value={eventData.startDate?.toISOString().split('T')[0]}
                onChange={(e) => setEventData(prev => ({ ...prev, startDate: new Date(e.target.value) }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                End Date (if completed)
              </label>
              <input
                type="date"
                value={eventData.endDate?.toISOString().split('T')[0] || ''}
                onChange={(e) => setEventData(prev => ({ 
                  ...prev, 
                  endDate: e.target.value ? new Date(e.target.value) : undefined 
                }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Overall Severity
              </label>
              <select
                value={eventData.severity}
                onChange={(e) => setEventData(prev => ({ ...prev, severity: e.target.value as any }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              >
                <option value="mild">Mild</option>
                <option value="moderate">Moderate</option>
                <option value="severe">Severe</option>
                <option value="dangerous">Dangerous</option>
              </select>
            </div>
          </div>

          {/* Status Checkboxes */}
          <div className="grid grid-cols-2 gap-4">
            <label className="flex items-center space-x-3">
              <input
                type="checkbox"
                checked={eventData.medicalSupervision}
                onChange={(e) => setEventData(prev => ({ ...prev, medicalSupervision: e.target.checked }))}
                className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
              />
              <span className="text-sm text-gray-700">Under medical supervision</span>
            </label>

            <label className="flex items-center space-x-3">
              <input
                type="checkbox"
                checked={eventData.successfullyCompleted}
                onChange={(e) => setEventData(prev => ({ ...prev, successfullyCompleted: e.target.checked }))}
                className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
              />
              <span className="text-sm text-gray-700">Successfully completed</span>
            </label>
          </div>

          {/* Add New Symptom */}
          <div className="border border-gray-200 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 mb-4">Add Withdrawal Symptom</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Symptom
                </label>
                <div className="space-y-2">
                  <input
                    type="text"
                    value={currentSymptom.symptom}
                    onChange={(e) => setCurrentSymptom(prev => ({ ...prev, symptom: e.target.value }))}
                    placeholder="Enter custom symptom or select below"
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  />
                  
                  <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto">
                    {symptomList.map((symptom) => (
                      <button
                        key={symptom}
                        type="button"
                        onClick={() => setCurrentSymptom(prev => ({ ...prev, symptom }))}
                        className={`text-left p-2 rounded border text-sm hover:bg-gray-50 ${
                          currentSymptom.symptom === symptom ? 'border-purple-500 bg-purple-50' : 'border-gray-200'
                        }`}
                      >
                        {symptom}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Severity (1-10): {currentSymptom.severity}
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={currentSymptom.severity}
                    onChange={(e) => setCurrentSymptom(prev => ({ ...prev, severity: parseInt(e.target.value) }))}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Mild</span>
                    <span>Severe</span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Duration (hours)
                  </label>
                  <input
                    type="number"
                    min="0.5"
                    step="0.5"
                    value={currentSymptom.duration}
                    onChange={(e) => setCurrentSymptom(prev => ({ ...prev, duration: parseFloat(e.target.value) }))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  />
                </div>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Management Strategies (select all that apply)
              </label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-32 overflow-y-auto">
                {managementStrategies.map((strategy) => (
                  <label key={strategy} className="flex items-center space-x-2 text-sm">
                    <input
                      type="checkbox"
                      checked={currentSymptom.managementStrategies.includes(strategy)}
                      onChange={(e) => {
                        const strategies = e.target.checked
                          ? [...currentSymptom.managementStrategies, strategy]
                          : currentSymptom.managementStrategies.filter(s => s !== strategy);
                        setCurrentSymptom(prev => ({ ...prev, managementStrategies: strategies }));
                      }}
                      className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                    />
                    <span>{strategy}</span>
                  </label>
                ))}
              </div>
            </div>

            <button
              onClick={addSymptom}
              disabled={!currentSymptom.symptom.trim()}
              className="px-4 py-2 text-sm font-medium text-white bg-purple-600 border border-transparent rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Add Symptom
            </button>
          </div>

          {/* Current Symptoms List */}
          {eventData.symptoms && eventData.symptoms.length > 0 && (
            <div>
              <h4 className="font-medium text-gray-900 mb-4">Current Symptoms</h4>
              <div className="space-y-3">
                {eventData.symptoms.map((symptom, index) => (
                  <div key={index} className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h5 className="font-medium text-gray-900">{symptom.symptom}</h5>
                          <span className={`text-sm font-medium ${getSymptomSeverityColor(symptom.severity)}`}>
                            Severity: {symptom.severity}/10
                          </span>
                          <span className="text-sm text-gray-500">
                            Duration: {symptom.duration}h
                          </span>
                        </div>
                        
                        {symptom.managementStrategies.length > 0 && (
                          <div className="mb-2">
                            <span className="text-sm text-gray-600">Strategies: </span>
                            <span className="text-sm text-gray-800">
                              {symptom.managementStrategies.join(', ')}
                            </span>
                          </div>
                        )}

                        <label className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={symptom.resolved}
                            onChange={(e) => updateSymptom(index, { resolved: e.target.checked })}
                            className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                          />
                          <span className="text-sm text-gray-700">Resolved</span>
                        </label>
                      </div>
                      
                      <button
                        onClick={() => removeSymptom(index)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Interventions */}
          <div>
            <h4 className="font-medium text-gray-900 mb-4">Interventions & Support</h4>
            <div className="space-y-3">
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={newIntervention}
                  onChange={(e) => setNewIntervention(e.target.value)}
                  placeholder="Add intervention (e.g., doctor visit, support group)"
                  className="flex-1 border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                />
                <button
                  onClick={addIntervention}
                  disabled={!newIntervention.trim()}
                  className="px-4 py-2 text-sm font-medium text-white bg-purple-600 border border-transparent rounded-md hover:bg-purple-700 disabled:opacity-50"
                >
                  Add
                </button>
              </div>
              
              {eventData.interventions && eventData.interventions.length > 0 && (
                <div className="space-y-2">
                  {eventData.interventions.map((intervention, index) => (
                    <div key={index} className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded">
                      <span className="text-sm text-gray-800">{intervention}</span>
                      <button
                        onClick={() => setEventData(prev => ({
                          ...prev,
                          interventions: prev.interventions?.filter((_, i) => i !== index) || []
                        }))}
                        className="text-red-600 hover:text-red-800"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Relapse Prevention */}
          <div>
            <h4 className="font-medium text-gray-900 mb-4">Relapse Prevention Strategies</h4>
            <div className="space-y-3">
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={newPreventionStrategy}
                  onChange={(e) => setNewPreventionStrategy(e.target.value)}
                  placeholder="Add prevention strategy (e.g., stress management, therapy)"
                  className="flex-1 border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                />
                <button
                  onClick={addPreventionStrategy}
                  disabled={!newPreventionStrategy.trim()}
                  className="px-4 py-2 text-sm font-medium text-white bg-purple-600 border border-transparent rounded-md hover:bg-purple-700 disabled:opacity-50"
                >
                  Add
                </button>
              </div>
              
              {eventData.relapsePrevention && eventData.relapsePrevention.length > 0 && (
                <div className="space-y-2">
                  {eventData.relapsePrevention.map((strategy, index) => (
                    <div key={index} className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded">
                      <span className="text-sm text-gray-800">{strategy}</span>
                      <button
                        onClick={() => setEventData(prev => ({
                          ...prev,
                          relapsePrevention: prev.relapsePrevention?.filter((_, i) => i !== index) || []
                        }))}
                        className="text-red-600 hover:text-red-800"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Warning for dangerous withdrawal */}
          {eventData.severity === 'dangerous' && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
                <div>
                  <h4 className="text-sm font-medium text-red-800">Dangerous Withdrawal Warning</h4>
                  <p className="text-sm text-red-700 mt-1">
                    Dangerous withdrawal symptoms require immediate medical attention. If experiencing seizures, 
                    severe confusion, or other life-threatening symptoms, seek emergency medical care immediately.
                  </p>
                </div>
              </div>
            </div>
          )}
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
              className="px-6 py-2 text-sm font-medium text-white bg-purple-600 border border-transparent rounded-md hover:bg-purple-700 flex items-center space-x-2"
            >
              <Activity className="h-4 w-4" />
              <span>{event ? 'Update' : 'Start'} Tracking</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
