import { NavLink } from 'react-router-dom';
import { 
  X, 
  Home, 
  Pill, 
  // Calendar,  // DISABLED
  BarChart3, 
  Settings, 
  Heart,
  Bell,
  FileText,
  Package,
  Book,
  Activity
} from 'lucide-react';
import { cn } from '@/utils/helpers';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: Home },
  { name: 'Medications', href: '/medications', icon: Pill },
  { name: 'Inventory', href: '/inventory', icon: Package },
  // { name: 'Calendar', href: '/calendar', icon: Calendar },  // DISABLED
  { name: 'Analytics', href: '/analytics', icon: BarChart3 },
  { name: 'Settings', href: '/settings', icon: Settings },
];

const secondaryNavigation = [
  { name: 'Advanced Schedules', href: '/cyclic-dosing', icon: Activity },
  { name: 'Wiki', href: '/wiki', icon: Book },
  { name: 'Reminders', href: '/reminders', icon: Bell },
  { name: 'Reports', href: '/reports', icon: FileText },
  { name: 'Health Profile', href: '/profile', icon: Heart },
];

export function Sidebar({ isOpen, onClose }: SidebarProps) {

  const NavItem = ({ item, onClick }: { item: typeof navigation[0]; onClick?: () => void }) => {
    // Generate data-testid based on the item name
    const testId = `sidebar-${item.name.toLowerCase().replace(/\s+/g, '-')}`;
    
    return (
      <NavLink
        to={item.href}
        onClick={onClick}
        data-testid={testId}
        className={({ isActive }) =>
          cn(
            'flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors',
            isActive
              ? 'bg-primary-100 text-primary-700 border-r-2 border-primary-600'
              : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
          )
        }
      >
        <item.icon className="mr-3 h-5 w-5 flex-shrink-0" />
        {item.name}
      </NavLink>
    );
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-gray-600 bg-opacity-75 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <div
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 transform transition-transform lg:translate-x-0 lg:static lg:inset-0',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200">
            <div className="flex items-center space-x-3" data-testid="header-logo">
              <div className="h-8 w-8 bg-primary-600 rounded-lg flex items-center justify-center">
                <Pill className="h-5 w-5 text-white" />
              </div>
              <span className="text-lg font-semibold text-gray-900">MedTrack</span>
            </div>
            <button
              onClick={onClose}
              className="lg:hidden p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-1">
            <div className="space-y-1">
              {navigation.map((item) => (
                <NavItem key={item.name} item={item} onClick={() => isOpen && onClose()} />
              ))}
            </div>

            <div className="pt-6">
              <h3 className="px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Tools
              </h3>
              <div className="mt-2 space-y-1">
                {secondaryNavigation.map((item) => (
                  <NavItem key={item.name} item={item} onClick={() => isOpen && onClose()} />
                ))}
              </div>
            </div>
          </nav>

          {/* Footer */}
          <div className="border-t border-gray-200 p-4">
            <div className="flex items-center space-x-3" data-testid="footer-help">
              <div className="h-8 w-8 bg-green-100 rounded-full flex items-center justify-center">
                <Heart className="h-4 w-4 text-green-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-500">Stay healthy</p>
                <p className="text-xs text-gray-400" data-testid="footer-privacy">Track your progress</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
