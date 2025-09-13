import React from 'react';
import { Menu, Bell, Search, User } from 'lucide-react';
import { useMedicationStore } from '@/store';
import { formatTime } from '@/utils/helpers';

interface HeaderProps {
  onMenuClick: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const { getTodaysReminders, userProfile } = useMedicationStore();
  const [currentTime, setCurrentTime] = React.useState(new Date());

  // Update time every minute
  React.useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);

    return () => clearInterval(timer);
  }, []);

  const todaysReminders = getTodaysReminders();
  const upcomingReminders = todaysReminders.filter(reminder => {
    const reminderTime = new Date();
    const [hours, minutes] = reminder.time.split(':').map(Number);
    reminderTime.setHours(hours, minutes, 0, 0);
    return reminderTime > currentTime;
  });

  return (
    <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
      {/* Left side */}
      <div className="flex items-center space-x-4">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500 touch-target"
        >
          <Menu className="h-5 w-5" />
        </button>
        
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
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search medications..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            data-testid="search-button"
          />
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center space-x-3">
        {/* Notifications */}
        <div className="relative">
          <button className="relative p-2 text-gray-400 hover:text-gray-500 hover:bg-gray-100 rounded-full touch-target" data-testid="header-notifications">
            <Bell className="h-5 w-5" />
            {upcomingReminders.length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 h-4 w-4 bg-red-500 rounded-full flex items-center justify-center">
                <span className="text-xs text-white font-medium">
                  {upcomingReminders.length > 9 ? '9+' : upcomingReminders.length}
                </span>
              </span>
            )}
          </button>
        </div>

        {/* Profile */}
        <div className="relative">
          <button className="flex items-center space-x-2 p-2 text-gray-400 hover:text-gray-500 hover:bg-gray-100 rounded-lg touch-target" data-testid="header-settings">
            <div className="h-8 w-8 bg-primary-100 rounded-full flex items-center justify-center">
              <User className="h-4 w-4 text-primary-600" />
            </div>
            {userProfile?.name && (
              <span className="hidden sm:block text-sm font-medium text-gray-700">
                {userProfile.name}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
