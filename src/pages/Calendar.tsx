import React from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle
} from 'lucide-react';
import { useMedicationStore } from '@/store';
import { formatTime, isSameDay, formatPillDisplayShort } from '@/utils/helpers';
import { CalendarEvent } from '@/types';
import { 
  format, 
  addDays, 
  startOfWeek, 
  endOfWeek, 
  startOfMonth,
  endOfMonth,
  eachDayOfInterval, 
  isSameMonth, 
  isToday
} from 'date-fns';

export function Calendar() {
  const {
    medications,
    logs,
    reminders,
    getCurrentDose
  } = useMedicationStore();

  // Handle search navigation parameters
  const searchParams = new URLSearchParams(window.location.search);
  const highlightLogId = searchParams.get('highlight');
  const dateParam = searchParams.get('date');

  const [selectedDate, setSelectedDate] = React.useState(new Date());
  const [viewMode, setViewMode] = React.useState<'week' | 'month'>('month');
  const [selectedMedication, setSelectedMedication] = React.useState<string | 'all'>('all');
  const [highlightedLogId, setHighlightedLogId] = React.useState<string | null>(null);

  // Handle navigation from search results
  React.useEffect(() => {
    if (dateParam) {
      const parsedDate = new Date(dateParam);
      if (!isNaN(parsedDate.getTime())) {
        setSelectedDate(parsedDate);
      }
    }
    
    if (highlightLogId) {
      setHighlightedLogId(highlightLogId);
      // Auto-clear highlight after 5 seconds
      const timer = setTimeout(() => {
        setHighlightedLogId(null);
      }, 5000);
      
      // Clear URL parameters
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('date');
      newUrl.searchParams.delete('highlight');
      window.history.replaceState({}, '', newUrl.pathname + newUrl.hash);
      
      return () => clearTimeout(timer);
    }
  }, [dateParam, highlightLogId]);

  // Helper function to get reminders for a specific date (based on getTodaysReminders pattern)
  const getRemindersForDate = React.useCallback((date: Date) => {
    const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const dayMapping = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayName = dayMapping[dayOfWeek];

    return reminders
      .filter((reminder) => {
        const medication = medications.find((med) => med.id === reminder.medicationId);
        if (!medication?.isActive || !reminder.isActive) return false;
        
        // Check medication date range
        const medicationStartDate = new Date(medication.startDate);
        const medicationEndDate = medication.endDate ? new Date(medication.endDate) : null;
        
        if (date < medicationStartDate) return false;
        if (medicationEndDate && date > medicationEndDate) return false;
        
        // Check if reminder is for this day
        return reminder.days.includes(dayName as any) && 
               (!reminder.snoozeUntil || reminder.snoozeUntil <= date);
      })
      .map((reminder) => ({
        ...reminder,
        medication: medications.find((med) => med.id === reminder.medicationId)!,
      }))
      .sort((a, b) => a.time.localeCompare(b.time));
  }, [medications, reminders]);

  // Helper function to get medications without reminders for a specific date
  const getMedicationsWithoutRemindersForDate = React.useCallback((date: Date) => {
    const activeMedications = medications.filter(med => med.isActive);
    const dateReminders = getRemindersForDate(date);
    
    return activeMedications.filter(med => {
      // Skip if has reminders for this specific date
      // If a medication has reminders, it should only appear via reminder logic
      const hasRemindersForThisDate = dateReminders.some(reminder => reminder.medicationId === med.id);
      if (hasRemindersForThisDate) return false;
      
      // Skip as-needed medications (they should be manually logged)
      if (!med.frequency || med.frequency === 'as-needed') return false;
      
      // Check medication date range
      const medicationStartDate = new Date(med.startDate);
      const medicationEndDate = med.endDate ? new Date(med.endDate) : null;
      
      if (date < medicationStartDate) return false;
      if (medicationEndDate && date > medicationEndDate) return false;
      
      // For tapered medications, check if tapering has ended
      if (med.tapering?.isActive) {
        const taperingEndDate = new Date(med.tapering.endDate);
        if (date > taperingEndDate && med.tapering.finalDose === 0) {
          return false; // Don't show medications that have completed tapering to zero
        }
      }
      
      // Check frequency pattern - be more specific about daily calculations
      const daysDiff = Math.floor((date.getTime() - medicationStartDate.getTime()) / (1000 * 60 * 60 * 24));
      
      switch (med.frequency) {
        case 'every-other-day':
          return daysDiff >= 0 && daysDiff % 2 === 0;
        case 'weekly':
          return daysDiff >= 0 && daysDiff % 7 === 0;
        case 'monthly':
          return daysDiff >= 0 && daysDiff % 30 === 0;
        case 'once-daily':
        case 'twice-daily':
        case 'three-times-daily':
        case 'four-times-daily':
          // For daily medications, be strict about date bounds
          const daysSinceStart = daysDiff;
          const maxDaysWithoutEndDate = 90; // Only show 3 months ahead without end date
          
          if (daysSinceStart < 0) return false;
          
          // Don't show medications that are very old without an end date
          if (!medicationEndDate && daysSinceStart > maxDaysWithoutEndDate) return false;
          
          // For medications with active tapering, respect the taper end date
          if (med.tapering?.isActive) {
            const taperingEndDate = new Date(med.tapering.endDate);
            if (date > taperingEndDate) return false;
          }
          
          return true;
        case 'custom':
          return false; // Custom should use reminders
        default:
          return false; // Unknown frequency
      }
    });
  }, [medications, getRemindersForDate]);

  // Generate calendar events using the same patterns as working components
  const generateCalendarEvents = React.useCallback((): CalendarEvent[] => {
    const events: CalendarEvent[] = [];

    // Determine date range based on view mode
    let startDate: Date, endDate: Date;
    if (viewMode === 'week') {
      startDate = startOfWeek(selectedDate);
      endDate = endOfWeek(selectedDate);
    } else {
      startDate = startOfWeek(startOfMonth(selectedDate));
      endDate = endOfWeek(endOfMonth(selectedDate));
    }
    

    // 1. Add logged medication events (within date range)
    logs.forEach(log => {
      const medication = medications.find(med => med.id === log.medicationId);
      if (!medication) return;

      const logDate = new Date(log.timestamp);
      if (logDate < startDate || logDate > endDate) return;

      // Calculate logged dosage display
      let dosageInfo = '';
      if (medication.useMultiplePills && log.pillsLogged?.length) {
        const pillDetails = log.pillsLogged.map(pill => {
          const config = medication.pillConfigurations?.find(c => c.id === pill.pillConfigurationId);
          return `${pill.quantityTaken}×${config?.strength || '?'}${config?.unit || 'mg'}`;
        }).join(' + ');
        
        const totalDose = log.pillsLogged.reduce((sum, pill) => {
          const config = medication.pillConfigurations?.find(c => c.id === pill.pillConfigurationId);
          const strength = parseFloat(config?.strength?.toString() || '0');
          return sum + (pill.quantityTaken * strength);
        }, 0);
        
        dosageInfo = `${pillDetails} = ${totalDose}${medication.unit}`;
      } else if (medication.useMultiplePills) {
        dosageInfo = formatPillDisplayShort(medication);
      } else {
        dosageInfo = `${log.dosageTaken || 0} ${log.unit || medication.unit}`;
      }

      events.push({
        id: `log-${log.id}`,
        medicationId: log.medicationId,
        medicationName: medication.name,
        medicationColor: medication.color,
        dosageInfo,
        time: formatTime(logDate),
        date: logDate,
        type: 'logged',
        status: log.adherence,
        notes: log.notes,
        skipReason: log.skipReason,
        isTapered: medication.tapering?.isActive,
        isMultiplePills: medication.useMultiplePills
      });
    });

    // 2. Add scheduled events for each date in range
    for (let currentDate = startDate; currentDate <= endDate; currentDate = addDays(currentDate, 1)) {
      // Get reminders for this date
      const dateReminders = getRemindersForDate(currentDate);
      
      // Add reminder-based events
      dateReminders.forEach(reminder => {
        const medication = reminder.medication;
        
        // Additional safety check for medication date range
        const medicationStartDate = new Date(medication.startDate);
        const medicationEndDate = medication.endDate ? new Date(medication.endDate) : null;
        
        if (currentDate < medicationStartDate) return;
        if (medicationEndDate && currentDate > medicationEndDate) return;
        
        // Count existing logs for this medication on this date
        const existingLogs = logs.filter(log => 
          log.medicationId === reminder.medicationId && 
          isSameDay(new Date(log.timestamp), currentDate)
        );

        // Get all reminders for this medication on this day
        const dayReminders = dateReminders.filter(r => r.medicationId === reminder.medicationId);
        const reminderIndex = dayReminders.findIndex(r => r.id === reminder.id);

        // Skip if already logged
        if (existingLogs.length > reminderIndex) return;

        // Get current dose with proper date
        const currentDose = getCurrentDose(medication.id, currentDate);
        
        // Skip if tapering is complete and we're past the end date
        if (medication.tapering?.isActive) {
          const taperingEndDate = new Date(medication.tapering.endDate);
          // Only skip if we're actually past the tapering end date
          if (currentDate > taperingEndDate) {
            return; // Medication should no longer appear after tapering period ends
          }
        }
        
        // Skip cyclic "off" days
        if (currentDose.dose === 0 && medication.cyclicDosing?.isActive && currentDose.phase === 'off') {
          return;
        }

        // Calculate dosage display using working patterns
        let dosageInfo = '';
        if (medication.useMultiplePills) {
          if (currentDose.pillBreakdown) {
            const pillEntries = Object.entries(currentDose.pillBreakdown).filter(([_, quantity]) => (quantity as number) > 0);
            if (pillEntries.length > 0) {
              const pillDetails = pillEntries.map(([pillId, quantity]) => {
                const pillConfig = medication.pillConfigurations?.find(p => p.id === pillId);
                return `${quantity}×${pillConfig?.strength || '?'}${pillConfig?.unit || 'mg'}`;
              }).join(' + ');
              dosageInfo = `${pillDetails} = ${Number(currentDose.dose.toFixed(2))}${medication.unit}`;
            } else {
              dosageInfo = `${Number(currentDose.dose.toFixed(2))}${medication.unit}`;
            }
          } else {
            // For multiple pills without pill breakdown, show current dose
            if (medication.tapering?.isActive || medication.cyclicDosing?.isActive) {
              dosageInfo = `${Number(currentDose.dose.toFixed(2))} ${medication.unit}`;
            } else {
              dosageInfo = formatPillDisplayShort(medication);
            }
          }
        } else {
          // For single pills, always use the current calculated dose
          const dose = Number(currentDose.dose.toFixed(2));
          dosageInfo = `${dose} ${medication.unit}`;
        }

        // Add phase info for special schedules
        if (medication.cyclicDosing?.isActive && currentDose.phase !== 'maintenance') {
          dosageInfo += ` (${currentDose.phase})`;
        } else if (medication.tapering?.isActive) {
          dosageInfo += ' (tapering)';
        }

        events.push({
          id: `reminder-${reminder.id}-${format(currentDate, 'yyyy-MM-dd')}`,
          medicationId: reminder.medicationId,
          medicationName: medication.name,
          medicationColor: medication.color,
          dosageInfo,
          time: reminder.time,
          date: currentDate,
          type: 'scheduled',
          status: 'scheduled',
          cyclicPhase: medication.cyclicDosing?.isActive ? currentDose.phase : undefined,
          isTapered: medication.tapering?.isActive,
          isMultiplePills: medication.useMultiplePills
        });
      });

      // Get medications without reminders for this date
      const medicationsWithoutReminders = getMedicationsWithoutRemindersForDate(currentDate);
      
      // Add frequency-based events
      medicationsWithoutReminders.forEach(medication => {
        const existingLogs = logs.filter(log => 
          log.medicationId === medication.id && 
          isSameDay(new Date(log.timestamp), currentDate)
        );

        // Get times based on frequency
        const getFrequencyTimes = (frequency: string): string[] => {
          switch (frequency) {
            case 'once-daily': return ['09:00'];
            case 'twice-daily': return ['09:00', '21:00'];
            case 'three-times-daily': return ['08:00', '14:00', '20:00'];
            case 'four-times-daily': return ['08:00', '12:00', '16:00', '20:00'];
            case 'every-other-day': return ['09:00'];
            case 'weekly': return ['09:00'];
            case 'monthly': return ['09:00'];
            default: return ['09:00'];
          }
        };

        const times = getFrequencyTimes(medication.frequency);
        
        times.forEach((time, index) => {
          // Skip if already logged
          if (existingLogs.length > index) return;

          const currentDose = getCurrentDose(medication.id, currentDate);
          
          // Skip if tapering is complete and final dose is 0
          if (medication.tapering?.isActive) {
            const taperingEndDate = new Date(medication.tapering.endDate);
            if (currentDate > taperingEndDate && medication.tapering.finalDose === 0) {
              return; // Medication should no longer appear after tapering ends
            }
          }
          
          // Skip cyclic "off" days
          if (currentDose.dose === 0 && medication.cyclicDosing?.isActive && currentDose.phase === 'off') {
            return;
          }
          
          // Skip if dose is 0 and tapering to zero (but not during active taper)
          if (currentDose.dose === 0 && medication.tapering?.isActive && medication.tapering.finalDose === 0) {
            const taperingEndDate = new Date(medication.tapering.endDate);
            if (currentDate >= taperingEndDate) {
              return; // Don't show zero doses after taper completes
            }
          }

          // Calculate dosage display
          let dosageInfo = '';
          if (medication.useMultiplePills) {
            if (currentDose.pillBreakdown) {
              const pillEntries = Object.entries(currentDose.pillBreakdown).filter(([_, quantity]) => (quantity as number) > 0);
              if (pillEntries.length > 0) {
                const pillDetails = pillEntries.map(([pillId, quantity]) => {
                  const pillConfig = medication.pillConfigurations?.find(p => p.id === pillId);
                  return `${quantity}×${pillConfig?.strength || '?'}${pillConfig?.unit || 'mg'}`;
                }).join(' + ');
                dosageInfo = `${pillDetails} = ${Number(currentDose.dose.toFixed(2))}${medication.unit}`;
              } else {
                dosageInfo = `${Number(currentDose.dose.toFixed(2))}${medication.unit}`;
              }
            } else {
              // For multiple pills without pill breakdown, show current dose
              if (medication.tapering?.isActive || medication.cyclicDosing?.isActive) {
                dosageInfo = `${Number(currentDose.dose.toFixed(2))} ${medication.unit}`;
              } else {
                dosageInfo = formatPillDisplayShort(medication);
              }
            }
          } else {
            // For single pills, always use the current calculated dose
            const dose = Number(currentDose.dose.toFixed(2));
            dosageInfo = `${dose} ${medication.unit}`;
          }

          events.push({
            id: `freq-${medication.id}-${format(currentDate, 'yyyy-MM-dd')}-${index}`,
            medicationId: medication.id,
            medicationName: medication.name,
            medicationColor: medication.color,
            dosageInfo,
            time,
            date: currentDate,
            type: 'scheduled',
            status: 'scheduled',
            isTapered: medication.tapering?.isActive,
            isMultiplePills: medication.useMultiplePills
          });
        });
      });
    }

    // Filter by selected medication and remove duplicates
    const filteredEvents = selectedMedication === 'all' 
      ? events 
      : events.filter(event => event.medicationId === selectedMedication);

    return filteredEvents.sort((a, b) => {
      const dateComparison = a.date.getTime() - b.date.getTime();
      if (dateComparison !== 0) return dateComparison;
      return a.time.localeCompare(b.time);
    });
  }, [medications, logs, reminders, selectedMedication, viewMode, selectedDate, getCurrentDose, getRemindersForDate, getMedicationsWithoutRemindersForDate]);

  const calendarEvents = generateCalendarEvents();

  // Get events for selected date
  const selectedDateEvents = calendarEvents.filter(event => 
    isSameDay(event.date, selectedDate)
  );

  // Generate calendar grid
  const calendarDays = React.useMemo(() => {
    if (viewMode === 'week') {
      const start = startOfWeek(selectedDate);
      const end = endOfWeek(selectedDate);
      return eachDayOfInterval({ start, end });
    } else {
      const start = startOfWeek(startOfMonth(selectedDate));
      const end = endOfWeek(endOfMonth(selectedDate));
      return eachDayOfInterval({ start, end });
    }
  }, [selectedDate, viewMode]);

  // Navigation functions
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

  const goToToday = () => {
    setSelectedDate(new Date());
  };

  // Event status icon component
  const EventStatusIcon = ({ status }: { status: string }) => {
    switch (status) {
      case 'taken':
        return <CheckCircle2 className="h-3 w-3 text-green-500 flex-shrink-0" />;
      case 'missed':
      case 'skipped':
        return <XCircle className="h-3 w-3 text-red-500 flex-shrink-0" />;
      case 'scheduled':
        return <Clock className="h-3 w-3 text-blue-500 flex-shrink-0" />;
      default:
        return <AlertCircle className="h-3 w-3 text-gray-400 flex-shrink-0" />;
    }
  };

  // Calendar day component
  const CalendarDay = ({ date }: { date: Date }) => {
    const dayEvents = calendarEvents.filter(event => isSameDay(event.date, date));
    const isSelected = isSameDay(date, selectedDate);
    const isCurrentDay = isToday(date);
    const isCurrentMonth = isSameMonth(date, selectedDate);

    const getEventTypeCount = (type: 'taken' | 'missed' | 'skipped' | 'scheduled') => {
      return dayEvents.filter(event => event.status === type).length;
    };

    return (
      <button
        onClick={() => setSelectedDate(date)}
        className={`
          relative w-full h-16 sm:h-24 lg:h-32 p-1 sm:p-2 border border-gray-200 
          hover:bg-gray-50 transition-colors text-left min-h-[44px] touch-manipulation
          ${isSelected ? 'bg-blue-50 border-blue-300 ring-1 ring-blue-500' : ''}
          ${isCurrentDay ? 'bg-yellow-50 border-yellow-300' : ''}
          ${!isCurrentMonth ? 'text-gray-400 bg-gray-50' : ''}
        `}
      >
        {/* Date number */}
        <div className={`text-xs sm:text-sm font-medium mb-1 ${
          isCurrentDay ? 'text-yellow-800' : 
          isSelected ? 'text-blue-800' : 
          !isCurrentMonth ? 'text-gray-400' : 'text-gray-900'
        }`}>
          {format(date, 'd')}
        </div>

        {/* Event indicators - responsive display */}
        <div className="space-y-0.5">
           {/* Show events on larger screens */}
            <div className="hidden sm:block">
              {(() => {
                // Group events by medication name to get unique medications
                const medicationMap = new Map();
                dayEvents.forEach(event => {
                  if (!medicationMap.has(event.medicationName)) {
                    medicationMap.set(event.medicationName, {
                      ...event,
                      count: dayEvents.filter(e => e.medicationName === event.medicationName).length
                    });
                  }
                });
                
                const uniqueMeds = Array.from(medicationMap.values());
                const displayMeds = uniqueMeds.slice(0, 2);
                const extraCount = Math.max(0, uniqueMeds.length - 2);
                
                return (
                  <>
                    {displayMeds.map((event) => (
                      <div
                        key={event.medicationName}
                        className="flex items-center space-x-1 text-xs"
                        style={{ color: event.medicationColor }}
                        title={`${event.medicationName} - ${event.count} dose(s) today`}
                      >
                        <EventStatusIcon status={event.status} />
                        <span className="font-medium">
                          {(() => {
                            const name = event.medicationName;
                            const words = name.split(' ').filter(w => w.length > 0);
                            
                            if (words.length >= 2) {
                              return (words[0].charAt(0) + words[1].charAt(0)).toUpperCase();
                            } else {
                              return name.substring(0, 2).toUpperCase();
                            }
                          })()}
                        </span>
                      </div>
                    ))}
                    
                  </>
                );
              })()}
            </div>
          
          {/* Show medication names on mobile */}
          <div className="sm:hidden flex flex-wrap gap-1">
            {(() => {
              // Group events by medication name to get unique medications
              const medicationMap = new Map();
              dayEvents.forEach(event => {
                if (!medicationMap.has(event.medicationName)) {
                  medicationMap.set(event.medicationName, {
                    ...event,
                    count: dayEvents.filter(e => e.medicationName === event.medicationName).length
                  });
                }
              });
              
              const uniqueMeds = Array.from(medicationMap.values());
              const displayMeds = uniqueMeds.slice(0, 2);
              const extraCount = Math.max(0, uniqueMeds.length - 2);
              
              return (
                <>
                  {displayMeds.map((event) => (
                    <span 
                      key={event.medicationName} 
                      className="text-xs font-medium" 
                      style={{ color: event.medicationColor }}
                      title={`${event.medicationName} - ${event.count} dose(s) today`}
                    >
                      {(() => {
                        const name = event.medicationName;
                        const words = name.split(' ').filter(w => w.length > 0);
                        
                        if (words.length >= 2) {
                          return (words[0].charAt(0) + words[1].charAt(0)).toUpperCase();
                        } else {
                          return name.substring(0, 2).toUpperCase();
                        }
                      })()}
                    </span>
                  ))}
                </>
              );
            })()}
          </div>
        </div>

        {/* Summary dots for mobile */}
        {dayEvents.length > 0 && (
          <div className="absolute bottom-1 right-1 flex space-x-0.5">
            {getEventTypeCount('taken') > 0 && (
              <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
            )}
            {(getEventTypeCount('missed') + getEventTypeCount('skipped')) > 0 && (
              <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>
            )}
            {getEventTypeCount('scheduled') > 0 && (
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
            )}
          </div>
        )}
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-3 sm:p-4 lg:p-6 space-y-6">
        {/* Header */}
        <div className="bg-white rounded-lg shadow p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="mobile-title text-gray-900">Calendar</h1>
              <p className="mobile-text text-gray-500 mt-1">
                Track your medication history and upcoming doses
              </p>
            </div>

            {/* Controls */}
            <div className="flex flex-col sm:flex-row gap-3">
              {/* Medication Filter */}
              <select
                value={selectedMedication}
                onChange={(e) => setSelectedMedication(e.target.value)}
                className="mobile-input sm:w-48"
                style={{ fontSize: '16px' }}
              >
            <option value="all">All Medications</option>
            {medications.filter(med => med.isActive).map((med) => (
              <option key={med.id} value={med.id}>
                {med.name}
              </option>
            ))}
          </select>

          {/* View Mode Toggle */}
          <div className="flex rounded-lg border border-gray-300 overflow-hidden">
            <button
              onClick={() => setViewMode('week')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                viewMode === 'week'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              Week
            </button>
            <button
              onClick={() => setViewMode('month')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                viewMode === 'month'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              Month
            </button>
          </div>
          </div>
        </div>

        {/* Main Calendar Layout */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="p-4 sm:p-6 max-h-[calc(100vh-300px)] overflow-y-auto mobile-scroll">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 lg:gap-6">
        {/* Calendar Grid */}
        <div className="lg:col-span-3">
          <div className="mobile-card">
            {/* Calendar Header */}
            <div className="card-header pb-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">
                  {format(selectedDate, 'MMMM yyyy')}
                </h2>
                
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => navigateCalendar('prev')}
                    className="mobile-button p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 min-h-[44px] touch-manipulation"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  
                  <button
                    onClick={goToToday}
                    className="mobile-button px-3 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg min-h-[44px] touch-manipulation"
                  >
                    Today
                  </button>
                  
                  <button
                    onClick={() => navigateCalendar('next')}
                    className="mobile-button p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 min-h-[44px] touch-manipulation"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Calendar Grid */}
            <div className="mobile-card pt-0 overflow-hidden">
              {/* Days of week header */}
              <div className="grid grid-cols-7 border-b border-gray-200 mb-3">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                  <div key={day} className="p-2 sm:p-3 text-center mobile-text font-semibold text-gray-700">
                    <span className="hidden sm:inline">{day}</span>
                    <span className="sm:hidden text-xs">{day.charAt(0)}</span>
                  </div>
                ))}
              </div>

              {/* Calendar body */}
              <div className="grid grid-cols-7 gap-0 border border-gray-300 rounded-lg overflow-hidden shadow-sm">
                {calendarDays.map((date) => (
                  <CalendarDay key={date.toISOString()} date={date} />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Selected Date Details */}
        <div className="space-y-4">
          <div className="mobile-card">
            <div className="card-header">
              <h3 className="mobile-subtitle text-gray-900">
                {format(selectedDate, 'EEEE')}
              </h3>
              <p className="mobile-text text-gray-500">
                {format(selectedDate, 'MMMM d, yyyy')}
              </p>
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
                <div className="space-y-3">
                  {selectedDateEvents.map((event) => {
                    const isHighlighted = highlightedLogId && event.id.includes(highlightedLogId);
                    return (
                    <div
                      key={event.id}
                      className={`p-3 rounded-lg border transition-all duration-500 ${
                        isHighlighted 
                          ? 'bg-primary-100 border-primary-300 ring-2 ring-primary-200 shadow-lg transform scale-105' 
                          : event.status === 'taken' ? 'bg-green-50 border-green-200' :
                            event.status === 'missed' || event.status === 'skipped' ? 'bg-red-50 border-red-200' :
                            'bg-blue-50 border-blue-200'
                      }`}
                    >
                      <div className="flex items-start space-x-3">
                        <EventStatusIcon status={event.status} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2">
                            <div
                              className="w-3 h-3 rounded-full flex-shrink-0"
                              style={{ backgroundColor: event.medicationColor }}
                            />
                            <p className="text-sm font-medium text-gray-900">
                              {event.medicationName}
                              {isHighlighted && (
                                <span className="ml-2 text-xs px-2 py-1 bg-primary-200 text-primary-800 rounded-full font-medium">
                                  ⭐ Found
                                </span>
                              )}
                            </p>
                          </div>
                          
                          <p className="text-xs text-gray-600 mt-1">
                            {event.dosageInfo} • {event.time}
                          </p>

                          {event.status === 'scheduled' && (
                            <p className="text-xs text-blue-600 font-medium mt-1">
                              📅 Scheduled dose
                            </p>
                          )}

                          {event.cyclicPhase && event.cyclicPhase !== 'maintenance' && (
                            <p className="text-xs text-purple-600 font-medium mt-1">
                              🔄 Cyclic: {event.cyclicPhase}
                            </p>
                          )}

                          {event.isTapered && (
                            <p className="text-xs text-orange-600 font-medium mt-1">
                              📉 Tapering dose
                            </p>
                          )}

                          {event.skipReason && (
                            <p className="text-xs text-red-600 mt-1">
                              💭 Skipped: {event.skipReason}
                            </p>
                          )}

                          {event.notes && (
                            <p className="text-xs text-gray-600 mt-1">
                              📝 {event.notes}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Legend */}
          <div className="mobile-card">
            <div className="card-header">
              <h3 className="mobile-subtitle text-gray-900">Legend</h3>
            </div>
            <div className="card-content">
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span className="mobile-text text-gray-700">Taken</span>
                </div>
                <div className="flex items-center space-x-2">
                  <XCircle className="h-4 w-4 text-red-500" />
                  <span className="mobile-text text-gray-700">Missed/Skipped</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Clock className="h-4 w-4 text-blue-500" />
                  <span className="mobile-text text-gray-700">Scheduled</span>
                </div>
              </div>
            </div>
          </div>
        </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    </div>
  );
}
