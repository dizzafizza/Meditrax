import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, isToday as isDateToday, isSameDay as isDateSame, formatDistanceToNow } from 'date-fns';

/**
 * Utility function to merge Tailwind CSS classes
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Generate a unique ID with collision prevention
 */
let idCounter = 0;
let lastTimestamp = 0;

export function generateId(): string {
  const timestamp = Date.now();
  
  // If same timestamp, increment counter
  if (timestamp === lastTimestamp) {
    idCounter = (idCounter + 1) % 100000;
  } else {
    idCounter = 0;
    lastTimestamp = timestamp;
  }
  
  // Add process/session identifier for additional uniqueness
  const sessionId = typeof window !== 'undefined' 
    ? window.performance?.now().toString(36).substr(2, 4) || 'xxxx'
    : 'node';
    
  return `${timestamp}-${idCounter.toString().padStart(5, '0')}-${sessionId}-${Math.random().toString(36).substr(2, 6)}`;
}

/**
 * Generate a React key with additional context to prevent collisions
 */
export function generateReactKey(prefix: string = 'item', index?: number, id?: string): string {
  const baseKey = id || generateId();
  const indexPart = typeof index === 'number' ? `-${index}` : '';
  return `${prefix}-${baseKey}${indexPart}`;
}

/**
 * Check if a date is today
 */
export function isToday(date: Date): boolean {
  return isDateToday(date);
}

/**
 * Check if two dates are the same day
 */
export function isSameDay(date1: Date, date2: Date): boolean {
  return isDateSame(date1, date2);
}

/**
 * Format a date for display
 */
export function formatDate(date: Date | string | number | undefined | null, formatString = 'MMM dd, yyyy'): string {
  if (!date) return 'N/A';
  
  const dateObj = date instanceof Date ? date : new Date(date);
  
  // Check if the date is valid
  if (isNaN(dateObj.getTime())) {
    return 'Invalid Date';
  }
  
  return format(dateObj, formatString);
}

/**
 * Format a time for display
 */
export function formatTime(date: Date | string | number | undefined | null, use24Hour = false): string {
  if (!date) return 'N/A';
  
  const dateObj = date instanceof Date ? date : new Date(date);
  
  // Check if the date is valid
  if (isNaN(dateObj.getTime())) {
    return 'Invalid Time';
  }
  
  return format(dateObj, use24Hour ? 'HH:mm' : 'h:mm a');
}

/**
 * Get relative time (e.g., "2 hours ago")
 */
export function getRelativeTime(date: Date): string {
  return formatDistanceToNow(date, { addSuffix: true });
}

/**
 * Convert time string (HH:MM) to Date object for today
 */
export function timeStringToDate(timeString: string): Date {
  const [hours, minutes] = timeString.split(':').map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date;
}

/**
 * Convert Date object to time string (HH:MM)
 */
export function dateToTimeString(date: Date): string {
  return format(date, 'HH:mm');
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate phone number format
 */
export function isValidPhone(phone: string): boolean {
  const phoneRegex = /^\+?[\d\s\-()]{10,}$/;
  return phoneRegex.test(phone);
}

/**
 * Capitalize first letter of each word
 */
export function capitalizeWords(str: string): string {
  return str.replace(/\b\w/g, (char) => char.toUpperCase());
}

/**
 * Truncate text to specified length
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + '...';
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
}

/**
 * Throttle function
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let lastCall = 0;
  return (...args: Parameters<T>) => {
    const now = Date.now();
    if (now - lastCall >= limit) {
      lastCall = now;
      func(...args);
    }
  };
}

/**
 * Deep clone an object
 */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj.getTime()) as unknown as T;
  if (Array.isArray(obj)) return obj.map(deepClone) as unknown as T;
  
  const cloned = {} as T;
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      cloned[key] = deepClone(obj[key]);
    }
  }
  return cloned;
}

/**
 * Check if object is empty
 */
export function isEmpty(obj: any): boolean {
  if (obj == null) return true;
  if (Array.isArray(obj) || typeof obj === 'string') return obj.length === 0;
  if (typeof obj === 'object') return Object.keys(obj).length === 0;
  return false;
}

/**
 * Generate a random color for medications
 */
