import React from 'react';
import { useForm } from 'react-hook-form';
import { X, Bell, Clock, Calendar } from 'lucide-react';
import { useMedicationStore } from '@/store';
import { Reminder, DayOfWeek } from '@/types';
import toast from 'react-hot-toast';

interface ReminderModalProps {
  isOpen: boolean;
  onClose: () => void;
  reminder?: Reminder | null;
}

interface FormData {
  medicationId: string;
  time: string;
  days: DayOfWeek[];
  isActive: boolean;
  customMessage?: string;
  notificationSound: boolean;
}

const DAYS_OF_WEEK: { value: DayOfWeek; label: string }[] = [
  { value: 'monday', label: 'Monday' },
  { value: 'tuesday', label: 'Tuesday' },
  { value: 'wednesday', label: 'Wednesday' },
  { value: 'thursday', label: 'Thursday' },
  { value: 'friday', label: 'Friday' },
  { value: 'saturday', label: 'Saturday' },
  { value: 'sunday', label: 'Sunday' },
];

export function ReminderModal({ isOpen, onClose, reminder }: ReminderModalProps) {
  const { 
    medications, 
    addReminder, 
    updateReminder,
    generateContextualMessage 
  } = useMedicationStore();
  
  const isEditing = !!reminder;
  const activeMedications = medications.filter(med => med.isActive);

  const { register, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<FormData>({
    defaultValues: {
      medicationId: '',
      time: '08:00',
      days: [],
      isActive: true,
      customMessage: '',
      notificationSound: true,
    }
  });

  const selectedDays = watch('days') || [];
  const selectedMedicationId = watch('medicationId');
  const selectedMedication = medications.find(med => med.id === selectedMedicationId);

  React.useEffect(() => {
    if (isOpen) {
      if (reminder) {
        reset({
          medicationId: reminder.medicationId,
          time: reminder.time,
          days: reminder.days,
          isActive: reminder.isActive,
          customMessage: reminder.customMessage || '',
          notificationSound: reminder.notificationSound || true,
        });
      } else {
        reset({
          medicationId: '',
          time: '08:00',
          days: [],
          isActive: true,
          customMessage: '',
          notificationSound: true,
        });
      }
    }
  }, [isOpen, reminder, reset]);

  const handleDayToggle = (day: DayOfWeek) => {
    const currentDays = selectedDays;
    const newDays = currentDays.includes(day)
      ? currentDays.filter(d => d !== day)
      : [...currentDays, day];
    setValue('days', newDays);
  };

  const setQuickSchedule = (schedule: 'daily' | 'weekdays' | 'weekends') => {
    switch (schedule) {
      case 'daily':
        setValue('days', ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']);
        break;
      case 'weekdays':
        setValue('days', ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']);
        break;
      case 'weekends':
        setValue('days', ['saturday', 'sunday']);
        break;
    }
  };

  const onSubmit = (data: FormData) => {
    if (data.days.length === 0) {
      toast.error('Please select at least one day');
      return;
    }

    const reminderData = {
      medicationId: data.medicationId,
      time: data.time,
      days: data.days,
      isActive: data.isActive,
      customMessage: data.customMessage?.trim() || undefined,
      notificationSound: data.notificationSound,
    };

    if (isEditing && reminder) {
      updateReminder(reminder.id, reminderData);
      toast.success('Reminder updated successfully');
      
      // Generate motivational message for reminder updates
      generateContextualMessage(data.medicationId, 'motivation');
    } else {
      addReminder(reminderData);
      toast.success('Reminder created successfully');
      
      // Generate celebratory message for new reminders
      const medication = medications.find(med => med.id === data.medicationId);
      if (medication) {
        generateContextualMessage(data.medicationId, 'celebration');
      }
    }

    onClose();
  };

  const getFrequencyText = () => {
    if (selectedDays.length === 0) return 'No days selected';
    if (selectedDays.length === 7) return 'Daily';
    if (selectedDays.length === 5 && !selectedDays.includes('saturday') && !selectedDays.includes('sunday')) {
      return 'Weekdays only';
    }
    if (selectedDays.length === 2 && selectedDays.includes('saturday') && selectedDays.includes('sunday')) {
      return 'Weekends only';
    }
    return `${selectedDays.length} days per week`;
  };

  const getPsychologicalMessage = () => {
    if (!selectedMedication) return null;
    
    if (selectedMedication.riskLevel === 'high') {
      return {
        message: "Setting reminders for high-priority medications helps ensure consistent treatment and prevents complications.",
        color: "bg-red-50 border-red-200 text-red-700"
      };
    }
    
    if (selectedMedication.category === 'vitamin' || selectedMedication.category === 'supplement') {
      return {
        message: "Regular reminders help build healthy habits and maximize the benefits of your wellness routine.",
        color: "bg-green-50 border-green-200 text-green-700"
      };
    }
    
    return {
      message: "Consistent medication timing improves effectiveness and helps you build a healthy routine.",
      color: "bg-blue-50 border-blue-200 text-blue-700"
    };
  };

  const psychMessage = getPsychologicalMessage();

  // Prevent body scroll when modal is open
  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = 'unset';
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto mobile-safe-area">
      <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose} />
        
        <div className="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg mobile-modal">
          <div className="max-h-[90vh] overflow-y-auto mobile-scroll">
          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="bg-white px-4 pb-4 pt-5 sm:p-6 sm:pb-4">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                  <Bell className="h-6 w-6 text-blue-600" />
                  <h3 className="text-lg font-medium text-gray-900">
                    {isEditing ? 'Edit Reminder' : 'Create New Reminder'}
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
                {/* Medication Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Medication *
                  </label>
                  <select
                    {...register('medicationId', { required: 'Please select a medication' })}
                    className="input w-full"
                  >
                    <option value="">Select a medication...</option>
                    {activeMedications.map((medication) => (
                      <option key={medication.id} value={medication.id}>
                        {medication.name} - {medication.dosage} {medication.unit}
                      </option>
                    ))}
                  </select>
                  {errors.medicationId && (
                    <p className="mt-1 text-sm text-red-600">{errors.medicationId.message}</p>
                  )}
                </div>

                {/* Psychological Message */}
                {psychMessage && (
                  <div className={`p-3 rounded-lg border ${psychMessage.color}`}>
                    <p className="text-sm font-medium">{psychMessage.message}</p>
                  </div>
                )}

                {/* Time Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Reminder Time *
                  </label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="time"
                      {...register('time', { required: 'Please select a time' })}
                      className="input pl-10 w-full"
                    />
                  </div>
                  {errors.time && (
                    <p className="mt-1 text-sm text-red-600">{errors.time.message}</p>
                  )}
                </div>

                {/* Quick Schedule Buttons */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Quick Schedule
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setQuickSchedule('daily')}
                      className="btn-secondary text-sm py-2"
                    >
                      Daily
                    </button>
                    <button
                      type="button"
                      onClick={() => setQuickSchedule('weekdays')}
                      className="btn-secondary text-sm py-2"
                    >
                      Weekdays
                    </button>
                    <button
                      type="button"
                      onClick={() => setQuickSchedule('weekends')}
                      className="btn-secondary text-sm py-2"
                    >
                      Weekends
                    </button>
                  </div>
                </div>

                {/* Days Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Days of Week *
                  </label>
                  <div className="space-y-2">
                    {DAYS_OF_WEEK.map((day) => (
                      <label key={day.value} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={selectedDays.includes(day.value)}
                          onChange={() => handleDayToggle(day.value)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <span className="ml-2 text-sm text-gray-700">{day.label}</span>
                      </label>
                    ))}
                  </div>
                  <p className="mt-1 text-sm text-gray-500">
                    Selected: {getFrequencyText()}
                  </p>
                  {selectedDays.length === 0 && (
                    <p className="mt-1 text-sm text-red-600">Please select at least one day</p>
                  )}
                </div>

                {/* Custom Message */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Custom Message (Optional)
                  </label>
                  <textarea
                    {...register('customMessage')}
                    rows={3}
                    className="input w-full"
                    placeholder="Add a personal reminder message..."
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    This message will be shown with your reminder notification
                  </p>
                </div>

                {/* Options */}
                <div className="space-y-3">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      {...register('notificationSound')}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label className="ml-2 block text-sm text-gray-900">
                      Play notification sound
                    </label>
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      {...register('isActive')}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label className="ml-2 block text-sm text-gray-900">
                      Reminder is active
                    </label>
                  </div>
                </div>

                {/* Preview */}
                {selectedMedication && selectedDays.length > 0 && (
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h4 className="text-sm font-medium text-gray-900 mb-2">Reminder Preview</h4>
                    <div className="flex items-center space-x-3">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: selectedMedication.color }}
                      />
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {selectedMedication.name}
                        </p>
                        <p className="text-xs text-gray-600">
                          {watch('time')} • {getFrequencyText()}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
              <button
                type="submit"
                className="w-full justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 sm:ml-3 sm:w-auto"
              >
                {isEditing ? 'Update Reminder' : 'Create Reminder'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="mt-3 w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:mt-0 sm:w-auto"
              >
                Cancel
              </button>
            </div>
          </form>
          </div>
        </div>
      </div>
    </div>
  );
}
