# CallPulse Dashboard (Next.js)

Professional dark navy dashboard for CallPulse AI Call Center platform, inspired by VirtualPBX design system.

## Features

- **VirtualPBX-Inspired UI**: Dark navy aesthetic with teal/cyan chart gradients
- **Zero Emojis**: Professional icons only (lucide-react)
- **Real-Time Updates**: Live call stream with Supabase Realtime subscriptions
- **Mobile Responsive**: Collapsible sidebar, card-based mobile views
- **Type-Safe**: Full TypeScript with Next.js 14 App Router

## Quick Start

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env.local

# Edit .env.local with your Supabase credentials
nano .env.local

# Start development server
npm run dev
```

Dashboard runs on http://localhost:3000

## Pages

### Overview Dashboard (`/dashboard/[orgId]/overview`)
- **Top Metrics**: Queue Waiting Time, Lost Calls Rate, Live Service Level, Active Calls
- **Performance Chart**: 24-hour stacked area chart (teal/cyan gradients)
- **Active Queues Panel**: Real-time queue status
- **Agent Performance**: Circular progress indicators with profile photos
- **Live Communications Stream**: Real-time call table with actions

### Calls Log (`/dashboard/[orgId]/calls`)
- Filterable call history (date range, status, escalation)
- Expandable transcript viewer
- Export to CSV

### Inbox (`/dashboard/[orgId]/inbox`)
- Two-pane SMS interface (contact list + message thread)
- Real-time message updates
- Manual agent reply input

### Contacts (`/dashboard/[orgId]/contacts`)
- Searchable contact list
- Add/edit contact modals
- CSV import

### Dialer (`/dashboard/[orgId]/dialer`)
- Numeric keypad for manual dialing
- Caller ID selector
- Recent calls list

### Settings (`/dashboard/[orgId]/settings/*`)
- **AI Configuration**: System prompt editor, model selector
- **Voice Settings**: Voice model dropdown, ElevenLabs toggle
- **Twilio Credentials**: Account SID, auth token, phone numbers
- **Escalation Rules**: Handoff phone number, keyword management

## Design System

### Color Palette

```tsx
// Navy Dark
bg-navy-dark          // #0f1419 (base background)
bg-navy-dark-panel    // #1a2332 (panels)
bg-navy-dark-elevated // #233044 (elevated surfaces)
border-navy-dark-border // #2d3f56 (borders)

// Status Colors
bg-status-in-call     // #ef4444 (red)
bg-status-available   // #10b981 (green)
bg-status-waiting     // #f59e0b (amber)
bg-status-resolved    // #06b6d4 (cyan)

// Chart Colors
bg-chart-teal-dark    // #0d9488
bg-chart-teal         // #14b8a6
bg-chart-cyan         // #06b6d4
```

### Typography

```tsx
font-sans  // Inter
font-mono  // JetBrains Mono (tabular nums)

text-metric-large   // 3.5rem, bold, tabular nums
text-metric-medium  // 2rem, semibold, tabular nums
```

### Components

All components follow VirtualPBX design patterns:
- Panels: Rounded corners (0.75rem), subtle shadows
- Status badges: Colored dot + uppercase text
- Buttons: Rounded medium, transition colors
- Tables: Alternating row hover, action button groups

## Project Structure

```
web/
├── app/                        # Next.js App Router
│   ├── (auth)/
│   │   ├── login/
│   │   └── signup/
│   ├── dashboard/
│   │   └── [orgId]/
│   │       ├── layout.tsx      # Sidebar + org context
│   │       ├── overview/
│   │       ├── calls/
│   │       ├── inbox/
│   │       ├── contacts/
│   │       ├── dialer/
│   │       └── settings/
│   ├── layout.tsx
│   ├── globals.css
│   └── page.tsx
├── src/
│   ├── components/
│   │   ├── ui/                 # Base UI components
│   │   ├── layout/             # Sidebar, nav
│   │   ├── metrics/            # Metric cards
│   │   ├── charts/             # Recharts wrappers
│   │   ├── agents/             # Agent performance
│   │   ├── communications/     # Call/SMS tables
│   │   ├── contacts/           # Contact management
│   │   ├── inbox/              # Messaging interface
│   │   └── dialer/             # Keypad, caller ID
│   ├── lib/
│   │   ├── supabase/           # Supabase clients
│   │   └── utils.ts            # Utility functions
│   ├── types/                  # TypeScript types
│   └── context/                # React contexts
├── public/                     # Static assets
├── tailwind.config.ts          # VirtualPBX theme
├── next.config.js
└── package.json
```

## Component Guidelines

### ✅ Do
- Use `lucide-react` for all icons (zero emojis)
- Apply navy dark theme colors consistently
- Use status dots for indicators (colored circles)
- Implement tabular nums for metrics
- Use enterprise terminology ("Active Queues", "Live Service Level")

### ❌ Don't
- Use emoji characters anywhere
- Apply purple/cyan neon glows (generic AI aesthetic)
- Use glassmorphism effects
- Write marketing hype copy ("Amazing!", "Best Ever")

## Development

```bash
# Start dev server
npm run dev

# Type check
npm run type-check

# Lint
npm run lint

# Build for production
npm run build

# Start production server
npm start
```

## Deployment

### Render.com (Static Site)

```bash
# Build command
npm run build

# Publish directory
out/
```

The `render.yaml` in root directory handles automatic deployment.

## Environment Variables

```bash
# Required
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
NEXT_PUBLIC_API_URL=https://callpulse-api.onrender.com
```

## License

Proprietary - CallPulse Engineering Team
