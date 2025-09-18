import { useState, useEffect } from 'react';

const CURRENT_VERSION = '1.1.1';
const VERSION_STORAGE_KEY = 'meditrax-last-seen-version';

export function useVersionCheck() {
  const [shouldShowChangelog, setShouldShowChangelog] = useState(false);
  const [currentVersion, setCurrentVersion] = useState(CURRENT_VERSION);

  useEffect(() => {
    const checkVersion = () => {
      try {
        const lastSeenVersion = localStorage.getItem(VERSION_STORAGE_KEY);
        
        // If no version stored or version has changed, show changelog
        if (!lastSeenVersion || lastSeenVersion !== CURRENT_VERSION) {
          setShouldShowChangelog(true);
        }
      } catch (error) {
        console.warn('Failed to check version from localStorage:', error);
        // If localStorage fails, show changelog to be safe
        setShouldShowChangelog(true);
      }
    };

    // Small delay to ensure app has loaded
    const timer = setTimeout(checkVersion, 1000);
    
    return () => clearTimeout(timer);
  }, []);

  const markVersionSeen = () => {
    try {
      localStorage.setItem(VERSION_STORAGE_KEY, CURRENT_VERSION);
      setShouldShowChangelog(false);
    } catch (error) {
      console.warn('Failed to save version to localStorage:', error);
      // Still close the modal even if saving fails
      setShouldShowChangelog(false);
    }
  };

  const showChangelog = () => {
    setShouldShowChangelog(true);
  };

  return {
    shouldShowChangelog,
    currentVersion,
    markVersionSeen,
    showChangelog
  };
}
