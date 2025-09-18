import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { cn } from '@/utils/helpers';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger'
}: ConfirmDialogProps) {
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

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto mobile-safe-area">
      <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose} />
        
        <div className="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 w-full max-w-lg mx-4 sm:mx-0 mobile-modal">
          <div className="bg-white px-4 pb-4 pt-5 sm:p-6 sm:pb-4">
            <div className="sm:flex sm:items-start">
              <div className={cn(
                'mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full sm:mx-0 sm:h-10 sm:w-10',
                variant === 'danger' && 'bg-red-100',
                variant === 'warning' && 'bg-yellow-100',
                variant === 'info' && 'bg-blue-100'
              )}>
                <AlertTriangle className={cn(
                  'h-6 w-6',
                  variant === 'danger' && 'text-red-600',
                  variant === 'warning' && 'text-yellow-600',
                  variant === 'info' && 'text-blue-600'
                )} />
              </div>
              <div className="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left flex-1">
                <h3 className="text-base font-semibold leading-6 text-gray-900">
                  {title}
                </h3>
                <div className="mt-2">
                  <p className="text-sm text-gray-500">
                    {message}
                  </p>
                </div>
              </div>
              <div className="absolute top-4 right-4">
                <button
                  onClick={onClose}
                  className="rounded-md bg-white text-gray-400 hover:text-gray-500"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
          <div className="bg-gray-50 px-4 py-3 flex flex-col-reverse space-y-2 space-y-reverse sm:flex-row sm:space-y-0 sm:space-x-2 sm:px-6">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex w-full justify-center rounded-md bg-white px-4 py-3 sm:py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 touch-target sm:w-auto"
            >
              {cancelText}
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className={cn(
                'inline-flex w-full justify-center rounded-md px-4 py-3 sm:py-2 text-sm font-semibold text-white shadow-sm touch-target sm:w-auto',
                variant === 'danger' && 'bg-red-600 hover:bg-red-500 active:bg-red-700',
                variant === 'warning' && 'bg-yellow-600 hover:bg-yellow-500 active:bg-yellow-700',
                variant === 'info' && 'bg-blue-600 hover:bg-blue-500 active:bg-blue-700'
              )}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