export function generateRandomColor(): string {
  const colors = [
    '#3b82f6', // blue
    '#ef4444', // red
    '#10b981', // emerald
    '#f59e0b', // amber
    '#8b5cf6', // violet
    '#ec4899', // pink
    '#06b6d4', // cyan
    '#84cc16', // lime
    '#f97316', // orange
    '#6366f1', // indigo
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

/**
 * Calculate adherence percentage
 */
export function calculateAdherence(taken: number, total: number): number {
  if (total === 0 || isNaN(taken) || isNaN(total)) return 0;
  const percentage = Math.round((taken / total) * 100);
  return isNaN(percentage) ? 0 : percentage;
}

/**
 * Get adherence status color
 */
export function getAdherenceColor(percentage: number): string {
  if (percentage >= 90) return 'text-green-600';
  if (percentage >= 75) return 'text-yellow-600';
  if (percentage >= 50) return 'text-orange-600';
  return 'text-red-600';
}

/**
 * Format medication dosage for display
 */
export function formatDosage(dosage: string, unit: string): string {
  return `${dosage} ${unit}`;
}

// NEW: Multiple Pills Display Functions
export function formatPillDisplay(medication: any): string {
  if (!medication.useMultiplePills || !medication.pillConfigurations || !medication.doseConfigurations) {
    return `${medication.dosage} ${medication.unit}`;
  }

  const defaultDoseConfig = medication.doseConfigurations?.find(
    (config: any) => config.id === medication.defaultDoseConfigurationId
  ) || medication.doseConfigurations?.[0];

  if (!defaultDoseConfig) {
    return `${medication.dosage} ${medication.unit}`;
  }

  const pillDescriptions = defaultDoseConfig.pillComponents.map((component: any) => {
    const pillConfig = medication.pillConfigurations.find(
      (config: any) => config.id === component.pillConfigurationId
    );
    if (!pillConfig) return '';
    
    const quantity = component.quantity;
    const strength = pillConfig.strength;
    const unit = pillConfig.unit;
    const color = pillConfig.color;
    
    const inventoryUnit = medication.inventoryUnit || 'pill';
    if (quantity === 1) {
      return `1 × ${strength}${unit}${color ? ` ${color}` : ''} ${inventoryUnit}`;
    } else if (quantity % 1 === 0) {
      return `${quantity} × ${strength}${unit}${color ? ` ${color}` : ''} ${inventoryUnit}s`;
    } else {
      return `${quantity} × ${strength}${unit}${color ? ` ${color}` : ''} ${inventoryUnit}`;
    }
  }).filter(Boolean);

  if (pillDescriptions.length === 0) {
    return `${medication.dosage} ${medication.unit}`;
  }

  const totalDose = defaultDoseConfig.totalDoseAmount;
  const totalUnit = defaultDoseConfig.totalDoseUnit;
  
  if (pillDescriptions.length === 1) {
    return `${pillDescriptions[0]} (${totalDose}${totalUnit} total)`;
  } else {
    return `${pillDescriptions.join(' + ')} (${totalDose}${totalUnit} total)`;
  }
}

export function formatPillDisplayShort(medication: any): string {
  if (!medication.useMultiplePills || !medication.pillConfigurations || !medication.doseConfigurations) {
    return `${medication.dosage} ${medication.unit}`;
  }

  const defaultDoseConfig = medication.doseConfigurations?.find(
    (config: any) => config.id === medication.defaultDoseConfigurationId
  ) || medication.doseConfigurations?.[0];

  if (!defaultDoseConfig) {
    return `${medication.dosage} ${medication.unit}`;
  }

  const totalPills = defaultDoseConfig.pillComponents.reduce(
    (sum: number, component: any) => sum + component.quantity, 0
  );
  
  if (totalPills === 1) {
    return `1 pill (${defaultDoseConfig.totalDoseAmount}${defaultDoseConfig.totalDoseUnit})`;
  } else if (totalPills % 1 === 0) {
    return `${totalPills} pills (${defaultDoseConfig.totalDoseAmount}${defaultDoseConfig.totalDoseUnit})`;
  } else {
    return `${totalPills} pills (${defaultDoseConfig.totalDoseAmount}${defaultDoseConfig.totalDoseUnit})`;
  }
}

export function getPillComponents(medication: any): any[] {
  if (!medication.useMultiplePills || !medication.pillConfigurations || !medication.doseConfigurations) {
    return [];
  }

  const defaultDoseConfig = medication.doseConfigurations?.find(
    (config: any) => config.id === medication.defaultDoseConfigurationId
  ) || medication.doseConfigurations?.[0];

  if (!defaultDoseConfig) return [];

  return defaultDoseConfig.pillComponents.map((component: any) => {
    const pillConfig = medication.pillConfigurations.find(
      (config: any) => config.id === component.pillConfigurationId
    );
    return {
      ...component,
      pillConfig,
      displayText: pillConfig ? 
        `${component.quantity} × ${pillConfig.strength}${pillConfig.unit}${pillConfig.color ? ` ${pillConfig.color}` : ''}` :
        'Unknown pill'
    };
  }).filter((comp: any) => comp.pillConfig);
}

/**
 * Parse frequency to human readable format
 */
export function formatFrequency(frequency: string): string {
  const frequencyMap: Record<string, string> = {
    'as-needed': 'As needed',
    'once-daily': 'Once daily',
    'twice-daily': 'Twice daily',
    'three-times-daily': '3 times daily',
    'four-times-daily': '4 times daily',
    'every-other-day': 'Every other day',
    'weekly': 'Weekly',
    'monthly': 'Monthly',
    'custom': 'Custom schedule',
  };
  return frequencyMap[frequency] || frequency;
}

/**
 * Sort medications by name
 */
export function sortMedicationsByName<T extends { name: string }>(medications: T[]): T[] {
  return [...medications].sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Filter medications by search term
 */
export function filterMedicationsBySearch<T extends { name: string }>(
  medications: T[],
  searchTerm: string
): T[] {
  if (!searchTerm.trim()) return medications;
  
  const term = searchTerm.toLowerCase();
  return medications.filter((med) =>
    med.name.toLowerCase().includes(term)
  );
}

/**
 * Local storage helpers
 */
export const storage = {
  get<T>(key: string, defaultValue: T): T {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch {
      return defaultValue;
    }
  },

  set<T>(key: string, value: T): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error('Failed to save to localStorage:', error);
    }
  },

  remove(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error('Failed to remove from localStorage:', error);
    }
  },

  clear(): void {
    try {
      localStorage.clear();
    } catch (error) {
      console.error('Failed to clear localStorage:', error);
    }
  },
};

/**
 * Notification helpers
 */
export const notifications = {
  async requestPermission(): Promise<boolean> {
    if (!('Notification' in window)) {
      console.warn('This browser does not support notifications');
      return false;
    }

    if (Notification.permission === 'granted') {
      return true;
    }

    if (Notification.permission === 'denied') {
      return false;
    }

    const permission = await Notification.requestPermission();
    return permission === 'granted';
  },

  show(title: string, options: NotificationOptions = {}): Notification | null {
    if (Notification.permission !== 'granted') {
      return null;
    }

    return new Notification(title, {
      icon: '/pill-icon.svg',
      badge: '/pill-icon.svg',
      ...options,
    });
  },
};

/**
 * File download helper
 */
