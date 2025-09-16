import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu, Bell, Search, User, Clock, Settings, Heart, ChevronDown, Pill } from 'lucide-react';
import { useMedicationStore } from '@/store';
import { formatTime } from '@/utils/helpers';
import { useGlobalSearch } from '@/hooks/useGlobalSearch';
import { SearchResults } from '@/components/ui/SearchResults';

interface HeaderProps {
  onMenuClick: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const navigate = useNavigate();
  const { getTodaysReminders, userProfile } = useMedicationStore();
  const [currentTime, setCurrentTime] = React.useState(new Date());
  const [showNotificationDropdown, setShowNotificationDropdown] = React.useState(false);
  const [showProfileDropdown, setShowProfileDropdown] = React.useState(false);
  const [showSearchResults, setShowSearchResults] = React.useState(false);
  const [showMobileSearch, setShowMobileSearch] = React.useState(false);
  
  // Search functionality
  const {
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
  } = useGlobalSearch();
  
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  // Update time every minute
  React.useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);

    return () => clearInterval(timer);
  }, []);

  // Close dropdowns when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest('.dropdown-container') && !target.closest('.search-container') && !target.closest('.mobile-search-modal')) {
        setShowNotificationDropdown(false);
        setShowProfileDropdown(false);
        setShowSearchResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle mobile search
  const handleMobileSearchOpen = () => {
    setShowMobileSearch(true);
    setShowSearchResults(true);
  };

  const handleMobileSearchClose = () => {
    setShowMobileSearch(false);
    setShowSearchResults(false);
    clearSearch();
  };

  // Search event handlers
  const handleSearchFocus = () => {
    setShowSearchResults(true);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchTerm(value);
    setShowSearchResults(true);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setShowSearchResults(false);
      searchInputRef.current?.blur();
    } else if (showSearchResults) {
      handleKeyNavigation(e);
    }
  };

  const handleSelectSearchResult = (result: any) => {
    selectResult(result);
    setShowSearchResults(false);
    setShowMobileSearch(false);
    searchInputRef.current?.blur();
  };

  const todaysReminders = getTodaysReminders();
  const upcomingReminders = todaysReminders.filter(reminder => {
    const reminderTime = new Date();
    const [hours, minutes] = reminder.time.split(':').map(Number);
    reminderTime.setHours(hours, minutes, 0, 0);
    return reminderTime > currentTime;
  });

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shadow-sm backdrop-blur-sm bg-white/95 supports-[backdrop-filter]:bg-white/95">
      {/* Left side */}
      <div className="flex items-center space-x-3 sm:space-x-4">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500 touch-target"
        >
          <Menu className="h-5 w-5" />
        </button>
        
        {/* Mobile Logo */}
        <div className="sm:hidden flex items-center space-x-2">
          <div className="h-8 w-8 bg-primary-600 rounded-lg flex items-center justify-center">
            <Pill className="h-5 w-5 text-white" />
          </div>
          <span className="text-lg font-semibold text-gray-900">Meditrax</span>
        </div>
        
        {/* Desktop Greeting */}
        <div className="hidden sm:block">
          <h1 className="text-xl font-semibold text-gray-900" data-testid="header-logo">
            Good {currentTime.getHours() < 12 ? 'morning' : currentTime.getHours() < 18 ? 'afternoon' : 'evening'}
            {userProfile?.name && `, ${userProfile.name.split(' ')[0]}`}
          </h1>
          <p className="text-sm text-gray-500">
            {formatTime(currentTime)} • {currentTime.toLocaleDateString('en-US', { 
              weekday: 'long', 
              month: 'long', 
              day: 'numeric' 
            })}
          </p>
        </div>
      </div>

      {/* Center - Search */}
      <div className="hidden md:flex flex-1 max-w-md mx-8">
        <div className="relative w-full search-container">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search medications, logs, pages..."
            value={searchTerm}
            onChange={handleSearchChange}
            onFocus={handleSearchFocus}
            onKeyDown={handleSearchKeyDown}
            className="mobile-search"
            data-testid="search-input"
          />
          
          {/* Search Results Dropdown */}
          {showSearchResults && (
            <SearchResults
              categories={searchResults}
              isSearching={isSearching}
              hasResults={hasResults}
              selectedIndex={selectedIndex}
              onSelectResult={handleSelectSearchResult}
              searchTerm={searchTerm}
            />
          )}
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center space-x-3">
        {/* Mobile Search Button */}
        <button
          onClick={handleMobileSearchOpen}
          className="md:hidden p-2 text-gray-400 hover:text-gray-500 hover:bg-gray-100 rounded-full touch-target transition-colors"
          title="Search"
        >
          <Search className="h-5 w-5" />
        </button>
        {/* Notifications */}
        <div className="relative dropdown-container">
          <button 
            onClick={() => setShowNotificationDropdown(!showNotificationDropdown)}
            className="relative p-2 text-gray-400 hover:text-gray-500 hover:bg-gray-100 rounded-full touch-target transition-colors" 
            data-testid="header-notifications"
            title={`${upcomingReminders.length} upcoming reminders - Click to view all reminders`}
          >
            <Bell className="h-5 w-5" />
            {upcomingReminders.length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 h-4 w-4 bg-red-500 rounded-full flex items-center justify-center">
                <span className="text-xs text-white font-medium">
                  {upcomingReminders.length > 9 ? '9+' : upcomingReminders.length}
                </span>
              </span>
            )}
          </button>

          {/* Notifications Dropdown */}
          {showNotificationDropdown && (
            <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-900">Upcoming Reminders</h3>
                  <button
                    onClick={() => {
                      setShowNotificationDropdown(false);
                      navigate('/reminders');
                    }}
                    className="text-xs text-primary-600 hover:text-primary-700"
                  >
                    View All
                  </button>
                </div>
                
                {upcomingReminders.length === 0 ? (
                  <p className="text-sm text-gray-500">No upcoming reminders today</p>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {upcomingReminders.slice(0, 5).map((reminder) => (
                      <div key={reminder.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <div className="flex items-center space-x-2">
                          <Clock className="h-4 w-4 text-gray-400" />
                          <div>
                            <p className="text-sm font-medium text-gray-900">{reminder.medication.name}</p>
                            <p className="text-xs text-gray-500">{reminder.time}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            setShowNotificationDropdown(false);
                            navigate('/reminders');
                          }}
                          className="text-xs text-primary-600 hover:text-primary-700"
                        >
                          View
                        </button>
                      </div>
                    ))}
                    {upcomingReminders.length > 5 && (
                      <p className="text-xs text-gray-500 text-center pt-2">
                        And {upcomingReminders.length - 5} more...
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Profile */}
        <div className="relative dropdown-container">
          <button 
            onClick={() => setShowProfileDropdown(!showProfileDropdown)}
            className="flex items-center space-x-2 p-2 text-gray-400 hover:text-gray-500 hover:bg-gray-100 rounded-lg touch-target transition-colors" 
            data-testid="header-settings"
            title={`${userProfile?.name ? `Manage ${userProfile.name}'s profile` : 'Manage your health profile'}`}
          >
            <div className="h-8 w-8 bg-primary-100 rounded-full flex items-center justify-center">
              <User className="h-4 w-4 text-primary-600" />
            </div>
            {userProfile?.name && (
              <span className="hidden sm:block text-sm font-medium text-gray-700">
                {userProfile.name}
              </span>
            )}
            <ChevronDown className="h-3 w-3 text-gray-400" />
          </button>

          {/* Profile Dropdown */}
          {showProfileDropdown && (
            <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
              <div className="p-2">
                {userProfile?.name && (
                  <div className="px-3 py-2 border-b border-gray-100">
                    <p className="text-sm font-semibold text-gray-900">{userProfile.name}</p>
                    <p className="text-xs text-gray-500">Account Settings</p>
                  </div>
                )}
                
                <div className="py-1">
                  <button
                    onClick={() => {
                      setShowProfileDropdown(false);
                      navigate('/profile');
                    }}
                    className="w-full flex items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded"
                  >
                    <Heart className="h-4 w-4 mr-3 text-gray-400" />
                    Health Profile
                  </button>
                  
                  <button
                    onClick={() => {
                      setShowProfileDropdown(false);
                      navigate('/settings');
                    }}
                    className="w-full flex items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded"
                  >
                    <Settings className="h-4 w-4 mr-3 text-gray-400" />
                    Settings
                  </button>
                  
                  <button
                    onClick={() => {
                      setShowProfileDropdown(false);
                      navigate('/analytics');
                    }}
                    className="w-full flex items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded"
                  >
                    <Clock className="h-4 w-4 mr-3 text-gray-400" />
                    Analytics
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Search Modal */}
      {showMobileSearch && (
        <div className="fixed inset-0 z-50 bg-white mobile-search-modal md:hidden">
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900">Search</h2>
              <button
                onClick={handleMobileSearchClose}
                className="p-2 text-gray-400 hover:text-gray-500 rounded-full touch-target"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="flex-1 p-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search medications, logs, pages..."
                  value={searchTerm}
                  onChange={handleSearchChange}
                  onKeyDown={handleSearchKeyDown}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base"
                  autoFocus
                />
              </div>
              
              {/* Mobile Search Results */}
              <div className="mt-4 flex-1 overflow-hidden">
                <SearchResults
                  categories={searchResults}
                  isSearching={isSearching}
                  hasResults={hasResults}
                  selectedIndex={selectedIndex}
                  onSelectResult={handleSelectSearchResult}
                  searchTerm={searchTerm}
                  isMobile={true}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
