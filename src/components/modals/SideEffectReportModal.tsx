import React from 'react';
import { X, AlertTriangle, FileText } from 'lucide-react';
import { useMedicationStore } from '@/store';
import { Medication, SideEffectReport } from '@/types';
import { generateId } from '@/utils/helpers';
import toast from 'react-hot-toast';

interface SideEffectReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  medication: Medication;
}

export function SideEffectReportModal({ isOpen, onClose, medication }: SideEffectReportModalProps) {
  const { updateMedication } = useMedicationStore();
  
  const [formData, setFormData] = React.useState({
    sideEffect: '',
    severity: 'mild' as const,
    onset: 'gradual' as const,
    frequency: 'occasional' as const,
    duration: 24,
    interference: 'none' as const,
    bodySystem: 'other' as const,
    description: '',
    doctorNotified: false,
    followUpRequired: false,
    actionTaken: 'continued' as const,
    relatedMedications: [] as string[]
  });

  const [currentStep, setCurrentStep] = React.useState(1);
  const totalSteps = 4;

  const commonSideEffects = {
    neurological: ['Headache', 'Dizziness', 'Drowsiness', 'Confusion', 'Memory problems', 'Tremor'],
    gastrointestinal: ['Nausea', 'Vomiting', 'Diarrhea', 'Constipation', 'Stomach pain', 'Loss of appetite'],
    cardiovascular: ['Palpitations', 'Chest pain', 'Shortness of breath', 'Swelling', 'Changes in blood pressure'],
    psychological: ['Anxiety', 'Depression', 'Mood changes', 'Irritability', 'Sleep problems', 'Cognitive issues'],
    dermatological: ['Skin rash', 'Itching', 'Hives', 'Dry skin', 'Hair loss', 'Photosensitivity'],
    respiratory: ['Cough', 'Difficulty breathing', 'Congestion', 'Wheezing', 'Throat irritation'],
    other: ['Fatigue', 'Weight changes', 'Sexual dysfunction', 'Muscle pain', 'Joint pain', 'Vision changes']
  };

  const handleSubmit = () => {
    const sideEffectReport: SideEffectReport = {
      id: generateId(),
      medicationId: medication.id,
      medicationName: medication.name,
      ...formData,
      timestamp: new Date(),
      resolved: false,
      doctorNotified: false,
      followUpRequired: false,
      reportedDates: [new Date()]
    };

    const updatedReports = [...(medication.sideEffectReports || []), sideEffectReport];
    
    updateMedication(medication.id, {
      sideEffectReports: updatedReports,
      enhancedMonitoring: true
    });

    // Generate appropriate alerts based on severity
    if (formData.severity === 'severe' || formData.severity === 'life-threatening') {
      toast.error('⚠️ Severe side effect reported. Consider consulting your doctor immediately.', {
        duration: 8000
      });
    } else {
      toast.success('📝 Side effect report saved successfully', {
        duration: 4000
      });
    }

    onClose();
    resetForm();
  };

  const resetForm = () => {
    setFormData({
      sideEffect: '',
      severity: 'mild',
      onset: 'gradual',
      frequency: 'occasional',
      duration: 24,
      interference: 'none',
      bodySystem: 'other',
      description: '',
      doctorNotified: false,
      followUpRequired: false,
      actionTaken: 'continued',
      relatedMedications: []
    });
    setCurrentStep(1);
  };

  const nextStep = () => setCurrentStep(Math.min(currentStep + 1, totalSteps));
  const prevStep = () => setCurrentStep(Math.max(currentStep - 1, 1));

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'mild': return 'text-green-600 bg-green-50 border-green-200';
      case 'moderate': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'severe': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'life-threatening': return 'text-red-600 bg-red-50 border-red-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 glass-overlay flex items-center justify-center p-4 z-50">
      <div className="glass-panel rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="sticky top-0 bg-white/70 backdrop-blur-md border-b border-gray-200/70 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <AlertTriangle className="h-6 w-6 text-orange-600" />
              <div>
                <h3 className="text-lg font-medium text-gray-900">
                  Report Side Effect
                </h3>
                <p className="text-sm text-gray-500">
                  {medication.name} • Step {currentStep} of {totalSteps}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
              <X className="h-6 w-6" />
            </button>
          </div>
          
          {/* Progress bar */}
          <div className="mt-4 w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-orange-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(currentStep / totalSteps) * 100}%` }}
            />
          </div>
        </div>

        <div className="px-6 py-4">
          {/* Step 1: Side Effect & Body System */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Body System Affected
                </label>
                <select
                  value={formData.bodySystem}
                  onChange={(e) => setFormData(prev => ({ ...prev, bodySystem: e.target.value as any }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                >
                  <option value="neurological">Neurological (Brain & Nervous System)</option>
                  <option value="gastrointestinal">Gastrointestinal (Digestive System)</option>
                  <option value="cardiovascular">Cardiovascular (Heart & Circulation)</option>
                  <option value="psychological">Psychological (Mental Health)</option>
                  <option value="dermatological">Dermatological (Skin)</option>
                  <option value="respiratory">Respiratory (Breathing)</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Side Effect (Select or type custom)
                </label>
                <div className="space-y-2">
                  <input
                    type="text"
                    value={formData.sideEffect}
                    onChange={(e) => setFormData(prev => ({ ...prev, sideEffect: e.target.value }))}
                    placeholder="Type a custom side effect or select from below"
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                  
                  <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto">
                    {commonSideEffects[formData.bodySystem]?.map((effect) => (
                      <button
                        key={effect}
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, sideEffect: effect }))}
                        className={`text-left p-2 rounded border text-sm hover:bg-gray-50 ${
                          formData.sideEffect === effect ? 'border-orange-500 bg-orange-50' : 'border-gray-200'
                        }`}
                      >
                        {effect}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Severity & Timing */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Severity Level
                </label>
                <div className="space-y-2">
                  {[
                    { value: 'mild', label: 'Mild', desc: 'Noticeable but not bothersome' },
                    { value: 'moderate', label: 'Moderate', desc: 'Interferes with daily activities' },
                    { value: 'severe', label: 'Severe', desc: 'Significantly impacts quality of life' },
                    { value: 'life-threatening', label: 'Life-threatening', desc: 'Requires immediate medical attention' }
                  ].map(({ value, label, desc }) => (
                    <label key={value} className="flex items-start space-x-3 cursor-pointer">
                      <input
                        type="radio"
                        name="severity"
                        value={value}
                        checked={formData.severity === value}
                        onChange={(e) => setFormData(prev => ({ ...prev, severity: e.target.value as any }))}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <div className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${getSeverityColor(value)}`}>
                          {label}
                        </div>
                        <p className="text-sm text-gray-500 mt-1">{desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    When did it start?
                  </label>
                  <select
                    value={formData.onset}
                    onChange={(e) => setFormData(prev => ({ ...prev, onset: e.target.value as any }))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  >
                    <option value="immediate">Immediately (within minutes)</option>
                    <option value="within-hours">Within hours</option>
                    <option value="within-days">Within days</option>
                    <option value="gradual">Gradual onset</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    How often?
                  </label>
                  <select
                    value={formData.frequency}
                    onChange={(e) => setFormData(prev => ({ ...prev, frequency: e.target.value as any }))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  >
                    <option value="once">Happened once</option>
                    <option value="occasional">Occasional</option>
                    <option value="frequent">Frequent</option>
                    <option value="constant">Constant</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Impact & Duration */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Duration (hours)
                  </label>
                  <input
                    type="number"
                    min="0.5"
                    step="0.5"
                    value={formData.duration}
                    onChange={(e) => setFormData(prev => ({ ...prev, duration: parseFloat(e.target.value) }))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Daily life interference
                  </label>
                  <select
                    value={formData.interference}
                    onChange={(e) => setFormData(prev => ({ ...prev, interference: e.target.value as any }))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  >
                    <option value="none">No interference</option>
                    <option value="mild">Mild interference</option>
                    <option value="moderate">Moderate interference</option>
                    <option value="severe">Severe interference</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Detailed Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  rows={4}
                  placeholder="Describe the side effect in detail, including any triggers, patterns, or additional context..."
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
              </div>
            </div>
          )}

          {/* Step 4: Actions & Follow-up */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Action taken
                </label>
                <select
                  value={formData.actionTaken}
                  onChange={(e) => setFormData(prev => ({ ...prev, actionTaken: e.target.value as any }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                >
                  <option value="continued">Continued medication as prescribed</option>
                  <option value="reduced-dose">Reduced dose</option>
                  <option value="stopped">Stopped medication</option>
                  <option value="consulted-doctor">Consulted doctor</option>
                  <option value="added-medication">Added medication to manage side effect</option>
                </select>
              </div>

              <div className="space-y-3">
                <label className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={formData.doctorNotified}
                    onChange={(e) => setFormData(prev => ({ ...prev, doctorNotified: e.target.checked }))}
                    className="rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                  />
                  <span className="text-sm text-gray-700">Doctor has been notified</span>
                </label>

                <label className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={formData.followUpRequired}
                    onChange={(e) => setFormData(prev => ({ ...prev, followUpRequired: e.target.checked }))}
                    className="rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                  />
                  <span className="text-sm text-gray-700">Follow-up appointment needed</span>
                </label>
              </div>

              {formData.severity === 'severe' || formData.severity === 'life-threatening' ? (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-start space-x-3">
                    <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-medium text-red-800">Medical Attention Recommended</h4>
                      <p className="text-sm text-red-700 mt-1">
                        The severity you've reported suggests this side effect may require immediate medical attention. 
                        Please contact your healthcare provider or seek emergency care if needed.
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 px-6 py-4 border-t border-gray-200">
          <div className="flex justify-between">
            <button
              onClick={prevStep}
              disabled={currentStep === 1}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            
            <div className="flex space-x-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              
              {currentStep === totalSteps ? (
                <button
                  onClick={handleSubmit}
                  disabled={!formData.sideEffect.trim()}
                  className="px-6 py-2 text-sm font-medium text-white bg-orange-600 border border-transparent rounded-md hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  <FileText className="h-4 w-4" />
                  <span>Submit Report</span>
                </button>
              ) : (
                <button
                  onClick={nextStep}
                  disabled={currentStep === 1 && !formData.sideEffect.trim()}
                  className="px-4 py-2 text-sm font-medium text-white bg-orange-600 border border-transparent rounded-md hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
