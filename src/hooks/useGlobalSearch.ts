import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useMedicationStore } from '@/store';
import { searchMedicationDatabase, getMedicationSuggestions } from '@/services/medicationDatabase';
import { filterMedicationsBySearch } from '@/utils/helpers';
import { Medication, MedicationLog, Reminder } from '@/types';

export interface SearchResult {
  id: string;
  type: 'medication' | 'database_medication' | 'log' | 'reminder' | 'page';
  title: string;
  subtitle?: string;
  description?: string;
  metadata?: string;
  icon?: string;
  href?: string;
  action?: () => void;
  medication?: Medication;
  riskLevel?: string;
}

export interface SearchResultCategory {
  name: string;
  results: SearchResult[];
  icon: string;
}

export interface UseGlobalSearchReturn {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  searchResults: SearchResultCategory[];
  isSearching: boolean;
  hasResults: boolean;
  clearSearch: () => void;
  selectResult: (result: SearchResult) => void;
  selectedIndex: number;
  setSelectedIndex: (index: number) => void;
  handleKeyNavigation: (event: React.KeyboardEvent) => void;
}

// Available pages for search
const SEARCHABLE_PAGES = [
  { name: 'Dashboard', href: '/dashboard', icon: '🏠', description: 'Overview of your medications and health data' },
  { name: 'Medications', href: '/medications', icon: '💊', description: 'Manage your medications and prescriptions' },
  { name: 'Inventory', href: '/inventory', icon: '📦', description: 'Track your medication inventory and refills' },
  { name: 'Calendar', href: '/calendar', icon: '📅', description: 'View medication schedule and history' },
  { name: 'Analytics', href: '/analytics', icon: '📊', description: 'Analyze medication adherence and patterns' },
  { name: 'Reminders', href: '/reminders', icon: '🔔', description: 'Manage medication reminders and notifications' },
  { name: 'Reports', href: '/reports', icon: '📄', description: 'Generate and export medication reports' },
  { name: 'Settings', href: '/settings', icon: '⚙️', description: 'Configure app preferences and settings' },
  { name: 'Health Profile', href: '/profile', icon: '❤️', description: 'Manage your health profile and medical information' },
  { name: 'Wiki', href: '/wiki', icon: '📚', description: 'Learn about medications and health topics' },
  { name: 'Advanced Schedules', href: '/cyclic-dosing', icon: '🔄', description: 'Set up cyclic dosing and tapering schedules' },
];

