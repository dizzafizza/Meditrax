#!/bin/bash

# Validation script for iOS 26 Ionic UI Migration
# Run this after completing the migration to verify everything works

set -e

echo "🔍 Meditrax v2.0 - Ionic Migration Validation"
echo "=============================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check 1: Dependencies
echo "📦 Checking dependencies..."
if grep -q '"@ionic/react-router"' package.json; then
    echo -e "${GREEN}✓${NC} @ionic/react-router found in package.json"
else
    echo -e "${RED}✗${NC} @ionic/react-router missing - run 'npm install'"
    exit 1
fi

# Check 2: Router import
echo "🔀 Checking router migration..."
if grep -q "IonReactRouter" src/main.tsx; then
    echo -e "${GREEN}✓${NC} IonReactRouter imported in src/main.tsx"
else
    echo -e "${RED}✗${NC} IonReactRouter not found in src/main.tsx"
    exit 1
fi

# Check 3: Ionic shell
echo "🏗️  Checking Ionic shell..."
if grep -q "IonTabs" src/App.tsx && grep -q "IonRouterOutlet" src/App.tsx; then
    echo -e "${GREEN}✓${NC} Ionic shell (IonTabs + IonRouterOutlet) configured"
else
    echo -e "${RED}✗${NC} Ionic shell not properly configured in src/App.tsx"
    exit 1
fi

# Check 4: Theme file
echo "🎨 Checking iOS 26 theme..."
if [ -f "src/theme/ionic.css" ]; then
    if grep -q "007AFF" src/theme/ionic.css; then
        echo -e "${GREEN}✓${NC} iOS 26 theme colors applied"
    else
        echo -e "${YELLOW}⚠${NC} Theme file exists but may not have iOS 26 colors"
    fi
else
    echo -e "${RED}✗${NC} src/theme/ionic.css missing"
    exit 1
fi

# Check 5: Page wrappers
echo "📄 Checking page migrations..."
pages_to_check=("Dashboard" "Medications" "Calendar" "Reminders" "Settings" "Inventory" "EffectsTracker")
all_pages_ok=true

for page in "${pages_to_check[@]}"; do
    if grep -q "IonPage" "src/pages/${page}.tsx" 2>/dev/null; then
        echo -e "${GREEN}✓${NC} ${page}.tsx uses IonPage"
    else
        echo -e "${RED}✗${NC} ${page}.tsx missing IonPage wrapper"
        all_pages_ok=false
    fi
done

if [ "$all_pages_ok" = false ]; then
    exit 1
fi

# Check 6: Capacitor config
echo "⚙️  Checking Capacitor configuration..."
if grep -q "contentInset" capacitor.config.ts; then
    echo -e "${GREEN}✓${NC} iOS safe area insets configured"
else
    echo -e "${YELLOW}⚠${NC} Safe area insets may not be configured"
fi

# Check 7: No legacy Layout imports
echo "🧹 Checking for legacy imports..."
if grep -rq "import.*Layout.*from.*layout/Layout" src/pages/ 2>/dev/null; then
    echo -e "${YELLOW}⚠${NC} Found legacy Layout imports - consider removing"
else
    echo -e "${GREEN}✓${NC} No legacy Layout imports found"
fi

# Check 8: TypeScript compilation
echo "🔧 Running TypeScript check..."
if command -v tsc &> /dev/null; then
    if npx tsc --noEmit; then
        echo -e "${GREEN}✓${NC} TypeScript compilation successful"
    else
        echo -e "${RED}✗${NC} TypeScript errors found"
        exit 1
    fi
else
    echo -e "${YELLOW}⚠${NC} TypeScript compiler not found, skipping check"
fi

echo ""
echo -e "${GREEN}✅ All validation checks passed!${NC}"
echo ""
echo "Next steps:"
echo "1. Install dependencies: npm install"
echo "2. Build web assets: npm run build"
echo "3. Sync Capacitor: npm run cap:sync"
echo "4. Test on iOS: npm run ios:dev"
echo "5. Test on Android: npm run android:dev"
echo ""
echo "📚 See IONIC_MIGRATION_GUIDE.md for testing checklist"

