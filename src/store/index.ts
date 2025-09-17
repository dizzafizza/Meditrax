import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { 
  Medication, 
  MedicationLog, 
  Reminder, 
  UserProfile, 
  StorageData,
  SmartMessage,
  CyclicDosingPattern,
  TaperingSchedule,
  PsychologicalIntervention,
  AdherencePattern,
  DependencyRiskAssessment,
  RiskLevel,
  DependencyRiskCategory,
  PillConfiguration,
  DoseConfiguration,
  PillLogEntry,
  PillInventoryItem,
  AdherenceDetails,
  MedicationUnit,
  SideEffectReport,
  DependencePrevention,
  UsagePattern,
  DependenceAlert,
  DependenceIntervention
} from '@/types';
import { 
  generateId, 
  isToday, 
  getRiskLevel, 
  getDependencyRiskCategory,
  calculateCyclicDose,
  generatePsychologicalMessage,
  calculateDependencyRisk,
  detectBehaviorPatterns,
  generateCSV,
  formatDate,
  formatTime,
  calculateTaperingDose,
  calculatePillCountsForDose,
  isHeavyDose,
  generateDoseSafetyMessage,
  isWeightBasedUnit,
  unitsAreCompatible,
  convertToBaseWeight,
  convertFromBaseWeight
} from '@/utils/helpers';
import { DependencePreventionService } from '@/services/dependencePreventionService';
import { suggestPauseDuration } from '@/services/medicationDatabase';
import { PsychologicalSafetyService } from '@/services/psychologicalSafetyService';

interface MedicationStore {
  // State
  medications: Medication[];
  logs: MedicationLog[];
  reminders: Reminder[];
  userProfile: UserProfile | null;
  isLoading: boolean;
  error: string | null;
  
  // Advanced features state
  smartMessages: SmartMessage[];
  cyclicDosingPatterns: CyclicDosingPattern[];
  taperingSchedules: TaperingSchedule[];
  psychologicalInterventions: PsychologicalIntervention[];
  adherencePatterns: AdherencePattern[];
  dependencyRiskAssessments: DependencyRiskAssessment[];
  psychologicalSafetyAlerts: PsychologicalSafetyAlert[];

