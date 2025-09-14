import React from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from 'lucide-react';
import { useMedicationStore } from '@/store';
import { formatTime, formatDate, isSameDay, formatPillDisplayShort } from '@/utils/helpers';
import { CalendarEvent, AdherenceStatus } from '@/types';
import { format, addDays, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isToday } from 'date-fns';

export function Calendar() {
  const {
    medications,
    logs,
    reminders,
    markMedicationTaken,
    markMedicationMissed,
    getCurrentDose
  } = useMedicationStore();

  const [selectedDate, setSelectedDate] = React.useState(new Date());
  const [viewMode, setViewMode] = React.useState<'week' | 'month'>('week');
  const [selectedMedication, setSelectedMedication] = React.useState<string | 'all'>('all');

  // Generate calendar events
  const generateCalendarEvents = React.useCallback((): CalendarEvent[] => {
    const events: CalendarEvent[] = [];
    const activeMedications = medications.filter(med => med.isActive);

    // Add logged medications as events
    logs.forEach(log => {
      const medication = medications.find(med => med.id === log.medicationId);
      if (medication) {
          events.push({
            id: log.id,
            medicationId: log.medicationId,
            medicationName: medication.name,
            dosageInfo: medication.useMultiplePills ? formatPillDisplayShort(medication) : `${medication.dosage} ${medication.unit}`,
            time: formatTime(new Date(log.timestamp)),
            type: log.adherence === 'taken' ? 'taken' : 'missed',
            status: log.adherence,
            date: new Date(log.timestamp),
          } as any);
      }
    });

    // Add reminders as upcoming events
    const today = new Date();
    const endDate = viewMode === 'week' ? addDays(today, 7) : addDays(today, 30);
    
    for (let date = today; date <= endDate; date = addDays(date, 1)) {
      const dayName = format(date, 'EEEE').toLowerCase();
      
      // Process medications with reminders
      reminders.forEach(reminder => {
        const medication = activeMedications.find(med => med.id === reminder.medicationId);
        if (medication && reminder.isActive && reminder.days.includes(dayName as any)) {
          // Check if this reminder was already logged
          const existingLog = logs.find(log => 
            log.medicationId === reminder.medicationId && 
            isSameDay(new Date(log.timestamp), date)
          );

          if (!existingLog) {
            // Get current dose for this date (considering cyclic dosing)
            const currentDose = getCurrentDose(reminder.medicationId);
            let dosageInfo = medication.useMultiplePills ? formatPillDisplayShort(medication) : `${medication.dosage} ${medication.unit}`;
            
            // If cyclic dosing is active and dose is different, show adjusted dose
            if (medication.cyclicDosing?.isActive && currentDose.phase !== 'maintenance') {
              const adjustedDoseText = medication.useMultiplePills 
                ? `${currentDose.dose} ${medication.doseConfigurations?.find(config => config.id === medication.defaultDoseConfigurationId)?.totalDoseUnit || medication.unit}`
                : `${currentDose.dose} ${medication.unit}`;
              dosageInfo = `${adjustedDoseText} (${currentDose.phase})`;
            }
            
            events.push({
              id: `${reminder.id}-${format(date, 'yyyy-MM-dd')}`,
              medicationId: reminder.medicationId,
              medicationName: medication.name,
              dosageInfo: dosageInfo,
              time: reminder.time,
              type: 'reminder',
              status: 'upcoming',
              date,
              cyclicPhase: medication.cyclicDosing?.isActive ? currentDose.phase : undefined,
              cyclicMessage: medication.cyclicDosing?.isActive ? currentDose.message : undefined,
            } as any);
          }
        }
      });
      
      // Add medications without reminders as informational entries (for today only to avoid clutter)
      if (isSameDay(date, today)) {
        const medicationsWithReminders = new Set(reminders.map(r => r.medicationId));
        activeMedications.forEach(medication => {
          if (!medicationsWithReminders.has(medication.id)) {
            // Check if this medication was already logged today
            const existingLog = logs.find(log => 
              log.medicationId === medication.id && 
              isSameDay(new Date(log.timestamp), date)
            );

            if (!existingLog) {
              // Get current dose for this date (considering cyclic dosing)
              const currentDose = getCurrentDose(medication.id);
              let dosageInfo = medication.useMultiplePills ? formatPillDisplayShort(medication) : `${medication.dosage} ${medication.unit}`;
              
              // If cyclic dosing is active and dose is different, show adjusted dose
              if (medication.cyclicDosing?.isActive && currentDose.phase !== 'maintenance') {
                const adjustedDoseText = medication.useMultiplePills 
                  ? `${currentDose.dose} ${medication.doseConfigurations?.find(config => config.id === medication.defaultDoseConfigurationId)?.totalDoseUnit || medication.unit}`
                  : `${currentDose.dose} ${medication.unit}`;
                dosageInfo = `${adjustedDoseText} (${currentDose.phase})`;
              }
              
              events.push({
                id: `no-reminder-${medication.id}-${format(date, 'yyyy-MM-dd')}`,
                medicationId: medication.id,
                medicationName: medication.name,
                dosageInfo: dosageInfo,
                time: 'No reminder set',
                type: 'reminder',
                status: 'upcoming',
                date,
                cyclicPhase: medication.cyclicDosing?.isActive ? currentDose.phase : undefined,
                cyclicMessage: medication.cyclicDosing?.isActive ? currentDose.message : undefined,
              } as any);
            }
          }
        });
      }
    }

    return events.sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [medications, logs, reminders, viewMode]);

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

  const handleMedicationAction = (medicationId: string, action: 'taken' | 'missed') => {
    if (action === 'taken') {
      markMedicationTaken(medicationId);
    } else {
      markMedicationMissed(medicationId);
    }
  };

  const navigateCalendar = (direction: 'prev' | 'next') => {
    if (viewMode === 'week') {
      setSelectedDate(prev => addDays(prev, direction === 'next' ? 7 : -7));
    } else {
      setSelectedDate(prev => new Date(prev.getFullYear(), prev.getMonth() + (direction === 'next' ? 1 : -1), 1));
    }
  };

  const EventIcon = ({ status }: { status: AdherenceStatus | 'upcoming' }) => {
    switch (status) {
      case 'taken':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'missed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'upcoming':
        return <Clock className="h-4 w-4 text-blue-500" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
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
        <div className="space-y-1">
          {dayEvents.slice(0, 2).map((event) => (
            <div
              key={event.id}
              className="flex items-center space-x-1 text-xs"
            >
              <EventIcon status={event.status} />
              <span className="truncate">{event.medicationName}</span>
            </div>
          ))}
          {dayEvents.length > 2 && (
            <div className="text-xs text-gray-500">
              +{dayEvents.length - 2} more
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
            View and manage your medication schedule
          </p>
        </div>
        <div className="mt-4 sm:mt-0 flex items-center space-x-3">
          <select
            value={selectedMedication}
            onChange={(e) => setSelectedMedication(e.target.value)}
            className="input"
          >
            <option value="all">All Medications</option>
            {medications.filter(med => med.isActive).map(med => (
              <option key={med.id} value={med.id}>{med.name}</option>
            ))}
          </select>
          <div className="flex rounded-md shadow-sm">
            <button
              onClick={() => setViewMode('week')}
              className={`px-3 py-2 text-sm font-medium rounded-l-md border ${
                viewMode === 'week' 
                  ? 'bg-primary-600 text-white border-primary-600' 
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              Week
            </button>
            <button
              onClick={() => setViewMode('month')}
              className={`px-3 py-2 text-sm font-medium rounded-r-md border-t border-r border-b ${
                viewMode === 'month' 
                  ? 'bg-primary-600 text-white border-primary-600' 
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              Month
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar Grid */}
        <div className="lg:col-span-2">
          <div className="card">
            <div className="card-header">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">
                  {format(selectedDate, 'MMMM yyyy')}
                </h3>
                <div className="flex items-center space-x-2">
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
                    {monthDays.map((date, index) => (
                      <CalendarDay
                        key={index}
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
                    No medications scheduled for this day.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedDateEvents.map((event) => (
                    <div
                      key={event.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex items-center space-x-3">
                        <EventIcon status={event.status} />
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {event.medicationName}
                          </p>
                          <p className="text-xs text-gray-500">
                            {(event as any).dosageInfo} • {event.time}
                          </p>
                          {(event as any).cyclicPhase && (event as any).cyclicPhase !== 'maintenance' && (
                            <p className="text-xs text-indigo-600 font-medium">
                              📊 Cyclic phase: {(event as any).cyclicPhase}
                            </p>
                          )}
                          {(event as any).cyclicMessage && (
                            <p className="text-xs text-indigo-500 italic">
                              💡 {(event as any).cyclicMessage}
                            </p>
                          )}
                        </div>
                      </div>
                      {event.status === 'upcoming' && (
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleMedicationAction(event.medicationId, 'taken')}
                            className="btn-success text-xs px-2 py-1"
                          >
                            Take
                          </button>
                          <button
                            onClick={() => handleMedicationAction(event.medicationId, 'missed')}
                            className="btn-secondary text-xs px-2 py-1"
                          >
                            Skip
                          </button>
                        </div>
                      )}
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
                  <span className="text-sm text-gray-700">Upcoming</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
