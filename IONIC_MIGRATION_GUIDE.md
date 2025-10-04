# iOS 26 Ionic UI Migration Guide

## Overview

Meditrax v2.0 represents a complete UI overhaul aligned with iOS 26 Human Interface Guidelines using Ionic Framework. This migration brings native-feeling navigation, iOS 26 visual design, and enhanced cross-platform support.

## What Changed

### Architecture & Routing

**Before:**
- React Router (`BrowserRouter`)
- Custom Layout component with sidebar
- Manual route management

**After:**
- Ionic React Router (`IonReactRouter`)
- Native `IonRouterOutlet` with page transitions
- `IonSplitPane` + `IonMenu` + `IonTabs` architecture
- Bottom tabs for primary navigation (Dashboard, Medications, Calendar, Reminders, Settings)
- Side menu for secondary features (Inventory, Analytics, Effects, Reports, Wiki, Profile, Cyclic Dosing)

### Navigation Structure

```tsx
<IonApp>
  <IonReactRouter>
    <IonSplitPane contentId="main">
      <IonMenu contentId="main">
        {/* Secondary navigation */}
      </IonMenu>
      
      <IonPage id="main">
        <IonTabs>
          <IonRouterOutlet>
            {/* Page routes */}
          </IonRouterOutlet>
          
          <IonTabBar slot="bottom">
            {/* Primary tabs */}
          </IonTabBar>
        </IonTabs>
      </IonPage>
    </IonSplitPane>
  </IonReactRouter>
</IonApp>
```

### Page Structure

**Before:**
```tsx
<div className="min-h-screen bg-gray-50">
  <div className="max-w-7xl mx-auto p-6">
    {/* Content */}
  </div>
</div>
```

**After:**
```tsx
<IonPage>
  <IonHeader translucent>
    <IonToolbar>
      <IonTitle size="large">Page Title</IonTitle>
    </IonToolbar>
  </IonHeader>
  <IonContent fullscreen className="bg-gray-50">
    <div className="max-w-7xl mx-auto p-6">
      {/* Content */}
    </div>
  </IonContent>
</IonPage>
```

### Design System Updates

#### iOS 26 Color Palette

- **Primary:** `#007AFF` (iOS blue)
- **Success:** `#34C759` (iOS green)
- **Warning:** `#FF9500` (iOS orange)
- **Danger:** `#FF3B30` (iOS red)
- **Background (light):** `#f2f2f7`
- **Background (dark):** `#000000` (pure black)

#### Typography

- **Font Family:** SF Pro Display/Text (`-apple-system`)
- **Base Size:** 17px (iOS standard body)
- **Large Title:** 34px with bold weight
- **Letter Spacing:** -0.4px for large titles

#### Visual Effects

- **Border Radius:** 12px standard, 16px for cards
- **Translucency:** `saturate(180%) blur(20px)` for headers/tabs
- **Transitions:** 280ms with iOS spring curve `cubic-bezier(0.32, 0.72, 0, 1)`
- **Safe Areas:** Full support for notches and Dynamic Island

### Component Replacements

| Old Component | New Component | Notes |
|--------------|---------------|-------|
| `<input type="text">` (search) | `<IonSearchbar>` | Native search with animations |
| Button groups | `<IonSegment>` | iOS-style segmented controls |
| Custom toggles | `<IonToggle>` | Native platform toggles |
| `<Link>` in menu | `routerLink` prop | Enables native transitions |
| Progress bars | `<IonProgressBar>` | Platform-adaptive styling |
| Action menus | `<IonActionSheet>` | iOS-style bottom sheets |

### Removed Legacy Code

- ❌ `VITE_USE_IONIC_UI` feature flag (always Ionic now)
- ❌ `src/components/layout/Layout.tsx` conditional logic for Ionic
- ❌ `BrowserRouter` dependency on `react-router-dom`
- ❌ Custom page wrapper logic (`pageStart`/`pageEnd` conditionals)

## New Dependencies

```json
{
  "@ionic/react-router": "^8.7.5"
}
```

## Migration Steps for Future Updates

### 1. Page Migration

When creating or updating pages:

