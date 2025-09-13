import React from 'react';
import { X, AlertTriangle, Calendar, TrendingDown, CheckCircle2, Clock, Heart, Settings, Brain, Lightbulb } from 'lucide-react';
import { generateTaperingPlan, getMedicationByName, generateEnhancedTaperingPlan, generateIntelligentTaperingRecommendation } from '@/services/medicationDatabase';
import { useMedicationStore } from '@/store';
import { Medication } from '@/types';
import { formatDate, calculateOptimalPillReduction, formatPillCountsForTapering, calculatePillCountsForDose } from '@/utils/helpers';
import toast from 'react-hot-toast';

interface TaperingPlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  medication: Medication;
}

export function TaperingPlanModal({ isOpen, onClose, medication }: TaperingPlanModalProps) {
  const { updateMedication, addSmartMessage } = useMedicationStore();
  const [taperingPlan, setTaperingPlan] = React.useState<any>(null);
  const [intelligentRecommendation, setIntelligentRecommendation] = React.useState<any>(null);
  const [selectedPlan, setSelectedPlan] = React.useState<'intelligent' | 'custom' | 'advanced'>('intelligent');
  const [customDuration, setCustomDuration] = React.useState(4);
  const [customReduction, setCustomReduction] = React.useState(25);
  const [customMethod, setCustomMethod] = React.useState<'linear' | 'exponential' | 'hyperbolic'>('hyperbolic');
  const [includeStabilization, setIncludeStabilization] = React.useState(false);
  const [showAdvanced, setShowAdvanced] = React.useState(false);
  const [startDate, setStartDate] = React.useState(new Date().toISOString().split('T')[0]);
  const [doctorApproval, setDoctorApproval] = React.useState(false);
  const [understanding, setUnderstanding] = React.useState(false);

  React.useEffect(() => {
    if (isOpen && medication) {
      const currentDose = parseFloat(medication.dosage);
      
      // Generate intelligent recommendation
      const intelligent = generateIntelligentTaperingRecommendation(
        medication.name, currentDose, medication.unit, medication
      );
      setIntelligentRecommendation(intelligent);
      
      // Generate enhanced plan with intelligent recommendations
      const plan = generateEnhancedTaperingPlan(
        medication.name, currentDose, medication.unit, medication
      );
      setTaperingPlan(plan);
      
      // Set custom defaults from intelligent recommendation
      if (intelligent?.adjustedPlan) {
        setCustomDuration(intelligent.adjustedPlan.durationWeeks);
        setCustomReduction(intelligent.adjustedPlan.reductionPercent);
        setCustomMethod(intelligent.adjustedPlan.method);
      }
    }
  }, [isOpen, medication]);

  const generateCustomPlan = () => {
    const currentDose = parseFloat(medication.dosage);
    
    // Use enhanced plan generation with custom options
    const enhancedPlan = generateEnhancedTaperingPlan(
      medication.name, 
      currentDose, 
      medication.unit, 
      medication,
      {
        preferredMethod: customMethod,
        preferredDuration: customDuration,
        preferredReduction: customReduction,
        includeStabilizationPeriods: includeStabilization
      }
    );
    
    return enhancedPlan || {
      medicationName: medication.name,
      method: customMethod,
      totalDuration: customDuration * 7,
      steps: [],
      warnings: [
        "Custom tapering plan - consult with your healthcare provider",
        "Monitor for withdrawal symptoms and adjust pace if necessary",
        "Never stop abruptly if experiencing severe withdrawal symptoms"
      ],
      riskLevel: 'moderate',
      canPause: true,
      flexibilityNotes: "This custom schedule can be paused or slowed at any point."
    };
  };

  const getDisplayPlan = () => {
    if (selectedPlan === 'custom' || selectedPlan === 'advanced') {
      return generateCustomPlan();
    }
    return taperingPlan;
  };

  const handleStartTapering = () => {
    if (!doctorApproval || !understanding) {
      toast.error('Please confirm doctor approval and understanding before starting');
      return;
    }

    const plan = getDisplayPlan();
    if (!plan) return;

    // Create tapering schedule
    const taperingSchedule = {
      id: `tapering-${Date.now()}`,
      startDate: new Date(startDate),
      endDate: new Date(new Date(startDate).getTime() + plan.totalDuration * 24 * 60 * 60 * 1000),
      initialDose: parseFloat(medication.dosage),
      finalDose: 0,
      taperingMethod: plan.method as 'linear' | 'exponential' | 'hyperbolic' | 'custom',
      customSteps: plan.steps.map((step: any) => ({
        day: step.day,
        dosageMultiplier: step.dose / parseFloat(medication.dosage),
        notes: step.notes
      })),
      isActive: true
    };

    // Update medication with tapering schedule
    updateMedication(medication.id, {
      tapering: {
        ...taperingSchedule,
        canPause: plan.canPause || false,
        flexibilityNotes: plan.flexibilityNotes,
        intelligentRecommendations: plan.intelligentRecommendations,
        customizationUsed: plan.customizationUsed,
        includeStabilizationPeriods: plan.includeStabilizationPeriods
      }
    });

    // Add smart message about starting tapering
    addSmartMessage({
      medicationId: medication.id,
      type: 'risk-alert',
      priority: 'high',
      title: 'Tapering Schedule Started',
      message: `You've started a ${plan.totalDuration}-day tapering schedule for ${medication.name}. Remember to monitor for withdrawal symptoms and contact your healthcare provider if you experience any concerning effects.`,
      psychologicalApproach: 'empathetic-support',
      scheduledTime: new Date(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
    });

    toast.success(`Tapering plan started for ${medication.name}`);
    onClose();
  };

  const getRiskColor = (riskLevel: string) => {
    switch (riskLevel) {
      case 'severe':
        return 'text-red-700 bg-red-100 border-red-300';
      case 'high':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'moderate':
        return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'low':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const plan = getDisplayPlan();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose} />
        
        <div className="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-4xl">
          <div className="bg-white px-4 pb-4 pt-5 sm:p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <TrendingDown className="h-6 w-6 text-orange-600" />
                <h3 className="text-lg font-medium text-gray-900">
                  Tapering Plan for {medication.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-md bg-white text-gray-400 hover:text-gray-500"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="space-y-6">
              {/* Warning Banner */}
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-start space-x-3">
                  <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="text-sm font-medium text-red-800">Important Safety Information</h4>
                    <div className="mt-2 text-sm text-red-700">
                      <ul className="list-disc list-inside space-y-1">
                        <li>Never stop this medication abruptly - serious withdrawal symptoms may occur</li>
                        <li>This tapering plan must be supervised by your healthcare provider</li>
                        <li>Monitor for withdrawal symptoms and contact your doctor if they become severe</li>
                        <li>Do not adjust the schedule without medical guidance</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              {/* Medication Info */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <span className="text-sm font-medium text-gray-700">Current Dose:</span>
                    <p className="text-lg font-semibold text-gray-900">{medication.dosage} {medication.unit}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-700">Risk Level:</span>
                    <span className={`inline-flex items-center px-2 py-1 rounded text-sm font-medium ${getRiskColor(plan?.riskLevel || 'moderate')}`}>
                      {plan?.riskLevel || 'moderate'} withdrawal risk
                    </span>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-700">Category:</span>
                    <p className="text-sm text-gray-900">{medication.dependencyRiskCategory.replace('-', ' ')}</p>
                  </div>
                </div>
              </div>

              {/* Intelligent Recommendations */}
              {intelligentRecommendation && (
                <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start space-x-3">
                    <Brain className="h-5 w-5 text-blue-600 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="text-sm font-medium text-blue-800">Intelligent Tapering Analysis</h4>
                      <p className="text-sm text-blue-700 mt-1">
                        Based on your {intelligentRecommendation.monthsOnMedication} months of {medication.name} use
                      </p>
                      
                      {intelligentRecommendation.adjustmentReasons.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {intelligentRecommendation.adjustmentReasons.map((reason: string, index: number) => (
                            <div key={index} className="flex items-start space-x-2">
                              <Lightbulb className="h-3 w-3 text-amber-500 mt-1 flex-shrink-0" />
                              <span className="text-xs text-blue-700">{reason}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      
                      <div className="mt-2 grid grid-cols-3 gap-3 text-xs">
                        <div className="text-center">
                          <div className="font-medium text-blue-800">Suggested Duration</div>
                          <div className="text-blue-600">{intelligentRecommendation.adjustedPlan.durationWeeks} weeks</div>
                        </div>
                        <div className="text-center">
                          <div className="font-medium text-blue-800">Reduction Rate</div>
                          <div className="text-blue-600">{intelligentRecommendation.adjustedPlan.reductionPercent}%</div>
                        </div>
                        <div className="text-center">
                          <div className="font-medium text-blue-800">Method</div>
                          <div className="text-blue-600">{intelligentRecommendation.adjustedPlan.method}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Plan Selection */}
              <div className="space-y-4">
                <h4 className="text-md font-medium text-gray-900">Choose Tapering Approach</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div 
                    className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                      selectedPlan === 'intelligent' ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
                    }`}
                    onClick={() => setSelectedPlan('intelligent')}
                  >
                    <div className="flex items-center space-x-2 mb-2">
                      <input 
                        type="radio" 
                        checked={selectedPlan === 'intelligent'} 
                        onChange={() => setSelectedPlan('intelligent')}
                        className="text-blue-600"
                      />
                      <Brain className="h-4 w-4 text-blue-600" />
                      <span className="font-medium text-gray-900">Smart Plan</span>
                    </div>
                    <p className="text-sm text-gray-600">
                      AI-optimized schedule based on your medication history and risk factors
                    </p>
                    {taperingPlan && (
                      <div className="mt-2 text-xs text-gray-700">
                        <strong>Duration:</strong> {taperingPlan.totalDuration} days<br/>
                        <strong>Method:</strong> {taperingPlan.method === 'hyperbolic' ? 'Hyperbolic' : taperingPlan.method}
                      </div>
                    )}
                  </div>

                  <div 
                    className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                      selectedPlan === 'custom' ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
                    }`}
                    onClick={() => setSelectedPlan('custom')}
                  >
                    <div className="flex items-center space-x-2 mb-2">
                      <input 
                        type="radio" 
                        checked={selectedPlan === 'custom'} 
                        onChange={() => setSelectedPlan('custom')}
                        className="text-blue-600"
                      />
                      <Settings className="h-4 w-4 text-gray-600" />
                      <span className="font-medium text-gray-900">Basic Custom</span>
                    </div>
                    <p className="text-sm text-gray-600">
                      Simple customization of duration and reduction rate
                    </p>
                  </div>
                  
                  <div 
                    className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                      selectedPlan === 'advanced' ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
                    }`}
                    onClick={() => setSelectedPlan('advanced')}
                  >
                    <div className="flex items-center space-x-2 mb-2">
                      <input 
                        type="radio" 
                        checked={selectedPlan === 'advanced'} 
                        onChange={() => setSelectedPlan('advanced')}
                        className="text-blue-600"
                      />
                      <Settings className="h-4 w-4 text-purple-600" />
                      <span className="font-medium text-gray-900">Advanced</span>
                    </div>
                    <p className="text-sm text-gray-600">
                      Full customization with method selection and stabilization periods
                    </p>
                  </div>
                </div>

                {/* Custom Plan Options */}
                {selectedPlan === 'custom' && (
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Duration (weeks)
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="52"
                          value={customDuration}
                          onChange={(e) => setCustomDuration(parseInt(e.target.value))}
                          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                        />
                        {intelligentRecommendation && customDuration < intelligentRecommendation.adjustedPlan.durationWeeks && (
                          <p className="text-xs text-amber-600 mt-1">
                            ⚠️ Shorter than recommended ({intelligentRecommendation.adjustedPlan.durationWeeks} weeks)
                          </p>
                        )}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Reduction Rate (%)
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="50"
                          value={customReduction}
                          onChange={(e) => setCustomReduction(parseInt(e.target.value))}
                          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                        />
                        {intelligentRecommendation && customReduction > intelligentRecommendation.adjustedPlan.reductionPercent && (
                          <p className="text-xs text-amber-600 mt-1">
                            ⚠️ Faster than recommended ({intelligentRecommendation.adjustedPlan.reductionPercent}%)
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Advanced Plan Options */}
                {selectedPlan === 'advanced' && (
                  <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Duration (weeks)
                          </label>
                          <input
                            type="number"
                            min="1"
                            max="52"
                            value={customDuration}
                            onChange={(e) => setCustomDuration(parseInt(e.target.value))}
                            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Reduction Rate (%)
                          </label>
                          <input
                            type="number"
                            min="1"
                            max="50"
                            value={customReduction}
                            onChange={(e) => setCustomReduction(parseInt(e.target.value))}
                            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Tapering Method
                          </label>
                          <select
                            value={customMethod}
                            onChange={(e) => setCustomMethod(e.target.value as 'linear' | 'exponential' | 'hyperbolic')}
                            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                          >
                            <option value="hyperbolic">Hyperbolic (Recommended)</option>
                            <option value="linear">Linear</option>
                            <option value="exponential">Exponential</option>
                          </select>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="stabilization"
                          checked={includeStabilization}
                          onChange={(e) => setIncludeStabilization(e.target.checked)}
                          className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                        />
                        <label htmlFor="stabilization" className="text-sm text-gray-700">
                          Include stabilization periods between reductions
                        </label>
                      </div>
                      
                      <div className="text-xs text-gray-600 bg-white p-2 rounded border">
                        <strong>Method Explanations:</strong><br/>
                        • <strong>Hyperbolic:</strong> Reduces by % of current dose (e.g., 10% of whatever you're taking now)<br/>
                        • <strong>Linear:</strong> Reduces by fixed amount each step<br/>
                        • <strong>Exponential:</strong> Larger reductions early, smaller reductions later
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Tapering Schedule */}
              {plan && (
                <div className="space-y-4">
                  <h4 className="text-md font-medium text-gray-900 flex items-center space-x-2">
                    <Calendar className="h-4 w-4" />
                    <span>Tapering Schedule</span>
                  </h4>
                  
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Start Date
                        </label>
                        <input
                          type="date"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <span className="block text-sm font-medium text-gray-700 mb-1">
                          Estimated End Date
                        </span>
                        <p className="text-sm text-gray-900 py-2">
                          {formatDate(new Date(new Date(startDate).getTime() + plan.totalDuration * 24 * 60 * 60 * 1000))}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-3 max-h-60 overflow-y-auto">
                      {plan.steps.map((step: any, index: number) => (
                        <div key={index} className="bg-white p-3 rounded border border-gray-200">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                                <span className="text-sm font-medium text-blue-800">{index + 1}</span>
                              </div>
                              <div>
                                <p className="text-sm font-medium text-gray-900">{step.notes}</p>
                                <p className="text-xs text-gray-500">
                                  Day {step.day} • {formatDate(new Date(new Date(startDate).getTime() + step.day * 24 * 60 * 60 * 1000))}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-semibold text-gray-900">
                                {medication.useMultiplePills ? 
                                  formatPillCountsForTapering(
                                    calculatePillCountsForDose(step.dose, medication), 
                                    medication
                                  ) : 
                                  `${step.dose} ${medication.unit}`
                                }
                              </p>
                              <p className="text-xs text-gray-500">
                                {Math.round((step.dose / parseFloat(medication.dosage)) * 100)}% of original
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Safety Warnings */}
              {plan && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-orange-800 mb-2">Safety Warnings & Guidelines</h4>
                  <div className="space-y-2">
                    {plan.warnings.map((warning: string, index: number) => (
                      <div key={index} className="flex items-start space-x-2">
                        <AlertTriangle className="h-4 w-4 text-orange-600 mt-0.5 flex-shrink-0" />
                        <p className="text-sm text-orange-700">{warning}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Confirmation Checkboxes */}
              <div className="space-y-3">
                <h4 className="text-md font-medium text-gray-900">Required Confirmations</h4>
                
                <div className="space-y-3">
                  <label className="flex items-start space-x-3">
                    <input
                      type="checkbox"
                      checked={doctorApproval}
                      onChange={(e) => setDoctorApproval(e.target.checked)}
                      className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <div>
                      <span className="text-sm font-medium text-gray-900">Doctor Approval</span>
                      <p className="text-sm text-gray-600">
                        I have discussed this tapering plan with my healthcare provider and received their approval to proceed.
                      </p>
                    </div>
                  </label>

                  <label className="flex items-start space-x-3">
                    <input
                      type="checkbox"
                      checked={understanding}
                      onChange={(e) => setUnderstanding(e.target.checked)}
                      className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <div>
                      <span className="text-sm font-medium text-gray-900">Understanding & Commitment</span>
                      <p className="text-sm text-gray-600">
                        I understand the risks of withdrawal and commit to following this schedule exactly as planned, monitoring for symptoms, and contacting my healthcare provider if problems arise.
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Flexibility Information */}
              {plan?.canPause && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start space-x-3">
                    <Clock className="h-5 w-5 text-blue-600 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-medium text-blue-800">Flexible Tapering Schedule</h4>
                      <p className="text-sm text-blue-700 mt-1">
                        {plan.flexibilityNotes || "This schedule can be paused or slowed at any point if withdrawal symptoms become problematic. Your comfort and safety always take priority over the timeline."}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Psychological Support Message */}
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <Heart className="h-5 w-5 text-purple-600 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-medium text-purple-800">You're Taking a Positive Step</h4>
                    <p className="text-sm text-purple-700 mt-1">
                      Safely tapering off medication shows responsibility and commitment to your health. 
                      This process requires patience and support. Remember that it's normal to feel anxious 
                      about reducing medication - you're not alone, and your healthcare team is here to help.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
            <button
              type="button"
              onClick={handleStartTapering}
              disabled={!doctorApproval || !understanding}
              className="w-full justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed sm:ml-3 sm:w-auto"
            >
              Start Tapering Plan
            </button>
            <button
              type="button"
              onClick={onClose}
              className="mt-3 w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:mt-0 sm:w-auto"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