export function useGlobalSearch(): UseGlobalSearchReturn {
  const navigate = useNavigate();
  const { medications, logs, reminders } = useMedicationStore();
  
  const [searchTerm, setSearchTerm] = React.useState('');
  const [selectedIndex, setSelectedIndex] = React.useState(-1);
  const [isSearching, setIsSearching] = React.useState(false);

  // Debounced search to avoid too many operations
  const [debouncedSearchTerm, setDebouncedSearchTerm] = React.useState('');
  
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 150);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  const searchResults = React.useMemo(() => {
    if (!debouncedSearchTerm.trim()) {
      return [];
    }

    setIsSearching(true);
    const term = debouncedSearchTerm.toLowerCase();
    const categories: SearchResultCategory[] = [];

    try {
      // 1. Search user's medications
      const userMedications = filterMedicationsBySearch(medications, term);
      if (userMedications.length > 0) {
        categories.push({
          name: 'Your Medications',
          icon: '💊',
          results: userMedications.slice(0, 5).map((med) => ({
            id: `med-${med.id}`,
            type: 'medication',
            title: med.name,
            subtitle: `${med.dosage} ${med.unit} • ${med.frequency.replace('-', ' ')}`,
            description: med.notes || `${med.category.replace('-', ' ')} medication`,
            metadata: med.isActive ? 'Active' : 'Inactive',
            riskLevel: med.riskLevel,
            href: '/medications',
            medication: med,
            action: () => {
              navigate(`/medications?highlight=${med.id}`);
            }
          }))
        });
      }

      // 2. Search medication database for discovery
      const databaseResults = searchMedicationDatabase(term);
      if (databaseResults.length > 0) {
        categories.push({
          name: 'Add New Medication',
          icon: '🔍',
          results: databaseResults.slice(0, 4).map((med) => ({
            id: `db-${med.name}`,
            type: 'database_medication',
            title: med.name,
            subtitle: med.genericName || `${med.category} medication`,
            description: med.description || 'Click to add this medication',
            riskLevel: med.riskLevel,
            action: () => {
              navigate(`/medications?add=${encodeURIComponent(med.name)}`);
            }
          }))
        });
      }

      // 3. Search medication logs
      const logResults = logs.filter(log => 
        log.notes?.toLowerCase().includes(term) ||
        log.sideEffectsReported?.some(effect => 
          effect.toLowerCase().includes(term)
        )
      );
      if (logResults.length > 0) {
        const medicationMap = new Map(medications.map(med => [med.id, med]));
        categories.push({
          name: 'Medication Logs',
          icon: '📝',
          results: logResults.slice(0, 3).map((log) => {
            const medication = medicationMap.get(log.medicationId);
            const logDate = new Date(log.timestamp);
            return {
              id: `log-${log.id}`,
              type: 'log',
              title: medication?.name || 'Unknown Medication',
              subtitle: `${logDate.toLocaleDateString()} at ${logDate.toLocaleTimeString()}`,
              description: log.notes || 'Medication log entry',
              metadata: log.adherence,
              href: '/calendar',
              action: () => {
                const dateStr = logDate.toISOString().split('T')[0];
                navigate(`/calendar?date=${dateStr}&highlight=${log.id}`);
              }
            };
          })
        });
      }

      // 4. Search reminders
      const reminderResults = reminders.filter(reminder => {
        const medication = medications.find(med => med.id === reminder.medicationId);
        return medication?.name.toLowerCase().includes(term) ||
               reminder.customMessage?.toLowerCase().includes(term);
      });
      if (reminderResults.length > 0) {
        const medicationMap = new Map(medications.map(med => [med.id, med]));
        categories.push({
          name: 'Reminders',
          icon: '🔔',
          results: reminderResults.slice(0, 3).map((reminder) => {
            const medication = medicationMap.get(reminder.medicationId);
            return {
              id: `reminder-${reminder.id}`,
              type: 'reminder',
              title: medication?.name || 'Unknown Medication',
              subtitle: `${reminder.time} • ${reminder.days.join(', ')}`,
              description: reminder.customMessage || 'Medication reminder',
              metadata: reminder.isActive ? 'Active' : 'Inactive',
              href: '/reminders',
              action: () => {
                navigate('/reminders');
              }
            };
          })
        });
      }

      // 5. Search pages/navigation
      const pageResults = SEARCHABLE_PAGES.filter(page =>
        page.name.toLowerCase().includes(term) ||
        page.description.toLowerCase().includes(term)
      );
      if (pageResults.length > 0) {
        categories.push({
          name: 'Pages',
          icon: '🧭',
          results: pageResults.slice(0, 3).map((page) => ({
            id: `page-${page.href}`,
            type: 'page',
            title: page.name,
            subtitle: page.description,
            icon: page.icon,
            href: page.href,
            action: () => {
              navigate(page.href);
            }
          }))
        });
      }

    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsSearching(false);
    }

    return categories;
  }, [debouncedSearchTerm, medications, logs, reminders, navigate]);

  const hasResults = searchResults.length > 0;

  const clearSearch = React.useCallback(() => {
    setSearchTerm('');
    setSelectedIndex(-1);
  }, []);

  const selectResult = React.useCallback((result: SearchResult) => {
    if (result.action) {
      result.action();
    } else if (result.href) {
      navigate(result.href);
    }
    clearSearch();
  }, [navigate, clearSearch]);

  // Get flattened list of all results for keyboard navigation
  const flatResults = React.useMemo(() => {
    return searchResults.flatMap(category => category.results);
  }, [searchResults]);

  const handleKeyNavigation = React.useCallback((event: React.KeyboardEvent) => {
    if (!hasResults) return;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setSelectedIndex(prev => 
          prev < flatResults.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        event.preventDefault();
        setSelectedIndex(prev => 
          prev > 0 ? prev - 1 : flatResults.length - 1
        );
        break;
      case 'Enter':
        event.preventDefault();
        if (selectedIndex >= 0 && flatResults[selectedIndex]) {
          selectResult(flatResults[selectedIndex]);
        }
        break;
      case 'Escape':
        event.preventDefault();
        clearSearch();
        break;
    }
  }, [hasResults, flatResults, selectedIndex, selectResult, clearSearch]);

  // Reset selected index when search term changes
  React.useEffect(() => {
    setSelectedIndex(-1);
  }, [debouncedSearchTerm]);

  return {
    searchTerm,
    setSearchTerm,
    searchResults,
    isSearching,
    hasResults,
    clearSearch,
    selectResult,
    selectedIndex,
    setSelectedIndex,
    handleKeyNavigation,
  };
}