export function downloadFile(data: string, filename: string, type = 'text/plain'): void {
  const blob = new Blob([data], { type });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Generate CSV from array of objects
 */
export function generateCSV<T extends Record<string, any>>(data: T[], headers?: string[]): string {
  if (data.length === 0) return '';

  const keys = headers || Object.keys(data[0]);
  const csvHeaders = keys.join(',');
  
  const csvRows = data.map((row) =>
    keys.map((key) => {
      const value = row[key];
      // Escape quotes and wrap in quotes if contains comma or quotes
      if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    }).join(',')
  );

  return [csvHeaders, ...csvRows].join('\n');
}

// Advanced Features - Risk Assessment
export function getRiskLevel(category: string): 'minimal' | 'low' | 'moderate' | 'high' {
  const riskMapping: Record<string, 'minimal' | 'low' | 'moderate' | 'high'> = {
    'opioid': 'high',
    'benzodiazepine': 'high',
    'stimulant': 'high',
    'dissociative': 'high',
    'alcohol': 'high',
    'sleep-aid': 'moderate',
    'muscle-relaxant': 'moderate',
    'antidepressant': 'low',
    'anticonvulsant': 'low',
    'antipsychotic': 'moderate',
    'low-risk': 'minimal'
  };
  
  return riskMapping[category] || 'low';
}

export function getDependencyRiskCategory(medicationName: string): string {
  const name = medicationName.toLowerCase();
  
  // Opioids
  if (name.includes('oxycodone') || name.includes('morphine') || name.includes('fentanyl') || 
      name.includes('hydrocodone') || name.includes('codeine') || name.includes('tramadol') ||
      name.includes('kratom')) {
    return 'opioid';
  }
  
  // Benzodiazepines and GABA drugs
  if (name.includes('alprazolam') || name.includes('lorazepam') || name.includes('diazepam') || 
      name.includes('clonazepam') || name.includes('xanax') || name.includes('valium') ||
      name.includes('ativan') || name.includes('klonopin') || name.includes('phenibut') ||
      name.includes('ghb')) {
    return 'benzodiazepine';
  }
  
  // Stimulants
  if (name.includes('adderall') || name.includes('ritalin') || name.includes('concerta') || 
      name.includes('vyvanse') || name.includes('amphetamine') || name.includes('methylphenidate') ||
      name.includes('modafinil') || name.includes('cocaine') || name.includes('methamphetamine') ||
      name.includes('crystal meth') || name.includes('mdma') || name.includes('ecstasy')) {
    return 'stimulant';
  }
  
  // Dissociatives
  if (name.includes('ketamine') || name.includes('dmt') || name.includes('nitrous oxide') ||
      name.includes('n2o') || name.includes('pcp')) {
    return 'dissociative';
  }
  
  // Alcohol
  if (name.includes('alcohol') || name.includes('ethanol') || name.includes('beer') ||
      name.includes('wine') || name.includes('vodka') || name.includes('whiskey')) {
    return 'alcohol';
  }
  
  // Sleep aids
  if (name.includes('zolpidem') || name.includes('ambien') || name.includes('lunesta') || 
      name.includes('sonata') || name.includes('eszopiclone')) {
    return 'sleep-aid';
  }
  
  // Muscle relaxants
  if (name.includes('cyclobenzaprine') || name.includes('flexeril') || name.includes('baclofen') || 
      name.includes('tizanidine')) {
    return 'muscle-relaxant';
  }
  
  // Antidepressants
  if (name.includes('sertraline') || name.includes('fluoxetine') || name.includes('escitalopram') ||
      name.includes('venlafaxine') || name.includes('duloxetine') || name.includes('paroxetine') ||
      name.includes('bupropion') || name.includes('mirtazapine') || name.includes('zoloft') ||
      name.includes('prozac') || name.includes('lexapro') || name.includes('effexor') ||
      name.includes('cymbalta') || name.includes('paxil') || name.includes('wellbutrin') ||
      name.includes('remeron')) {
    return 'antidepressant';
  }
  
  // Anticonvulsants
  if (name.includes('gabapentin') || name.includes('pregabalin') || name.includes('neurontin') ||
      name.includes('lyrica')) {
    return 'anticonvulsant';
  }
  
  // Antipsychotics
  if (name.includes('quetiapine') || name.includes('seroquel') || name.includes('olanzapine') ||
      name.includes('risperidone') || name.includes('aripiprazole') || name.includes('haloperidol')) {
    return 'antipsychotic';
  }
  
  return 'low-risk';
}

// Cyclic Dosing Calculations
export function calculateCyclicDose(
  baseDose: number,
  cyclicPattern: any,
  currentDate: Date
): { dose: number; phase: string; message?: string } {
  if (!cyclicPattern?.pattern) {
    return { dose: baseDose, phase: 'maintenance' };
  }
  
  const startDate = new Date(cyclicPattern.startDate);
  const daysDiff = Math.floor((currentDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  
  let totalCycleDuration = 0;
  cyclicPattern.pattern.forEach((cycle: any) => {
    totalCycleDuration += cycle.duration;
  });
  
  if (totalCycleDuration === 0) {
    return { dose: baseDose, phase: 'maintenance' };
  }
  
  const cyclePosition = daysDiff % totalCycleDuration;
  let currentDay = 0;
  
  for (const cycle of cyclicPattern.pattern) {
    if (cyclePosition >= currentDay && cyclePosition < currentDay + cycle.duration) {
      return {
        dose: baseDose * cycle.dosageMultiplier,
        phase: cycle.phase,
        message: cycle.customMessage
      };
    }
    currentDay += cycle.duration;
  }
  
  return { dose: baseDose, phase: 'maintenance' };
}

export function calculateTaperingDose(
  taperingSchedule: any,
  currentDate: Date,
  medication?: any
): number {
  if (!taperingSchedule || !taperingSchedule.initialDose) return 0;
  
  const finalizeDose = (dose: number): number => {
    const safeDose = Math.max(0, isFinite(dose) ? dose : 0);
    const roundedDose = Math.round(safeDose * 1000) / 1000;
    if (roundedDose === 0) return 0;
    // For tapering, don't adjust dose for pill combinations
    // The exact tapered dose should be maintained, pill breakdown is calculated separately
    return roundedDose;
  };
  
  // Check if tapering is paused or has an active break
  if (taperingSchedule.isPaused) {
    // Handle different types of breaks
    if (taperingSchedule.currentBreak && taperingSchedule.currentBreak.isActive) {
      const currentBreak = taperingSchedule.currentBreak;
      
      // For all break types, maintain the dose at break initiation
      // This ensures stability during the break period
      return finalizeDose(currentBreak.doseAtBreak);
    } else {
      // Legacy pause handling - return dose from when paused
      const pausedDate = taperingSchedule.pausedAt ? new Date(taperingSchedule.pausedAt) : currentDate;
      return calculateTaperingDose({ ...taperingSchedule, isPaused: false }, pausedDate, medication);
    }
  }
  
  const startDate = new Date(taperingSchedule.startDate);
  const endDate = new Date(taperingSchedule.endDate);
  const daysDiff = Math.floor((currentDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  const totalDays = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  
  if (daysDiff < 0) return finalizeDose(taperingSchedule.initialDose);
  if (daysDiff >= totalDays) return finalizeDose(taperingSchedule.finalDose);
  
  // Use custom steps if available (for hyperbolic and other advanced methods)
  if (taperingSchedule.customSteps && taperingSchedule.customSteps.length > 0) {
    // Sort steps by day to ensure proper ordering
    const sortedSteps = [...taperingSchedule.customSteps].sort((a: any, b: any) => a.day - b.day);
    
    // Find the appropriate step for the current day
    let applicableStep = null;
    for (let i = 0; i < sortedSteps.length; i++) {
      if (sortedSteps[i].day <= daysDiff) {
        applicableStep = sortedSteps[i];
      } else {
        break; // We've passed the current day
      }
    }
    
    if (applicableStep) {
      const calculatedDose = taperingSchedule.initialDose * applicableStep.dosageMultiplier;
      return finalizeDose(calculatedDose);
    }
    
    // If we have custom steps but no applicable step yet (day 0 or before first step), return initial dose
    return finalizeDose(taperingSchedule.initialDose);
  }
  
  if (taperingSchedule.taperingMethod === 'linear') {
    const daysBetween = taperingSchedule.daysBetweenReductions || 7;
    const stepNumber = Math.floor(daysDiff / daysBetween);
    const totalSteps = Math.floor(totalDays / daysBetween);
    
    if (stepNumber >= totalSteps) {
      return finalizeDose(0);
    }
    
    // Calculate safe step reduction with safety limits (same as plan generation)
    let stepReduction = taperingSchedule.initialDose / totalSteps;
    const maxReductionPerStep = taperingSchedule.initialDose * 0.25; // Never reduce more than 25% per step
    const minReductionPerStep = taperingSchedule.initialDose * 0.05; // Never reduce less than 5% per step
    stepReduction = Math.min(maxReductionPerStep, Math.max(minReductionPerStep, stepReduction));
    
    const currentDose = taperingSchedule.initialDose - (stepReduction * stepNumber);
    
    return finalizeDose(Math.max(0, currentDose));
  }
  
  if (taperingSchedule.taperingMethod === 'exponential') {
    const daysBetween = taperingSchedule.daysBetweenReductions || 7;
    const stepNumber = Math.floor(daysDiff / daysBetween);
    const totalSteps = Math.floor(totalDays / daysBetween);
    
    if (stepNumber >= totalSteps) {
      return finalizeDose(0);
    }
    
    // Calculate safe max reduction based on number of steps (same as plan generation)
    let maxReduction, minReduction;
    if (totalSteps <= 5) {
      maxReduction = 0.4; // 40% max for very short tapers
      minReduction = 0.1; // 10% min
    } else if (totalSteps <= 10) {
      maxReduction = 0.3; // 30% max for medium tapers
      minReduction = 0.08; // 8% min
    } else if (totalSteps <= 15) {
      maxReduction = 0.25; // 25% max for longer tapers
      minReduction = 0.06; // 6% min
    } else {
      maxReduction = 0.2; // 20% max for very long tapers
      minReduction = 0.05; // 5% min
    }
    
    // Calculate dose by applying exponential reductions step by step
    let currentDose = taperingSchedule.initialDose;
    
    for (let step = 1; step <= stepNumber; step++) {
      const stepProgress = (step - 1) / (totalSteps - 1); // 0 to 1
      const reductionPercent = maxReduction * Math.pow(1 - stepProgress, 2) + minReduction;
      currentDose = currentDose * (1 - reductionPercent);
    }
    
    return finalizeDose(Math.max(0, currentDose));
  }
  
  if (taperingSchedule.taperingMethod === 'hyperbolic') {
    const daysBetween = taperingSchedule.daysBetweenReductions || 7;
    const stepNumber = Math.floor(daysDiff / daysBetween);
    const totalSteps = Math.floor(totalDays / daysBetween);
    
    if (stepNumber >= totalSteps) {
      return finalizeDose(0);
    }
    
    // Calculate the reduction percentage needed to get close to zero
    const targetRemainingPercent = 0.01; // 1% of original
    const reductionPercent = totalSteps > 1 ? 1 - Math.pow(targetRemainingPercent, 1 / (totalSteps - 1)) : 0.5;
    
    const currentDose = taperingSchedule.initialDose * Math.pow(1 - reductionPercent, stepNumber);
    
    return finalizeDose(Math.max(0, currentDose));
  }
  
  // Note: Custom steps are handled at the top of this function
  
  // Default to linear tapering if no method specified or method not recognized
  const progress = daysDiff / totalDays;
  const taperedDose = taperingSchedule.initialDose + 
                     (taperingSchedule.finalDose - taperingSchedule.initialDose) * progress;
  return finalizeDose(taperedDose);
}

// Helper function to adjust tapered dose to available pill combinations for multiple pills
export function adjustDoseForMultiplePills(targetDose: number, medication: any): number {
  if (!medication?.pillConfigurations) return targetDose;
  
  // Find the best combination of available pills to get closest to target dose
  const availablePills = medication.pillConfigurations.filter((config: any) => config.isActive);
  
  let bestCombination = targetDose;
  let minDifference = Infinity;
  
  // Try different combinations of pills (simple approach: use largest pills first)
  availablePills.sort((a: any, b: any) => b.strength - a.strength);
  
  for (let i = 0; i < availablePills.length; i++) {
    const pill = availablePills[i];
    const wholePills = Math.floor(targetDose / pill.strength);
    const halfPills = targetDose >= pill.strength * (wholePills + 0.5) ? 0.5 : 0;
    
    const achievableDose = pill.strength * (wholePills + halfPills);
    const difference = Math.abs(targetDose - achievableDose);
    
    if (difference < minDifference && achievableDose <= targetDose * 1.1) { // Allow 10% overshoot
      minDifference = difference;
      bestCombination = achievableDose;
    }
  }
  
  return bestCombination;
}

// Enhanced tapering functions for multiple pills
// Calculate optimal pill reduction for tapering with multiple pill configurations
export function calculateOptimalPillReduction(
  currentPillCounts: Record<string, number>,
  reductionPercent: number,
  medication: any
): { newPillCounts: Record<string, number>; actualReduction: number } {
  if (!medication?.pillConfigurations) {
    return { newPillCounts: {}, actualReduction: 0 };
  }

  // Calculate current total dose
  const currentTotalDose = Object.entries(currentPillCounts).reduce((total, [pillId, count]) => {
    const pillConfig = medication.pillConfigurations.find((config: any) => config.id === pillId);
    return total + (pillConfig ? pillConfig.strength * count : 0);
  }, 0);

  // Calculate target dose after reduction
  const targetDose = currentTotalDose * (1 - reductionPercent / 100);

  // Use existing function to calculate optimal pill combination for target dose
  const newPillCounts = calculatePillCountsForDose(targetDose, medication);

  // Calculate actual reduction achieved
  const newTotalDose = Object.entries(newPillCounts).reduce((total, [pillId, count]) => {
    const pillConfig = medication.pillConfigurations.find((config: any) => config.id === pillId);
    return total + (pillConfig ? pillConfig.strength * count : 0);
  }, 0);

  const actualReduction = currentTotalDose > 0 ? 
    ((currentTotalDose - newTotalDose) / currentTotalDose) * 100 : 0;
  return { newPillCounts, actualReduction };
}

export function calculatePillCountsForDose(targetDose: number, medication: any): Record<string, number> {
  if (!medication?.pillConfigurations) return {};
  
  const availablePills = medication.pillConfigurations
    .filter((config: any) => config.isActive)
    .sort((a: any, b: any) => b.strength - a.strength); // Largest pills first
  
  const pillCounts: Record<string, number> = {};
  let remainingDose = targetDose;
  
  // Initialize all pill counts to 0
  availablePills.forEach((pill: any) => {
    pillCounts[pill.id] = 0;
  });
  
  // Use greedy algorithm: largest pills first
  for (const pill of availablePills) {
    if (remainingDose <= 0) break;
    
    const wholePills = Math.floor(remainingDose / pill.strength);
    if (wholePills > 0) {
      pillCounts[pill.id] += wholePills;
      remainingDose -= wholePills * pill.strength;
    }
    
    // Check if we can use a half pill (if remaining dose is significant)
    if (remainingDose >= pill.strength * 0.4) { // Use half if remaining is at least 40% of pill strength
      pillCounts[pill.id] += 0.5;
      remainingDose -= pill.strength * 0.5;
    }
  }
  
  return pillCounts;
}

// Format pill counts for tapering display showing which pills to take
export function formatPillCountsForTapering(pillCounts: Record<string, number>, medication: any): string {
  if (!medication?.pillConfigurations) return '';
  
  const parts: string[] = [];
  
  Object.entries(pillCounts).forEach(([pillId, count]) => {
    if (count > 0) {
      const pillConfig = medication.pillConfigurations.find((config: any) => config.id === pillId);
      if (pillConfig) {
        const countDisplay = count === Math.floor(count) ? count.toString() : count.toString();
        parts.push(`${countDisplay}x ${pillConfig.strength}${pillConfig.unit} ${pillConfig.shape || 'pill'}${count > 1 ? 's' : ''}`);
      }
    }
  });
  
  return parts.join(' + ') || 'No pills needed';
}

// Calculate total dose from pill counts for multiple pill medications
export function calculateTotalDoseFromPillCounts(pillCounts: Record<string, number>, medication: any): number {
  if (!medication?.pillConfigurations) return 0;
  
  let totalDose = 0;
  Object.entries(pillCounts).forEach(([pillId, count]) => {
    const pillConfig = medication.pillConfigurations.find((config: any) => config.id === pillId);
    if (pillConfig) {
      totalDose += pillConfig.strength * count;
    }
  });
  
  return totalDose;
}

// Enhanced function to generate step-by-step tapering plan for multiple pills
export function generateMultiplePillTaperingSteps(
  medication: any,
  initialDose: number,
  finalDose: number,
  durationWeeks: number,
  method: 'linear' | 'exponential' | 'hyperbolic' = 'hyperbolic'
): Array<{
  week: number;
  day: number;
  targetDose: number;
  pillCounts: Record<string, number>;
  instructions: string;
  totalDose: number;
}> {
  if (!medication?.pillConfigurations) return [];
  
  const steps: Array<{
    week: number;
    day: number;
    targetDose: number;
    pillCounts: Record<string, number>;
    instructions: string;
    totalDose: number;
  }> = [];
  
  for (let week = 1; week <= durationWeeks; week++) {
    let targetDose: number;
    
    if (method === 'linear') {
      const progress = (week - 1) / (durationWeeks - 1);
      targetDose = initialDose + (finalDose - initialDose) * progress;
    } else if (method === 'exponential') {
      const progress = (week - 1) / (durationWeeks - 1);
      const exponentialProgress = 1 - Math.pow(1 - progress, 2);
      targetDose = initialDose + (finalDose - initialDose) * exponentialProgress;
    } else { // hyperbolic
      const reductionPercent = 10; // 10% reduction each step
      targetDose = week === 1 ? initialDose : steps[week - 2].targetDose * (1 - reductionPercent / 100);
      targetDose = Math.max(targetDose, finalDose);
    }
    
    const pillCounts = calculatePillCountsForDose(targetDose, medication);
    const actualDose = calculateTotalDoseFromPillCounts(pillCounts, medication);
    const instructions = formatPillCountsForTapering(pillCounts, medication);
    
    steps.push({
      week,
      day: week * 7,
      targetDose,
      pillCounts,
      instructions,
      totalDose: actualDose
    });
  }
  
  return steps;
}

// Enhanced Psychological Messaging with Cyclic Dosing and Tapering Support
export function generatePsychologicalMessage(
  type: 'adherence-reminder' | 'dependency-warning' | 'motivation' | 'celebration' | 'risk-alert' | 'cyclic-dosing' | 'tapering-support' | 'heavy-dose-warning' | 'dose-adjustment',
  medicationName: string,
  personalizedData?: Record<string, any>
): { title: string; message: string; approach: string } {
  const approaches = {
    'adherence-reminder': 'gentle-reminder',
    'dependency-warning': 'factual-warning',
    'motivation': 'positive-reinforcement',
    'celebration': 'positive-reinforcement',
    'risk-alert': 'empathetic-support',
    'cyclic-dosing': 'gentle-reminder',
    'tapering-support': 'empathetic-support',
    'heavy-dose-warning': 'factual-warning',
    'dose-adjustment': 'empathetic-support'
  };
  
  const messages = {
    'adherence-reminder': {
      title: 'Gentle Reminder',
      message: `Hi there! It's time for your ${medicationName}. Taking your medication consistently helps maintain your health and well-being. You've got this! 💪`
    },
    'dependency-warning': {
      title: 'Health Check-In',
      message: `We noticed some changes in your ${medicationName} usage pattern. It's important to stick to your prescribed schedule. If you're experiencing increased symptoms, please consult your healthcare provider rather than adjusting the dose yourself.`
    },
    'motivation': {
      title: 'You\'re Doing Great!',
      message: personalizedData?.adherenceStreak && personalizedData.adherenceStreak > 0
        ? `Your consistency with ${medicationName} is impressive! ${personalizedData.adherenceStreak} day streak! 🔥 Every dose you take as prescribed is an investment in your health. Keep up the excellent work! 🌟`
        : `Your consistency with ${medicationName} is impressive! Every dose you take as prescribed is an investment in your health. Keep up the excellent work! 🌟`
    },
    'celebration': {
      title: 'Milestone Achieved! 🎉',
      message: personalizedData?.overallStreak 
        ? `Congratulations! ${personalizedData.overallStreak} day streak! 🔥 You've completed all scheduled medications consistently. Your dedication to your health is inspiring and making a real difference!`
        : `Congratulations! You've maintained excellent adherence with ${medicationName} this week. Your dedication to your health is inspiring and making a real difference!`
    },
    'risk-alert': {
      title: 'Supportive Check-In',
      message: `We care about your well-being. If you're finding it challenging to stick to your ${medicationName} schedule, remember that this is normal and you're not alone. Consider reaching out to your healthcare provider for support.`
    },
    'cyclic-dosing': {
      title: 'Cyclic Dosing Update',
      message: `Your ${medicationName} is on a cyclic schedule. ${personalizedData?.cyclicPhase === 'off' ? 'Today is a break day - no dose needed.' : `Today's dose: ${personalizedData?.adjustedDose || 'as scheduled'}.`} This cycling helps maintain effectiveness and reduce tolerance. 🔄`
    },
    'tapering-support': {
      title: 'Tapering Progress',
      message: `You're doing great with your ${medicationName} tapering! ${personalizedData?.taperPhase ? `Currently in ${personalizedData.taperPhase} phase.` : ''} Remember, going slow is safe and reduces withdrawal symptoms. Your body is adapting well. 📉💪`
    },
    'heavy-dose-warning': {
      title: 'Dose Safety Check',
      message: `The amount of ${medicationName} you're taking (${personalizedData?.currentDose}) is considered a heavy dose according to safety guidelines. Please ensure you have proper supervision and consider harm reduction strategies. Your safety is our priority. ⚠️`
    },
    'dose-adjustment': {
      title: 'Dose Adjustment Notice',
      message: `${personalizedData?.adjustmentType === 'increase' ? 'You took more' : 'You took less'} ${medicationName} than your ${personalizedData?.scheduleType || 'prescribed'} dose. ${personalizedData?.adjustmentType === 'increase' ? 'Taking more than prescribed can increase risk - consider discussing with your healthcare provider.' : 'Taking less is okay, but try to maintain consistency when possible.'}`
    }
  };
  
  const baseMessage = messages[type];
  
  // Enhanced personalization
  if (personalizedData?.adherenceStreak && personalizedData.adherenceStreak > 0) {
    baseMessage.message += ` You're on a ${personalizedData.adherenceStreak}-day streak!`;
  }
  
  if (personalizedData?.cyclicMessage && type === 'cyclic-dosing') {
    baseMessage.message += ` Note: ${personalizedData.cyclicMessage}`;
  }
  
  if (personalizedData?.taperingProgress && type === 'tapering-support') {
    baseMessage.message += ` You've completed ${personalizedData.taperingProgress}% of your tapering schedule.`;
  }
  
  // Add encouragement for challenging phases
  if (personalizedData?.isWithdrawal && type === 'tapering-support') {
    baseMessage.message += ' If you\'re experiencing withdrawal symptoms, it\'s okay to pause or slow down. Listen to your body.';
  }
  
  return {
    ...baseMessage,
    approach: approaches[type]
  };
}

// Heavy Dose Detection based on Psychonaut Wiki standards
// Helper function to determine if a unit is weight/volume-based (continuous) or discrete (countable)
export function isWeightBasedUnit(unit: string): boolean {
  const weightVolumeUnits = [
    'mg', 'g', 'mcg', 'μg', 'ng', 'kg', 'lbs', 'oz', 'ounces', 'grams',
    'ml', 'L', 'fl oz', 'tsp', 'tbsp', 'cc',
    'iu', 'IU', 'units', 'mEq', 'mmol', '%',
    'mg THC', 'mg CBD', 'billion CFU', 'million CFU',
    'mg THC/CBD', 'g flower', 'g concentrate', 'g edible', 'mg/ml',
    'drops (tincture)', 'puffs (vape)', 'mL/hr', 'mcg/hr', 'mg/hr', 'units/hr',
    'g powder', 'mg powder', 'kg powder', 'oz powder', 'lbs powder'
  ];
  
  return weightVolumeUnits.includes(unit);
}

// Helper function to determine if units are compatible for inventory calculations
export function unitsAreCompatible(doseUnit: string, inventoryUnit: string): boolean {
  // If both are weight-based, they're compatible (we can convert between them)
  if (isWeightBasedUnit(doseUnit) && isWeightBasedUnit(inventoryUnit)) {
    return true;
  }
  
  // If both are discrete units, they're compatible
  if (!isWeightBasedUnit(doseUnit) && !isWeightBasedUnit(inventoryUnit)) {
    return true;
  }
  
  // If one is weight-based and one is discrete, they're not directly compatible
  return false;
}

// Convert weight units to a standard base unit (mg) for calculations
export function convertToBaseWeight(amount: number, unit: string): number {
  const conversions: Record<string, number> = {
    'ng': 0.000001,
    'mcg': 0.001,
    'μg': 0.001,
    'mg': 1,
    'g': 1000,
    'grams': 1000,
    'kg': 1000000,
    'oz': 28349.5,
    'ounces': 28349.5,
    'lbs': 453592,
    'g powder': 1000,
    'mg powder': 1,
    'kg powder': 1000000,
    'oz powder': 28349.5,
    'lbs powder': 453592
  };
  
  return amount * (conversions[unit] || 1);
}

// Convert from base weight (mg) to target unit
export function convertFromBaseWeight(amount: number, unit: string): number {
  const conversions: Record<string, number> = {
    'ng': 0.000001,
    'mcg': 0.001,
    'μg': 0.001,
    'mg': 1,
    'g': 1000,
    'grams': 1000,
    'kg': 1000000,
    'oz': 28349.5,
    'ounces': 28349.5,
    'lbs': 453592,
    'g powder': 1000,
    'mg powder': 1,
    'kg powder': 1000000,
    'oz powder': 28349.5,
    'lbs powder': 453592
  };
  
  return amount / (conversions[unit] || 1);
}

export function isHeavyDose(medicationName: string, dose: number, unit: string): boolean {
  const name = medicationName.toLowerCase();
  
  // Convert dose to standard units for comparison
  let standardDose = dose;
  if (unit === 'g') standardDose = dose * 1000; // Convert to mg
  if (unit === 'mcg' || unit === 'μg') standardDose = dose / 1000; // Convert to mg
  
  // Heavy dose thresholds based on psychonaut wiki data
  const heavyDoseThresholds: Record<string, number> = {
    // Opioids (mg)
    'oxycodone': 30,
    'morphine': 60,
    'tramadol': 300,
    'kratom': 8000, // 8g
    
    // Benzodiazepines (mg)
    'alprazolam': 2,
    'xanax': 2,
    'lorazepam': 2,
    'ativan': 2,
    'clonazepam': 2,
    'klonopin': 2,
    'diazepam': 20,
    'valium': 20,
    
    // Stimulants (mg)
    'adderall': 40,
    'amphetamine': 50,
    'methylphenidate': 60,
    'ritalin': 60,
    'cocaine': 90,
    'methamphetamine': 50,
    
    // Psychedelics (mg or mcg)
    'lsd': 0.2, // 200mcg
    'psilocybin': 5000, // 5g mushrooms
    'dmt': 50,
    '2c-b': 25,
    '4-aco-dmt': 35,
    
    // Dissociatives (mg)
    'ketamine': 150,
    'dxm': 400,
    'pcp': 15,
    
    // GABAergics (mg or g)
    'phenibut': 2000,
    'ghb': 3000,
    
    // Cannabinoids (mg)
    'thc': 50,
    'cbd': 200,
    
    // Other recreational substances
    'mdma': 180,
    'ecstasy': 180,
    'alcohol': 60000, // ~6 drinks in mg equivalent
    'nitrous oxide': 16000, // 16g (multiple cartridges)
    
    // Nootropics and supplements (mg)
    'modafinil': 400,
    'piracetam': 4800,
    'phenylpiracetam': 200,
    'noopept': 30,
    
    // Prescription medications (mg)
    'gabapentin': 3600,
    'pregabalin': 600,
    'quetiapine': 800,
    'seroquel': 800,
    'lithium': 1800,
    
    // Antidepressants (mg)
    'sertraline': 200,
    'fluoxetine': 80,
    'venlafaxine': 375,
    'paroxetine': 60,
    'citalopram': 60,
    'escitalopram': 30
  };
  
  // Check if medication matches any known substance
  for (const [substance, threshold] of Object.entries(heavyDoseThresholds)) {
    if (name.includes(substance)) {
      return standardDose >= threshold;
    }
  }
  
  return false;
}

// Generate dose safety message based on amount taken
export function generateDoseSafetyMessage(medicationName: string, doseTaken: number, prescribedDose: number, unit: string): string | null {
  const isHeavy = isHeavyDose(medicationName, doseTaken, unit);
  const isOverPrescribed = doseTaken > prescribedDose * 1.5; // 50% over prescribed
  const isUnderPrescribed = doseTaken < prescribedDose * 0.5; // 50% under prescribed
  
  if (isHeavy) {
    return `⚠️ Heavy dose detected: ${doseTaken}${unit} of ${medicationName} is considered a heavy dose. Please ensure you have proper supervision and consider harm reduction strategies.`;
  }
  
  if (isOverPrescribed) {
    return `⚠️ Above prescribed dose: You took ${doseTaken}${unit} but your prescribed dose is ${prescribedDose}${unit}. Taking more than prescribed can increase risks.`;
  }
  
  if (isUnderPrescribed) {
    return `ℹ️ Below prescribed dose: You took ${doseTaken}${unit} but your prescribed dose is ${prescribedDose}${unit}. This is generally safer, but consistency is important for effectiveness.`;
  }
  
  return null;
}

// Enhanced dose calculation functions for dashboard
export function calculateRemainingDosesForDay(
  medication: any,
  todaysLogs: any[]
): { remaining: number; total: number; completed: boolean } {
  const frequencyMap = {
    'once-daily': 1,
    'twice-daily': 2,
    'three-times-daily': 3,
    'four-times-daily': 4,
    'as-needed': 0, // Variable, so we don't show remaining
  };
  
  const totalDoses = frequencyMap[medication.frequency as keyof typeof frequencyMap] || 0;
  
  if (totalDoses === 0) {
    // For as-needed medications, just check if taken today
    const takenToday = todaysLogs.some(log => 
      log.medicationId === medication.id && log.adherence === 'taken'
    );
    return { remaining: 0, total: 0, completed: takenToday };
  }
  
  const takenDoses = todaysLogs.filter(log => 
    log.medicationId === medication.id && log.adherence === 'taken'
  ).length;
  
  const remaining = Math.max(0, totalDoses - takenDoses);
  const completed = takenDoses >= totalDoses;
  
  return { remaining, total: totalDoses, completed };
}

export function getProgressDisplayText(
  remaining: number,
  total: number,
  completed: boolean,
  frequency: string
): string {
  if (frequency === 'as-needed') {
    return completed ? 'Taken today' : 'As needed';
  }
  
  if (completed) {
    return 'All doses complete';
  }
  
  if (remaining === total) {
    return `${total} dose${total > 1 ? 's' : ''} today`;
  }
  
  return `${remaining} of ${total} remaining`;
}

// Dependency Risk Analysis - Enhanced with medication start date validation
export function calculateDependencyRisk(
  medicationLogs: any[],
  medication: any,
  timeWindow: number = 30 // days
): { riskScore: number; riskFactors: string[]; recommendations: string[] } {
  // Check if medication was started recently (within grace period)
  const medicationStartDate = medication.startDate ? new Date(medication.startDate) : medication.createdAt ? new Date(medication.createdAt) : null;
  const gracePeriodDays = 14; // 2 weeks grace period for new medications
  
  if (medicationStartDate) {
    const daysSinceStart = (Date.now() - medicationStartDate.getTime()) / (1000 * 60 * 60 * 24);
    
    // If medication is very new, provide minimal risk assessment
    if (daysSinceStart < gracePeriodDays) {
      return {
        riskScore: 0,
        riskFactors: ['Recently started medication - monitoring phase'],
        recommendations: [
          'Continue taking as prescribed',
          'Monitor for any side effects or concerns',
          'Follow up with healthcare provider as scheduled'
        ]
      };
    }
  }

  const recentLogs = medicationLogs.filter(log => {
    const logDate = new Date(log.timestamp);
    const daysAgo = (Date.now() - logDate.getTime()) / (1000 * 60 * 60 * 24);
    return daysAgo <= timeWindow && log.medicationId === medication.id;
  });
  
  let riskScore = 0;
  const riskFactors: string[] = [];
  const recommendations: string[] = [];
  
  // Base risk from medication category - reduced for newer medications
  const categoryRisk = {
    'opioid': 40,
    'benzodiazepine': 35,
    'stimulant': 30,
    'sleep-aid': 20,
    'muscle-relaxant': 15,
    'antidepressant': 5,
    'anticonvulsant': 5,
    'low-risk': 0
  };
  
  let baseCategoryRisk = categoryRisk[medication.dependencyRiskCategory as keyof typeof categoryRisk] || 0;
  
  // Reduce base risk for newer medications (within first 30 days)
  if (medicationStartDate) {
    const daysSinceStart = (Date.now() - medicationStartDate.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceStart < 30) {
      const reductionFactor = Math.max(0.3, daysSinceStart / 30); // Gradually increase from 30% to 100%
      baseCategoryRisk *= reductionFactor;
      riskFactors.push(`Medication started ${Math.round(daysSinceStart)} days ago - risk assessment adjusting`);
    }
  }
  
  riskScore += baseCategoryRisk;
  
  // Analyze dosage patterns - only if we have sufficient data
  if (recentLogs.length >= 5) { // Need at least 5 logs to detect patterns
    const dosages = recentLogs.map(log => log.dosageTaken);
    const prescribedDose = parseFloat(medication.dosage);
    
    if (dosages.some(dose => dose > prescribedDose * 1.5)) {
      riskScore += 25;
      riskFactors.push('Doses exceeding prescribed amount detected');
      recommendations.push('Contact healthcare provider about dose concerns');
    }
  } else if (recentLogs.length > 0) {
    riskFactors.push('Limited usage data - continuing to monitor patterns');
  }
  
  // Check for frequency increases - only if we have sufficient data spread over multiple days
  const expectedDailyDoses = {
    'once-daily': 1,
    'twice-daily': 2,
    'three-times-daily': 3,
    'four-times-daily': 4
  };
  
  const expectedDaily = expectedDailyDoses[medication.frequency as keyof typeof expectedDailyDoses] || 1;
  const dailyGroups = recentLogs.reduce((acc, log) => {
    const date = new Date(log.timestamp).toDateString();
    acc[date] = (acc[date] || 0) + 1;
    return acc;
  }, {});
  
  const uniqueDays = Object.keys(dailyGroups).length;
  
  // Only flag frequency issues if we have data from multiple days (at least 3 days)
  if (uniqueDays >= 3) {
    const excessiveDays = Object.values(dailyGroups).filter((count: unknown) => (count as number) > expectedDaily * 1.5);
    if (excessiveDays.length > 0 && excessiveDays.length / uniqueDays > 0.3) { // More than 30% of days
      riskScore += 20;
      riskFactors.push('Taking medication more frequently than prescribed');
      recommendations.push('Review dosing schedule with healthcare provider');
    }
  }
  
  // Check for early refill patterns (if pill count data available)
  if (medication.pillsRemaining !== undefined && medication.totalPills) {
    const expectedUsage = (medication.totalPills - medication.pillsRemaining) / 
                         (expectedDaily * (timeWindow / 30));
    if (expectedUsage > 1.3) {
      riskScore += 15;
      riskFactors.push('Using medication faster than expected');
      recommendations.push('Monitor usage patterns carefully');
    }
  }
  
  // Cap risk score at 100
  riskScore = Math.min(riskScore, 100);
  
  // Provide appropriate recommendations based on risk score and medication age
  if (medicationStartDate && (Date.now() - medicationStartDate.getTime()) / (1000 * 60 * 60 * 24) < 30) {
    // New medication - more conservative recommendations
    if (riskScore < 30) {
      recommendations.push('Continue current medication routine and monitor for any changes');
      recommendations.push('Follow up with healthcare provider as scheduled');
    } else {
      recommendations.push('Discuss any concerns with healthcare provider at next appointment');
      recommendations.push('Monitor usage patterns carefully during adjustment period');
    }
  } else {
    // Established medication - standard recommendations
    if (riskScore < 20) {
      recommendations.push('Continue current medication routine');
    } else if (riskScore < 50) {
      recommendations.push('Monitor usage patterns and discuss with healthcare provider');
    } else {
      recommendations.push('Immediate consultation with healthcare provider recommended');
      recommendations.push('Consider dependency assessment');
    }
  }
  
  return { riskScore, riskFactors, recommendations };
}

// Behavioral Pattern Detection
export function detectBehaviorPatterns(
  medicationLogs: any[],
  _medication: any,
  _timeWindow: number = 30
): any[] {
  const patterns: any[] = [];
  
  // Detect weekend gaps
  const weekendMisses = medicationLogs.filter(log => {
    const logDate = new Date(log.timestamp);
    const dayOfWeek = logDate.getDay();
    return (dayOfWeek === 0 || dayOfWeek === 6) && log.adherence === 'missed';
  });
  
  if (weekendMisses.length > 2) {
    patterns.push({
      type: 'weekend-gaps',
      detectedDate: new Date(),
      confidence: 0.8,
      description: 'Tendency to miss doses on weekends',
      recommendedAction: 'Set weekend-specific reminders'
    });
  }
  
  // Detect timing drift
  const takenLogs = medicationLogs.filter(log => log.adherence === 'taken');
  const timeDifferences = takenLogs.map(log => {
    const time = new Date(log.timestamp);
    return time.getHours() * 60 + time.getMinutes();
  });
  
  if (timeDifferences.length > 7) {
    const avgTime = timeDifferences.reduce((a, b) => a + b, 0) / timeDifferences.length;
    const variance = timeDifferences.reduce((acc, time) => acc + Math.pow(time - avgTime, 2), 0) / timeDifferences.length;
    
    if (variance > 3600) { // High variance (more than 1 hour standard deviation)
      patterns.push({
        type: 'dose-timing-drift',
        detectedDate: new Date(),
        confidence: 0.7,
        description: 'Inconsistent dosing times detected',
        recommendedAction: 'Consider setting consistent daily reminders'
      });
    }
  }

  return patterns;
}

