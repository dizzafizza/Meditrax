import React from 'react';
import { 
  Search, 
  Loader2, 
  Pill, 
  Plus, 
  FileText, 
  Bell, 
  Calendar,
  Shield,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';
import { SearchResultCategory, SearchResult } from '@/hooks/useGlobalSearch';
import { cn } from '@/utils/helpers';

interface SearchResultsProps {
  categories: SearchResultCategory[];
  isSearching: boolean;
  hasResults: boolean;
  selectedIndex: number;
  onSelectResult: (result: SearchResult) => void;
  searchTerm: string;
  isMobile?: boolean;
}

const getCategoryIcon = (iconName: string) => {
  const iconMap: Record<string, React.ReactNode> = {
    '💊': <Pill className="h-4 w-4" />,
    '🔍': <Search className="h-4 w-4" />,
    '📝': <FileText className="h-4 w-4" />,
    '🔔': <Bell className="h-4 w-4" />,
    '🧭': <Calendar className="h-4 w-4" />,
  };
  return iconMap[iconName] || <Search className="h-4 w-4" />;
};

const getRiskIcon = (riskLevel?: string) => {
  switch (riskLevel) {
    case 'high':
      return <AlertCircle className="h-3 w-3 text-red-500" />;
    case 'moderate':
      return <AlertCircle className="h-3 w-3 text-yellow-500" />;
    case 'low':
      return <Shield className="h-3 w-3 text-blue-500" />;
    default:
      return <CheckCircle2 className="h-3 w-3 text-green-500" />;
  }
};

const getRiskColorClass = (riskLevel?: string) => {
  switch (riskLevel) {
    case 'high':
      return 'border-l-red-500 bg-red-50';
    case 'moderate':
      return 'border-l-yellow-500 bg-yellow-50';
    case 'low':
      return 'border-l-blue-500 bg-blue-50';
    default:
      return 'border-l-green-500 bg-green-50';
  }
};

export function SearchResults({
  categories,
  isSearching,
  hasResults,
  selectedIndex,
  onSelectResult,
  searchTerm,
  isMobile = false
}: SearchResultsProps) {
  // Calculate flattened results for selection indexing
  const flatResults = React.useMemo(() => {
    return categories.flatMap(category => category.results);
  }, [categories]);

  const containerClass = isMobile 
    ? "bg-white/90 backdrop-blur rounded-lg border border-gray-200/70 p-4 h-full overflow-y-auto"
    : "absolute top-full left-0 right-0 mt-1 bg-white/90 backdrop-blur rounded-lg shadow-lg border border-gray-200/70 z-50 p-4";

  if (!searchTerm.trim()) {
    return (
      <div className={containerClass}>
        <div className="text-center text-gray-500">
          <Search className="h-8 w-8 mx-auto mb-2 text-gray-300" />
          <p className="text-sm">Search medications, logs, reminders, and more...</p>
          <div className="mt-2 text-xs text-gray-400">
            Try: medication names, side effects, or pages
          </div>
        </div>
      </div>
    );
  }

  if (isSearching) {
    return (
      <div className={containerClass}>
        <div className="flex items-center justify-center space-x-2 text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Searching...</span>
        </div>
      </div>
    );
  }

  if (!hasResults) {
    return (
      <div className={containerClass}>
        <div className="text-center text-gray-500">
          <Search className="h-8 w-8 mx-auto mb-2 text-gray-300" />
          <p className="text-sm font-medium">No results found</p>
          <p className="text-xs text-gray-400 mt-1">
            Try searching for medication names, categories, or page names
          </p>
        </div>
      </div>
    );
  }

  const resultsContainerClass = isMobile 
    ? "bg-white/90 backdrop-blur rounded-lg border border-gray-200/70 h-full overflow-y-auto"
    : "absolute top-full left-0 right-0 mt-1 bg-white/90 backdrop-blur rounded-lg shadow-lg border border-gray-200/70 z-50 max-h-[70vh] overflow-y-auto";

  return (
    <div className={resultsContainerClass}>
      {categories.map((category, categoryIndex) => (
        <div key={category.name} className={cn("border-b border-gray-100 last:border-b-0")}>
          {/* Category Header */}
          <div className="px-4 py-2 bg-gray-50 border-b border-gray-100">
            <div className="flex items-center space-x-2 text-xs font-medium text-gray-600 uppercase tracking-wider">
              {getCategoryIcon(category.icon)}
              <span>{category.name}</span>
              <span className="text-gray-400">({category.results.length})</span>
            </div>
          </div>

          {/* Category Results */}
          <div className="divide-y divide-gray-100">
            {category.results.map((result, resultIndex) => {
              // Calculate the flat index for this result
              const flatIndex = categories
                .slice(0, categoryIndex)
                .reduce((acc, cat) => acc + cat.results.length, 0) + resultIndex;
              
              const isSelected = flatIndex === selectedIndex;

              return (
                <button
                  key={result.id}
                  onClick={() => onSelectResult(result)}
                  className={cn(
                    "w-full px-4 py-3 text-left hover:bg-gray-50 focus:bg-gray-50 focus:outline-none transition-all duration-200 border-l-2 border-transparent",
                    isSelected && "bg-primary-50 border-l-primary-500 transform scale-[1.02] shadow-sm",
                    result.riskLevel && getRiskColorClass(result.riskLevel)
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <h4 className="text-sm font-medium text-gray-900 truncate">
                          {result.title}
                        </h4>
                        {result.riskLevel && (
                          <div className="flex items-center space-x-1">
                            {getRiskIcon(result.riskLevel)}
                            <span className="text-xs text-gray-500 capitalize">
                              {result.riskLevel}
                            </span>
                          </div>
                        )}
                        {result.metadata && (
                          <span className={cn(
                            "text-xs px-2 py-0.5 rounded-full",
                            result.metadata === 'Active' ? "bg-green-100 text-green-700" :
                            result.metadata === 'Inactive' ? "bg-gray-100 text-gray-600" :
                            result.metadata === 'taken' ? "bg-green-100 text-green-700" :
                            result.metadata === 'missed' ? "bg-red-100 text-red-700" :
                            "bg-gray-100 text-gray-600"
                          )}>
                            {result.metadata}
                          </span>
                        )}
                      </div>
                      {result.subtitle && (
                        <p className="text-xs text-gray-600 mt-0.5 truncate">
                          {result.subtitle}
                        </p>
                      )}
                      {result.description && (
                        <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                          {result.description}
                        </p>
                      )}
                    </div>
                    
                    <div className="flex items-center space-x-1 ml-2">
                      {result.icon && (
                        <span className="text-lg">{result.icon}</span>
                      )}
                      {result.type === 'database_medication' && (
                        <Plus className="h-3 w-3 text-gray-400" />
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {/* Footer with keyboard hints */}
      <div className="px-4 py-2 bg-gray-50 border-t border-gray-100">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center space-x-3">
            <span className="flex items-center space-x-1">
              <kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-xs">↑↓</kbd>
              <span>Navigate</span>
            </span>
            <span className="flex items-center space-x-1">
              <kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-xs">Enter</kbd>
              <span>Select</span>
            </span>
            <span className="flex items-center space-x-1">
              <kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-xs">Esc</kbd>
              <span>Close</span>
            </span>
          </div>
          <span>
            {flatResults.length} result{flatResults.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>
    </div>
  );
}