```tsx
import { IonPage, IonHeader, IonToolbar, IonTitle, IonContent } from '@ionic/react';

export function MyPage() {
  return (
    <IonPage>
      <IonHeader translucent>
        <IonToolbar>
          <IonTitle size="large">My Page</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        {/* Content here */}
      </IonContent>
    </IonPage>
  );
}
```

### 2. Navigation

Use `routerLink` for Ionic components:
```tsx
<IonItem button routerLink="/medications">
  <IonLabel>Medications</IonLabel>
</IonItem>
```

Use standard React Router for non-Ionic components:
```tsx
<Link to="/medications">Medications</Link>
```

### 3. Theming

Custom colors should align with iOS 26 palette. Use CSS variables:

```css
.my-component {
  background: var(--ion-color-primary);
  color: var(--ion-color-primary-contrast);
  border-radius: var(--ion-border-radius);
}
```

### 4. Dark Mode

Test both light and dark modes:
```css
@media (prefers-color-scheme: dark) {
  .my-component {
    /* Dark mode styles */
  }
}
```

## Platform-Specific Behavior

### iOS
- Large collapsing titles
- Translucent headers with blur
- Swipe-to-go-back gestures
- SF Pro typography
- Spring animations

### Android
- Material Design tab bar
- Ripple effects
- Roboto typography
- Material motion

## Capacitor Configuration

Updated `capacitor.config.ts`:

```typescript
{
  ios: {
    contentInset: 'always', // Safe area support
  },
  plugins: {
    StatusBar: {
      style: 'dark',
      overlaysWebView: false,
    },
    SplashScreen: {
      backgroundColor: '#007AFF', // iOS 26 blue
      launchShowDuration: 1500,
    }
  }
}
```

## Testing Checklist

### Navigation
- [ ] All bottom tabs navigate correctly
- [ ] Side menu items navigate correctly
- [ ] Back navigation works (swipe-back on iOS, hardware back on Android)
- [ ] Deep links and URL parameters preserved
- [ ] Page transitions smooth and native-feeling

### Visual
- [ ] Large titles collapse on scroll
- [ ] Headers are translucent with blur
- [ ] Tab bar respects safe areas (notch/home indicator)
- [ ] Dark mode renders correctly
- [ ] iOS and Android styles differ appropriately

### Functionality
- [ ] Search bars filter correctly
- [ ] Segmented controls switch views
- [ ] Modals present with iOS sheet style
- [ ] All Capacitor plugins functional (camera, haptics, notifications, biometric)
- [ ] Offline functionality preserved
- [ ] Data persistence working

### Performance
- [ ] Page transitions < 300ms
- [ ] No layout shift on load
- [ ] Smooth scrolling
- [ ] Reduced motion respected

## Known Issues & Mitigations

### Issue: Router History
**Problem:** Ionic router uses hash-based routing by default
**Solution:** Configured for standard history mode; test deep linking

### Issue: Modal Layering
**Problem:** Modals may render behind tab bar
**Solution:** Use `IonModal` with proper `z-index` or present modals at app root

### Issue: Safe Area Insets
**Problem:** Content may be obscured by notch or home indicator
**Solution:** Use `fullscreen` on `IonContent` and respect CSS `env(safe-area-inset-*)`

## Breaking Changes

1. **Navigation URLs:** All routes now use Ionic navigation; external links may need updating
2. **Page Components:** Must be wrapped in `IonPage`; plain `<div>` pages won't transition correctly
3. **Routing API:** `useNavigate` and `useLocation` behavior may differ slightly with Ionic router
4. **CSS Classes:** Some Tailwind classes may conflict with Ionic's styling; use Ionic CSS variables where possible

## Rollback Plan

If critical issues arise:

1. Revert to previous commit before migration
2. Re-enable `VITE_USE_IONIC_UI` feature flag (if preserved)
3. Restore `BrowserRouter` in `src/main.tsx`
4. Restore `src/components/layout/Layout.tsx` logic

## Support

For issues specific to this migration:
- Check Ionic documentation: https://ionicframework.com/docs/react
- Review iOS HIG: https://developer.apple.com/design/human-interface-guidelines/
- Test on iOS Simulator and Android Emulator before device testing

