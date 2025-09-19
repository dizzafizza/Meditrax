import React from 'react';
import { Calendar, Activity, TrendingDown, CheckCircle, Edit, Info } from 'lucide-react';
import { useMedicationStore } from '@/store';
import { CyclicDosingPattern, TaperingSchedule } from '@/types';
import { generateId } from '@/utils/helpers';
import { TaperingPlanModal } from '@/components/modals/TaperingPlanModal';
import toast from 'react-hot-toast';

export function CyclicDosing() {
  const { 
    medications, 
    addCyclicDosingPattern,
    addTaperingSchedule,
    updateMedication
  } = useMedicationStore();

  const [selectedMedication, setSelectedMedication] = React.useState<string>('');
  const [activeTab, setActiveTab] = React.useState<'patterns' | 'tapering' | 'active'>('active');
  const [customPatternName, setCustomPatternName] = React.useState<string>('');
  const [customStartDate, setCustomStartDate] = React.useState<string>(new Date().toISOString().split('T')[0]);
  type CustomPhase = { phase: string; duration: number; multiplier: number; message: string; repeat?: number; rampTo?: number | null; rampDays?: number | null };
  const [customPhases, setCustomPhases] = React.useState<CustomPhase[]>([
    { phase: 'on', duration: 5, multiplier: 1.0, message: 'Take medication as prescribed', repeat: 1, rampTo: null, rampDays: null },
    { phase: 'off', duration: 2, multiplier: 0.0, message: 'Break period - no medication', repeat: 1, rampTo: null, rampDays: null }
  ]);
  const [advancedOpen, setAdvancedOpen] = React.useState<Record<number, boolean>>({});

  // Template categories state
  const [templateCategory, setTemplateCategory] = React.useState<string>('Popular');

  // Tapering modal state
  const [taperingModalOpen, setTaperingModalOpen] = React.useState(false);
  const [editingMedication, setEditingMedication] = React.useState<any>(null);

  // Check for URL parameters to pre-select medication
  React.useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const medicationParam = urlParams.get('medication');
    if (medicationParam && medications.find(m => m.id === medicationParam)) {
      setSelectedMedication(medicationParam);
      setActiveTab('patterns'); // Switch to patterns tab
    }
  }, [medications]);

  // Get medications with active cyclic dosing or tapering
  const activeCyclicMedications = medications.filter(med => 
    med.cyclicDosing?.isActive || med.tapering?.isActive
  );

  const handleCreateCustomPattern = (medicationId: string) => {
    const medication = medications.find(m => m.id === medicationId);
    if (!medication || !customPatternName.trim()) return;

    try {
      const expanded: { phase: any; duration: number; dosageMultiplier: number; customMessage?: string }[] = [];
      const expandPhase = (phase: CustomPhase) => {
        const repeat = Math.max(1, phase.repeat || 1);
        for (let r = 0; r < repeat; r++) {
          const hasRamp = typeof phase.rampTo === 'number' && phase.rampTo !== phase.multiplier && (phase.rampDays || 0) > 0;
          const totalDays = Math.max(1, phase.duration);
          if (hasRamp) {
            const rampDays = Math.min(totalDays, Math.max(1, Number(phase.rampDays)));
            const stableDays = totalDays - rampDays;
            // Linear ramp per-day from multiplier -> rampTo over rampDays
            const start = phase.multiplier;
            const end = Number(phase.rampTo);
            for (let d = 1; d <= rampDays; d++) {
              const t = d / rampDays;
              const m = start + (end - start) * t;
              expanded.push({
                phase: phase.phase as any,
                duration: 1,
                dosageMultiplier: Number(m.toFixed(2)),
                customMessage: d === 1 ? phase.message : undefined
              });
            }
            if (stableDays > 0) {
              expanded.push({
                phase: phase.phase as any,
                duration: stableDays,
                dosageMultiplier: Number(end.toFixed(2)),
                customMessage: undefined
              });
            }
          } else {
            expanded.push({
              phase: phase.phase as any,
              duration: totalDays,
              dosageMultiplier: phase.multiplier,
              customMessage: phase.message
            });
          }
        }
      };

      customPhases.forEach(expandPhase);

      const pattern: Omit<CyclicDosingPattern, 'id'> = {
        name: customPatternName.trim(),
        type: 'variable-dose',
        pattern: expanded,
        startDate: new Date(customStartDate),
        isActive: true,
        notes: `Custom pattern for ${medication.name}`
      };

      // Add the pattern to the store and get the ID
      const patternId = generateId();
      const patternWithId = { ...pattern, id: patternId };
      addCyclicDosingPattern(patternWithId);
      
      // Update medication to reference the created pattern
      updateMedication(medicationId, {
        cyclicDosing: patternWithId
      });

      toast.success('Custom cyclic dosing pattern created');
      
      // Reset form
      setCustomPatternName('');
      setCustomPhases([
        { phase: 'on', duration: 5, multiplier: 1.0, message: 'Take medication as prescribed', repeat: 1, rampTo: null, rampDays: null },
        { phase: 'off', duration: 2, multiplier: 0.0, message: 'Break period - no medication', repeat: 1, rampTo: null, rampDays: null }
      ]);
      
      // Switch to active tab to show the new pattern
      setActiveTab('active');
    } catch (error) {
      console.error('Error creating custom cyclic dosing pattern:', error);
      toast.error('Failed to create cyclic dosing pattern. Please try again.');
    }
  };

  const handleCreateCyclicPattern = (medicationId: string, patternType: 'on-off' | 'tapering' | 'variable') => {
    const medication = medications.find(m => m.id === medicationId);
    if (!medication) return;

    try {
      if (patternType === 'tapering') {
        // Create tapering schedule
        const taperingSchedule: Omit<TaperingSchedule, 'id'> = {
          startDate: new Date(),
          endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
          initialDose: parseFloat(medication.dosage),
          finalDose: parseFloat(medication.dosage) * 0.1, // 10% of initial
          taperingMethod: 'hyperbolic',
          customSteps: [],
          isActive: true
        };

        const scheduleId = generateId();
        const scheduleWithId = { ...taperingSchedule, id: scheduleId };
        addTaperingSchedule(scheduleWithId);
        
        // Update medication to reference the created schedule
        updateMedication(medicationId, {
          tapering: scheduleWithId
        });
        toast.success('Tapering schedule created');
        setActiveTab('active');
      } else {
        // Create cyclic dosing pattern
        const pattern: Omit<CyclicDosingPattern, 'id'> = {
          name: `${patternType} pattern for ${medication.name}`,
          type: patternType === 'on-off' ? 'on-off-cycle' : 'variable-dose',
          pattern: patternType === 'on-off' ? [
            { phase: 'on', duration: 5, dosageMultiplier: 1.0, customMessage: 'Take medication as prescribed' },
            { phase: 'off', duration: 2, dosageMultiplier: 0.0, customMessage: 'Break period - no medication' }
          ] : [
            { phase: 'maintenance', duration: 5, dosageMultiplier: 1.0, customMessage: 'Weekday dose' },
            { phase: 'maintenance', duration: 2, dosageMultiplier: 0.5, customMessage: 'Weekend reduced dose' }
          ],
          startDate: new Date(),
          isActive: true,
          notes: `${patternType} cycling pattern for ${medication.name}`
        };

        const patternId = generateId();
        const patternWithId = { ...pattern, id: patternId };
        addCyclicDosingPattern(patternWithId);
        
        // Update medication to reference the created pattern
        updateMedication(medicationId, {
          cyclicDosing: patternWithId
        });
        toast.success('Cyclic dosing pattern created');
        setActiveTab('active');
      }
    } catch (error) {
      console.error('Error creating cyclic pattern:', error);
      toast.error('Failed to create pattern. Please try again.');
    }
  };

  const handleStopPattern = (medicationId: string) => {
    const medication = medications.find(m => m.id === medicationId);
    if (!medication) return;

    // Disable cyclic dosing and tapering
    updateMedication(medicationId, {
      cyclicDosing: undefined,
      tapering: undefined
    });

    toast.success('Cycling pattern stopped');
  };

  const handleEditTaperingPlan = (medication: any) => {
    setEditingMedication(medication);
    setTaperingModalOpen(true);
  };

  const handleCloseTaperingModal = () => {
    setTaperingModalOpen(false);
    setEditingMedication(null);
  };

  // ---------- Template system ----------
  type PhaseDef = { phase: string; duration: number; dosageMultiplier: number; customMessage: string };
  type TemplateDef = {
    id: string;
    category: string;
    name: string;
    description: string;
    icon: any;
    iconColor: string;
    accent: string; // border and hover color classes
    kind: 'pattern' | 'tapering';
    type?: 'on-off-cycle' | 'variable-dose';
    phases?: PhaseDef[];
  };

  const allTemplates: TemplateDef[] = [
    // Popular
    {
      id: 'onoff-5-2',
      category: 'Popular',
      name: 'On/Off 5–2',
      description: 'Take 5 days, break for 2 days',
      icon: Activity,
      iconColor: 'text-blue-500',
      accent: 'border-dashed border-gray-300 hover:border-blue-500 hover:bg-blue-50',
      kind: 'pattern',
      type: 'on-off-cycle',
      phases: [
        { phase: 'on', duration: 5, dosageMultiplier: 1.0, customMessage: 'Weekday dose' },
        { phase: 'off', duration: 2, dosageMultiplier: 0.0, customMessage: 'Weekend break' }
      ]
    },
    {
      id: 'weekday-full-weekend-half',
      category: 'Popular',
      name: 'Weekday Full, Weekend Half',
      description: 'Full dose on weekdays, half dose on weekends',
      icon: Calendar,
      iconColor: 'text-green-600',
      accent: 'border-dashed border-gray-300 hover:border-green-500 hover:bg-green-50',
      kind: 'pattern',
      type: 'variable-dose',
      phases: [
        { phase: 'maintenance', duration: 5, dosageMultiplier: 1.0, customMessage: 'Weekday full dose' },
        { phase: 'maintenance', duration: 2, dosageMultiplier: 0.5, customMessage: 'Weekend half dose' }
      ]
    },
    // Work/Week
    {
      id: '6-1-workweek',
      category: 'Work/Week',
      name: '6 On / 1 Off',
      description: 'Six days of use with one recovery day',
      icon: Activity,
      iconColor: 'text-blue-500',
      accent: 'border-dashed border-gray-300 hover:border-blue-500 hover:bg-blue-50',
      kind: 'pattern',
      type: 'on-off-cycle',
      phases: [
        { phase: 'on', duration: 6, dosageMultiplier: 1.0, customMessage: 'Use as prescribed' },
        { phase: 'off', duration: 1, dosageMultiplier: 0.0, customMessage: 'Rest day' }
      ]
    },
    {
      id: '4-3-balance',
      category: 'Work/Week',
      name: '4 On / 3 Off',
      description: 'Balanced weekly cycle with longer recovery',
      icon: Activity,
      iconColor: 'text-blue-500',
      accent: 'border-dashed border-gray-300 hover:border-blue-500 hover:bg-blue-50',
      kind: 'pattern',
      type: 'on-off-cycle',
      phases: [
        { phase: 'on', duration: 4, dosageMultiplier: 1.0, customMessage: 'Active days' },
        { phase: 'off', duration: 3, dosageMultiplier: 0.0, customMessage: 'Recovery days' }
      ]
    },
    {
      id: 'weekday-full-weekend-off',
      category: 'Work/Week',
      name: 'Weekend Off',
      description: 'Full dose Monday–Friday, no use on weekends',
      icon: Calendar,
      iconColor: 'text-green-600',
      accent: 'border-dashed border-gray-300 hover:border-green-500 hover:bg-green-50',
      kind: 'pattern',
      type: 'on-off-cycle',
      phases: [
        { phase: 'on', duration: 5, dosageMultiplier: 1.0, customMessage: 'Weekday use' },
        { phase: 'off', duration: 2, dosageMultiplier: 0.0, customMessage: 'Weekend off' }
      ]
    },
    // Alternate-Day
    {
      id: 'alternate-day',
      category: 'Alternate-Day',
      name: 'Alternate-Day (QOD)',
      description: 'One day on, one day off (repeats)',
      icon: Activity,
      iconColor: 'text-blue-500',
      accent: 'border-dashed border-gray-300 hover:border-blue-500 hover:bg-blue-50',
      kind: 'pattern',
      type: 'on-off-cycle',
      phases: [
        { phase: 'on', duration: 1, dosageMultiplier: 1.0, customMessage: 'Dose day' },
        { phase: 'off', duration: 1, dosageMultiplier: 0.0, customMessage: 'Off day' }
      ]
    },
    // Pulse / Intermittent
    {
      id: 'pulse-2-5',
      category: 'Pulse/Intermittent',
      name: 'Pulse 2 On / 5 Off',
      description: 'Two consecutive dose days per week',
      icon: Calendar,
      iconColor: 'text-green-600',
      accent: 'border-dashed border-gray-300 hover:border-green-500 hover:bg-green-50',
      kind: 'pattern',
      type: 'on-off-cycle',
      phases: [
        { phase: 'on', duration: 2, dosageMultiplier: 1.0, customMessage: 'Pulse phase' },
        { phase: 'off', duration: 5, dosageMultiplier: 0.0, customMessage: 'Off phase' }
      ]
    },
    {
      id: 'pulse-3-4',
      category: 'Pulse/Intermittent',
      name: 'Pulse 3 On / 4 Off',
      description: 'Three on, four off (weekly pulse)',
      icon: Calendar,
      iconColor: 'text-green-600',
      accent: 'border-dashed border-gray-300 hover:border-green-500 hover:bg-green-50',
      kind: 'pattern',
      type: 'on-off-cycle',
      phases: [
        { phase: 'on', duration: 3, dosageMultiplier: 1.0, customMessage: 'Pulse phase' },
        { phase: 'off', duration: 4, dosageMultiplier: 0.0, customMessage: 'Recovery' }
      ]
    },
    {
      id: '1w-on-1w-off',
      category: 'Pulse/Intermittent',
      name: '1 Week On / 1 Week Off',
      description: 'Seven days on followed by seven off',
      icon: Activity,
      iconColor: 'text-blue-500',
      accent: 'border-dashed border-gray-300 hover:border-blue-500 hover:bg-blue-50',
      kind: 'pattern',
      type: 'on-off-cycle',
      phases: [
        { phase: 'on', duration: 7, dosageMultiplier: 1.0, customMessage: 'Active week' },
        { phase: 'off', duration: 7, dosageMultiplier: 0.0, customMessage: 'Rest week' }
      ]
    },
    // Monthly-style cycles
    {
      id: '21-7',
      category: 'Monthly',
      name: '21 On / 7 Off',
      description: 'Three weeks on, one week off',
      icon: Calendar,
      iconColor: 'text-green-600',
      accent: 'border-dashed border-gray-300 hover:border-green-500 hover:bg-green-50',
      kind: 'pattern',
      type: 'on-off-cycle',
      phases: [
        { phase: 'on', duration: 21, dosageMultiplier: 1.0, customMessage: 'On cycle' },
        { phase: 'off', duration: 7, dosageMultiplier: 0.0, customMessage: 'Off cycle' }
      ]
    },
    {
      id: '14-7',
      category: 'Monthly',
      name: '14 On / 7 Off',
      description: 'Two weeks on, one week off',
      icon: Calendar,
      iconColor: 'text-green-600',
      accent: 'border-dashed border-gray-300 hover:border-green-500 hover:bg-green-50',
      kind: 'pattern',
      type: 'on-off-cycle',
      phases: [
        { phase: 'on', duration: 14, dosageMultiplier: 1.0, customMessage: 'On cycle' },
        { phase: 'off', duration: 7, dosageMultiplier: 0.0, customMessage: 'Off cycle' }
      ]
    },
    {
      id: '10-20-monthly',
      category: 'Monthly',
      name: '10 On / 20 Off',
      description: 'Ten days per month with extended recovery',
      icon: Calendar,
      iconColor: 'text-green-600',
      accent: 'border-dashed border-gray-300 hover:border-green-500 hover:bg-green-50',
      kind: 'pattern',
      type: 'on-off-cycle',
      phases: [
        { phase: 'on', duration: 10, dosageMultiplier: 1.0, customMessage: 'On period' },
        { phase: 'off', duration: 20, dosageMultiplier: 0.0, customMessage: 'Off period' }
      ]
    },
    // Advanced
    {
      id: 'step-down-weekly-3step',
      category: 'Advanced',
      name: 'Step‑Down (Weekly 3‑step)',
      description: '7d @1.0 → 7d @0.75 → 7d @0.5, then repeat',
      icon: Activity,
      iconColor: 'text-purple-600',
      accent: 'border-dashed border-gray-300 hover:border-purple-500 hover:bg-purple-50',
      kind: 'pattern',
      type: 'variable-dose',
      phases: [
        { phase: 'maintenance', duration: 7, dosageMultiplier: 1.0, customMessage: 'Full dose week' },
        { phase: 'maintenance', duration: 7, dosageMultiplier: 0.75, customMessage: 'Step‑down week' },
        { phase: 'maintenance', duration: 7, dosageMultiplier: 0.5, customMessage: 'Lower dose week' }
      ]
    },
    {
      id: 'deload-4th-week',
      category: 'Advanced',
      name: 'Deload on 4th Week',
      description: '3 weeks @1.0, 1 week @0.5 (repeat)',
      icon: Calendar,
      iconColor: 'text-purple-600',
      accent: 'border-dashed border-gray-300 hover:border-purple-500 hover:bg-purple-50',
      kind: 'pattern',
      type: 'variable-dose',
      phases: [
        { phase: 'maintenance', duration: 21, dosageMultiplier: 1.0, customMessage: 'On cycle' },
        { phase: 'maintenance', duration: 7, dosageMultiplier: 0.5, customMessage: 'Deload week' }
      ]
    },
    {
      id: 'burst-stabilize',
      category: 'Advanced',
      name: 'Burst & Stabilize',
      description: '2d @1.25 then 5d @1.0 each week',
      icon: Activity,
      iconColor: 'text-purple-600',
      accent: 'border-dashed border-gray-300 hover:border-purple-500 hover:bg-purple-50',
      kind: 'pattern',
      type: 'variable-dose',
      phases: [
        { phase: 'maintenance', duration: 2, dosageMultiplier: 1.25, customMessage: 'Short burst' },
        { phase: 'maintenance', duration: 5, dosageMultiplier: 1.0, customMessage: 'Stabilize' }
      ]
    },
    {
      id: '3-on-1-low',
      category: 'Advanced',
      name: '3 On / 1 Low',
      description: '3 days @1.0 then 1 day @0.25 (repeat)',
      icon: Activity,
      iconColor: 'text-purple-600',
      accent: 'border-dashed border-gray-300 hover:border-purple-500 hover:bg-purple-50',
      kind: 'pattern',
      type: 'variable-dose',
      phases: [
        { phase: 'on', duration: 3, dosageMultiplier: 1.0, customMessage: 'Full dose' },
        { phase: 'maintenance', duration: 1, dosageMultiplier: 0.25, customMessage: 'Cushion day' }
      ]
    },
    {
      id: 'reverse-taper-weekly',
      category: 'Advanced',
      name: 'Reverse Taper (Weekly)',
      description: '7d @0.5 → 7d @0.75 → 7d @1.0',
      icon: Calendar,
      iconColor: 'text-purple-600',
      accent: 'border-dashed border-gray-300 hover:border-purple-500 hover:bg-purple-50',
      kind: 'pattern',
      type: 'variable-dose',
      phases: [
        { phase: 'maintenance', duration: 7, dosageMultiplier: 0.5, customMessage: 'Start lower' },
        { phase: 'maintenance', duration: 7, dosageMultiplier: 0.75, customMessage: 'Increase' },
        { phase: 'maintenance', duration: 7, dosageMultiplier: 1.0, customMessage: 'Stabilize' }
      ]
    },
    // Tapering (uses existing tapering creator)
    {
      id: 'tapering-standard',
      category: 'Tapering',
      name: 'Tapering Schedule',
      description: 'Create a gradual dose reduction plan',
      icon: TrendingDown,
      iconColor: 'text-orange-600',
      accent: 'border-dashed border-gray-300 hover:border-orange-500 hover:bg-orange-50',
      kind: 'tapering'
    }
  ];

  function getTemplates(category: string): TemplateDef[] {
    return allTemplates.filter(t => t.category === category);
  }

  function handleApplyTemplate(templateId: string) {
    if (!selectedMedication) return;
    const tpl = allTemplates.find(t => t.id === templateId);
    if (!tpl) return;

    if (tpl.kind === 'tapering') {
      handleCreateCyclicPattern(selectedMedication, 'tapering');
      return;
    }

    const medication = medications.find(m => m.id === selectedMedication);
    if (!medication || !tpl.type || !tpl.phases) return;

    try {
      const pattern: Omit<CyclicDosingPattern, 'id'> = {
        name: tpl.name,
        type: tpl.type,
        pattern: tpl.phases,
        startDate: new Date(),
        isActive: true,
        notes: tpl.description
      };

      const patternId = generateId();
      const patternWithId = { ...pattern, id: patternId };
      addCyclicDosingPattern(patternWithId);
      updateMedication(selectedMedication, { cyclicDosing: patternWithId });
      toast.success(`${tpl.name} created`);
      setActiveTab('active');
    } catch (error) {
      console.error('Error applying template:', error);
      toast.error('Failed to create pattern. Please try again.');
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-3 sm:p-4 lg:p-6 space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-4 sm:p-6 rounded-lg border border-gray-200 shadow">
          <div className="flex flex-col sm:flex-row sm:items-center mb-4 gap-3">
            <Activity className="h-8 w-8 text-blue-600 flex-shrink-0" />
            <div className="flex-1">
              <h1 className="mobile-title text-gray-900">Cyclic Dosing & Tapering</h1>
              <p className="mobile-text text-gray-600 mt-1">Manage complex medication schedules and withdrawal protocols</p>
            </div>
          </div>
          
          <div className="mobile-dashboard-grid">
            <div className="mobile-card">
              <div className="flex items-center space-x-2 mb-2">
                <Activity className="h-5 w-5 text-blue-500" />
                <h3 className="font-semibold text-gray-900">Cyclic Patterns</h3>
              </div>
              <p className="mobile-text text-gray-600">On/off cycles, variable dosing, holiday schedules</p>
            </div>
            
            <div className="mobile-card">
              <div className="flex items-center space-x-2 mb-2">
                <TrendingDown className="h-5 w-5 text-orange-500" />
                <h3 className="font-semibold text-gray-900">Tapering Schedules</h3>
              </div>
              <p className="mobile-text text-gray-600">Gradual dose reduction with medical supervision</p>
            </div>
            
            <div className="mobile-card">
              <div className="flex items-center space-x-2 mb-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <h3 className="font-semibold text-gray-900">Smart Monitoring</h3>
              </div>
              <p className="mobile-text text-gray-600">Withdrawal tracking and safety alerts</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow border-b border-gray-200">
          <nav className="flex space-x-4 sm:space-x-8 px-4 sm:px-6 overflow-x-auto scrollbar-hide">
            {[
              { id: 'active', name: 'Active Schedules', icon: Activity },
              { id: 'patterns', name: 'Create Pattern', icon: Calendar },
              { id: 'tapering', name: 'Tapering Plans', icon: TrendingDown }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-3 sm:py-4 px-2 sm:px-1 border-b-2 font-medium text-sm flex items-center space-x-2 whitespace-nowrap touch-manipulation min-h-[44px] ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <tab.icon className="w-4 h-4 flex-shrink-0" />
                <span className="hidden sm:inline">{tab.name}</span>
                <span className="sm:hidden">{tab.name.split(' ')[0]}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="p-4 sm:p-6 max-h-[calc(100vh-400px)] overflow-y-auto mobile-scroll">
            {/* Active Schedules */}
            {activeTab === 'active' && (
              <div className="space-y-4">
                <h2 className="mobile-subtitle text-gray-900">Active Cyclic Dosing & Tapering</h2>
          
          {activeCyclicMedications.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
              <Activity className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No active schedules</h3>
              <p className="mt-1 text-sm text-gray-500">
                Create cyclic dosing patterns or tapering schedules to get started.
              </p>
            </div>
          ) : (
            <div className="mobile-grid">
              {activeCyclicMedications.map((medication) => (
                <div key={medication.id} className="mobile-card">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-medium text-gray-900">{medication.name}</h3>
                      <p className="text-sm text-gray-500">{medication.dosage} {medication.unit}</p>
                    </div>
                    <button
                      onClick={() => handleStopPattern(medication.id)}
                      className="text-red-600 hover:text-red-700 text-sm"
                    >
                      Stop
                    </button>
                  </div>

                  {medication.cyclicDosing?.isActive && (
                    <div className="mb-4">
                      <div className="flex items-center space-x-2 mb-2">
                        <Activity className="h-4 w-4 text-blue-500" />
                        <span className="text-sm font-medium text-gray-700">Cyclic Dosing</span>
                      </div>
                      <div className="text-sm text-gray-600">
                        <p>Pattern: <span className="font-medium">{medication.cyclicDosing.name}</span></p>
                        <p>Type: <span className="font-medium">{medication.cyclicDosing.type}</span></p>
                        <p>Started: {new Date(medication.cyclicDosing.startDate).toLocaleDateString()}</p>
                      </div>
                    </div>
                  )}

                  {medication.tapering?.isActive && (
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <TrendingDown className="h-4 w-4 text-orange-500" />
                          <span className="text-sm font-medium text-gray-700">Tapering Schedule</span>
                        </div>
                        <button
                          onClick={() => handleEditTaperingPlan(medication)}
                          className="text-orange-600 hover:text-orange-700 text-sm flex items-center space-x-1"
                        >
                          <Edit className="h-3 w-3" />
                          <span>Edit</span>
                        </button>
                      </div>
                      <div className="text-sm text-gray-600">
                        <p>Method: <span className="font-medium">{medication.tapering.taperingMethod}</span></p>
                        <p>Started: {new Date(medication.tapering.startDate).toLocaleDateString()}</p>
                        <p>Target End: {new Date(medication.tapering.endDate).toLocaleDateString()}</p>
                        {medication.tapering.isPaused && (
                          <p className="text-amber-600 font-medium">⏸️ Paused</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Create Pattern */}
      {activeTab === 'patterns' && (
        <div className="space-y-6">
          <h2 className="mobile-subtitle text-gray-900">Create Cyclic Dosing Pattern</h2>
          
          <div className="mobile-card">
            <div className="space-y-4">
              <div>
                <label className="block mobile-text font-medium text-gray-700 mb-2">
                  Select Medication
                </label>
                <select
                  value={selectedMedication}
                  onChange={(e) => setSelectedMedication(e.target.value)}
                  className="mobile-input w-full"
                  style={{ fontSize: '16px' }}
                >
                  <option value="">Choose a medication...</option>
                  {medications.filter(med => med.isActive && !med.cyclicDosing?.isActive && !med.tapering?.isActive).map((med) => (
                    <option key={med.id} value={med.id}>
                      {med.name} ({med.dosage} {med.unit})
                    </option>
                  ))}
                </select>
              </div>

              {selectedMedication && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-md font-medium text-gray-900 mb-3">Templates</h3>

                    {/* Categories - horizontally scrollable */}
                    <div className="flex items-center space-x-2 overflow-x-auto scrollbar-hide py-1 -mx-1 px-1">
                      {[
                        'Popular',
                        'Work/Week',
                        'Alternate-Day',
                        'Pulse/Intermittent',
                        'Monthly',
                        'Advanced',
                        'Tapering'
                      ].map((cat) => (
                        <button
                          key={cat}
                          onClick={() => setTemplateCategory(cat)}
                          className={`px-3 py-1.5 rounded-full border text-sm whitespace-nowrap transition-colors min-h-[36px] ${
                            templateCategory === cat
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                          }`}
                          aria-pressed={templateCategory === cat}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>

                    {/* Short Guide */}
                    <div className="mt-3">
                      <details className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4">
                        <summary className="flex items-center space-x-2 cursor-pointer select-none">
                          <Info className="h-4 w-4 text-blue-600" />
                          <span className="text-sm font-medium text-blue-900">Short Guide</span>
                        </summary>
                        <div className="mt-3 text-sm text-blue-800 space-y-2">
                          <p><strong>1.</strong> Select a medication, choose a category, then tap a template. It will create an active schedule immediately. You can switch to the builder below to customize further.</p>
                          <p><strong>2.</strong> Use the builder’s <em>Show advanced options</em> to repeat a phase or add a linear ramp (e.g., 1.0 → 0.5 over N days). This expands into day‑by‑day steps automatically.</p>
                          <p><strong>3.</strong> Advanced templates provide step‑downs, deload weeks, burst & stabilize, and cushion‑day patterns. Adjust any phase after applying.</p>
                          <p className="text-[12px]">This is general scheduling guidance and not medical advice. Consult your clinician for changes to treatment.</p>
                        </div>
                      </details>
                    </div>

                    {/* Template Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mt-4">
                      {getTemplates(templateCategory).map((tpl) => (
                        <button
                          key={tpl.id}
                          onClick={() => handleApplyTemplate(tpl.id)}
                          className={`p-4 rounded-lg border-2 transition-colors w-full h-auto min-h-[148px] whitespace-normal break-words ${tpl.accent}`}
                          title={tpl.description}
                        >
                          <div className="flex items-start space-x-3">
                            <tpl.icon className={`h-5 w-5 mt-0.5 flex-shrink-0 ${tpl.iconColor}`} />
                            <div className="flex-1">
                              <h4 className="font-medium text-gray-900">{tpl.name}</h4>
                              <p className="text-sm text-gray-600 mt-1 leading-relaxed">{tpl.description}</p>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="border-t pt-6">
                    <h3 className="mobile-subtitle text-gray-900 mb-4">Custom Pattern Builder</h3>
                    
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block mobile-text font-medium text-gray-700 mb-1">
                            Pattern Name
                          </label>
                          <input
                            type="text"
                            value={customPatternName}
                            onChange={(e) => setCustomPatternName(e.target.value)}
                            placeholder="e.g., Weekend Break Pattern"
                            className="mobile-input w-full"
                            style={{ fontSize: '16px' }}
                          />
                        </div>
                        <div>
                          <label className="block mobile-text font-medium text-gray-700 mb-1">
                            Start Date
                          </label>
                          <input
                            type="date"
                            value={customStartDate}
                            onChange={(e) => setCustomStartDate(e.target.value)}
                            className="mobile-input w-full"
                            style={{ fontSize: '16px' }}
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Pattern Phases
                        </label>
                        <div className="space-y-3">
                          {customPhases.map((phase, index) => (
                            <div key={index} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                                <div>
                                  <label className="block text-xs font-medium text-gray-600 mb-1">Phase Name</label>
                                  <input
                                    type="text"
                                    value={phase.phase}
                                    onChange={(e) => {
                                      const newPhases = [...customPhases];
                                      newPhases[index].phase = e.target.value;
                                      setCustomPhases(newPhases);
                                    }}
                                    className="mobile-input w-full"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-gray-600 mb-1">Duration (days)</label>
                                  <input
                                    type="number"
                                    min="1"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    value={phase.duration}
                                    onChange={(e) => {
                                      const newPhases = [...customPhases];
                                      newPhases[index].duration = parseInt(e.target.value) || 1;
                                      setCustomPhases(newPhases);
                                    }}
                                    className="mobile-input w-full"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-gray-600 mb-1">Dose Multiplier</label>
                                  <select
                                    value={phase.multiplier}
                                    onChange={(e) => {
                                      const newPhases = [...customPhases];
                                      newPhases[index].multiplier = parseFloat(e.target.value);
                                      setCustomPhases(newPhases);
                                    }}
                                    className="mobile-input w-full"
                                    aria-label="Dose Multiplier"
                                  >
                                    <option value={0}>0x (Skip)</option>
                                    <option value={0.25}>0.25x (Quarter)</option>
                                    <option value={0.5}>0.5x (Half)</option>
                                    <option value={0.75}>0.75x (Three quarters)</option>
                                    <option value={1}>1x (Full dose)</option>
                                    <option value={1.25}>1.25x</option>
                                    <option value={1.5}>1.5x</option>
                                  </select>
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-gray-600 mb-1">Message</label>
                                  <input
                                    type="text"
                                    value={phase.message}
                                    onChange={(e) => {
                                      const newPhases = [...customPhases];
                                      newPhases[index].message = e.target.value;
                                      setCustomPhases(newPhases);
                                    }}
                                    placeholder="Optional phase message"
                                    className="mobile-input w-full"
                                  />
                                </div>
                              </div>

                          {/* Advanced options */}
                          <div className="mt-3">
                            <button
                              type="button"
                              onClick={() => setAdvancedOpen(prev => ({ ...prev, [index]: !prev[index] }))}
                              className="text-xs text-blue-600 hover:text-blue-700"
                            >
                              {advancedOpen[index] ? 'Hide advanced options' : 'Show advanced options'}
                            </button>
                            {advancedOpen[index] && (
                              <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-3">
                                <div>
                                  <label className="block text-xs font-medium text-gray-600 mb-1">Repeat Count</label>
                                  <input
                                    type="number"
                                    min="1"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    value={phase.repeat || 1}
                                    onChange={(e) => {
                                      const newPhases = [...customPhases];
                                      newPhases[index].repeat = Math.max(1, parseInt(e.target.value) || 1);
                                      setCustomPhases(newPhases);
                                    }}
                                    className="mobile-input w-full"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-gray-600 mb-1">Ramp To (Multiplier)</label>
                                  <select
                                    value={(phase.rampTo ?? '').toString()}
                                    onChange={(e) => {
                                      const value = e.target.value === '' ? null : parseFloat(e.target.value);
                                      const newPhases = [...customPhases];
                                      newPhases[index].rampTo = (value as any);
                                      setCustomPhases(newPhases);
                                    }}
                                    className="mobile-input w-full"
                                  >
                                    <option value="">None (no ramp)</option>
                                    <option value={0}>0x (Skip)</option>
                                    <option value={0.25}>0.25x</option>
                                    <option value={0.5}>0.5x</option>
                                    <option value={0.75}>0.75x</option>
                                    <option value={1}>1x</option>
                                    <option value={1.25}>1.25x</option>
                                    <option value={1.5}>1.5x</option>
                                  </select>
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-gray-600 mb-1">Ramp Over (days)</label>
                                  <input
                                    type="number"
                                    min="1"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    value={phase.rampDays || ''}
                                    onChange={(e) => {
                                      const v = e.target.value === '' ? null : Math.max(1, parseInt(e.target.value) || 1);
                                      const newPhases = [...customPhases];
                                      newPhases[index].rampDays = (v as any);
                                      setCustomPhases(newPhases);
                                    }}
                                    className="mobile-input w-full"
                                  />
                                  <p className="text-[11px] text-gray-500 mt-1">Linear ramp; remaining days stay at final multiplier.</p>
                                </div>
                              </div>
                            )}
                          </div>
                              {customPhases.length > 1 && (
                                <button
                                  onClick={() => {
                                    const newPhases = customPhases.filter((_, i) => i !== index);
                                    setCustomPhases(newPhases);
                                  }}
                                  className="mt-2 text-xs text-red-600 hover:text-red-700"
                                >
                                  Remove Phase
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                        
                        <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
                          <button
                            onClick={() => setCustomPhases([...customPhases, { phase: 'phase', duration: 1, multiplier: 1.0, message: '', repeat: 1, rampTo: null, rampDays: null }])}
                            className="mobile-button text-sm text-indigo-600 hover:text-indigo-700 font-medium min-h-[44px]"
                          >
                            + Add Phase
                          </button>
                          <button
                            onClick={() => handleCreateCustomPattern(selectedMedication)}
                            disabled={!customPatternName.trim()}
                            className="mobile-button px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
                          >
                            Create Custom Pattern
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tapering Plans */}
      {activeTab === 'tapering' && (
        <div className="space-y-6">
          <h2 className="mobile-subtitle text-gray-900">Tapering Plans</h2>
          
          <div className="mobile-card">
            <div>
              <label className="block mobile-text font-medium text-gray-700 mb-2">
                Select Medication for Tapering
              </label>
              <select 
                value={selectedMedication}
                onChange={(e) => setSelectedMedication(e.target.value)}
                className="mobile-input w-full"
                style={{ fontSize: '16px' }}
              >
                <option value="">Choose a medication...</option>
                {medications.filter(med => med.isActive && !med.cyclicDosing?.isActive && !med.tapering?.isActive).map((med) => (
                  <option key={med.id} value={med.id}>
                    {med.name} ({med.dosage} {med.unit})
                  </option>
                ))}
              </select>
            </div>

            {selectedMedication && (
              <div className="border-t pt-6">
                <div className="text-center">
                  <TrendingDown className="mx-auto h-12 w-12 text-orange-500 mb-4" />
                  <h3 className="mobile-subtitle text-gray-900 mb-2">Create Tapering Plan</h3>
                  <p className="mobile-text text-gray-600 mb-6">
                    Create a medically supervised gradual dose reduction plan
                  </p>
                  <button
                    onClick={() => {
                      const medication = medications.find(m => m.id === selectedMedication);
                      if (medication) {
                        setEditingMedication(medication);
                        setTaperingModalOpen(true);
                      }
                    }}
                    className="mobile-button btn-primary inline-flex items-center space-x-2"
                  >
                    <TrendingDown className="h-4 w-4" />
                    <span>Create Tapering Plan</span>
                  </button>
                </div>
              </div>
            )}

            {selectedMedication === '' && (
              <div className="border-t pt-6">
                <div className="text-center py-8">
                  <TrendingDown className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 mobile-text font-medium text-gray-900">Select a Medication</h3>
                  <p className="mt-1 mobile-text text-gray-500">
                    Choose a medication from the dropdown above to create a tapering plan
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Show existing tapering plans */}
          {activeCyclicMedications.filter(med => med.tapering?.isActive).length > 0 && (
            <div className="space-y-4">
              <h3 className="mobile-subtitle text-gray-900">Active Tapering Plans</h3>
              <div className="mobile-grid">
                {activeCyclicMedications.filter(med => med.tapering?.isActive).map((medication) => (
                  <div key={medication.id} className="mobile-card">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-medium text-gray-900">{medication.name}</h3>
                        <p className="text-sm text-gray-500">{medication.dosage} {medication.unit}</p>
                      </div>
                      <button
                        onClick={() => handleStopPattern(medication.id)}
                        className="mobile-button text-red-600 hover:text-red-700 text-sm"
                      >
                        Stop
                      </button>
                    </div>

                    {medication.tapering?.isActive && (
                      <div className="mb-4">
                        <div className="flex items-center space-x-2 mb-2">
                          <TrendingDown className="h-4 w-4 text-orange-500" />
                          <span className="text-sm font-medium text-gray-700">Tapering Schedule</span>
                        </div>
                        <div className="mobile-text text-gray-600">
                          <p>Start: {new Date(medication.tapering.startDate).toLocaleDateString()}</p>
                          <p>End: {new Date(medication.tapering.endDate).toLocaleDateString()}</p>
                          {(() => {
                            const phases = (medication.tapering as any)?.phases ?? (medication.tapering as any)?.customSteps;
                            const totalPhases = Array.isArray(phases) ? phases.length : undefined;
                            const currentPhaseIndex = typeof (medication.tapering as any)?.currentPhase === 'number'
                              ? (medication.tapering as any).currentPhase
                              : undefined;
                            return (typeof totalPhases === 'number' && typeof currentPhaseIndex === 'number')
                              ? (<p>Current Phase: {currentPhaseIndex + 1} / {totalPhases}</p>)
                              : null;
                          })()}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
          </div>
        </div>
      </div>

      {/* Tapering Plan Modal */}
      {taperingModalOpen && editingMedication && (
        <TaperingPlanModal
          isOpen={taperingModalOpen}
          onClose={handleCloseTaperingModal}
          medication={editingMedication}
        />
      )}
    </div>
  );
}
