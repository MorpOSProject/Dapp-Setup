# MORP OS Design Guidelines

## Design Approach

**Hybrid Reference-Based Approach** drawing from leading DeFi interfaces:
- **Uniswap**: Clean swap interface patterns and token selection
- **Phantom Wallet**: Wallet connection UX and balance displays
- **Zapper/DeFiLlama**: Portfolio dashboard layouts
- **Unique Privacy Layer**: Visual indicators for shadow balances and private actions

**Core Principle**: Professional financial interface with privacy-first visual language, balancing data density with clarity.

---

## Typography

**Font Family**: Inter (Google Fonts)
- **Display/Headings**: Inter 700 (Bold) - Dashboard titles, feature headers
- **Subheadings**: Inter 600 (Semibold) - Section labels, card titles
- **Body/Data**: Inter 500 (Medium) - Financial values, balances
- **Labels/Secondary**: Inter 400 (Regular) - Helper text, descriptions
- **Monospace Data**: JetBrains Mono 500 - Wallet addresses, transaction hashes

**Size Scale**:
- Page titles: text-3xl to text-4xl
- Section headers: text-xl to text-2xl
- Card titles: text-lg
- Financial values: text-base to text-xl (prominence based on hierarchy)
- Labels/metadata: text-sm
- Fine print: text-xs

---

## Layout System

**Spacing Primitives**: Use Tailwind units of **2, 4, 6, 8, 12, 16**
- Component padding: p-4 to p-8
- Section spacing: space-y-6 to space-y-8
- Card gaps: gap-4 to gap-6
- Generous whitespace between major sections: mb-12 to mb-16

**Container Structure**:
- Main dashboard: max-w-7xl mx-auto px-4
- Sidebar navigation: w-64 fixed (desktop), hidden on mobile
- Content area: Full width minus sidebar
- Modals/overlays: max-w-2xl centered

**Grid Systems**:
- Portfolio cards: grid-cols-1 md:grid-cols-2 lg:grid-cols-3
- Stats row: grid-cols-2 md:grid-cols-4
- Swap interface: Single column centered max-w-lg

---

## Color Strategy

**DO NOT SPECIFY COLORS** - Focus on semantic naming:
- Primary accent: Gradient theme (blue-to-cyan from logo)
- Background layers: Three-tier hierarchy (darkest → dark → elevated)
- Text hierarchy: Primary → secondary → tertiary opacity
- Success/Error/Warning states: Standard semantic colors
- Privacy indicators: Unique accent for shadow balance features

---

## Component Library

### Navigation
**Top Navigation Bar**:
- Logo (left), Wallet connection button (right), Network indicator
- Height: h-16, backdrop-blur effect
- Sticky positioning

**Sidebar Navigation** (Desktop):
- Dashboard, Swap, Portfolio, Settings menu items
- Active state indicators with accent border
- Collapsible on tablet/mobile to hamburger menu

### Dashboard Cards
**Shadow Balance Card**:
- Large prominent display of private balance
- Privacy shield icon indicator
- Toggle between "Masked" and "Revealed" states
- Glassmorphism card style with subtle backdrop-blur

**Quick Stats Grid**:
- 4-column layout showing: Total Value, Active Positions, Pending Actions, Privacy Score
- Each stat in elevated card with icon, label, and large value display

**Recent Activity Feed**:
- Timeline-style list of batched actions
- Each item: timestamp, action type icon, amount, status badge
- Expandable for transaction details

### Swap Interface
**Token Selection Cards**:
- Two prominent cards: "From" and "To" with token selector
- Large input fields with max-width
- Centered swap direction icon between cards
- Balance display below input with "Max" button

**Swap Preview Panel**:
- Route visualization (if multi-hop)
- Fee breakdown
- Privacy batch indicator (shows when action will be batched)
- Large prominent "Execute Private Swap" button

### Portfolio Management
**Holdings Table**:
- Columns: Asset, Balance (shadow), Public Balance, Value, 24h Change, Actions
- Sortable headers
- Row hover states with action buttons (Send, Swap)

**DeFi Positions Grid**:
- Card-based layout for each active position
- Protocol logo, APY, deposited amount, claimable rewards
- Compact action buttons within cards

**Portfolio Chart**:
- Area chart showing balance history over time
- Time period selector (24H, 7D, 30D, All)
- Privacy toggle to show/hide from chart

### Transaction Batching Visualization
**Pending Actions Queue**:
- Card showing batched actions waiting to execute
- Progress indicator for batch threshold
- List of queued transactions with ability to review/cancel
- "Execute Batch Now" option with privacy trade-off indicator

### Selective Disclosure Panel
**Audit Proof Generator**:
- Form to select specific transactions/balances to prove
- Recipient/auditor address input
- Proof type selector (full disclosure, balance proof, transaction proof)
- "Generate Proof" button with cryptographic seal icon

### Modals & Overlays
**Wallet Connection Modal**:
- Grid of supported wallets (Phantom, Solflare, etc.)
- Each with logo and "Connect" button
- Backdrop blur with centered max-w-md container

**Transaction Confirmation**:
- Transaction summary
- Privacy impact indicator
- Fee breakdown
- Two-button layout: Cancel (secondary), Confirm (primary)

---

## Animations

**Minimal, Purpose-Driven Only**:
- Balance number transitions (counting animation)
- Card hover lift (subtle transform)
- Loading skeleton states for data fetching
- Modal fade-in/slide-up entrance
- No scroll animations or decorative motion

---

## Accessibility

- All interactive elements have visible focus states
- Financial values have proper ARIA labels with full precision
- Color is never the sole indicator of state (use icons + text)
- Keyboard navigation for all core flows
- Screen reader announcements for balance updates

---

## Images

**No hero image required** - This is a functional dashboard, not a landing page.

**Icon System**: Use Heroicons (outline for navigation, solid for states)
- Privacy shield icon for shadow balances
- Lock/unlock icons for disclosure states
- Swap arrows, wallet icons, chart icons
- Protocol logos (fetch from token list APIs)

**Branding**: MORP OS logo in sidebar and top navigation

---

## Layout-Specific Guidelines

**Dashboard View**:
- Hero stats section (shadow balance + quick stats grid)
- Two-column below: Recent activity (left 60%), Quick actions (right 40%)
- Privacy score widget prominently placed

**Swap View**:
- Centered single-column layout, max-w-lg
- Token cards stack vertically with generous spacing (space-y-6)
- Preview panel below swap interface
- Slippage settings in expandable panel

**Portfolio View**:
- Chart spans full width at top
- Holdings table below (full width)
- DeFi positions grid (3 columns on desktop)
- Filter/sort controls in toolbar above table