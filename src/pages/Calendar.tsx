import React from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon,
  Clock,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { useMedicationStore } from '@/store';
import { formatTime, formatDate, isSameDay, formatPillDisplayShort } from '@/utils/helpers';
import { CalendarEvent } from '@/types';
import { format, addDays, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isToday } from 'date-fns';

export function Calendar() {
  const {
    medications,
    logs,
    reminders,
    getCurrentDose
  } = useMedicationStore();

  const [selectedDate, setSelectedDate] = React.useState(new Date());
  const [viewMode, setViewMode] = React.useState<'week' | 'month'>('week');
  const [selectedMedication, setSelectedMedication] = React.useState<string | 'all'>('all');

  // Helper function to get default times for different frequencies
  const getFrequencyTimes = (frequency: string): string[] => {
    switch (frequency) {
      case 'once-daily':
        return ['09:00'];
      case 'twice-daily':
        return ['09:00', '21:00'];
      case 'three-times-daily':
        return ['08:00', '14:00', '20:00'];
      case 'four-times-daily':
        return ['08:00', '12:00', '16:00', '20:00'];
      case 'every-other-day':
        return ['09:00'];
      default:
        return ['09:00'];
    }
  };

  // Generate calendar events - show both logged medications and upcoming doses
  const generateCalendarEvents = React.useCallback((): CalendarEvent[] => {
    const events: CalendarEvent[] = [];
    const activeMedications = medications.filter(med => med.isActive);

    // Add logged medications as events
    logs.forEach(log => {
      const medication = medications.find(med => med.id === log.medicationId);
      if (medication) {
        // Calculate proper dosage display for logged medications
        let dosageInfo;
        if (medication.useMultiplePills && log.pillsLogged && log.pillsLogged.length > 0) {
          // Show pill breakdown for multiple-pill medications
          const totalDose = log.pillsLogged.reduce((sum, pill) => sum + (pill.quantity * (parseFloat(pill.strength) || 0)), 0);
          const pillBreakdown = log.pillsLogged.map(pill => `${pill.quantity}×${pill.strength}`).join(' + ');
          dosageInfo = `${pillBreakdown} (${totalDose}${medication.unit})`;
        } else if (medication.useMultiplePills) {
          // Fallback for multiple-pill medications without pill logs
          dosageInfo = formatPillDisplayShort(medication);
        } else {
          // Single pill medications - show the logged dose
          dosageInfo = `${log.dosageTaken} ${log.unit}`;
        }
        
        events.push({
          id: log.id,
          medicationId: log.medicationId,
          medicationName: medication.name,
          dosageInfo: dosageInfo,
          time: formatTime(new Date(log.timestamp)),
          type: log.adherence === 'taken' ? 'taken' : 'missed',
          status: log.adherence,
          date: new Date(log.timestamp),
          notes: log.notes,
        } as any);
      }
    });

    // Add events for the calendar view range (including past days in current view)
    const today = new Date();
    let startDate, endDate;
    
    if (viewMode === 'week') {
      // For week view, show the full week containing today
      startDate = startOfWeek(selectedDate);
      endDate = endOfWeek(selectedDate);
    } else {
      // For month view, show the full month containing today plus some future days
      startDate = startOfWeek(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));
      endDate = endOfWeek(new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0));
    }
    
    for (let date = startDate; date <= endDate; date = addDays(date, 1)) {
      const dayName = format(date, 'EEEE').toLowerCase();
      
      // Process medications with reminders
      reminders.forEach(reminder => {
        const medication = activeMedications.find(med => med.id === reminder.medicationId);
        if (medication && reminder.isActive && reminder.days.includes(dayName as any)) {
          // Count how many reminders exist for this medication on this day
          const medicationRemindersToday = reminders.filter(r => 
            r.medicationId === reminder.medicationId && 
            r.isActive && 
            r.days.includes(dayName as any)
          );
          
          // Count how many times this medication was logged on this day
          const dailyLogs = logs.filter(log => 
            log.medicationId === reminder.medicationId && 
            isSameDay(new Date(log.timestamp), date)
          );
          
          // Get the index of this reminder among the day's reminders (sorted by time)
          const sortedReminders = medicationRemindersToday.sort((a, b) => a.time.localeCompare(b.time));
          const reminderIndex = sortedReminders.findIndex(r => r.id === reminder.id);
          
          // Skip this reminder if we have enough logs already
          if (dailyLogs.length > reminderIndex) {
            return;
          }
          
          // Get current dose for this date
          const currentDose = getCurrentDose(reminder.medicationId, date);
          
          
          // Only skip if this is clearly a cyclic dosing "off" day
          if (currentDose.dose === 0 && medication.cyclicDosing?.isActive && currentDose.phase === 'off') {
            return;
          }
          
          // Calculate dosage info with tapering/cyclic adjustments
          let dosageInfo;
          if (medication.tapering?.isActive || medication.cyclicDosing?.isActive) {
            if (medication.useMultiplePills && currentDose.pillBreakdown) {
              // Show pill breakdown for tapered multiple-pill medications
              const pillEntries = Object.entries(currentDose.pillBreakdown).filter(([_, quantity]) => quantity > 0);
              
              if (pillEntries.length > 0) {
                // Check if all pill quantities are whole numbers
                const hasWholePills = pillEntries.every(([_, quantity]) => quantity % 1 === 0);
                
                if (hasWholePills) {
                  // Show pill breakdown for whole pills
                  const pillBreakdown = pillEntries
                    .map(([pillId, quantity]) => {
                      const pillConfig = medication.pillConfigurations?.find(p => p.id === pillId);
                      return `${quantity}×${pillConfig?.strength || '?'}mg`;
                    })
                    .join(' + ');
                  const adjustedDoseText = `${pillBreakdown} (${currentDose.dose}${medication.unit})`;
                  
                  if (medication.cyclicDosing?.isActive && currentDose.phase !== 'maintenance') {
                    dosageInfo = `${adjustedDoseText} (${currentDose.phase})`;
                  } else if (medication.tapering?.isActive) {
                    dosageInfo = `${adjustedDoseText} (tapering)`;
                  } else {
                    dosageInfo = adjustedDoseText;
                  }
                } else {
                  // For fractional pills, just show the total dose with note about partial pills
                  const adjustedDoseText = `~${currentDose.dose}${medication.unit}`;
                  
                  if (medication.cyclicDosing?.isActive && currentDose.phase !== 'maintenance') {
                    dosageInfo = `${adjustedDoseText} (${currentDose.phase})`;
                  } else if (medication.tapering?.isActive) {
                    dosageInfo = `${adjustedDoseText} (tapering)`;
                  } else {
                    dosageInfo = adjustedDoseText;
                  }
                }
              } else {
                // No pills to take today, but show the tapering/cyclic status
                if (medication.cyclicDosing?.isActive && currentDose.phase !== 'maintenance') {
                  dosageInfo = `0${medication.unit} (${currentDose.phase})`;
                } else if (medication.tapering?.isActive) {
                  // Check if we're actually past the tapering end date
                  const taperingEndDate = new Date(medication.tapering.endDate);
                  const isActuallyComplete = date >= taperingEndDate;
                  dosageInfo = isActuallyComplete 
                    ? `0${medication.unit} (tapering complete)` 
                    : `0${medication.unit} (skipped during taper)`;
                } else {
                  dosageInfo = `0${medication.unit}`;
                }
              }
            } else {
              // Single pill or fallback for multiple pills
              if (currentDose.dose === 0) {
                // Show 0 dose with context
                if (medication.cyclicDosing?.isActive && currentDose.phase !== 'maintenance') {
                  dosageInfo = `0${medication.unit} (${currentDose.phase})`;
                } else if (medication.tapering?.isActive) {
                  // Check if we're actually past the tapering end date
                  const taperingEndDate = new Date(medication.tapering.endDate);
                  const isActuallyComplete = date >= taperingEndDate;
                  dosageInfo = isActuallyComplete 
                    ? `0${medication.unit} (tapering complete)` 
                    : `0${medication.unit} (skipped during taper)`;
                } else {
                  dosageInfo = `0${medication.unit}`;
                }
              } else {
                const adjustedDoseText = `${currentDose.dose} ${medication.unit}`;
                
                if (medication.cyclicDosing?.isActive && currentDose.phase !== 'maintenance') {
                  dosageInfo = `${adjustedDoseText} (${currentDose.phase})`;
                } else if (medication.tapering?.isActive) {
                  dosageInfo = `${adjustedDoseText} (tapering)`;
                } else {
                  dosageInfo = adjustedDoseText;
                }
              }
            }
          } else {
            // For new medications, use their base dosage or a default if not set
            if (medication.useMultiplePills) {
              dosageInfo = formatPillDisplayShort(medication);
            } else if (medication.dosage && parseFloat(medication.dosage) > 0) {
              dosageInfo = `${medication.dosage} ${medication.unit}`;
            } else {
              dosageInfo = `TBD ${medication.unit || 'mg'}`; // Show something for new medications
            }
          }
          
          events.push({
            id: `${reminder.id}-${format(date, 'yyyy-MM-dd')}`,
            medicationId: reminder.medicationId,
            medicationName: medication.name,
            dosageInfo: dosageInfo,
            time: reminder.time,
            type: 'upcoming',
            status: 'upcoming',
            date: date,
            cyclicPhase: medication.cyclicDosing?.isActive ? currentDose.phase : undefined,
            cyclicMessage: medication.cyclicDosing?.isActive ? currentDose.message : undefined,
          } as any);
        }
      });

      // Process medications with frequency but no specific reminders
      activeMedications
        .filter(med => !reminders.some(reminder => reminder.medicationId === med.id && reminder.isActive))
        .forEach(medication => {
          // Include all medications with frequency, or medications with no frequency at all (new medications)
          if ((medication.frequency && medication.frequency !== 'as-needed') || !medication.frequency) {
            const frequencyTimes = getFrequencyTimes(medication.frequency || 'once-daily');
            
            // Count how many times this medication was logged on this day
            const dailyLogs = logs.filter(log => 
              log.medicationId === medication.id && 
              isSameDay(new Date(log.timestamp), date)
            );
            
            frequencyTimes.forEach((time, index) => {
              // Skip scheduled doses if we already have enough logs for the day
              // For example, if twice-daily and 2 logs exist, don't show any scheduled
              if (dailyLogs.length > index) {
                return;
              }

              // Get current dose for this date
              const currentDose = getCurrentDose(medication.id, date);
              
              
              // Only skip if this is clearly a cyclic dosing "off" day
              if (currentDose.dose === 0 && medication.cyclicDosing?.isActive && currentDose.phase === 'off') {
                return;
              }
              
              // Calculate dosage info
              let dosageInfo;
              if (medication.tapering?.isActive || medication.cyclicDosing?.isActive) {
                if (medication.useMultiplePills && currentDose.pillBreakdown) {
                  // Show pill breakdown for tapered multiple-pill medications
                  const pillEntries = Object.entries(currentDose.pillBreakdown).filter(([_, quantity]) => quantity > 0);
                  
                  if (pillEntries.length > 0) {
                    // Check if all pill quantities are whole numbers
                    const hasWholePills = pillEntries.every(([_, quantity]) => quantity % 1 === 0);
                    
                    if (hasWholePills) {
                      // Show pill breakdown for whole pills
                      const pillBreakdown = pillEntries
                        .map(([pillId, quantity]) => {
                          const pillConfig = medication.pillConfigurations?.find(p => p.id === pillId);
                          return `${quantity}×${pillConfig?.strength || '?'}mg`;
                        })
                        .join(' + ');
                      const adjustedDoseText = `${pillBreakdown} (${currentDose.dose}${medication.unit})`;
                      
                      if (medication.cyclicDosing?.isActive && currentDose.phase !== 'maintenance') {
                        dosageInfo = `${adjustedDoseText} (${currentDose.phase})`;
                      } else if (medication.tapering?.isActive) {
                        dosageInfo = `${adjustedDoseText} (tapering)`;
                      } else {
                        dosageInfo = adjustedDoseText;
                      }
                    } else {
                      // For fractional pills, just show the total dose with note about partial pills
                      const adjustedDoseText = `~${currentDose.dose}${medication.unit}`;
                      
                      if (medication.cyclicDosing?.isActive && currentDose.phase !== 'maintenance') {
                        dosageInfo = `${adjustedDoseText} (${currentDose.phase})`;
                      } else if (medication.tapering?.isActive) {
                        dosageInfo = `${adjustedDoseText} (tapering)`;
                      } else {
                        dosageInfo = adjustedDoseText;
                      }
                    }
                  } else {
                    // No pills to take today, but show the tapering/cyclic status
                    if (medication.cyclicDosing?.isActive && currentDose.phase !== 'maintenance') {
                      dosageInfo = `0${medication.unit} (${currentDose.phase})`;
                    } else if (medication.tapering?.isActive) {
                      // Check if we're actually past the tapering end date
                      const taperingEndDate = new Date(medication.tapering.endDate);
                      const isActuallyComplete = date >= taperingEndDate;
                      dosageInfo = isActuallyComplete 
                        ? `0${medication.unit} (tapering complete)` 
                        : `0${medication.unit} (skipped during taper)`;
                    } else {
                      dosageInfo = `0${medication.unit}`;
                    }
                  }
                } else {
                  // Single pill or fallback for multiple pills
                  if (currentDose.dose === 0) {
                    // Show 0 dose with context
                    if (medication.cyclicDosing?.isActive && currentDose.phase !== 'maintenance') {
                      dosageInfo = `0${medication.unit} (${currentDose.phase})`;
                    } else if (medication.tapering?.isActive) {
                      // Check if we're actually past the tapering end date
                      const taperingEndDate = new Date(medication.tapering.endDate);
                      const isActuallyComplete = date >= taperingEndDate;
                      dosageInfo = isActuallyComplete 
                        ? `0${medication.unit} (tapering complete)` 
                        : `0${medication.unit} (skipped during taper)`;
                    } else {
                      dosageInfo = `0${medication.unit}`;
                    }
                  } else {
                    const adjustedDoseText = `${currentDose.dose} ${medication.unit}`;
                    
                    if (medication.cyclicDosing?.isActive && currentDose.phase !== 'maintenance') {
                      dosageInfo = `${adjustedDoseText} (${currentDose.phase})`;
                    } else if (medication.tapering?.isActive) {
                      dosageInfo = `${adjustedDoseText} (tapering)`;
                    } else {
                      dosageInfo = adjustedDoseText;
                    }
                  }
                }
              } else {
                // For new medications, use their base dosage or a default if not set
                if (medication.useMultiplePills) {
                  dosageInfo = formatPillDisplayShort(medication);
                } else if (medication.dosage && parseFloat(medication.dosage) > 0) {
                  dosageInfo = `${medication.dosage} ${medication.unit}`;
                } else {
                  dosageInfo = `TBD ${medication.unit || 'mg'}`; // Show something for new medications
                }
              }
              
              events.push({
                id: `freq-${medication.id}-${format(date, 'yyyy-MM-dd')}-${index}`,
                medicationId: medication.id,
                medicationName: medication.name,
                dosageInfo: dosageInfo,
                time: time,
                type: 'upcoming',
                status: 'upcoming',
                date: date,
                cyclicPhase: medication.cyclicDosing?.isActive ? currentDose.phase : undefined,
                cyclicMessage: medication.cyclicDosing?.isActive ? currentDose.message : undefined,
              } as any);
            });
          }
        });
    }

    // Remove exact duplicates while preserving legitimate multiple daily doses
    const uniqueEvents = events.filter((event, index, self) => {
      return index === self.findIndex(e => 
        e.medicationId === event.medicationId &&
        e.time === event.time &&
        format(e.date, 'yyyy-MM-dd') === format(event.date, 'yyyy-MM-dd') &&
        e.type === event.type
      );
    });

    return uniqueEvents.sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [medications, logs, reminders, viewMode, getCurrentDose]);

  const calendarEvents = generateCalendarEvents();

  // Filter events by selected medication
  const filteredEvents = selectedMedication === 'all' 
    ? calendarEvents 
    : calendarEvents.filter(event => event.medicationId === selectedMedication);

  // Get events for selected date
  const selectedDateEvents = filteredEvents.filter(event => 
    isSameDay(event.date, selectedDate)
  );

  // Generate calendar grid for month view
  const monthDays = React.useMemo(() => {
    const start = startOfWeek(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));
    const end = endOfWeek(new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0));
    return eachDayOfInterval({ start, end });
  }, [selectedDate]);

  // Generate week days for week view
  const weekDays = React.useMemo(() => {
    const start = startOfWeek(selectedDate);
    const end = endOfWeek(selectedDate);
    return eachDayOfInterval({ start, end });
  }, [selectedDate]);

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
  };

  const navigateCalendar = (direction: 'prev' | 'next') => {
    if (viewMode === 'week') {
      setSelectedDate(prev => addDays(prev, direction === 'next' ? 7 : -7));
    } else {
      setSelectedDate(prev => {
        const newMonth = direction === 'next' ? prev.getMonth() + 1 : prev.getMonth() - 1;
        return new Date(prev.getFullYear(), newMonth, 1);
      });
    }
  };

  const EventIcon = ({ status }: { status: string }) => {
    switch (status) {
      case 'taken':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'missed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'upcoming':
        return <Clock className="h-4 w-4 text-blue-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const CalendarDay = ({ date, isCurrentMonth = true }: { date: Date; isCurrentMonth?: boolean }) => {
    const dayEvents = filteredEvents.filter(event => isSameDay(event.date, date));
    const isSelected = isSameDay(date, selectedDate);
    const isCurrentDay = isToday(date);

    return (
      <button
        onClick={() => handleDateSelect(date)}
        className={`
          p-2 h-20 w-full border border-gray-200 text-left hover:bg-gray-50 transition-colors
          ${isSelected ? 'bg-blue-50 border-blue-200' : ''}
          ${isCurrentDay ? 'bg-yellow-50' : ''}
          ${!isCurrentMonth ? 'text-gray-400 bg-gray-50' : ''}
        `}
      >
        <div className="font-medium text-sm mb-1">
          {format(date, 'd')}
        </div>
        <div className="space-y-0">
          {dayEvents.slice(0, 4).map((event) => (
            <div
              key={event.id}
              className="flex items-center space-x-1 text-xs leading-tight"
            >
              <EventIcon status={event.status} />
              <span className="truncate">{event.medicationName}</span>
            </div>
          ))}
          {dayEvents.length > 4 && (
            <div className="text-xs text-gray-500">
              +{dayEvents.length - 4} more
            </div>
          )}
        </div>
      </button>
    );
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Calendar</h1>
          <p className="mt-1 text-sm text-gray-500">
            View your medication history
          </p>
        </div>

        {/* Medication Filter */}
        <div className="mt-4 sm:mt-0">
          <select
            value={selectedMedication}
            onChange={(e) => setSelectedMedication(e.target.value)}
            className="block w-full sm:w-auto rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          >
            <option value="all">All Medications</option>
            {medications.filter(med => med.isActive).map((med) => (
              <option key={med.id} value={med.id}>
                {med.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Calendar Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar Grid */}
        <div className="lg:col-span-2">
          <div className="card">
            <div className="card-header">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-medium text-gray-900">
                  {format(selectedDate, 'MMMM yyyy')}
                </h2>
                <div className="flex items-center space-x-2">
                  <div className="flex rounded-md border border-gray-300">
                    <button
                      onClick={() => setViewMode('week')}
                      className={`px-3 py-1 text-sm font-medium ${
                        viewMode === 'week'
                          ? 'bg-primary-600 text-white'
                          : 'text-gray-700 hover:text-gray-900'
                      }`}
                    >
                      Week
                    </button>
                    <button
                      onClick={() => setViewMode('month')}
                      className={`px-3 py-1 text-sm font-medium ${
                        viewMode === 'month'
                          ? 'bg-primary-600 text-white'
                          : 'text-gray-700 hover:text-gray-900'
                      }`}
                    >
                      Month
                    </button>
                  </div>
                  <button
                    onClick={() => navigateCalendar('prev')}
                    className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => setSelectedDate(new Date())}
                    className="px-3 py-1 text-sm font-medium text-primary-600 hover:text-primary-700"
                  >
                    Today
                  </button>
                  <button
                    onClick={() => navigateCalendar('next')}
                    className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>
            <div className="card-content p-0">
              {viewMode === 'month' ? (
                <div>
                  {/* Calendar Header */}
                  <div className="grid grid-cols-7 border-b border-gray-200">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                      <div key={day} className="p-3 text-center text-sm font-medium text-gray-700 border-r border-gray-200 last:border-r-0">
                        {day}
                      </div>
                    ))}
                  </div>
                  {/* Calendar Body */}
                  <div className="grid grid-cols-7">
                    {monthDays.map((date) => (
                      <CalendarDay
                        key={date.toISOString()}
                        date={date}
                        isCurrentMonth={isSameMonth(date, selectedDate)}
                      />
                    ))}
                  </div>
                </div>
              ) : (
                <div>
                  {/* Week Header */}
                  <div className="grid grid-cols-7 border-b border-gray-200">
                    {weekDays.map(date => (
                      <div key={date.toISOString()} className="p-3 text-center border-r border-gray-200 last:border-r-0">
                        <div className="text-sm font-medium text-gray-700">
                          {format(date, 'EEE')}
                        </div>
                        <div className={`text-lg font-semibold mt-1 ${
                          isToday(date) ? 'text-primary-600' : 'text-gray-900'
                        }`}>
                          {format(date, 'd')}
                        </div>
                      </div>
                    ))}
                  </div>
                  {/* Week Body */}
                  <div className="grid grid-cols-7 min-h-[300px]">
                    {weekDays.map(date => (
                      <CalendarDay key={date.toISOString()} date={date} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Selected Date Events */}
        <div>
          <div className="card">
            <div className="card-header">
              <h3 className="text-lg font-medium text-gray-900">
                {formatDate(selectedDate, 'EEEE, MMM d')}
              </h3>
            </div>
            <div className="card-content">
              {selectedDateEvents.length === 0 ? (
                <div className="text-center py-8">
                  <CalendarIcon className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No events</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    No medications scheduled or logged for this day.
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  {selectedDateEvents.map((event) => (
                    <div
                      key={event.id}
                      className={`px-2 py-1 rounded ${
                        event.status === 'taken' ? 'bg-green-50 border border-green-200' :
                        event.status === 'missed' ? 'bg-red-50 border border-red-200' :
                        'bg-blue-50 border border-blue-200'
                      }`}
                    >
                      <div className="flex items-start space-x-2">
                        <EventIcon status={event.status} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {event.medicationName}
                          </p>
                          <p className="text-xs text-gray-500">
                            {(event as any).dosageInfo} • {event.time}
                          </p>
                          {event.status === 'upcoming' && (
                            <p className="text-xs text-blue-600 font-medium leading-tight">
                              📅 Scheduled
                            </p>
                          )}
                          {(event as any).cyclicPhase && (event as any).cyclicPhase !== 'maintenance' && (
                            <p className="text-xs text-indigo-600 font-medium leading-tight">
                              📊 Cyclic: {(event as any).cyclicPhase}
                            </p>
                          )}
                          {(event as any).cyclicMessage && (
                            <p className="text-xs text-indigo-500 italic leading-tight">
                              💡 {(event as any).cyclicMessage}
                            </p>
                          )}
                          {(event as any).notes && (
                            <p className="text-xs text-gray-600 leading-tight">
                              📝 {(event as any).notes}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Legend */}
          <div className="card mt-4">
            <div className="card-header">
              <h3 className="text-sm font-medium text-gray-900">Legend</h3>
            </div>
            <div className="card-content">
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span className="text-sm text-gray-700">Taken</span>
                </div>
                <div className="flex items-center space-x-2">
                  <XCircle className="h-4 w-4 text-red-500" />
                  <span className="text-sm text-gray-700">Missed</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Clock className="h-4 w-4 text-blue-500" />
                  <span className="text-sm text-gray-700">Scheduled</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
