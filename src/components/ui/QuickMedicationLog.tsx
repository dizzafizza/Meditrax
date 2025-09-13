import React from 'react';
import { Check, X, Clock, AlertCircle, Heart, Target, Zap } from 'lucide-react';
import { useMedicationStore } from '@/store';
import { Medication } from '@/types';
import { formatDosage, formatTime, formatPillDisplay, formatPillDisplayShort, getPillComponents } from '@/utils/helpers';
import { MultiplePillQuickLog } from './MultiplePillQuickLog';
import toast from 'react-hot-toast';

interface QuickMedicationLogProps {
  medication: Medication;
  reminder?: {
    time: string;
    id: string;
  };
  onAction?: (action: 'taken' | 'skipped' | 'snoozed') => void;
}

export function QuickMedicationLog({ medication, reminder, onAction }: QuickMedicationLogProps) {
  const { 
    markMedicationTaken, 
    markMedicationMissed, 
    getCurrentDose,
    generateContextualMessage,
    addSmartMessage,
    logMedication
  } = useMedicationStore();

  const [showDosageInput, setShowDosageInput] = React.useState(false);
  const [customDosage, setCustomDosage] = React.useState('');
  const [showSkipReason, setShowSkipReason] = React.useState(false);
  const [skipReason, setSkipReason] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const [showDoseWarning, setShowDoseWarning] = React.useState(false);
  const [warningMessage, setWarningMessage] = React.useState('');

  const currentDose = getCurrentDose(medication.id);
  const displayDose = currentDose.phase !== 'maintenance' ? currentDose.dose : parseFloat(medication.dosage);
  
  // Dose validation and psychological safety checks
  const validateCustomDose = (proposedDose: number) => {
    const expectedDose = displayDose;
    const deviation = ((proposedDose - expectedDose) / expectedDose) * 100;
    const warnings: string[] = [];
    let severity: 'info' | 'warning' | 'critical' = 'info';

    // Check for tapering medications
    if (medication.tapering?.isActive) {
      if (deviation > 20) {
        warnings.push(`⚠️ You're taking ${Math.round(deviation)}% more than your tapering schedule.`);
        warnings.push('💭 Taking more during tapering can disrupt your withdrawal plan and make it harder to reduce later.');
        warnings.push('🏥 Consider contacting your healthcare provider before taking this higher dose.');
        severity = 'critical';
      } else if (deviation < -20) {
        warnings.push(`⚠️ You're taking ${Math.round(Math.abs(deviation))}% less than scheduled.`);
        warnings.push('💭 Sudden dose reductions can trigger withdrawal symptoms.');
        warnings.push('🏥 Stick to your tapering plan for your safety and comfort.');
        severity = 'critical';
      } else if (Math.abs(deviation) > 10) {
        warnings.push(`ℹ️ This is ${Math.round(Math.abs(deviation))}% ${deviation > 0 ? 'higher' : 'lower'} than planned.`);
        warnings.push('💭 Small deviations are sometimes okay, but consistency helps your body adjust.');
        severity = 'warning';
      }
    }

    // Check for high-risk medications
    if (medication.riskLevel === 'high') {
      if (Math.abs(deviation) > 50) {
        warnings.push(`🚨 Significant dose change for a high-risk medication.`);
        warnings.push('💭 This medication requires careful monitoring. Large changes can be dangerous.');
        warnings.push('🏥 Please consult your healthcare provider before taking this dose.');
        severity = 'critical';
      } else if (Math.abs(deviation) > 25) {
        warnings.push(`⚠️ Notable dose change for a monitored medication.`);
        warnings.push('💭 Be mindful of how this change affects you.');
        severity = 'warning';
      }
    }

    // Check for maximum daily dose limits
    if (medication.maxDailyDose && proposedDose > medication.maxDailyDose) {
      warnings.push(`🛑 This exceeds your maximum daily dose limit (${medication.maxDailyDose} ${medication.unit}).`);
      warnings.push('💭 Taking more than prescribed can be dangerous and may cause serious side effects.');
      warnings.push('🏥 Contact your healthcare provider immediately if you feel you need more medication.');
      severity = 'critical';
    }

    // Psychological support messages
    if (deviation > 0 && medication.frequency === 'as-needed') {
      warnings.push('💙 Remember: Taking PRN medications is about finding balance, not avoiding all discomfort.');
    } else if (deviation > 30) {
      warnings.push('💚 Consider: Are you taking more because you\'re having a difficult day? That\'s human and understandable.');
      warnings.push('🤝 There are other coping strategies that might help alongside your medication.');
    }

    return { warnings, severity };
  };

  // Helper function to check if multiple pills are actually configured
  const hasConfiguredMultiplePills = () => {
    const result = medication.useMultiplePills && 
           medication.pillConfigurations && 
           medication.doseConfigurations &&
           medication.pillConfigurations.length > 0 &&
           medication.doseConfigurations.length > 0;
    
    // Debug logging
    console.log(`🔍 QuickMedicationLog ${medication.name}:`, {
      useMultiplePills: medication.useMultiplePills,
      hasConfigs: result,
      pillConfigs: medication.pillConfigurations?.length || 0,
      doseConfigs: medication.doseConfigurations?.length || 0,
      fullMedication: medication
    });
    
    return result;
  };

  const handleTaken = async (dosage?: number) => {
    setIsLoading(true);
    try {
      const actualDosage = dosage || displayDose;
      console.log('🔄 Logging medication:', medication.name, {
        dosage: actualDosage,
        useMultiplePills: medication.useMultiplePills,
        hasPillInventory: !!medication.pillInventory?.length
      });
      
      markMedicationTaken(medication.id, actualDosage);
      
      // Generate positive reinforcement message
      generateContextualMessage(medication.id, 'celebration');
      
      toast.success(`✅ ${medication.name} logged successfully!`, {
        icon: '💊',
        duration: 3000,
      });

      // Add motivational smart message for streaks
      const now = new Date();
      addSmartMessage({
        medicationId: medication.id,
        type: 'celebration',
        priority: 'low',
        title: 'Great Job!',
        message: `You took your ${medication.name} on time. Consistency builds healthy habits! 🌟`,
        psychologicalApproach: 'positive-reinforcement',
        scheduledTime: now,
        expiresAt: new Date(now.getTime() + 2 * 60 * 60 * 1000), // 2 hours
      });

      onAction?.('taken');
    } catch (error) {
      console.error('❌ Failed to log medication:', error);
      toast.error('Failed to log medication');
    } finally {
      setIsLoading(false);
      setShowDosageInput(false);
      setCustomDosage('');
    }
  };

  const handleSkipped = async () => {
    setIsLoading(true);
    try {
      markMedicationMissed(medication.id);
      
      // Generate supportive message for missed doses
      if (medication.riskLevel === 'high' || medication.riskLevel === 'moderate') {
        generateContextualMessage(medication.id, 'adherence-reminder');
      }

      toast(`⏭️ ${medication.name} marked as skipped`, {
        icon: '⚠️',
        duration: 4000,
      });

      // Add supportive smart message
      const now = new Date();
      addSmartMessage({
        medicationId: medication.id,
        type: 'adherence-reminder',
        priority: medication.riskLevel === 'high' ? 'high' : 'medium',
        title: 'Gentle Reminder',
        message: `It's okay to miss occasionally, but try to stay consistent with your ${medication.name}. Your health journey matters! 💙`,
        psychologicalApproach: 'empathetic-support',
        scheduledTime: now,
        expiresAt: new Date(now.getTime() + 6 * 60 * 60 * 1000), // 6 hours
      });

      onAction?.('skipped');
    } catch (error) {
      toast.error('Failed to log skip');
    } finally {
      setIsLoading(false);
      setShowSkipReason(false);
      setSkipReason('');
    }
  };

  const handleCustomDosage = () => {
    if (!customDosage || isNaN(parseFloat(customDosage))) {
      toast.error('Please enter a valid dosage');
      return;
    }

    const proposedDose = parseFloat(customDosage);
    const validation = validateCustomDose(proposedDose);

    // Show warning for significant deviations
    if (validation.warnings.length > 0) {
      setWarningMessage(validation.warnings.join('\n\n'));
      setShowDoseWarning(true);
      return;
    }

    // Proceed with logging if no warnings
    handleTaken(proposedDose);
  };

  const confirmCustomDosage = () => {
    const proposedDose = parseFloat(customDosage);
    
    // Log with special notes about the deviation
    logMedication(
      medication.id, 
      proposedDose, 
      `Custom dose: ${proposedDose} ${medication.unit} (expected: ${displayDose} ${medication.unit})`,
      []
    );

    // Add psychological support message for concerning patterns
    const validation = validateCustomDose(proposedDose);
    if (validation.severity === 'critical') {
      addSmartMessage({
        medicationId: medication.id,
        type: 'risk-alert',
        priority: 'urgent',
        title: 'Dose Deviation Detected',
        message: `You took a different dose than planned for ${medication.name}. This has been logged for your healthcare provider's review.`,
        psychologicalApproach: 'empathetic-support',
        scheduledTime: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
      });
    }

    toast.success(`✅ ${medication.name} (${proposedDose} ${medication.unit}) logged!`, {
      icon: '💊',
      duration: 3000,
    });

    onAction?.('taken');
    setShowDosageInput(false);
    setShowDoseWarning(false);
    setCustomDosage('');
    setWarningMessage('');
  };

  const getPsychologicalIcon = () => {
    if (medication.category === 'vitamin' || medication.category === 'supplement') {
      return <Heart className="h-4 w-4 text-green-500" />;
    }
    if (medication.riskLevel === 'high') {
      return <AlertCircle className="h-4 w-4 text-red-500" />;
    }
    if (medication.category === 'herbal') {
      return <Zap className="h-4 w-4 text-purple-500" />;
    }
    return <Target className="h-4 w-4 text-blue-500" />;
  };

  const getMotivationalMessage = () => {
    if (medication.category === 'vitamin' || medication.category === 'supplement') {
      return "Nourishing your body! 🌱";
    }
    if (medication.category === 'herbal') {
      return "Natural wellness choice! 🌿";
    }
    if (medication.riskLevel === 'high') {
      return "Important for your health 💊";
    }
    return "Taking care of yourself! ✨";
  };

  // Use MultiplePillQuickLog for medications with multiple pills enabled AND configured
  if (hasConfiguredMultiplePills()) {
    console.log(`✅ Using MultiplePillQuickLog for ${medication.name}`);
    return (
      <MultiplePillQuickLog 
        medication={medication} 
        onAction={onAction}
      />
    );
  }
  
  console.log(`✅ Using regular QuickMedicationLog for ${medication.name}`);

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-start space-x-3">
          <div
            className="w-4 h-4 rounded-full mt-1 flex-shrink-0"
            style={{ backgroundColor: medication.color }}
          />
          <div className="flex-1">
            <div className="flex items-center space-x-2">
              <h3 className="font-medium text-gray-900">{medication.name}</h3>
              {getPsychologicalIcon()}
            </div>
            <p className="text-sm text-gray-600 mt-1">
              {hasConfiguredMultiplePills() 
                ? formatPillDisplayShort(medication) 
                : formatDosage(displayDose.toString(), medication.unit)}
            </p>
            {hasConfiguredMultiplePills() && (
              <div className="mt-2 space-y-1">
                {getPillComponents(medication).map((component, index) => (
                  <div key={index} className="flex items-center space-x-2 text-xs text-gray-500">
                    <div 
                      className="w-2 h-2 rounded-full" 
                      style={{ backgroundColor: component.pillConfig.color || medication.color }}
                    />
                    <span>{component.displayText}</span>
                  </div>
                ))}
              </div>
            )}
            {currentDose.phase !== 'maintenance' && (
              <p className="text-xs text-blue-600 font-medium mt-1">
                Current: {currentDose.dose} {medication.unit} ({currentDose.phase})
              </p>
            )}
            {reminder && (
              <div className="flex items-center space-x-1 mt-1">
                <Clock className="h-3 w-3 text-gray-400" />
                <span className="text-xs text-gray-500">Due: {reminder.time}</span>
              </div>
            )}
            <p className="text-xs text-gray-500 mt-1 italic">{getMotivationalMessage()}</p>
          </div>
        </div>
      </div>

      {/* Quick Action Buttons */}
      <div className="space-y-3">
        {!showDosageInput && !showSkipReason && (
          <div className="flex space-x-2">
            <button
              onClick={() => handleTaken()}
              disabled={isLoading}
              className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center space-x-2"
            >
              <Check className="h-4 w-4" />
              <span>
                {hasConfiguredMultiplePills()
                  ? `Take ${formatPillDisplayShort(medication).split('(')[0].trim()}`
                  : `Take ${displayDose} ${medication.unit}`
                }
              </span>
            </button>
            
            <button
              onClick={() => setShowDosageInput(true)}
              className="px-3 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition-colors"
              title="Different dosage"
            >
              ±
            </button>
            
            <button
              onClick={() => setShowSkipReason(true)}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition-colors flex items-center space-x-1"
            >
              <X className="h-4 w-4" />
              <span>Skip</span>
            </button>
          </div>
        )}

        {/* Custom Dosage Input */}
        {showDosageInput && !showDoseWarning && (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Custom Dosage ({medication.unit})
            </label>
            <div className="text-xs text-gray-500 mb-2">
              Expected: {displayDose} {medication.unit}
              {medication.tapering?.isActive && (
                <span className="text-purple-600 font-medium"> (Tapering Schedule)</span>
              )}
            </div>
            <div className="flex space-x-2">
              <input
                type="number"
                step="0.1"
                value={customDosage}
                onChange={(e) => setCustomDosage(e.target.value)}
                placeholder={displayDose.toString()}
                className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                autoFocus
              />
              <button
                onClick={handleCustomDosage}
                disabled={isLoading || !customDosage}
                className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
              >
                Check Dose
              </button>
              <button
                onClick={() => {
                  setShowDosageInput(false);
                  setCustomDosage('');
                }}
                className="border border-gray-300 text-gray-700 px-4 py-2 rounded-md text-sm hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Dose Warning Modal */}
        {showDoseWarning && (
          <div className="space-y-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-start space-x-3">
              <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h4 className="text-sm font-medium text-yellow-800">Dose Safety Check</h4>
                <div className="mt-2 text-sm text-yellow-700 whitespace-pre-line">
                  {warningMessage}
                </div>
              </div>
            </div>
            
            <div className="flex space-x-2">
              <button
                onClick={confirmCustomDosage}
                className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
              >
                I Understand - Log This Dose
              </button>
              <button
                onClick={() => {
                  setShowDoseWarning(false);
                  setWarningMessage('');
                }}
                className="flex-1 border border-gray-300 text-gray-700 px-4 py-2 rounded-md text-sm hover:bg-gray-50 transition-colors"
              >
                Cancel & Revise
              </button>
            </div>
            
            <div className="text-xs text-gray-600 bg-white p-2 rounded border">
              💡 <strong>Remember:</strong> Your healthcare provider can help adjust your medication plan if you're consistently needing different doses.
            </div>
          </div>
        )}

        {/* Skip Reason */}
        {showSkipReason && (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Why are you skipping? (Optional)
            </label>
            <div className="space-y-2">
              <select
                value={skipReason}
                onChange={(e) => setSkipReason(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select a reason</option>
                <option value="forgot">Forgot to take it</option>
                <option value="side-effects">Experiencing side effects</option>
                <option value="no-access">Don't have medication with me</option>
                <option value="feeling-better">Feeling better</option>
                <option value="doctor-advice">Doctor advised to skip</option>
                <option value="interaction">Potential drug interaction</option>
                <option value="other">Other reason</option>
              </select>
              <div className="flex space-x-2">
                <button
                  onClick={handleSkipped}
                  disabled={isLoading}
                  className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  Skip This Dose
                </button>
                <button
                  onClick={() => {
                    setShowSkipReason(false);
                    setSkipReason('');
                  }}
                  className="border border-gray-300 text-gray-700 px-4 py-2 rounded-md text-sm hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Psychological Support Messages */}
      {medication.riskLevel === 'high' && (
        <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-xs text-blue-700">
            💙 <strong>You're doing great!</strong> Staying consistent with this medication is important for your health and well-being.
          </p>
        </div>
      )}
      
      {(medication.category === 'vitamin' || medication.category === 'supplement') && (
        <div className="mt-3 p-2 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-xs text-green-700">
            🌟 <strong>Investing in your wellness!</strong> Every supplement you take is a step towards better health.
          </p>
        </div>
      )}
    </div>
  );
}