  // Medication actions
  addMedication: (medication: Omit<Medication, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateMedication: (id: string, updates: Partial<Medication>) => void;
  deleteMedication: (id: string) => void;
  toggleMedicationActive: (id: string) => void;

  // Log actions
  logMedication: (medicationId: string, dosage?: number, notes?: string, sideEffects?: string[]) => void;
  updateLog: (id: string, updates: Partial<MedicationLog>) => void;
  deleteLog: (id: string) => void;
  markMedicationTaken: (medicationId: string, dosage?: number) => void;
  markMedicationMissed: (medicationId: string) => void;

  // NEW: Multiple pills support
  addPillConfiguration: (medicationId: string, config: Omit<PillConfiguration, 'id'>) => void;
  updatePillConfiguration: (medicationId: string, configId: string, updates: Partial<PillConfiguration>) => void;
  deletePillConfiguration: (medicationId: string, configId: string) => void;
  addDoseConfiguration: (medicationId: string, config: Omit<DoseConfiguration, 'id'>) => void;
  updateDoseConfiguration: (medicationId: string, configId: string, updates: Partial<DoseConfiguration>) => void;
  deleteDoseConfiguration: (medicationId: string, configId: string) => void;
  setDefaultDoseConfiguration: (medicationId: string, configId: string) => void;
  logMultiplePillDose: (medicationId: string, pillLogs: PillLogEntry[], notes?: string, sideEffects?: string[]) => void;
  logDoseConfiguration: (medicationId: string, doseConfigId: string, pillLogs: PillLogEntry[], notes?: string, sideEffects?: string[]) => void;
  calculateTotalDoseFromPills: (medicationId: string, doseConfigId?: string) => { amount: number; unit: MedicationUnit } | null;
  updatePillInventory: (medicationId: string, inventoryUpdates: Partial<PillInventoryItem>[]) => void;
  enableMultiplePills: (medicationId: string) => void;

  // Reminder actions
  addReminder: (reminder: Omit<Reminder, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateReminder: (id: string, updates: Partial<Reminder>) => void;
  deleteReminder: (id: string) => void;
  toggleReminderActive: (id: string) => void;
  snoozeReminder: (id: string, minutes: number) => void;

  // Profile actions
  updateProfile: (updates: Partial<UserProfile>) => void;
  createProfile: (profile: Omit<UserProfile, 'id' | 'createdAt' | 'updatedAt'>) => void;

  // Enhanced Psychological Safety Alerts
  generatePsychologicalSafetyAlerts: (medicationId?: string) => PsychologicalSafetyAlert[];
  acknowledgePsychologicalAlert: (alertId: string, response?: 'helpful' | 'not-helpful' | 'dismissed') => void;
  getPsychologicalSafetyAlertsForMedication: (medicationId: string) => PsychologicalSafetyAlert[];
  getActivePsychologicalSafetyAlerts: () => PsychologicalSafetyAlert[];

  // Analytics and computed values
  getMedicationAdherence: (medicationId: string, days: number) => number;
  getTodaysReminders: () => (Reminder & { medication: Medication })[];
  getTodaysLogs: () => MedicationLog[];
  getMissedDoses: (days: number) => MedicationLog[];
  getUpcomingRefills: () => Medication[];

  // Utility actions
  clearAllData: () => void;
  importData: (data: Partial<StorageData>) => void;
  exportData: () => StorageData;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  // Enhanced Export/Import actions
  exportDataWithOptions: (options: any) => Promise<string>;
  importDataWithValidation: (data: any, format: 'json' | 'csv') => Promise<{ success: boolean; errors: string[]; warnings: string[] }>;
  validateImportData: (data: any) => { isValid: boolean; errors: string[]; warnings: string[] };
  exportToCSV: (dataType: 'medications' | 'logs' | 'reminders' | 'all', dateRange?: { start: Date; end: Date }) => string;
  exportToPDF: (options: any) => Promise<string>;
  backupData: () => void;
  restoreData: (backupData: any) => Promise<{ success: boolean; errors: string[] }>;

  // Advanced features actions
  // Smart messaging
  addSmartMessage: (message: Omit<SmartMessage, 'id'>) => void;
  markMessageAsRead: (messageId: string) => void;
  dismissMessage: (messageId: string) => void;
  generateContextualMessage: (medicationId: string, type: string) => void;

  // Cyclic dosing
  addCyclicDosingPattern: (pattern: Omit<CyclicDosingPattern, 'id'>) => void;
  updateCyclicDosingPattern: (id: string, updates: Partial<CyclicDosingPattern>) => void;
  deleteCyclicDosingPattern: (id: string) => void;
  getCurrentDose: (medicationId: string, date?: Date) => { dose: number; phase: string; message?: string; pillBreakdown?: Record<string, number> };

  // Tapering schedules
  addTaperingSchedule: (schedule: Omit<TaperingSchedule, 'id'>) => void;
  updateTaperingSchedule: (id: string, updates: Partial<TaperingSchedule>) => void;
  deleteTaperingSchedule: (id: string) => void;

  // Risk assessment
  assessDependencyRisk: (medicationId: string) => DependencyRiskAssessment;
  updateRiskAssessment: (medicationId: string) => void;
  getHighRiskMedications: () => Medication[];

  // Behavioral analysis
  analyzeAdherencePatterns: (medicationId: string) => AdherencePattern;
  detectBehaviorPattern: (medicationId: string) => void;
  triggerPsychologicalIntervention: (medicationId: string, type: string, trigger: string) => void;

  // Analytics
  getSmartInsights: () => any[];
  getPsychologicalProfile: (medicationId: string) => any;
  getAdherenceScore: (medicationId: string, timeWindow?: number) => number;

  // Enhanced streak tracking methods
  getCurrentStreak: (medicationId: string) => number;
  getOverallStreak: () => number;
  areAllScheduledMedicationsComplete: () => boolean;
}

const initialUserProfile: UserProfile = {
  id: generateId(),
  name: '',
  preferences: {
    theme: 'system',
    notifications: {
      push: true,
      sound: true,
      vibration: true,
      reminderAdvance: 15,
    },
    privacy: {
      shareData: false,
      analytics: true,
      anonymousReporting: {
        enabled: false,
        consentGiven: false,
        dataTypesAllowed: [],
        privacyLevel: 'minimal',
        granularControls: {
          includeAdherence: false,
          includeSideEffects: false,
          includeMedicationPatterns: false,
          includeRiskAssessments: false,
          allowTemporalAnalysis: false,
          allowDemographicAnalysis: false
        }
      }
    },
    display: {
      timeFormat: '12h',
      dateFormat: 'MM/DD/YYYY',
      defaultView: 'dashboard',
    },
  },
  createdAt: new Date(),
  updatedAt: new Date(),
};

// Helper function to deserialize dates in tapering schedules
const deserializeTaperingDates = (tapering: any) => {
  if (!tapering) return tapering;
  
  const deserializedTapering = { ...tapering };
  
  // Deserialize main schedule dates
  if (deserializedTapering.startDate && typeof deserializedTapering.startDate === 'string') {
    deserializedTapering.startDate = new Date(deserializedTapering.startDate);
  }
  if (deserializedTapering.endDate && typeof deserializedTapering.endDate === 'string') {
    deserializedTapering.endDate = new Date(deserializedTapering.endDate);
  }
  if (deserializedTapering.pausedAt && typeof deserializedTapering.pausedAt === 'string') {
    deserializedTapering.pausedAt = new Date(deserializedTapering.pausedAt);
  }
  if (deserializedTapering.originalEndDate && typeof deserializedTapering.originalEndDate === 'string') {
    deserializedTapering.originalEndDate = new Date(deserializedTapering.originalEndDate);
  }
  
  // Deserialize current break dates
  if (deserializedTapering.currentBreak) {
    if (deserializedTapering.currentBreak.startDate && typeof deserializedTapering.currentBreak.startDate === 'string') {
      deserializedTapering.currentBreak.startDate = new Date(deserializedTapering.currentBreak.startDate);
    }
    if (deserializedTapering.currentBreak.endDate && typeof deserializedTapering.currentBreak.endDate === 'string') {
      deserializedTapering.currentBreak.endDate = new Date(deserializedTapering.currentBreak.endDate);
    }
  }
  
  // Deserialize break history dates
  if (deserializedTapering.breakHistory && Array.isArray(deserializedTapering.breakHistory)) {
    deserializedTapering.breakHistory = deserializedTapering.breakHistory.map((breakItem: any) => ({
      ...breakItem,
      startDate: typeof breakItem.startDate === 'string' ? new Date(breakItem.startDate) : breakItem.startDate,
      endDate: breakItem.endDate && typeof breakItem.endDate === 'string' ? new Date(breakItem.endDate) : breakItem.endDate
    }));
  }
  
  return deserializedTapering;
};

export const useMedicationStore = create<MedicationStore>()(
  persist(
    (set, get) => ({
      // Initial state
      medications: [],
      logs: [],
      reminders: [],
      userProfile: null,
      isLoading: false,
      error: null,
      
      // Advanced features initial state
      smartMessages: [],
      cyclicDosingPatterns: [],
      taperingSchedules: [],
      psychologicalInterventions: [],
      adherencePatterns: [],
      dependencyRiskAssessments: [],
      psychologicalSafetyAlerts: [],

      // Medication actions
      addMedication: (medicationData) => {
        const dependencyRiskCategory = getDependencyRiskCategory(medicationData.name) as DependencyRiskCategory;
        const riskLevel = getRiskLevel(dependencyRiskCategory) as RiskLevel;
        
        const medication: Medication = {
          ...medicationData,
          id: generateId(),
          riskLevel,
          dependencyRiskCategory,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        set((state) => ({
          medications: [...state.medications, medication],
        }));

        // Automatically assess risk for high-risk medications
        if (riskLevel === 'high' || riskLevel === 'moderate') {
          setTimeout(() => {
            get().updateRiskAssessment(medication.id);
          }, 100);
        }
      },

      updateMedication: (id, updates) => {
        set((state) => ({
          medications: state.medications.map((med) =>
            med.id === id ? { ...med, ...updates, updatedAt: new Date() } : med
          ),
        }));
      },

      deleteMedication: (id) => {
        set((state) => ({
          medications: state.medications.filter((med) => med.id !== id),
          logs: state.logs.filter((log) => log.medicationId !== id),
          reminders: state.reminders.filter((reminder) => reminder.medicationId !== id),
        }));
      },

      toggleMedicationActive: (id) => {
        set((state) => ({
          medications: state.medications.map((med) =>
            med.id === id ? { ...med, isActive: !med.isActive, updatedAt: new Date() } : med
          ),
        }));
      },

      // Log actions
      logMedication: (medicationId, dosage, notes, sideEffects) => {
        const medication = get().medications.find((med) => med.id === medicationId);
        if (!medication) return;

        const dosageTaken = dosage || parseFloat(medication.dosage);
        const prescribedDose = parseFloat(medication.dosage);

        // Generate dose safety message
        const safetyMessage = generateDoseSafetyMessage(
          medication.name,
          dosageTaken,
          prescribedDose,
          medication.unit
        );

        // Add safety message to notes if present
        const enhancedNotes = safetyMessage 
          ? (notes ? `${notes}\n\n${safetyMessage}` : safetyMessage)
          : notes;

        const log: MedicationLog = {
          id: generateId(),
          medicationId,
          timestamp: new Date(),
          dosageTaken: dosageTaken,
          unit: medication.unit,
          notes: enhancedNotes,
          sideEffectsReported: sideEffects,
          adherence: 'taken',
          createdAt: new Date(),
        };

        set((state) => ({
          logs: [...state.logs, log],
        }));

        // Generate psychological messages based on dose taken and current schedule
        const currentDoseInfo = get().getCurrentDose(medicationId);
        
        // Check for cyclic dosing messages
        if (medication.cyclicDosing?.isActive) {
          const cyclicMessage = generatePsychologicalMessage(
            'cyclic-dosing',
            medication.name,
            {
              cyclicPhase: currentDoseInfo.phase,
              adjustedDose: `${currentDoseInfo.dose}${medication.unit}`,
              cyclicMessage: currentDoseInfo.message
            }
          );

          get().addSmartMessage({
            medicationId,
            type: 'cyclic-dosing' as any,
            priority: 'low',
            title: cyclicMessage.title,
            message: cyclicMessage.message,
            psychologicalApproach: cyclicMessage.approach as any,
            scheduledTime: new Date(),
            expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000), // 8 hours
          });
        }

        // Check for tapering messages
        if (medication.tapering?.isActive) {
          const taperingMessage = generatePsychologicalMessage(
            'tapering-support',
            medication.name,
            {
              taperPhase: medication.tapering.isPaused ? 'stabilization' : 'reduction',
              taperingProgress: Math.round(((new Date().getTime() - new Date(medication.tapering.startDate).getTime()) / 
                                          (new Date(medication.tapering.endDate).getTime() - new Date(medication.tapering.startDate).getTime())) * 100)
            }
          );

          get().addSmartMessage({
            medicationId,
            type: 'tapering-support' as any,
            priority: 'medium',
            title: taperingMessage.title,
            message: taperingMessage.message,
            psychologicalApproach: taperingMessage.approach as any,
            scheduledTime: new Date(),
            expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000), // 12 hours
          });
        }

        // Generate safety messages for dose deviations
        if (safetyMessage) {
          const messageType = isHeavyDose(medication.name, dosageTaken, medication.unit) 
            ? 'heavy-dose-warning' 
            : 'dose-adjustment';
          
          const psychMessage = generatePsychologicalMessage(
            messageType,
            medication.name,
            {
              currentDose: `${dosageTaken}${medication.unit}`,
              adjustmentType: dosageTaken > prescribedDose ? 'increase' : 'decrease',
              scheduleType: medication.cyclicDosing?.isActive ? 'cyclic' : 
                         medication.tapering?.isActive ? 'tapering' : 'prescribed'
            }
          );

          // Add as smart message
          get().addSmartMessage({
            medicationId,
            type: messageType as any,
            priority: messageType === 'heavy-dose-warning' ? 'high' : 'medium',
            title: psychMessage.title,
            message: psychMessage.message,
            psychologicalApproach: psychMessage.approach as any,
            scheduledTime: new Date(),
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
          });
        }

        // Update inventory - handle both weight-based and discrete units
        if (!medication.useMultiplePills) {
          get().updateInventoryAfterDose(medicationId, dosage, medication.unit);
        }

        // Update pill inventory for multiple pill medications
        if (medication.useMultiplePills && medication.pillInventory && medication.pillInventory.length > 0) {
          // For simple dosage logging, estimate pill consumption based on default dose configuration
          const defaultConfig = medication.doseConfigurations?.find(
            config => config.id === medication.defaultDoseConfigurationId
          ) || medication.doseConfigurations?.[0];
          
          if (defaultConfig) {
            const pillLogs = defaultConfig.pillComponents.map(component => ({
              pillConfigurationId: component.pillConfigurationId,
              quantityTaken: component.quantity,
              timestamp: new Date()
            }));
            
            const inventoryUpdates = pillLogs.map((pillLog) => ({
              pillConfigurationId: pillLog.pillConfigurationId,
              currentCount: -pillLog.quantityTaken, // Negative to subtract
            }));
            
            get().updatePillInventory(medicationId, inventoryUpdates);
          }
        } else if (!medication.useMultiplePills && medication.pillsRemaining) {
          // Handle legacy single pill inventory
          const pillsTaken = dosage || parseFloat(medication.dosage) || 1;
          get().updateMedication(medicationId, {
            pillsRemaining: Math.max(0, medication.pillsRemaining - pillsTaken)
          });
        }
      },

      // New function to handle inventory updates after dose logging
      updateInventoryAfterDose: (medicationId: string, dosageTaken: number, doseUnit: string) => {
        const state = get();
        const medication = state.medications.find(med => med.id === medicationId);
        if (!medication) return;

        const inventoryUnit = medication.inventoryUnit || medication.unit;

        // Handle weight-based units
        if (isWeightBasedUnit(doseUnit) && isWeightBasedUnit(inventoryUnit)) {
          if (medication.pillsRemaining !== undefined) {
            // Convert dose to base unit (mg), then convert to inventory unit
            const doseInBaseMg = convertToBaseWeight(dosageTaken, doseUnit);
            const doseInInventoryUnit = convertFromBaseWeight(doseInBaseMg, inventoryUnit);
            
            const newRemaining = Math.max(0, medication.pillsRemaining - doseInInventoryUnit);
            
            get().updateMedication(medicationId, {
              pillsRemaining: newRemaining
            });
          }
        } 
        // Handle discrete units (pills, capsules, etc.)
        else if (!isWeightBasedUnit(doseUnit) && !isWeightBasedUnit(inventoryUnit)) {
          if (medication.pillsRemaining !== undefined) {
            // For discrete units, subtract 1 unit per dose
            get().updateMedication(medicationId, {
              pillsRemaining: Math.max(0, medication.pillsRemaining - 1)
            });
          }
        }
        // Handle mixed units - log warning and fall back to discrete counting
        else {
          console.warn(`Unit mismatch: dose unit "${doseUnit}" and inventory unit "${inventoryUnit}" are not compatible. Falling back to discrete counting.`);
          if (medication.pillsRemaining !== undefined) {
            get().updateMedication(medicationId, {
              pillsRemaining: Math.max(0, medication.pillsRemaining - 1)
            });
          }
        }
      },

      updateLog: (id, updates) => {
        set((state) => ({
          logs: state.logs.map((log) =>
            log.id === id ? { ...log, ...updates } : log
          ),
        }));
      },

      deleteLog: (id) => {
        set((state) => ({
          logs: state.logs.filter((log) => log.id !== id),
        }));
      },

      markMedicationTaken: (medicationId, dosage) => {
        get().logMedication(medicationId, dosage);
      },

      markMedicationMissed: (medicationId) => {
        const medication = get().medications.find((med) => med.id === medicationId);
        if (!medication) return;

        const log: MedicationLog = {
          id: generateId(),
          medicationId,
          timestamp: new Date(),
          dosageTaken: 0,
          unit: medication.unit,
          adherence: 'missed',
          createdAt: new Date(),
        };

        set((state) => ({
          logs: [...state.logs, log],
        }));
      },

      // Reminder actions
      addReminder: async (reminderData) => {
        const reminder: Reminder = {
          ...reminderData,
          id: generateId(),
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        set((state) => ({
          reminders: [...state.reminders, reminder],
        }));

        // Schedule push notification for the reminder
        try {
          const medication = get().medications.find(med => med.id === reminder.medicationId);
          if (medication && reminder.isActive) {
            await notificationService.scheduleReminderEnhanced(reminder, medication);
          }
        } catch (error) {
          console.error('Failed to schedule push notification:', error);
          // Don't fail the reminder creation, just log the error
        }
      },

      updateReminder: async (id, updates) => {
        const state = get();
        const currentReminder = state.reminders.find(r => r.id === id);
        
        set((state) => ({
          reminders: state.reminders.map((reminder) =>
            reminder.id === id ? { ...reminder, ...updates, updatedAt: new Date() } : reminder
          ),
        }));

        // Update push notification if reminder was modified
        try {
          if (currentReminder) {
            const medication = state.medications.find(med => med.id === currentReminder.medicationId);
            if (medication) {
              // Cancel old notification
              notificationService.cancelReminder(id);
              
              // Schedule new notification if still active
              const updatedReminder = { ...currentReminder, ...updates };
              if (updatedReminder.isActive) {
                await notificationService.scheduleReminderEnhanced(updatedReminder, medication);
              }
            }
          }
        } catch (error) {
          console.error('Failed to update push notification:', error);
        }
      },

      deleteReminder: (id) => {
        // Cancel push notification
        try {
          notificationService.cancelReminder(id);
        } catch (error) {
          console.error('Failed to cancel push notification:', error);
        }

        set((state) => ({
          reminders: state.reminders.filter((reminder) => reminder.id !== id),
        }));
      },

      toggleReminderActive: async (id) => {
        const state = get();
        const reminder = state.reminders.find(r => r.id === id);
        
        if (reminder) {
          const newActiveState = !reminder.isActive;
          
          set((state) => ({
            reminders: state.reminders.map((reminder) =>
              reminder.id === id ? { ...reminder, isActive: newActiveState, updatedAt: new Date() } : reminder
            ),
          }));

          // Update push notification
          try {
            const medication = state.medications.find(med => med.id === reminder.medicationId);
            if (medication) {
              if (newActiveState) {
                // Schedule notification
                await notificationService.scheduleReminderEnhanced({ ...reminder, isActive: true }, medication);
              } else {
                // Cancel notification
                notificationService.cancelReminder(id);
              }
            }
          } catch (error) {
            console.error('Failed to update push notification:', error);
          }
        }
      },

      snoozeReminder: async (id, minutes = 15) => {
        const snoozeUntil = new Date();
        snoozeUntil.setMinutes(snoozeUntil.getMinutes() + minutes);
        
        const state = get();
        const reminder = state.reminders.find(r => r.id === id);

        set((state) => ({
          reminders: state.reminders.map((reminder) =>
            reminder.id === id ? { ...reminder, snoozeUntil, updatedAt: new Date() } : reminder
          ),
        }));

        // Handle push notification snoozing
        try {
          if (reminder) {
            const medication = state.medications.find(med => med.id === reminder.medicationId);
            if (medication) {
              // Cancel current notification and schedule a new one for the snooze time
              notificationService.cancelReminder(id);
              
              // Create a temporary reminder for the snooze
              const snoozeReminder = {
                ...reminder,
                id: `${id}_snooze_${Date.now()}`,
                scheduledTime: snoozeUntil
              };
              
              // This would need to be implemented in the notification service
              // await notificationService.scheduleSnoozeReminder(snoozeReminder, medication, minutes);
            }
          }
        } catch (error) {
          console.error('Failed to handle snooze push notification:', error);
        }
      },

      // Profile actions
      updateProfile: (updates) => {
        set((state) => ({
          userProfile: state.userProfile
            ? { ...state.userProfile, ...updates, updatedAt: new Date() }
            : { ...initialUserProfile, ...updates },
        }));
      },

      createProfile: (profileData) => {
        const profile: UserProfile = {
          ...profileData,
          id: generateId(),
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        set({ userProfile: profile });
      },

      // Analytics and computed values
      getMedicationAdherence: (medicationId, days) => {
        const medication = get().medications.find((med) => med.id === medicationId);
        
        const logs = get().logs.filter((log) => {
          const logDate = new Date(log.timestamp);
          const daysDiff = Math.floor((Date.now() - logDate.getTime()) / (1000 * 60 * 60 * 24));
          return log.medicationId === medicationId && daysDiff <= days;
        });

        // For as-needed medications, calculate based on actual usage
        if (medication?.frequency === 'as-needed') {
          if (logs.length === 0) return 0; // No logs = 0% adherence
          const takenLogs = logs.filter((log) => log.adherence === 'taken');
          return Math.round((takenLogs.length / logs.length) * 100);
        }

        if (logs.length === 0) return 0;

        const takenLogs = logs.filter((log) => log.adherence === 'taken');
        return Math.round((takenLogs.length / logs.length) * 100);
      },

      getTodaysReminders: () => {
        const medications = get().medications;
        const reminders = get().reminders;
        const today = new Date().getDay(); // 0 = Sunday, 1 = Monday, etc.
        const dayMapping = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const todayName = dayMapping[today];

        return reminders
          .filter((reminder) => {
            const medication = medications.find((med) => med.id === reminder.medicationId);
            return (
              reminder.isActive &&
              medication?.isActive &&
              reminder.days.includes(todayName as any) &&
              (!reminder.snoozeUntil || reminder.snoozeUntil <= new Date())
            );
          })
          .map((reminder) => ({
            ...reminder,
            medication: medications.find((med) => med.id === reminder.medicationId)!,
          }))
          .sort((a, b) => a.time.localeCompare(b.time));
      },

      getTodaysLogs: () => {
        return get().logs.filter((log) => isToday(new Date(log.timestamp)));
      },

      getMissedDoses: (days) => {
        const logs = get().logs.filter((log) => {
          const logDate = new Date(log.timestamp);
          const daysDiff = Math.floor((Date.now() - logDate.getTime()) / (1000 * 60 * 60 * 24));
          return log.adherence === 'missed' && daysDiff <= days;
        });

        return logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      },

      getUpcomingRefills: () => {
        return get().medications.filter((med) => {
          if (!med.pillsRemaining || !med.totalPills || !med.refillReminder) return false;
          const remainingPercent = (med.pillsRemaining / med.totalPills) * 100;
          return remainingPercent <= 20; // Alert when 20% or less remaining
        });
      },

      // Utility actions
      clearAllData: () => {
        set({
          medications: [],
          logs: [],
          reminders: [],
          userProfile: null,
          error: null,
          smartMessages: [],
          cyclicDosingPatterns: [],
          taperingSchedules: [],
          psychologicalInterventions: [],
          adherencePatterns: [],
          dependencyRiskAssessments: [],
        });
      },

      importData: (data) => {
        set((state) => ({
          medications: data.medications || state.medications,
          logs: data.logs || state.logs,
          reminders: data.reminders || state.reminders,
          userProfile: data.userProfile || state.userProfile,
        }));
      },

      exportData: () => {
        const state = get();
        return {
          medications: state.medications,
          logs: state.logs,
          reminders: state.reminders,
          userProfile: state.userProfile!,
          version: '1.0.0',
          lastSyncDate: new Date(),
        };
      },

      setLoading: (loading) => {
        set({ isLoading: loading });
      },

      setError: (error) => {
        set({ error });
      },

      // Enhanced Export/Import methods
      exportDataWithOptions: async (options) => {
        const state = get();
        const filteredData: any = {};

        // Apply date range filtering if specified
        if (options.dateRange) {
          const { start, end } = options.dateRange;
          filteredData.logs = state.logs.filter(log => {
            const logDate = new Date(log.timestamp);
            return logDate >= start && logDate <= end;
          });
        } else {
          filteredData.logs = state.logs;
        }

        // Include data based on options
        if (options.includeMedications) {
          filteredData.medications = state.medications;
        }
        if (options.includeReminders) {
          filteredData.reminders = state.reminders;
        }
        if (options.includeProfile && options.includePersonalInfo) {
          filteredData.userProfile = state.userProfile;
        }
        if (options.includeAdvancedFeatures) {
          filteredData.smartMessages = state.smartMessages;
          filteredData.cyclicDosingPatterns = state.cyclicDosingPatterns;
          filteredData.taperingSchedules = state.taperingSchedules;
          filteredData.psychologicalInterventions = state.psychologicalInterventions;
          filteredData.adherencePatterns = state.adherencePatterns;
          filteredData.dependencyRiskAssessments = state.dependencyRiskAssessments;
        }

        // Add metadata
        filteredData.exportMetadata = {
          version: '2.0.0',
          exportDate: new Date(),
          exportOptions: options,
          totalRecords: {
            medications: filteredData.medications?.length || 0,
            logs: filteredData.logs?.length || 0,
            reminders: filteredData.reminders?.length || 0,
            hasProfile: !!filteredData.userProfile
          }
        };

        return JSON.stringify(filteredData, null, 2);
      },

      importDataWithValidation: async (data) => {
        const validation = get().validateImportData(data);
        
        if (!validation.isValid) {
          return {
            success: false,
            errors: validation.errors,
            warnings: validation.warnings
          };
        }

        try {
          // Backup current data before import
          get().backupData();

          // Apply imported data
          set((state) => {
            const newState = { ...state };
            
            if (data.medications) {
              // Merge medications, avoiding duplicates by name
              const existingNames = new Set(state.medications.map(med => med.name));
              const newMedications = data.medications.filter((med: any) => !existingNames.has(med.name));
              newState.medications = [...state.medications, ...newMedications.map((med: any) => ({
                ...med,
                id: generateId(),
                createdAt: new Date(),
                updatedAt: new Date()
              }))];
            }

            if (data.logs) {
              newState.logs = [...state.logs, ...data.logs.map((log: any) => ({
                ...log,
                id: generateId(),
                timestamp: new Date(log.timestamp),
                createdAt: new Date()
              }))];
            }

            if (data.reminders) {
              newState.reminders = [...state.reminders, ...data.reminders.map((reminder: any) => ({
                ...reminder,
                id: generateId(),
                createdAt: new Date(),
                updatedAt: new Date()
              }))];
            }

            if (data.userProfile && !state.userProfile) {
              newState.userProfile = {
                ...data.userProfile,
                id: generateId(),
                createdAt: new Date(),
                updatedAt: new Date()
              };
            }

            return newState;
          });

          return {
            success: true,
            errors: [],
            warnings: validation.warnings
          };
        } catch (error) {
          return {
            success: false,
            errors: [`Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
            warnings: []
          };
        }
      },

      validateImportData: (data) => {
        const errors: string[] = [];
        const warnings: string[] = [];

        // Check for required structure
        if (!data || typeof data !== 'object') {
          errors.push('Invalid data format: must be a valid JSON object');
          return { isValid: false, errors, warnings };
        }

        // Validate medications
        if (data.medications) {
          if (!Array.isArray(data.medications)) {
            errors.push('Medications must be an array');
          } else {
            data.medications.forEach((med: any, index: number) => {
              if (!med.name || typeof med.name !== 'string') {
                errors.push(`Medication ${index + 1}: name is required and must be a string`);
              }
              if (!med.dosage || typeof med.dosage !== 'string') {
                errors.push(`Medication ${index + 1}: dosage is required and must be a string`);
              }
              if (!med.unit || typeof med.unit !== 'string') {
                errors.push(`Medication ${index + 1}: unit is required and must be a string`);
              }
              if (!med.frequency || typeof med.frequency !== 'string') {
                errors.push(`Medication ${index + 1}: frequency is required and must be a string`);
              }
            });
          }
        }

        // Validate logs
        if (data.logs) {
          if (!Array.isArray(data.logs)) {
            errors.push('Logs must be an array');
          } else {
            data.logs.forEach((log: any, index: number) => {
              if (!log.medicationId || typeof log.medicationId !== 'string') {
                errors.push(`Log ${index + 1}: medicationId is required and must be a string`);
              }
              if (!log.timestamp) {
                errors.push(`Log ${index + 1}: timestamp is required`);
              } else {
                const date = new Date(log.timestamp);
                if (isNaN(date.getTime())) {
                  errors.push(`Log ${index + 1}: invalid timestamp format`);
                }
              }
              if (log.adherence && !['taken', 'missed', 'skipped', 'partial'].includes(log.adherence)) {
                warnings.push(`Log ${index + 1}: unknown adherence status '${log.adherence}'`);
              }
            });
          }
        }

        // Validate reminders
        if (data.reminders) {
          if (!Array.isArray(data.reminders)) {
            errors.push('Reminders must be an array');
          } else {
            data.reminders.forEach((reminder: any, index: number) => {
              if (!reminder.medicationId || typeof reminder.medicationId !== 'string') {
                errors.push(`Reminder ${index + 1}: medicationId is required and must be a string`);
              }
              if (!reminder.time || typeof reminder.time !== 'string') {
                errors.push(`Reminder ${index + 1}: time is required and must be a string`);
              }
              if (!reminder.days || !Array.isArray(reminder.days)) {
                errors.push(`Reminder ${index + 1}: days is required and must be an array`);
              }
            });
          }
        }

        // Version compatibility warnings
        if (data.exportMetadata?.version && data.exportMetadata.version !== '2.0.0') {
          warnings.push(`Import data was exported with version ${data.exportMetadata.version}, some features may not be compatible`);
        }

        return {
          isValid: errors.length === 0,
          errors,
          warnings
        };
      },

      exportToCSV: (dataType, dateRange) => {
        const state = get();
        
        switch (dataType) {
          case 'medications':
            return generateCSV(state.medications.map(med => ({
              name: med.name,
              dosage: med.dosage,
              unit: med.unit,
              frequency: med.frequency,
              category: med.category,
              isActive: med.isActive,
              startDate: formatDate(new Date(med.startDate)),
              riskLevel: med.riskLevel,
              prescribedBy: med.prescribedBy || '',
              pharmacy: med.pharmacy || '',
              notes: med.notes || ''
            })));

          case 'logs': {
            let logs = state.logs;
            if (dateRange) {
              logs = logs.filter(log => {
                const logDate = new Date(log.timestamp);
                return logDate >= dateRange.start && logDate <= dateRange.end;
              });
            }
            return generateCSV(logs.map(log => {
              const medication = state.medications.find(med => med.id === log.medicationId);
              return {
                date: formatDate(new Date(log.timestamp)),
                time: formatTime(new Date(log.timestamp)),
                medication: medication?.name || 'Unknown',
                dosageTaken: log.dosageTaken,
                unit: log.unit,
                adherence: log.adherence,
                notes: log.notes || '',
                sideEffects: log.sideEffectsReported?.join('; ') || ''
              };
            }));
          }

          case 'reminders': {
            return generateCSV(state.reminders.map(reminder => {
              const medication = state.medications.find(med => med.id === reminder.medicationId);
              return {
                medication: medication?.name || 'Unknown',
                time: reminder.time,
                days: reminder.days.join(', '),
                isActive: reminder.isActive,
                customMessage: reminder.customMessage || '',
                notificationSound: reminder.notificationSound || false
              };
            }));
          }

          case 'all': {
            // Comprehensive export with all data
            const allData = {
              medications: state.medications,
              logs: dateRange ? state.logs.filter(log => {
                const logDate = new Date(log.timestamp);
                return logDate >= dateRange.start && logDate <= dateRange.end;
              }) : state.logs,
              reminders: state.reminders,
              userProfile: state.userProfile,
              summary: {
                totalMedications: state.medications.length,
                activeMedications: state.medications.filter(med => med.isActive).length,
                totalLogs: state.logs.length,
                totalReminders: state.reminders.length,
                exportDate: new Date()
              }
            };
            return JSON.stringify(allData, null, 2);
          }

          default:
            return '';
        }
      },

      exportToPDF: async (options) => {
        // For now, return JSON data - PDF generation would require additional library
        // In a real implementation, this would use jsPDF or similar
        const data = await get().exportDataWithOptions(options);
        return data;
      },

      backupData: () => {
        const state = get();
        const backup = {
          medications: state.medications,
          logs: state.logs,
          reminders: state.reminders,
          userProfile: state.userProfile,
          smartMessages: state.smartMessages,
          cyclicDosingPatterns: state.cyclicDosingPatterns,
          taperingSchedules: state.taperingSchedules,
          psychologicalInterventions: state.psychologicalInterventions,
          adherencePatterns: state.adherencePatterns,
          dependencyRiskAssessments: state.dependencyRiskAssessments,
          backupDate: new Date()
        };
        
        // Store backup in localStorage with timestamp
        localStorage.setItem(`meditrax-backup-${Date.now()}`, JSON.stringify(backup));
        
        // Keep only last 5 backups
        const backupKeys = Object.keys(localStorage).filter(key => key.startsWith('meditrax-backup-'));
        if (backupKeys.length > 5) {
          backupKeys.sort().slice(0, -5).forEach(key => localStorage.removeItem(key));
        }
      },

      restoreData: async (backupData) => {
        try {
          const validation = get().validateImportData(backupData);
          
          if (!validation.isValid) {
            return {
              success: false,
              errors: ['Invalid backup data format', ...validation.errors]
            };
          }

          set({
            medications: backupData.medications || [],
            logs: backupData.logs || [],
            reminders: backupData.reminders || [],
            userProfile: backupData.userProfile || null,
            smartMessages: backupData.smartMessages || [],
            cyclicDosingPatterns: backupData.cyclicDosingPatterns || [],
            taperingSchedules: backupData.taperingSchedules || [],
            psychologicalInterventions: backupData.psychologicalInterventions || [],
            adherencePatterns: backupData.adherencePatterns || [],
            dependencyRiskAssessments: backupData.dependencyRiskAssessments || [],
          });

          return { success: true, errors: [] };
        } catch (error) {
          return {
            success: false,
            errors: [`Restore failed: ${error instanceof Error ? error.message : 'Unknown error'}`]
          };
        }
      },

      // Advanced features actions implementation
      // Smart messaging
      addSmartMessage: (messageData) => {
        const message: SmartMessage = {
          ...messageData,
          id: generateId(),
        };
        
        set((state) => ({
          smartMessages: [...state.smartMessages, message],
        }));
      },

      markMessageAsRead: (messageId) => {
        set((state) => ({
          smartMessages: state.smartMessages.filter(msg => msg.id !== messageId),
        }));
      },

      dismissMessage: (messageId) => {
        set((state) => ({
          smartMessages: state.smartMessages.filter(msg => msg.id !== messageId),
        }));
      },

      generateContextualMessage: (medicationId, type) => {
        const { medications, logs } = get();
        const medication = medications.find(med => med.id === medicationId);
        
        if (!medication) return;

        // Enhanced adherence tracking for streaks
        const adherenceData = {
          adherenceStreak: get().getCurrentStreak(medicationId),
          overallStreak: get().getOverallStreak()
        };

        // Only generate celebration messages when ALL scheduled medications are complete
        if (type === 'celebration') {
          const allScheduledComplete = get().areAllScheduledMedicationsComplete();
          if (!allScheduledComplete) {
            return; // Don't show celebration message until all scheduled meds are done
          }
        }

        const messageContent = generatePsychologicalMessage(
          type as any, 
          medication.name, 
          adherenceData
        );

        get().addSmartMessage({
          medicationId,
          type: type as any,
          priority: medication.riskLevel === 'high' ? 'high' : 'medium',
          title: messageContent.title,
          message: messageContent.message,
          psychologicalApproach: messageContent.approach as any,
          scheduledTime: new Date(),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        });
      },

      // Cyclic dosing
      addCyclicDosingPattern: (patternData) => {
        const pattern: CyclicDosingPattern = {
          ...patternData,
          id: generateId(),
        };
        
        set((state) => ({
          cyclicDosingPatterns: [...state.cyclicDosingPatterns, pattern],
        }));
      },

      updateCyclicDosingPattern: (id, updates) => {
        set((state) => ({
          cyclicDosingPatterns: state.cyclicDosingPatterns.map(pattern =>
            pattern.id === id ? { ...pattern, ...updates } : pattern
          ),
        }));
      },

      deleteCyclicDosingPattern: (id) => {
        set((state) => ({
          cyclicDosingPatterns: state.cyclicDosingPatterns.filter(pattern => pattern.id !== id),
        }));
      },

      getCurrentDose: (medicationId, date = new Date()) => {
        const { medications, cyclicDosingPatterns } = get();
        const medication = medications.find(med => med.id === medicationId);
        
        if (!medication) return { dose: 0, phase: 'maintenance' };
        
        let baseDose = parseFloat(medication.dosage);
        let pillBreakdown: Record<string, number> = {};
        
        // Handle multiple pills - use total dose from default configuration
        if (medication.useMultiplePills && medication.doseConfigurations) {
          const defaultConfig = medication.doseConfigurations.find(
            config => config.id === medication.defaultDoseConfigurationId
          ) || medication.doseConfigurations[0];
          
          if (defaultConfig) {
            baseDose = defaultConfig.totalDoseAmount;
            
            // Calculate initial pill breakdown from default configuration
            if (medication.pillConfigurations) {
              defaultConfig.pillComponents.forEach(component => {
                pillBreakdown[component.pillConfigurationId] = component.quantity;
              });
            }
          }
        }
        
        // Apply tapering if active (use the provided date for calculation)
        let isTapering = false;
        let taperingMessage = undefined;
        if (medication.tapering?.isActive) {
          const taperedDose = calculateTaperingDose(medication.tapering, date, medication);
          isTapering = true;
          
        // Calculate message about next dose reduction, stabilization, or breaks
        if (medication.tapering.currentBreak && medication.tapering.currentBreak.isActive) {
          // Handle active breaks
          const currentBreak = medication.tapering.currentBreak;
          // Ensure startDate is a Date object (handle localStorage deserialization)
          const startDate = currentBreak.startDate instanceof Date ? currentBreak.startDate : new Date(currentBreak.startDate);
          const breakDuration = Math.floor((date.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
          
          switch (currentBreak.type) {
            case 'stabilization':
              if (currentBreak.plannedDuration) {
                const daysRemaining = currentBreak.plannedDuration - breakDuration;
                taperingMessage = daysRemaining > 0 
                  ? `Stabilization break (${daysRemaining} days remaining)`
                  : `Stabilization break complete - ready to resume`;
              } else {
                taperingMessage = `Stabilization break active (${breakDuration} days)`;
              }
              break;
            case 'tolerance':
              taperingMessage = `Tolerance break active - preventing dependence`;
              break;
            case 'emergency':
              taperingMessage = `Emergency break - severe withdrawal management`;
              break;
            case 'planned':
              taperingMessage = `Planned break - ${currentBreak.reason}`;
              break;
            case 'temporary':
              taperingMessage = `Temporary break - maintain current dose`;
              break;
            case 'withdrawal_management':
              const severity = currentBreak.withdrawalSeverity || 'moderate';
              taperingMessage = `Break for ${severity} withdrawal symptoms`;
              break;
            default:
              taperingMessage = `Tapering break active - maintain current dose`;
          }
        } else if (medication.tapering.daysBetweenReductions) {
          const startDate = new Date(medication.tapering.startDate);
          const daysSinceStart = Math.floor((date.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
          const currentStep = Math.floor(daysSinceStart / medication.tapering.daysBetweenReductions);
          const daysInCurrentStep = daysSinceStart % medication.tapering.daysBetweenReductions;
          const daysUntilNextReduction = medication.tapering.daysBetweenReductions - daysInCurrentStep;
          
          // Check if current step is a stabilization period
          // Stabilization periods occur on even steps (step 2, 4, 6, etc.) when enabled
          const isStabilizationEnabled = medication.tapering.includeStabilizationPeriods || 
            (medication.tapering.customSteps && 
             medication.tapering.customSteps.some((step: any) => step.notes && step.notes.includes('Stabilization')));
          const isCurrentStepStabilization = isStabilizationEnabled && currentStep > 0 && currentStep % 2 === 0;
          
          if (daysInCurrentStep === 0) {
            // First day of a new period
            if (isCurrentStepStabilization) {
              taperingMessage = `Stabilization period - maintain current dose`;
            } else {
              taperingMessage = `Dose reduction today`;
            }
          } else if (daysUntilNextReduction === 1) {
            // Last day of current period
            if (isCurrentStepStabilization) {
              taperingMessage = `Stabilization ends tomorrow`;
            } else {
              const nextStepWillBeStabilization = isStabilizationEnabled && (currentStep + 1) % 2 === 0;
              if (nextStepWillBeStabilization) {
                taperingMessage = `Stabilization period starts tomorrow`;
              } else {
                taperingMessage = `Next reduction tomorrow`;
              }
            }
          } else {
            // Middle of a period
            if (isCurrentStepStabilization) {
              taperingMessage = `Stabilization period (${daysUntilNextReduction} days remaining)`;
            } else {
              taperingMessage = `Next reduction in ${daysUntilNextReduction} days`;
            }
          }
        }
          
          // For multiple pills, calculate the pill breakdown for the tapered dose
          if (medication.useMultiplePills && medication.pillConfigurations) {
            pillBreakdown = calculatePillCountsForDose(taperedDose, medication);
            // Keep the tapered dose - don't recalculate based on pill combinations
            // The pill breakdown is for inventory tracking, not dose adjustment
            baseDose = taperedDose;
          } else {
            baseDose = taperedDose;
          }
        }
        
        // Apply cyclic dosing if active (use the provided date for calculation)
        let cyclicResult = { dose: baseDose, phase: isTapering ? 'tapering' : 'maintenance' };
        
        if (medication.cyclicDosing?.isActive) {
          // Use the medication's cyclicDosing directly and the provided date
          cyclicResult = calculateCyclicDose(baseDose, medication.cyclicDosing, date);
          // If both tapering and cyclic are active, show combined phase
          if (isTapering && cyclicResult.phase !== 'maintenance') {
            cyclicResult.phase = `tapering-${cyclicResult.phase}`;
          }
        }
        
        // For multiple pills with cyclic dosing, recalculate pill breakdown
        if (medication.useMultiplePills && medication.pillConfigurations && cyclicResult.dose !== baseDose) {
          pillBreakdown = calculatePillCountsForDose(cyclicResult.dose, medication);
        }
        
        // Return enhanced result with pill breakdown for multiple pill medications
        return {
          ...cyclicResult,
          message: taperingMessage || cyclicResult.message,
          pillBreakdown: medication.useMultiplePills ? pillBreakdown : undefined
        };
      },

      // Tapering schedules
      addTaperingSchedule: (scheduleData) => {
        const schedule: TaperingSchedule = {
          ...scheduleData,
          id: generateId(),
        };
        
        set((state) => ({
          taperingSchedules: [...state.taperingSchedules, schedule],
        }));
      },

      updateTaperingSchedule: (id, updates) => {
        set((state) => ({
          taperingSchedules: state.taperingSchedules.map(schedule =>
            schedule.id === id ? { ...schedule, ...updates } : schedule
          ),
        }));
      },

      deleteTaperingSchedule: (id) => {
        set((state) => ({
          taperingSchedules: state.taperingSchedules.filter(schedule => schedule.id !== id),
        }));
      },

      // Enhanced break management methods
      startTaperingBreak: (
        medicationId: string, 
        breakType: 'stabilization' | 'tolerance' | 'emergency' | 'planned' | 'temporary' | 'withdrawal_management',
        reason: string,
        options: {
          withdrawalSeverity?: 'mild' | 'moderate' | 'severe';
          plannedDuration?: number;
          notes?: string;
          autoResumeEnabled?: boolean;
          reminderEnabled?: boolean;
          reminderFrequency?: 'daily' | 'weekly' | 'none';
        } = {}
      ) => {
        set((state) => ({
          medications: state.medications.map(med => {
            if (med.id === medicationId && med.tapering && !med.tapering.isPaused) {
              const currentDose = get().getCurrentDose(medicationId);
              const suggestedDays = options.plannedDuration || suggestPauseDuration(med.name, options.withdrawalSeverity || 'moderate');
              
              const taperingBreak = {
                id: `break-${Date.now()}`,
                type: breakType,
                reason,
                startDate: new Date(),
                endDate: options.plannedDuration ? new Date(Date.now() + options.plannedDuration * 24 * 60 * 60 * 1000) : undefined,
                doseAtBreak: currentDose.dose,
                withdrawalSeverity: options.withdrawalSeverity,
                plannedDuration: suggestedDays,
                notes: options.notes,
                isActive: true,
                autoResumeEnabled: options.autoResumeEnabled || false,
                reminderEnabled: options.reminderEnabled !== false,
                reminderFrequency: options.reminderFrequency || 'weekly'
              };

              return {
                ...med,
                tapering: {
                  ...med.tapering,
                  isPaused: true,
                  pausedAt: new Date(),
                  suggestedResumeDays: suggestedDays,
                  currentBreak: taperingBreak,
                  breakHistory: [...(med.tapering.breakHistory || []), taperingBreak],
                  totalBreakDays: (med.tapering.totalBreakDays || 0),
                  originalEndDate: med.tapering.originalEndDate || med.tapering.endDate,
                  autoExtendOnBreak: med.tapering.autoExtendOnBreak !== false
                }
              };
            }
            return med;
          })
        }));
      },

      endTaperingBreak: (medicationId: string, resumeImmediately: boolean = true) => {
        set((state) => ({
          medications: state.medications.map(med => {
            if (med.id === medicationId && med.tapering && med.tapering.isPaused && med.tapering.currentBreak) {
              const currentBreak = med.tapering.currentBreak;
              // Ensure startDate is a Date object (handle localStorage deserialization)
              const startDate = currentBreak.startDate instanceof Date ? currentBreak.startDate : new Date(currentBreak.startDate);
              const breakDuration = Math.floor((new Date().getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
              
              // Update break with actual duration
              const updatedBreak = {
                ...currentBreak,
                endDate: new Date(),
                actualDuration: breakDuration,
                isActive: false
              };

              // Update break history
              const updatedHistory = (med.tapering.breakHistory || []).map(b => 
                b.id === currentBreak.id ? updatedBreak : b
              );

              let updatedTapering = {
                ...med.tapering,
                currentBreak: undefined,
                breakHistory: updatedHistory,
                totalBreakDays: (med.tapering.totalBreakDays || 0) + breakDuration
              };

              // If resuming immediately, update schedule
              if (resumeImmediately) {
                // Extend the end date by the break duration if auto-extend is enabled
                if (med.tapering.autoExtendOnBreak !== false) {
                  const newEndDate = new Date(med.tapering.endDate);
                  newEndDate.setDate(newEndDate.getDate() + breakDuration);
                  updatedTapering.endDate = newEndDate;
                }

                updatedTapering = {
                  ...updatedTapering,
                  isPaused: false,
                  pausedAt: undefined,
                  suggestedResumeDays: undefined
                };
              }

              return {
                ...med,
                tapering: updatedTapering
              };
            }
            return med;
          })
        }));
      },

      // Legacy methods for backward compatibility
      pauseTaperingSchedule: (medicationId, withdrawalSeverity: 'mild' | 'moderate' | 'severe' = 'moderate') => {
        get().startTaperingBreak(medicationId, 'withdrawal_management', 'Manual pause for withdrawal management', {
          withdrawalSeverity,
          autoResumeEnabled: false,
          reminderEnabled: true,
          reminderFrequency: 'weekly'
        });
      },

      resumeTaperingSchedule: (medicationId) => {
        get().endTaperingBreak(medicationId, true);
      },

      adjustTaperingSchedule: (medicationId, adjustments: {
        newReductionPercent?: number;
        extendDurationWeeks?: number;
        changeMethod?: 'linear' | 'exponential' | 'hyperbolic' | 'custom';
      }) => {
        set((state) => ({
          medications: state.medications.map(med => {
            if (med.id === medicationId && med.tapering) {
              const updatedTapering = { ...med.tapering };
              
              if (adjustments.extendDurationWeeks) {
                const extensionDays = adjustments.extendDurationWeeks * 7;
                const newEndDate = new Date(updatedTapering.endDate);
                newEndDate.setDate(newEndDate.getDate() + extensionDays);
                updatedTapering.endDate = newEndDate;
              }
              
              if (adjustments.changeMethod) {
                updatedTapering.taperingMethod = adjustments.changeMethod;
              }
              
              return {
                ...med,
                tapering: updatedTapering
              };
            }
            return med;
          })
        }));
      },

      // Risk assessment
      assessDependencyRisk: (medicationId) => {
        const { medications, logs } = get();
        const medication = medications.find(med => med.id === medicationId);
        
        if (!medication) {
          return {
            medicationId,
            riskScore: 0,
            riskFactors: [],
            lastAssessment: new Date(),
            recommendedActions: [],
            escalationRequired: false,
          };
        }

        const riskAssessment = calculateDependencyRisk(logs, medication);
        
        const assessment: DependencyRiskAssessment = {
          medicationId,
          riskScore: riskAssessment.riskScore,
          riskFactors: riskAssessment.riskFactors.map(factor => ({
            factor: 'dose-escalation',
            weight: 1,
            description: factor,
            firstDetected: new Date(),
            currentSeverity: 'medium' as const,
          })),
          lastAssessment: new Date(),
          recommendedActions: riskAssessment.recommendations,
          escalationRequired: riskAssessment.riskScore > 50,
        };

        return assessment;
      },

      updateRiskAssessment: (medicationId) => {
        const assessment = get().assessDependencyRisk(medicationId);
        
        set((state) => ({
          dependencyRiskAssessments: [
            ...state.dependencyRiskAssessments.filter(a => a.medicationId !== medicationId),
            assessment,
          ],
        }));

        // Generate alert message if high risk
        if (assessment.escalationRequired) {
          get().generateContextualMessage(medicationId, 'risk-alert');
        }
      },

      getHighRiskMedications: () => {
        return get().medications.filter(med => 
          med.riskLevel === 'high' || med.riskLevel === 'moderate'
        );
      },

      // Enhanced Psychological Safety Alerts
      generatePsychologicalSafetyAlerts: (medicationId?: string) => {
        const { medications, logs } = get();
        const targetMedications = medicationId 
          ? medications.filter(med => med.id === medicationId)
          : medications.filter(med => med.isActive);

        const allAlerts: PsychologicalSafetyAlert[] = [];

        targetMedications.forEach(medication => {
          const result = PsychologicalSafetyService.generatePsychologicalSafetyAlerts(
            medication, 
            logs, 
            medications
          );
          allAlerts.push(...result.alerts);
          
          // Add cyclic dosing specific alerts
          const cyclicAlerts = PsychologicalSafetyService.generateCyclicDosingAlerts(medication, logs);
          allAlerts.push(...cyclicAlerts);
          
          // Add tapering specific alerts
          const taperingAlerts = PsychologicalSafetyService.generateTaperingAlerts(medication, logs);
          allAlerts.push(...taperingAlerts);
        });

        // Deduplicate alerts by medicationId and type
        const uniqueAlerts = allAlerts.filter((alert, index, arr) => 
          arr.findIndex(a => a.medicationId === alert.medicationId && a.type === alert.type) === index
        );

        set((state) => ({
          psychologicalSafetyAlerts: uniqueAlerts
        }));

        return allAlerts;
      },

      acknowledgePsychologicalAlert: (alertId: string, response?: 'helpful' | 'not-helpful' | 'dismissed') => {
        set((state) => ({
          psychologicalSafetyAlerts: state.psychologicalSafetyAlerts.map(alert =>
            alert.id === alertId 
              ? { ...alert, acknowledged: true, userResponse: response }
              : alert
          )
        }));
      },

      getPsychologicalSafetyAlertsForMedication: (medicationId: string) => {
        return get().psychologicalSafetyAlerts.filter(alert => 
          alert.medicationId === medicationId && !alert.acknowledged
        );
      },

      getActivePsychologicalSafetyAlerts: () => {
        return get().psychologicalSafetyAlerts.filter(alert => !alert.acknowledged);
      },

      // Behavioral analysis
      analyzeAdherencePatterns: (medicationId) => {
        const { medications } = get();
        const medication = medications.find(med => med.id === medicationId);
        
        if (!medication) {
          return {
            medicationId,
            weeklyAdherence: [],
            monthlyTrend: 'stable' as const,
            riskScore: 0,
            concerningBehaviors: [],
            positivePatterns: [],
          };
        }

        // const medicationLogs = logs.filter(log => log.medicationId === medicationId);
        const adherenceData = get().getMedicationAdherence(medicationId, 7);
        
        const pattern: AdherencePattern = {
          medicationId,
          weeklyAdherence: [adherenceData],
          monthlyTrend: adherenceData > 80 ? 'stable' : 'declining',
          riskScore: 100 - adherenceData,
          concerningBehaviors: adherenceData < 70 ? ['Low adherence detected'] : [],
          positivePatterns: adherenceData > 90 ? ['Excellent adherence'] : [],
        };

        return pattern;
      },

      detectBehaviorPattern: (medicationId) => {
        const { medications, logs } = get();
        const medication = medications.find(med => med.id === medicationId);
        
        if (!medication) return;

        const patterns = detectBehaviorPatterns(logs, medication);
        
        // Generate appropriate interventions based on detected patterns
        patterns.forEach(pattern => {
          if (pattern.type === 'weekend-gaps') {
            get().generateContextualMessage(medicationId, 'adherence-reminder');
          } else if (pattern.type === 'dose-timing-drift') {
            get().generateContextualMessage(medicationId, 'motivation');
          }
        });
      },

      triggerPsychologicalIntervention: (medicationId, type, trigger) => {
        const intervention: PsychologicalIntervention = {
          id: generateId(),
          medicationId,
          type: type as any,
          trigger,
          message: '',
          timestamp: new Date(),
        };

        set((state) => ({
          psychologicalInterventions: [...state.psychologicalInterventions, intervention],
        }));

        // Generate corresponding smart message
        get().generateContextualMessage(medicationId, type);
      },

      // Analytics
      getSmartInsights: () => {
        const { medications } = get();
        const insights: any[] = [];

        // High-risk medication insights
        const highRiskMeds = medications.filter(med => med.riskLevel === 'high');
        if (highRiskMeds.length > 0) {
          insights.push({
            type: 'risk-alert',
            title: 'High-Risk Medications Detected',
            description: `You have ${highRiskMeds.length} high-risk medication(s) that require careful monitoring.`,
            priority: 'high',
            medications: highRiskMeds.map(med => med.name),
          });
        }

        // Adherence insights
        const adherenceScores = medications.map(med => 
          get().getMedicationAdherence(med.id, 7)
        );
        const avgAdherence = adherenceScores.reduce((a, b) => a + b, 0) / adherenceScores.length;
        
        if (avgAdherence < 70) {
          insights.push({
            type: 'adherence-concern',
            title: 'Adherence Below Target',
            description: `Your average adherence is ${Math.round(avgAdherence)}%. Consider setting more reminders.`,
            priority: 'medium',
          });
        } else if (avgAdherence > 90) {
          insights.push({
            type: 'celebration',
            title: 'Excellent Adherence!',
            description: `Your adherence is ${Math.round(avgAdherence)}%. Keep up the great work!`,
            priority: 'low',
          });
        }

        return insights;
      },

      getPsychologicalProfile: (medicationId) => {
        const medication = get().medications.find(med => med.id === medicationId);
        return medication?.psychologicalProfile || null;
      },

      getAdherenceScore: (medicationId, timeWindow = 30) => {
        return get().getMedicationAdherence(medicationId, timeWindow);
      },

      // Enhanced streak tracking
      getCurrentStreak: (medicationId) => {
        const logs = get().logs.filter(log => log.medicationId === medicationId)
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        if (logs.length === 0) return 0;

        let streak = 0;
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Count consecutive days of taking medication
        for (let i = 0; i < logs.length; i++) {
          const logDate = new Date(logs[i].timestamp);
          logDate.setHours(0, 0, 0, 0);
          
          const expectedDate = new Date(today.getTime() - (streak * 24 * 60 * 60 * 1000));
          
          if (logDate.getTime() === expectedDate.getTime() && logs[i].adherence === 'taken') {
            streak++;
          } else {
            break;
          }
        }

        return streak;
      },

      getOverallStreak: () => {
        const { medications, logs } = get();
        const scheduledMeds = medications.filter(med => 
          med.isActive && med.frequency !== 'as-needed'
        );

        if (scheduledMeds.length === 0) return 0;

        let minStreak = Infinity;
        for (const med of scheduledMeds) {
          const streak = get().getCurrentStreak(med.id);
          minStreak = Math.min(minStreak, streak);
        }

        return minStreak === Infinity ? 0 : minStreak;
      },

      areAllScheduledMedicationsComplete: () => {
        const { medications, logs } = get();
        const todaysLogs = logs.filter(log => isToday(new Date(log.timestamp)));
        const activeMedications = medications.filter(med => med.isActive);
        
        // Get all scheduled medications (not as-needed)
        const scheduledMedications = activeMedications.filter(med => 
          med.frequency !== 'as-needed'
        );

        if (scheduledMedications.length === 0) return true;

        // Check each scheduled medication to see if all required doses are taken
        for (const medication of scheduledMedications) {
          const frequencyMap = {
            'once-daily': 1,
            'twice-daily': 2,
            'three-times-daily': 3,
            'four-times-daily': 4,
          };
          
          const requiredDoses = frequencyMap[medication.frequency as keyof typeof frequencyMap] || 1;
          const takenDoses = todaysLogs.filter(log => 
            log.medicationId === medication.id && log.adherence === 'taken'
          ).length;

          if (takenDoses < requiredDoses) {
            return false; // This medication is not complete
          }
        }

        return true; // All scheduled medications are complete
      },

      // NEW: Multiple pills support methods
      addPillConfiguration: (medicationId, config) => {
        const pillConfig: PillConfiguration = {
          ...config,
          id: generateId(),
        };

        set((state) => ({
          medications: state.medications.map((med) =>
            med.id === medicationId
              ? {
                  ...med,
                  pillConfigurations: [...(med.pillConfigurations || []), pillConfig],
                  updatedAt: new Date(),
                }
              : med
          ),
        }));
      },

      updatePillConfiguration: (medicationId, configId, updates) => {
        set((state) => ({
          medications: state.medications.map((med) =>
            med.id === medicationId
              ? {
                  ...med,
                  pillConfigurations: (med.pillConfigurations || []).map((config) =>
                    config.id === configId ? { ...config, ...updates } : config
                  ),
                  updatedAt: new Date(),
                }
              : med
          ),
        }));
      },

      deletePillConfiguration: (medicationId, configId) => {
        set((state) => ({
          medications: state.medications.map((med) =>
            med.id === medicationId
              ? {
                  ...med,
                  pillConfigurations: (med.pillConfigurations || []).filter(
                    (config) => config.id !== configId
                  ),
                  updatedAt: new Date(),
                }
              : med
          ),
        }));
      },

      addDoseConfiguration: (medicationId, config) => {
        const doseConfig: DoseConfiguration = {
          ...config,
          id: generateId(),
        };

        set((state) => ({
          medications: state.medications.map((med) =>
            med.id === medicationId
              ? {
                  ...med,
                  doseConfigurations: [...(med.doseConfigurations || []), doseConfig],
                  defaultDoseConfigurationId: med.defaultDoseConfigurationId || doseConfig.id,
                  updatedAt: new Date(),
                }
              : med
          ),
        }));
      },

      updateDoseConfiguration: (medicationId, configId, updates) => {
        set((state) => ({
          medications: state.medications.map((med) =>
            med.id === medicationId
              ? {
                  ...med,
                  doseConfigurations: (med.doseConfigurations || []).map((config) =>
                    config.id === configId ? { ...config, ...updates } : config
                  ),
                  updatedAt: new Date(),
                }
              : med
          ),
        }));
      },

      deleteDoseConfiguration: (medicationId, configId) => {
        set((state) => ({
          medications: state.medications.map((med) => {
            if (med.id === medicationId) {
              const updatedDoseConfigs = (med.doseConfigurations || []).filter(
                (config) => config.id !== configId
              );
              return {
                ...med,
                doseConfigurations: updatedDoseConfigs,
                defaultDoseConfigurationId:
                  med.defaultDoseConfigurationId === configId
                    ? updatedDoseConfigs[0]?.id || undefined
                    : med.defaultDoseConfigurationId,
                updatedAt: new Date(),
              };
            }
            return med;
          }),
        }));
      },

      setDefaultDoseConfiguration: (medicationId, configId) => {
        set((state) => ({
          medications: state.medications.map((med) =>
            med.id === medicationId
              ? {
                  ...med,
                  defaultDoseConfigurationId: configId,
                  updatedAt: new Date(),
                }
              : med
          ),
        }));
      },

      logMultiplePillDose: (medicationId, pillLogs, notes, sideEffects) => {
        const medication = get().medications.find((med) => med.id === medicationId);
        if (!medication) return;

        // Calculate adherence details
        const totalExpected = pillLogs.reduce((sum, log) => sum + log.quantityExpected, 0);
        const totalTaken = pillLogs.reduce((sum, log) => sum + log.quantityTaken, 0);
        const adherencePercentage = totalExpected > 0 ? (totalTaken / totalExpected) * 100 : 0;
        const partialDose = adherencePercentage > 0 && adherencePercentage < 100;

        const adherenceDetails: AdherenceDetails = {
          totalExpectedPills: totalExpected,
          totalTakenPills: totalTaken,
          partialDose,
          adherencePercentage,
        };

        // Determine adherence status more accurately
        let adherenceStatus: 'taken' | 'partial' | 'missed';
        if (totalTaken === 0) {
          adherenceStatus = 'missed';
        } else if (totalTaken >= totalExpected) {
          adherenceStatus = 'taken'; // Full or extra dose still counts as taken
        } else {
          adherenceStatus = 'partial';
        }

        // Calculate total dose for safety checking
        const totalDoseAmount = pillLogs.reduce((sum, pillLog) => {
          const pillConfig = medication.pillConfigurations?.find(
            config => config.id === pillLog.pillConfigurationId
          );
          return sum + (pillConfig ? pillConfig.strength * pillLog.quantityTaken : 0);
        }, 0);

        // Generate dose safety message for multiple pills
        const prescribedDose = medication.doseConfigurations?.find(
          config => config.id === medication.defaultDoseConfigurationId
        )?.totalDoseAmount || parseFloat(medication.dosage);
        
        const safetyMessage = generateDoseSafetyMessage(
          medication.name,
          totalDoseAmount,
          prescribedDose,
          medication.unit
        );

        // Add safety message to notes if present
        const enhancedNotes = safetyMessage 
          ? (notes ? `${notes}\n\n${safetyMessage}` : safetyMessage)
          : notes;

        const log: MedicationLog = {
          id: generateId(),
          medicationId,
          timestamp: new Date(),
          dosageTaken: totalTaken, // For backward compatibility
          unit: medication.unit, // For backward compatibility
          notes: enhancedNotes,
          sideEffectsReported: sideEffects,
          adherence: adherenceStatus,
          createdAt: new Date(),
          pillsLogged: pillLogs,
          adherenceDetails,
          useMultiplePills: true,
        };

        set((state) => ({
          logs: [...state.logs, log],
        }));

        // Generate psychological messages for multiple pill dosing
        const currentDoseInfo = get().getCurrentDose(medicationId);
        
        // Check for cyclic dosing messages
        if (medication.cyclicDosing?.isActive) {
          const cyclicMessage = generatePsychologicalMessage(
            'cyclic-dosing',
            medication.name,
            {
              cyclicPhase: currentDoseInfo.phase,
              adjustedDose: `${totalDoseAmount}${medication.unit}`,
              cyclicMessage: currentDoseInfo.message
            }
          );

          get().addSmartMessage({
            medicationId,
            type: 'cyclic-dosing' as any,
            priority: 'low',
            title: cyclicMessage.title,
            message: cyclicMessage.message,
            psychologicalApproach: cyclicMessage.approach as any,
            scheduledTime: new Date(),
            expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000), // 8 hours
          });
        }

        // Generate safety messages for dose deviations
        if (safetyMessage) {
          const messageType = isHeavyDose(medication.name, totalDoseAmount, medication.unit) 
            ? 'heavy-dose-warning' 
            : 'dose-adjustment';
          
          const psychMessage = generatePsychologicalMessage(
            messageType,
            medication.name,
            {
              currentDose: `${totalDoseAmount}${medication.unit}`,
              adjustmentType: totalDoseAmount > prescribedDose ? 'increase' : 'decrease',
              scheduleType: medication.cyclicDosing?.isActive ? 'cyclic' : 
                         medication.tapering?.isActive ? 'tapering' : 'prescribed'
            }
          );

          get().addSmartMessage({
            medicationId,
            type: messageType as any,
            priority: messageType === 'heavy-dose-warning' ? 'high' : 'medium',
            title: psychMessage.title,
            message: psychMessage.message,
            psychologicalApproach: psychMessage.approach as any,
            scheduledTime: new Date(),
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
          });
        }

        // Update pill inventory if available
        if (medication.pillInventory && medication.pillInventory.length > 0) {
          const inventoryUpdates = pillLogs
            .filter(pillLog => pillLog.quantityTaken > 0) // Only update pills that were actually taken
            .map((pillLog) => ({
              pillConfigurationId: pillLog.pillConfigurationId,
              currentCount: -pillLog.quantityTaken, // Negative to subtract
              lastUpdated: new Date(),
            }));
          
          if (inventoryUpdates.length > 0) {
            get().updatePillInventory(medicationId, inventoryUpdates);
          }
        }
      },

      logDoseConfiguration: (medicationId, doseConfigId, pillLogs, notes, sideEffects) => {
        get().logMultiplePillDose(medicationId, pillLogs, notes, sideEffects);
        
        // Update the log to include dose configuration reference
        const logs = get().logs;
        const latestLog = logs[logs.length - 1];
        if (latestLog && latestLog.medicationId === medicationId) {
          get().updateLog(latestLog.id, { doseConfigurationId: doseConfigId });
        }
      },

      calculateTotalDoseFromPills: (medicationId, doseConfigId) => {
        const medication = get().medications.find((med) => med.id === medicationId);
        if (!medication?.pillConfigurations || !medication?.doseConfigurations) {
          return null;
        }

        let targetDoseConfig: DoseConfiguration | undefined;
        if (doseConfigId) {
          targetDoseConfig = medication.doseConfigurations.find((config) => config.id === doseConfigId);
        } else {
          targetDoseConfig = medication.doseConfigurations.find(
            (config) => config.id === medication.defaultDoseConfigurationId
          ) || medication.doseConfigurations[0];
        }

        if (!targetDoseConfig) return null;

        let totalAmount = 0;
        let commonUnit: MedicationUnit | null = null;

        for (const component of targetDoseConfig.pillComponents) {
          const pillConfig = medication.pillConfigurations.find(
            (config) => config.id === component.pillConfigurationId
          );
          if (pillConfig) {
            totalAmount += pillConfig.strength * component.quantity;
            commonUnit = commonUnit || pillConfig.unit;
          }
        }

        return commonUnit ? { amount: totalAmount, unit: commonUnit } : null;
      },

      updatePillInventory: (medicationId, inventoryUpdates) => {
        set((state) => ({
          medications: state.medications.map((med) => {
            if (med.id === medicationId) {
              const currentInventory = med.pillInventory || [];
              const updatedInventory = [...currentInventory];

              inventoryUpdates.forEach((update) => {
                const existingIndex = updatedInventory.findIndex(
                  (item) => item.pillConfigurationId === update.pillConfigurationId
                );

                if (existingIndex >= 0) {
                  // Update existing inventory item
                  const currentItem = updatedInventory[existingIndex];
                  const newCount = update.currentCount !== undefined 
                    ? currentItem.currentCount + update.currentCount
                    : currentItem.currentCount;

                  updatedInventory[existingIndex] = {
                    ...currentItem,
                    ...update,
                    currentCount: Math.max(0, newCount), // Ensure count never goes below 0
                    lastUpdated: new Date(),
                  };
                } else if (update.currentCount !== undefined && update.currentCount > 0) {
                  // Only add new inventory items if they have a positive count
                  updatedInventory.push({
                    pillConfigurationId: update.pillConfigurationId!,
                    currentCount: Math.max(0, update.currentCount),
                    lastUpdated: new Date(),
                    ...update,
                  } as PillInventoryItem);
                }
              });

              // Clean up inventory items with 0 count after some time
              const cleanedInventory = updatedInventory.filter(item => 
                item.currentCount > 0 || 
                (new Date().getTime() - new Date(item.lastUpdated).getTime() < 24 * 60 * 60 * 1000) // Keep 0 count items for 24 hours
              );

              return {
                ...med,
                pillInventory: cleanedInventory,
                updatedAt: new Date(),
              };
            }
            return med;
          }),
        }));
      },

      // Enhanced Side Effect Reporting
      addSideEffectReport: (medicationId: string, report: Omit<SideEffectReport, 'id' | 'medicationId' | 'timestamp'>) => {
        set((state) => ({
          medications: state.medications.map((med) =>
            med.id === medicationId
              ? {
                  ...med,
                  sideEffectReports: [
                    ...(med.sideEffectReports || []),
                    {
                      ...report,
                      id: generateId(),
                      medicationId,
                      timestamp: new Date()
                    } as SideEffectReport
                  ],
                  enhancedMonitoring: true
                }
              : med
          ),
        }));
      },

      updateSideEffectReport: (medicationId: string, reportId: string, updates: Partial<SideEffectReport>) => {
        set((state) => ({
          medications: state.medications.map((med) =>
            med.id === medicationId
              ? {
                  ...med,
                  sideEffectReports: med.sideEffectReports?.map((report) =>
                    report.id === reportId ? { ...report, ...updates } : report
                  )
                }
              : med
          ),
        }));
      },

      // Dependence Prevention System
      initializeDependencePrevention: (medicationId: string) => {
        const medication = get().medications.find(med => med.id === medicationId);
        if (!medication) return;

        const prevention = DependencePreventionService.initializePrevention(medication);
        
        set((state) => ({
          medications: state.medications.map((med) =>
            med.id === medicationId
              ? { ...med, dependencePrevention: prevention, enhancedMonitoring: true }
              : med
          ),
        }));
      },

      updateDependenceAssessment: (medicationId: string) => {
        const state = get();
        const medication = state.medications.find(med => med.id === medicationId);
        if (!medication || !medication.dependencePrevention) return;

        // Get usage patterns from medication logs
        const usagePatterns: UsagePattern[] = state.logs
          .filter(log => log.medicationId === medicationId)
          .slice(-30) // Last 30 entries
          .map(log => ({
            date: new Date(log.timestamp),
            doseTaken: parseFloat(log.dosageTaken || medication.dosage),
            prescribedDose: parseFloat(medication.dosage),
            selfAdjustment: false, // Would need to track this separately
            timesBetweenDoses: 24 / (medication.timesPerDay || 1), // Estimate
            effectivenessRating: 7 // Default, would need user input
          }));

        const updatedPrevention = DependencePreventionService.assessCurrentRisk(medication, usagePatterns);
        
        set((state) => ({
          medications: state.medications.map((med) =>
            med.id === medicationId
              ? { ...med, dependencePrevention: updatedPrevention }
              : med
          ),
        }));
      },

      recordUsagePattern: (medicationId: string, pattern: Omit<UsagePattern, 'date'>) => {
        set((state) => ({
          medications: state.medications.map((med) =>
            med.id === medicationId && med.dependencePrevention
              ? {
                  ...med,
                  dependencePrevention: {
                    ...med.dependencePrevention,
                    usagePatterns: [
                      ...med.dependencePrevention.usagePatterns,
                      { ...pattern, date: new Date() }
                    ].slice(-50) // Keep last 50 patterns
                  }
                }
              : med
          ),
        }));

        // Trigger reassessment
        get().updateDependenceAssessment(medicationId);
      },

      acknowledgeDependenceAlert: (medicationId: string, alertId: string, actionTaken?: string) => {
        set((state) => ({
          medications: state.medications.map((med) =>
            med.id === medicationId && med.dependencePrevention
              ? {
                  ...med,
                  dependencePrevention: {
                    ...med.dependencePrevention,
                    alerts: med.dependencePrevention.alerts.map((alert) =>
                      alert.id === alertId
                        ? { ...alert, acknowledged: true, actionTaken }
                        : alert
                    )
                  }
                }
              : med
          ),
        }));
      },

      addDependenceIntervention: (medicationId: string, intervention: Omit<DependenceIntervention, 'id' | 'timestamp'>) => {
        set((state) => ({
          medications: state.medications.map((med) =>
            med.id === medicationId && med.dependencePrevention
              ? {
                  ...med,
                  dependencePrevention: {
                    ...med.dependencePrevention,
                    interventions: [
                      ...med.dependencePrevention.interventions,
                      {
                        ...intervention,
                        id: generateId(),
                        timestamp: new Date()
                      }
                    ]
                  }
                }
              : med
          ),
        }));
      },

      updateDoctorReview: (medicationId: string, reviewDate: Date) => {
        set((state) => ({
          medications: state.medications.map((med) =>
            med.id === medicationId && med.dependencePrevention
              ? {
                  ...med,
                  dependencePrevention: {
                    ...med.dependencePrevention,
                    lastDoctorReview: reviewDate,
                    doctorReviewRequired: false
                  }
                }
              : med
          ),
        }));
      },

      // Get dependence insights and recommendations
      getDependenceInsights: (medicationId: string) => {
        const medication = get().medications.find(med => med.id === medicationId);
        if (!medication) return null;

        return DependencePreventionService.generateTaperingRecommendation(medication);
      },

      enableMultiplePills: (medicationId) => {
        set((state) => ({
          medications: state.medications.map((med) => {
            if (med.id !== medicationId) return med;

            // Create pill configurations if they don't exist
            const pillConfigs = med.pillConfigurations || [
              {
                id: generateId(),
                strength: parseFloat(med.dosage) || 1,
                unit: med.unit,
                isActive: true,
                color: med.color,
                shape: 'round',
                markings: ''
              },
            ];

            // Create dose configurations with proper pillComponents linking
            const doseConfigs = med.doseConfigurations || [
              {
                id: generateId(),
                name: 'Default Dose',
                description: `Standard dose of ${med.dosage} ${med.unit}`,
                pillComponents: [
                  {
                    pillConfigurationId: pillConfigs[0].id,
                    quantity: 1 // Adjust based on how many pills make up the dose
                  }
                ],
                totalDoseAmount: parseFloat(med.dosage) || 1,
                totalDoseUnit: med.unit,
                isDefault: true
              }
            ];

            // Create initial pill inventory if it doesn't exist
            const pillInventory = med.pillInventory || pillConfigs.map(config => ({
              pillConfigurationId: config.id,
              currentCount: med.pillsRemaining || 30, // Use existing pills remaining or default to 30
              lastUpdated: new Date()
            }));

            return {
              ...med,
              useMultiplePills: true,
              pillConfigurations: pillConfigs,
              doseConfigurations: doseConfigs,
              defaultDoseConfigurationId: doseConfigs[0].id,
              pillInventory: pillInventory,
              updatedAt: new Date(),
            };
          }),
        }));
      },
    }),
    {
      name: 'meditrax-storage',
      storage: createJSONStorage(() => localStorage),
      version: 1,
      onRehydrateStorage: () => (state) => {
        if (state?.medications) {
          // Deserialize dates in medications
          state.medications = state.medications.map((med: any) => ({
            ...med,
            // Deserialize basic dates
            createdAt: typeof med.createdAt === 'string' ? new Date(med.createdAt) : med.createdAt,
            updatedAt: typeof med.updatedAt === 'string' ? new Date(med.updatedAt) : med.updatedAt,
            // Deserialize tapering dates
            tapering: deserializeTaperingDates(med.tapering),
            // Deserialize cyclic dosing dates if they exist
            cyclicDosing: med.cyclicDosing ? {
              ...med.cyclicDosing,
              startDate: typeof med.cyclicDosing.startDate === 'string' ? new Date(med.cyclicDosing.startDate) : med.cyclicDosing.startDate
            } : med.cyclicDosing
          }));
        }
        
        if (state?.logs) {
          // Deserialize dates in medication logs
          state.logs = state.logs.map((log: any) => ({
            ...log,
            timestamp: typeof log.timestamp === 'string' ? new Date(log.timestamp) : log.timestamp,
            dateCreated: typeof log.dateCreated === 'string' ? new Date(log.dateCreated) : log.dateCreated
          }));
        }
        
        if (state?.reminders) {
          // Deserialize dates in reminders
          state.reminders = state.reminders.map((reminder: any) => ({
            ...reminder,
            createdAt: typeof reminder.createdAt === 'string' ? new Date(reminder.createdAt) : reminder.createdAt
          }));
        }
        
        if (state?.userProfile) {
          // Deserialize user profile dates
          state.userProfile = {
            ...state.userProfile,
            createdAt: typeof state.userProfile.createdAt === 'string' ? new Date(state.userProfile.createdAt) : state.userProfile.createdAt,
            updatedAt: typeof state.userProfile.updatedAt === 'string' ? new Date(state.userProfile.updatedAt) : state.userProfile.updatedAt
          };
        }
      }
    }
  )
);
