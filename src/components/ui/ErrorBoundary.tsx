import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center p-8 text-center bg-red-50 rounded-lg border border-red-200">
          <AlertTriangle className="h-12 w-12 text-red-500 mb-4" />
          <h3 className="text-lg font-semibold text-red-800 mb-2">
            Something went wrong
          </h3>
          <p className="text-red-600 mb-4">
            We encountered an error while displaying this content.
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: undefined })}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// Functional component wrapper for easier use
export function ChartErrorBoundary({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary
      fallback={
        <div className="flex items-center justify-center h-[300px] text-gray-500 bg-gray-50 rounded-lg border border-gray-200">
          <div className="text-center">
            <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-gray-400" />
            <p>Unable to display chart</p>
            <p className="text-sm text-gray-400">Chart data may be invalid</p>
          </div>
        </div>
      }
      onError={(error) => {
        console.error('Chart error:', error);
      }}
    >
      {children}
    </ErrorBoundary>
  );
}
