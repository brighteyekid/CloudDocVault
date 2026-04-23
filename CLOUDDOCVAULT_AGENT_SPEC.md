# CloudDocVault — Agent Build Specification
**Version:** 1.0  
**Project:** CloudDocVault — Secure Document Storage Portal  
**Stack:** Node.js (Express) backend, React (Vite) frontend, AWS S3 / Cognito / API Gateway / Lambda / CloudFront  
**Deployment Target:** EC2 (Ubuntu 22.04), single deploy script, AWS credentials pre-exported in shell environment

---

## 0. HOW TO READ THIS DOCUMENT

This document is the single source of truth for building CloudDocVault end to end. The agent must follow sections in order. Do not skip ahead. Each section is labelled with what it defines and what the agent must produce at the end of that section before moving on. UI sections are prescriptive — do not deviate from colours, spacing, or layout unless the section explicitly permits a judgment call. Backend sections are functional — implement exactly as described. The deployment section must produce a single executable shell script named `deploy.sh` that requires no human input after invocation.

---

## 1. PROJECT OVERVIEW

CloudDocVault is a secure, cloud-native document management portal. Users log in, upload documents to an S3 bucket via pre-signed URLs, browse their stored documents, download them, and inspect access logs. Administrators additionally see observability dashboards drawing data from CloudWatch metrics and a Prometheus endpoint.

The portal is a full-stack web application. The frontend is a React single-page application. The backend is a Node.js Express server that acts as the integration layer between the React frontend and AWS services (Cognito, S3, API Gateway, Lambda, CloudWatch). The entire system runs as two processes on a single EC2 instance behind an Nginx reverse proxy.

---

## 2. DESIGN SYSTEM

This section defines every visual token used throughout the application. Every colour reference in subsequent sections uses the variable names defined here. The agent must declare these as CSS custom properties on `:root` and reference only variable names in all component styles — no hardcoded hex values anywhere in component code.

### 2.1 Colour Palette

```
--color-bg-base:          #0B0E1A
--color-bg-surface:       #111827
--color-bg-card:          #1A2235
--color-bg-card-hover:    #1F2A42
--color-bg-elevated:      #243049
--color-border:           #2A3650
--color-border-subtle:    #1E2D40

--color-accent-primary:   #4F8EF7
--color-accent-primary-hover: #3B7BF0
--color-accent-cyan:      #22D3EE
--color-accent-cyan-dim:  #0E7490

--color-status-success:   #34D399
--color-status-warning:   #FBBF24
--color-status-danger:    #F87171
--color-status-neutral:   #94A3B8

--color-text-primary:     #F1F5F9
--color-text-secondary:   #94A3B8
--color-text-muted:       #4B5A72
--color-text-inverse:     #0B0E1A

--color-overlay:          rgba(0, 0, 0, 0.55)
```

### 2.2 Typography

Font stack must be loaded from Google Fonts. Import `Space Grotesk` (weights 400, 500, 600, 700) for all headings and UI labels. Import `Inter` (weights 400, 500) for body copy and descriptions. Import `JetBrains Mono` (weight 400) for all monospaced content — file sizes, IDs, ARNs, metric values, timestamps, and code.

```
--font-heading:   'Space Grotesk', system-ui, sans-serif
--font-body:      'Inter', system-ui, sans-serif
--font-mono:      'JetBrains Mono', 'Fira Code', monospace
```

Type scale:

```
--text-xs:    11px   line-height 1.5   letter-spacing 0.04em
--text-sm:    13px   line-height 1.55
--text-base:  15px   line-height 1.6
--text-lg:    17px   line-height 1.55
--text-xl:    20px   line-height 1.4
--text-2xl:   24px   line-height 1.35
--text-3xl:   30px   line-height 1.25
--text-4xl:   38px   line-height 1.15
```

Heading elements (h1–h4) always use `--font-heading`, weight 600. Body paragraphs and labels use `--font-body`, weight 400. All numeric metric displays use `--font-mono`, weight 400.

### 2.3 Spacing

All spacing uses an 8px base unit. The agent must define a spacing scale:

```
--space-1:   4px
--space-2:   8px
--space-3:   12px
--space-4:   16px
--space-5:   20px
--space-6:   24px
--space-8:   32px
--space-10:  40px
--space-12:  48px
--space-16:  64px
--space-20:  80px
```

### 2.4 Border Radius

```
--radius-sm:   4px
--radius-md:   8px
--radius-lg:   12px
--radius-xl:   16px
--radius-pill: 999px
```

### 2.5 Shadows

```
--shadow-card:    0 1px 3px rgba(0,0,0,0.4), 0 4px 12px rgba(0,0,0,0.3)
--shadow-modal:   0 8px 40px rgba(0,0,0,0.6)
--shadow-dropdown: 0 4px 16px rgba(0,0,0,0.5)
```

### 2.6 Motion

All transitions use `cubic-bezier(0.22, 1, 0.36, 1)` easing. Default duration: `180ms`. Hover state transitions: `120ms`. Modal/drawer open: `240ms`. Never use linear easing.

### 2.7 Global Layout Rules

- The global page background is always `--color-bg-base`.
- Cards and surface panels use `--color-bg-card`.
- All card borders are `1px solid var(--color-border)`.
- No card has a box-shadow on its resting state — shadows are applied only on hover or when the card is in a focused/selected state.
- The sidebar is fixed width: `240px` on desktop. On mobile (below 768px), the sidebar collapses to an icon-only rail of `60px`. Below 480px, the sidebar is hidden entirely and accessible via a hamburger menu that opens a drawer overlay.
- The main content area always has `padding: var(--space-8)` on desktop, `padding: var(--space-4)` on mobile.
- Maximum content column width: `1280px`, centred with `margin: 0 auto`.

---

## 3. GLOBAL COMPONENTS

Define these as reusable React components before building any page.

### 3.1 Sidebar

Fixed left side. Width `240px`. Background `--color-bg-surface`. Right border `1px solid var(--color-border)`. Height `100vh`, position `fixed`, `top: 0`, `left: 0`, `z-index: 100`.

Top section (height `64px`): Contains the application wordmark. Wordmark text: `CloudDocVault` in `--font-heading` weight 700, size `--text-lg`, colour `--color-text-primary`. To the left of the wordmark, a small square logo mark — a stylised lock icon in `--color-accent-primary`, `18x18px`.

Navigation section: Begins at `64px` from top. Each nav item is a row: `height: 44px`, `padding: 0 var(--space-4)`, `border-radius: var(--radius-md)` with `4px` margin on left and right. Contains a `16x16px` icon on the left and a label in `--font-body` weight 500 size `--text-sm`. Colour when inactive: icon and label both `--color-text-secondary`. Colour when active: background `--color-bg-elevated`, icon `--color-accent-primary`, label `--color-text-primary`. Hover state: background `--color-bg-card-hover`, label `--color-text-primary`. No transition on icon colour — instant swap.

Nav items in order (top to bottom):

1. Dashboard — icon: grid-2x2
2. Documents — icon: folder
3. Upload — icon: upload-cloud
4. Access Logs — icon: shield-check
5. Observability — icon: activity
6. Settings — icon: settings

Divider: a `1px` horizontal rule in `--color-border` placed above the Settings item, with `var(--space-3)` margin above and below.

Bottom section (position `absolute`, bottom `0`, width `100%`, `padding: var(--space-4)`): User avatar circle (`32px`, background `--color-bg-elevated`, initials in `--font-heading` weight 600 size `--text-sm` colour `--color-accent-primary`) on the left, username in `--font-body` size `--text-sm` colour `--color-text-secondary` on the right of the avatar, and a logout icon button (`16x16px`, colour `--color-text-muted`, hover colour `--color-status-danger`) flush right.

### 3.2 Top Bar

Position `fixed`, `top: 0`, `left: 240px`, `right: 0`, `height: 64px`, `z-index: 99`. Background `--color-bg-surface`. Bottom border `1px solid var(--color-border)`. Contains on the left: current page title in `--font-heading` weight 600 size `--text-xl` colour `--color-text-primary`. On the right: a search input (described in 3.3) and a notification bell icon button.

### 3.3 Search Input

Width `280px`. Height `36px`. Background `--color-bg-card`. Border `1px solid var(--color-border)`. Border-radius `--radius-pill`. Padding `0 var(--space-4)`. A search icon `14x14px` colour `--color-text-muted` on the left inside the field. Placeholder text: "Search documents..." in `--font-body` size `--text-sm` colour `--color-text-muted`. On focus: border colour transitions to `--color-accent-primary`, no outline, no box shadow.

### 3.4 Button

Four variants:

**Primary:** Background `--color-accent-primary`. Text `--color-text-inverse`, `--font-body` weight 500, `--text-sm`. Padding `var(--space-2) var(--space-5)`. Height `36px`. Border-radius `--radius-md`. No border. Hover: background `--color-accent-primary-hover`. Active: scale `0.97`.

**Secondary:** Background transparent. Border `1px solid var(--color-border)`. Text `--color-text-secondary`. Same sizing as Primary. Hover: border `--color-accent-primary`, text `--color-text-primary`, background `--color-bg-elevated`.

**Danger:** Background transparent. Border `1px solid var(--color-status-danger)`. Text `--color-status-danger`. Hover: background `rgba(248,113,113,0.08)`.

**Ghost:** No background, no border. Text `--color-text-secondary`. Hover: text `--color-text-primary`, background `--color-bg-elevated`. Used for icon-only actions.

### 3.5 Badge / Status Chip

Inline pill shape. Height `22px`. Padding `0 var(--space-2)`. Border-radius `--radius-pill`. Font `--font-mono` size `--text-xs`. Three colour modes:

- Success: background `rgba(52,211,153,0.12)`, text `--color-status-success`, border `1px solid rgba(52,211,153,0.2)`
- Warning: background `rgba(251,191,36,0.12)`, text `--color-status-warning`, border `1px solid rgba(251,191,36,0.2)`
- Danger: background `rgba(248,113,113,0.12)`, text `--color-status-danger`, border `1px solid rgba(248,113,113,0.2)`
- Neutral: background `rgba(148,163,184,0.10)`, text `--color-text-secondary`, border `1px solid var(--color-border)`

### 3.6 Data Table

Full width. No outer card border — the table lives inside a card component (3.7). Header row: background `--color-bg-elevated`, height `40px`. Header cells: `--font-body` weight 500 size `--text-xs` colour `--color-text-muted`, uppercase, letter-spacing `0.08em`. Left padding on first column `var(--space-6)`, right padding on last column `var(--space-6)`, all other cells `var(--space-4)`.

Body rows: height `52px`, border-bottom `1px solid var(--color-border-subtle)`. Row hover: background `--color-bg-card-hover`. Cell text: `--font-body` size `--text-sm` colour `--color-text-primary`. File names and IDs use `--font-mono`. The last row has no bottom border.

### 3.7 Card

Background `--color-bg-card`. Border `1px solid var(--color-border)`. Border-radius `--radius-lg`. Overflow hidden (so table headers respect the border-radius). A card header section (when present) has `padding: var(--space-5) var(--space-6)`, border-bottom `1px solid var(--color-border)`, and contains the card title in `--font-heading` weight 600 size `--text-base` colour `--color-text-primary` alongside optional right-side actions.

### 3.8 Stat Card

A card variant used for single-metric displays on the Dashboard. Fixed height `120px`. Padding `var(--space-6)`. Top row: metric label in `--font-body` size `--text-sm` colour `--color-text-muted`, and a trend chip (up or down arrow + percentage, colour green or red). Bottom row: large metric value in `--font-mono` weight 400 size `--text-3xl` colour `--color-text-primary`. A thin `3px` left border in `--color-accent-primary` (or the relevant status colour) as a visual accent — applied with `border-left`.

### 3.9 Modal

Backdrop: fixed overlay, `--color-overlay`, covers full viewport, `z-index: 200`. Modal panel: background `--color-bg-card`, border `1px solid var(--color-border)`, border-radius `--radius-xl`, shadow `--shadow-modal`, width `560px`, max-width `90vw`, `margin: auto`, positioned vertically centred. Header: `padding: var(--space-6)`, border-bottom `1px solid var(--color-border)`, title in `--font-heading` weight 600 size `--text-lg` colour `--color-text-primary`, a close icon button flush right. Body: `padding: var(--space-6)`. Footer: `padding: var(--space-4) var(--space-6)`, border-top `1px solid var(--color-border)`, action buttons right-aligned.

### 3.10 Toast Notification

Fixed position, `bottom: var(--space-6)`, `right: var(--space-6)`, `z-index: 300`. Each toast: background `--color-bg-elevated`, border `1px solid var(--color-border)`, border-radius `--radius-lg`, shadow `--shadow-dropdown`, padding `var(--space-4) var(--space-5)`, min-width `300px`, max-width `400px`. Left coloured bar `4px` wide in the relevant status colour. Icon `16x16px` in the status colour. Message in `--font-body` size `--text-sm` colour `--color-text-primary`. Auto-dismiss after `4000ms`. Enter animation: slide up `12px` + fade in. Exit: fade out.

### 3.11 Form Elements

**Text Input:** Height `40px`. Background `--color-bg-surface`. Border `1px solid var(--color-border)`. Border-radius `--radius-md`. Padding `0 var(--space-4)`. Font `--font-body` size `--text-sm` colour `--color-text-primary`. Placeholder colour `--color-text-muted`. Focus: border `--color-accent-primary`, no outline. Error state: border `--color-status-danger`. Label above the input in `--font-body` weight 500 size `--text-sm` colour `--color-text-secondary`, `margin-bottom: var(--space-2)`.

**Select / Dropdown:** Same dimensions as Text Input. Custom styled — no browser default arrow. Right-side chevron icon `12x12px` colour `--color-text-muted`. Dropdown list: background `--color-bg-elevated`, border `1px solid var(--color-border)`, border-radius `--radius-md`, shadow `--shadow-dropdown`. Each option: height `36px`, padding `0 var(--space-4)`, hover background `--color-bg-card-hover`.

---

## 4. PAGES

The main content area begins at `left: 240px` and `top: 64px` (offset for fixed sidebar and top bar). All page content renders within this area.

---

### PAGE 1: Login / Authentication

**Route:** `/login`  
**Access:** Public (redirect to `/dashboard` if already authenticated)

**Layout:** No sidebar. No top bar. Full-viewport centred layout. Background: `--color-bg-base`. A subtle radial gradient from `--color-accent-primary` at `3%` opacity originating from the top-right of the viewport — decorative only, very faint.

**Left panel (desktop only, 50% width):** A full-height panel background `--color-bg-surface`, border-right `1px solid var(--color-border)`. Contains centred content vertically and horizontally. At the top: the CloudDocVault wordmark (same as sidebar). Below it, a large italic pull-quote in `--font-heading` weight 400 size `--text-2xl` colour `--color-text-secondary`: "Encrypted. Versioned. Auditable." — this is purely decorative copy. Below the quote: three feature lines, each a `--text-sm` colour `--color-text-muted` label preceded by a small dot `4px` circle in `--color-accent-primary`. The three lines: "AWS S3 with SSE-KMS encryption", "IAM least-privilege access control", "Immutable CloudTrail audit log".

**Right panel (100% width on mobile, 50% width on desktop):** Contains the authentication form centred horizontally at approximately `40%` from top vertically.

Form card: width `380px`, no border, no shadow — forms are presented directly on the background, not inside a card, to keep the login screen airy.

Title: "Sign in to CloudDocVault" in `--font-heading` weight 600 size `--text-2xl` colour `--color-text-primary`. Sub-label: "Use your organisation credentials." in `--font-body` size `--text-sm` colour `--color-text-muted`.

Fields (top to bottom, each with `margin-bottom: var(--space-5)`):

1. Email — label "Email address", type `email`, placeholder "you@organisation.com"
2. Password — label "Password", type `password`, placeholder "Enter your password", with a toggle-visibility icon button inside the field on the right (`14x14px`, colour `--color-text-muted`)

Below the password field: a right-aligned text link "Forgot password?" in `--font-body` size `--text-sm` colour `--color-accent-primary`. No underline on rest; underline on hover.

Primary button, full width, height `44px`, label "Sign in". Below the button: a divider row — `1px` line either side of the text "or" in `--font-body` size `--text-xs` colour `--color-text-muted`.

Below the divider: a secondary full-width button, height `44px`, label "Continue with SSO", border `1px solid var(--color-border)`.

Error state: a danger-coloured inline alert box appears between the password field and the sign-in button. Background `rgba(248,113,113,0.08)`, border `1px solid var(--color-status-danger)`, border-radius `--radius-md`, padding `var(--space-3) var(--space-4)`, text `--font-body` size `--text-sm` colour `--color-status-danger`. Message: "Invalid credentials. Please try again."

Loading state on the Sign in button: replace label text with a spinning ring indicator (`16x16px`, white stroke), disable the button, reduce opacity to `0.7`.

---

### PAGE 2: Dashboard

**Route:** `/dashboard`  
**Access:** Authenticated

**Page title (top bar):** "Dashboard"

**Layout:** Two sections stacked vertically with `var(--space-8)` gap.

**Section A — Stat Cards Row**

A single horizontal row of four Stat Cards (component 3.8), each occupying equal width using CSS grid `grid-template-columns: repeat(4, 1fr)`, gap `var(--space-5)`.

Card 1 — "Total Documents": value from API, left border colour `--color-accent-primary`.
Card 2 — "Storage Used": value formatted as `X.XX GB` in `--font-mono`, left border colour `--color-accent-cyan`.
Card 3 — "Uploads Today": value from API, left border colour `--color-status-success`.
Card 4 — "Access Denied (24h)": value from CloudWatch, left border colour `--color-status-danger`.

**Section B — Two-column grid**

`grid-template-columns: 1fr 380px`, gap `var(--space-6)`.

**Left column — Recent Documents card:**

Card (component 3.7) with header "Recent Documents" and a right-side link "View all" (ghost style, `--text-sm`, colour `--color-accent-primary`).

Body: a Data Table (component 3.6) with five columns: Name, Type, Size, Uploaded, Status.

- Name column: file icon (`14x14px`, colour determined by file type — PDF red `--color-status-danger`, image cyan `--color-accent-cyan`, other neutral `--color-text-muted`) followed by filename in `--font-mono` size `--text-sm` colour `--color-text-primary`. Truncate with ellipsis if over `240px`.
- Type column: file extension in uppercase, Badge component neutral variant.
- Size column: `--font-mono` size `--text-sm` colour `--color-text-secondary`.
- Uploaded column: relative time ("2 hours ago") in `--font-body` size `--text-sm` colour `--color-text-muted`.
- Status column: Badge component. "Stored" maps to success variant. "Processing" maps to warning. "Failed" maps to danger.

Show the 8 most recent documents. No pagination on this card.

**Right column — Activity Feed card:**

Card with header "Activity". Body: a vertical list of activity events, no table — each event is a row of `padding: var(--space-4) var(--space-5)`, border-bottom `1px solid var(--color-border-subtle)`.

Each row: a `28x28px` icon circle (background `--color-bg-elevated`, icon `14x14px`) on the left, then event description in `--font-body` size `--text-sm` colour `--color-text-secondary`, and timestamp in `--font-mono` size `--text-xs` colour `--color-text-muted` flush right.

Icon circle colours by event type: Upload — `--color-accent-primary`, Download — `--color-accent-cyan`, Delete — `--color-status-danger`, Login — `--color-status-success`, Access Denied — `--color-status-warning`.

Show 10 events. At the bottom of the card, a full-width ghost-style link "View full audit log" centred, `--text-sm` colour `--color-accent-primary`.

---

### PAGE 3: Documents

**Route:** `/documents`  
**Access:** Authenticated

**Page title (top bar):** "Documents"

**Layout:** Full width, single column.

**Toolbar row:** `display: flex`, `align-items: center`, `justify-content: space-between`, `margin-bottom: var(--space-6)`.

Left side: A filter/view bar. Three segmented toggle buttons (inline, touching, rounded ends on the first and last): "All", "Mine", "Shared". Active segment: background `--color-accent-primary`, text `--color-text-inverse`. Inactive: background `--color-bg-elevated`, border `1px solid var(--color-border)`, text `--color-text-secondary`.

Right side: A type filter dropdown (component 3.11 Select, width `160px`, label omitted, placeholder "All types"), a sort dropdown (width `180px`, placeholder "Sort: Newest"), and a view toggle — two icon buttons (grid icon, list icon) in a pair. Active view icon: colour `--color-accent-primary`. Inactive: `--color-text-muted`.

**Grid view (default):** `grid-template-columns: repeat(auto-fill, minmax(220px, 1fr))`, gap `var(--space-4)`.

Each document card: background `--color-bg-card`, border `1px solid var(--color-border)`, border-radius `--radius-lg`, padding `var(--space-5)`. On hover: border `--color-accent-primary`, background `--color-bg-card-hover`, shadow `--shadow-card`.

Top of card: a file type icon, large `40x40px`, colour coded as above, centred horizontally. Below it: filename in `--font-mono` size `--text-sm` colour `--color-text-primary`, centred, two-line max with ellipsis. Below filename: file size in `--font-mono` size `--text-xs` colour `--color-text-muted`, centred. Bottom of card: a row with upload date left (relative) and a `...` action menu button right (ghost, `16x16px`).

On the `...` click: a dropdown (component 3.11) with options: "Download", "Copy link", "View details", separator line, "Delete" (danger colour text).

**List view:** Full-width table (component 3.6). Columns: checkbox, Name, Type, Size, Uploaded by, Last accessed, Actions. Actions column: three icon buttons — download, link, trash — ghost style. Trash icon hover colour `--color-status-danger`.

**Empty state (no documents):** Centred vertically and horizontally in the content area. A `64x64px` folder-open icon in `--color-text-muted`. Below it: heading "No documents yet" in `--font-heading` weight 600 size `--text-xl` colour `--color-text-secondary`. Sub-label "Upload your first document to get started." in `--font-body` size `--text-sm` colour `--color-text-muted`. A Primary button "Upload document" below.

**Pagination:** Below the grid or table. Centred. Previous / Next buttons (Secondary variant) with a page indicator between them: "Page 2 of 14" in `--font-body` size `--text-sm` colour `--color-text-secondary`. Show 24 items per page in grid view, 20 in list view.

---

### PAGE 4: Upload

**Route:** `/upload`  
**Access:** Authenticated

**Page title (top bar):** "Upload Document"

**Layout:** Single centred column, max-width `720px`, `margin: 0 auto`.

**Drop zone:** A large rectangular area, height `240px`, full width. Background `--color-bg-surface`. Border `2px dashed var(--color-border)`. Border-radius `--radius-xl`. Centred content vertically and horizontally. An upload-cloud icon `48x48px` colour `--color-text-muted`. Below it: heading "Drag and drop files here" in `--font-heading` weight 600 size `--text-lg` colour `--color-text-secondary`. Below that: "or" in `--font-body` size `--text-sm` colour `--color-text-muted`. Below that: a Secondary button "Browse files".

Drag-over state: border colour `--color-accent-primary`, background `rgba(79,142,247,0.05)`, icon colour `--color-accent-primary`.

Supported formats note: `--font-body` size `--text-xs` colour `--color-text-muted`, centred, below the drop zone with `var(--space-3)` margin. Text: "PDF, DOCX, XLSX, PNG, JPG, ZIP — max 5 GB per file"

**File queue (appears below drop zone after files are selected):**

Card with header "Selected files (N)". Each queued file is a row: height `60px`, border-bottom `1px solid var(--color-border-subtle)`. Left: file type icon `24x24px`. Centre: filename in `--font-mono` size `--text-sm` colour `--color-text-primary`, file size below in `--font-mono` size `--text-xs` colour `--color-text-muted`. Right: a progress bar container `200px` wide, height `4px`, background `--color-bg-elevated`, border-radius `--radius-pill`. The fill bar transitions from `--color-accent-primary` (uploading) to `--color-status-success` (complete) to `--color-status-danger` (failed). Next to the bar: a percentage label in `--font-mono` size `--text-xs`. A remove icon button (`14x14px`, ghost, hover danger) at the far right for pending files.

**Metadata form (below queue):**

Card with header "Document metadata". Fields:

1. Tags — a tag input field where the user types and presses Enter to add tags. Each tag renders as a pill inside the field: background `--color-bg-elevated`, border `1px solid var(--color-border)`, border-radius `--radius-pill`, text `--font-mono` size `--text-xs` colour `--color-text-secondary`, with a small `×` remove icon.
2. Description — textarea, `height: 100px`, same styles as Text Input (3.11).
3. Access level — Select dropdown with options: "Private (only me)", "Team", "Organisation".

**Action row:** `margin-top: var(--space-8)`. Primary button "Upload now" right-aligned. Secondary button "Clear all" left-aligned. Between them: nothing.

**Post-upload success state:** Replace the drop zone and queue with a full-width card. Green left border accent. Centred content: a checkmark-circle icon `48x48px` colour `--color-status-success`, heading "Upload complete" in `--font-heading` weight 600 size `--text-2xl` colour `--color-text-primary`, sub-label "All files have been securely stored." in `--font-body` size `--text-sm` colour `--color-text-muted`. Two buttons: Primary "View documents", Secondary "Upload more".

---

### PAGE 5: Document Detail

**Route:** `/documents/:id`  
**Access:** Authenticated

**Page title (top bar):** File name (from metadata)

**Layout:** Two-column, `grid-template-columns: 1fr 320px`, gap `var(--space-6)`.

**Left column — Preview panel:**

Card, full height. Header: filename in `--font-mono` weight 400 size `--text-base` colour `--color-text-primary`. Right side of header: a Primary button "Download" and a Ghost button with link icon "Copy link".

Body: an embedded preview area, height `480px`, background `--color-bg-surface`. For PDFs: render an `<iframe>` pointing to the pre-signed GET URL. For images: render an `<img>` tag. For all other types: a centred placeholder — file icon `64x64px`, label "Preview not available", Secondary button "Download to view".

**Right column — Metadata panel (two cards stacked, gap `var(--space-5)`):**

Card 1 header "File information". Body: a definition list — each row is `padding: var(--space-3) 0`, border-bottom `1px solid var(--color-border-subtle)`, with the key on the left in `--font-body` size `--text-sm` colour `--color-text-muted` and the value right-aligned in `--font-mono` size `--text-sm` colour `--color-text-primary`. Rows: File name, Type, Size, Uploaded, Uploaded by, S3 Key (truncated with ellipsis, click to copy), Version ID, Storage class.

Card 2 header "Access". Body: a smaller version activity list — last 5 access events. Each row: timestamp left, action badge right (Download / View / Copy link), accessor email below timestamp in `--text-xs` colour `--color-text-muted`.

Below Card 2: a Danger button "Delete document", full width. On click: open a confirmation Modal (component 3.9). Modal title "Delete document". Body text: "This action cannot be undone. The file will be permanently deleted from S3 and all versions will be removed." Confirm button: Danger variant, label "Yes, delete". Cancel button: Secondary variant.

---

### PAGE 6: Access Logs

**Route:** `/logs`  
**Access:** Authenticated

**Page title (top bar):** "Access Logs"

**Layout:** Single column, full width.

**Filter bar:** A horizontal row with `gap: var(--space-4)`, `margin-bottom: var(--space-6)`. Components left to right:

1. Date range picker — two text inputs side by side (From, To), each `height: 36px`, width `160px`, `--font-mono` size `--text-sm`.
2. Action filter dropdown — options: "All actions", "Upload", "Download", "Delete", "Access denied", "Login".
3. User filter — text input, placeholder "Filter by user", width `200px`.
4. Primary button "Apply filters".
5. Ghost button "Clear".

Right of the filter bar: a Badge chip showing "N events" in neutral variant.

**Export row:** A small row below the filter bar, right-aligned. Text: "Export as" in `--font-body` size `--text-sm` colour `--color-text-muted`. Two Ghost buttons: "CSV" and "JSON".

**Log table card:**

Card, no header (the page title + filter bar suffice). Data Table columns: Timestamp, User, Action, Resource (S3 key, truncated), Source IP, Result.

- Timestamp: `--font-mono` size `--text-sm` colour `--color-text-muted`.
- User: `--font-body` size `--text-sm` colour `--color-text-primary`.
- Action: Badge — Upload success, Danger denied, Warning delete, Neutral download.
- Resource: `--font-mono` size `--text-sm`, truncated at `200px`, hover shows full value in a tooltip.
- Source IP: `--font-mono` size `--text-sm` colour `--color-text-muted`.
- Result: Badge — success or danger.

Tooltip: background `--color-bg-elevated`, border `1px solid var(--color-border)`, border-radius `--radius-md`, padding `var(--space-2) var(--space-3)`, `--font-mono` size `--text-xs` colour `--color-text-primary`, shadow `--shadow-dropdown`. Appears on hover after `300ms` delay.

Pagination below the card: same as Documents page, 50 rows per page.

---

### PAGE 7: Observability

**Route:** `/observability`  
**Access:** Authenticated (admin users see additional panels)

**Page title (top bar):** "Observability"

**Layout:** Three sections stacked with `var(--space-8)` gap.

**Section A — Metric stat row:**

Five Stat Cards in a grid `repeat(5, 1fr)`, gap `var(--space-4)`.

1. API P95 Latency — value in `ms`, accent primary
2. Upload Error Rate — value as `X.X%`, colour dynamically: below 1% = success, 1–5% = warning, above 5% = danger left border
3. Lambda Errors (24h) — count, accent cyan
4. CloudFront Cache Hit — value as percentage, success
5. Active Sessions — count, accent primary

**Section B — Two charts side by side:**

`grid-template-columns: 1fr 1fr`, gap `var(--space-6)`.

Both charts are Cards (component 3.7) with a card header containing the chart title and a right-side time range segmented toggle: "1h", "6h", "24h", "7d". Use the `recharts` library for all charts.

Chart 1 card — "Document Operations": An `AreaChart` (recharts) with two area series — Uploads (fill/stroke `--color-accent-primary` at `20%` fill opacity) and Downloads (fill/stroke `--color-accent-cyan` at `20%` fill opacity). X axis: time labels in `--font-mono` size `--text-xs` colour `--color-text-muted`. Y axis: count. No grid lines on the Y axis. Horizontal dashed grid lines in `--color-border-subtle`. Tooltip: styled per tooltip spec above, showing exact counts.

Chart 2 card — "S3 Bucket Size": A `LineChart` (recharts) with a single line in `--color-accent-cyan`, stroke width `2`. Area fill beneath the line in `--color-accent-cyan` at `10%` opacity. Y axis labels formatted as `X.X GB`.

**Section C — Alerts table:**

Card with header "Active Alerts". If no active alerts: an inline empty state row — "No active alerts" in `--font-body` size `--text-sm` colour `--color-status-success`, with a checkmark icon.

If alerts present: Data Table. Columns: Severity (Badge), Alert name, Triggered, Duration, Source.

Severity badges: Critical = danger, Warning = warning, Info = neutral.

---

### PAGE 8: Settings

**Route:** `/settings`  
**Access:** Authenticated

**Page title (top bar):** "Settings"

**Layout:** Two-column, `grid-template-columns: 220px 1fr`, gap `var(--space-8)`.

**Left column — Settings nav:**

A vertical list of category links, each `height: 36px`, `padding: 0 var(--space-3)`, border-radius `--radius-md`. Active: background `--color-bg-elevated`, text `--color-text-primary`. Inactive: text `--color-text-secondary`. Categories: Profile, Security, Notifications, Storage Preferences, API Keys.

**Right column — Setting panels (one shown at a time, no page reload):**

Profile panel: Card with header "Profile". Form fields: Display name (text input), Email (text input, disabled — read-only, sourced from Cognito). Primary button "Save changes" at the bottom.

Security panel: Card with header "Security". One row: label "Multi-factor authentication", sub-label "Require MFA for all sign-ins" in `--text-sm` colour `--color-text-muted`, and a toggle switch flush right. Toggle: pill shape, `44x24px`. Off state: background `--color-bg-elevated`, handle white. On state: background `--color-accent-primary`. Transition `200ms`. A second row for "Active sessions" — a list of session entries (device, IP, last seen) with a "Revoke" Ghost button per row.

Notifications panel: Card with header "Notifications". Toggle rows for: Upload complete, Download by another user, Access denied event, Storage threshold reached, System alerts.

API Keys panel: Card with header "API Keys". Table of existing keys: Name, Created, Last used, Action (Revoke button, Danger ghost). Below table: a Primary button "Generate new key". On click: Modal with a text field showing the generated key, a warning "This key will only be shown once." in warning colour, a copy button, and a Close button.

---

## 5. ROUTING AND AUTHENTICATION

Use React Router v6. All routes except `/login` and `/forgot-password` are protected with an `<AuthGuard>` wrapper component. `AuthGuard` reads the Cognito JWT from memory (not localStorage — see note on storage). If no valid token exists or the token is expired, redirect to `/login` with the intended path saved in router state for post-login redirect.

Token storage: store the Cognito access token and refresh token in React memory state only (a React context). Do not write tokens to localStorage or sessionStorage for security reasons. Tokens are lost on page refresh — on refresh, silently attempt a Cognito refresh token call using an httpOnly cookie set by the backend. If the refresh fails, redirect to login.

Route map:

```
/login                    → Login page
/dashboard                → Dashboard (protected)
/documents                → Documents list (protected)
/documents/:id            → Document detail (protected)
/upload                   → Upload (protected)
/logs                     → Access logs (protected)
/observability            → Observability (protected)
/settings                 → Settings (protected)
*                         → Redirect to /dashboard
```

---

## 6. BACKEND — NODE.JS EXPRESS SERVER

### 6.1 Technology

- Runtime: Node.js 20.x LTS
- Framework: Express 4.x
- AWS SDK: `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`, `@aws-sdk/client-cognito-identity-provider`, `@aws-sdk/client-cloudwatch`, `@aws-sdk/client-cloudtrail`
- Auth middleware: `express-jwt` + `jwks-rsa` for Cognito JWT verification
- Process manager: PM2 (managed by deploy script)
- Port: `3001` (Nginx proxies from `80`/`443` to this)

### 6.2 Environment Variables

The backend reads all configuration from environment variables. These are written by the deploy script from the exported AWS credentials and a `.env` file. Define the following:

```
PORT=3001
NODE_ENV=production

AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=         # from shell environment (pre-exported by user)
AWS_SECRET_ACCESS_KEY=     # from shell environment (pre-exported by user)

S3_BUCKET_PRIMARY=         # name of the primary CloudDocVault S3 bucket
S3_BUCKET_AUDIT=           # name of the audit log bucket
CLOUDFRONT_DOMAIN=         # CloudFront distribution domain (no trailing slash)

COGNITO_USER_POOL_ID=      # from AWS Console or Terraform outputs
COGNITO_CLIENT_ID=         # Cognito App Client ID
COGNITO_REGION=            # same as AWS_REGION unless different

CLOUDWATCH_NAMESPACE=CloudDocVault
PROMETHEUS_URL=            # internal URL to Prometheus e.g. http://localhost:9090

CORS_ORIGIN=               # frontend origin e.g. http://your-ec2-ip or https://yourdomain.com

JWT_COOKIE_SECRET=         # random 64-char secret for signing the refresh-token httpOnly cookie
```

### 6.3 Folder Structure

```
/server
  /src
    /routes
      auth.js
      documents.js
      upload.js
      logs.js
      metrics.js
      settings.js
    /middleware
      authGuard.js
      errorHandler.js
      rateLimiter.js
    /services
      s3.js
      cognito.js
      cloudwatch.js
      cloudtrail.js
      prometheus.js
    app.js
    server.js
  .env
  package.json
  ecosystem.config.js       ← PM2 config
```

### 6.4 Middleware Stack (applied globally in app.js)

Order matters. Apply in this exact sequence:

1. `helmet()` — sets security headers. Explicitly set `Content-Security-Policy` to allow the frontend origin.
2. `cors({ origin: process.env.CORS_ORIGIN, credentials: true })` — credentials required for the httpOnly cookie.
3. `express.json({ limit: '50kb' })` — request body parsing, low size limit since files never pass through the backend.
4. `cookieParser(process.env.JWT_COOKIE_SECRET)` — for reading the signed refresh token cookie.
5. `rateLimiter` — custom middleware using the `express-rate-limit` package: 100 requests per minute per IP on all routes. On the `/api/auth/login` route specifically: 10 requests per 15 minutes per IP.
6. Request logger — log method, path, status, and duration to stdout using a simple custom logger (no third-party logging library). Format: `[ISO8601] METHOD /path STATUS Xms`.

### 6.5 Authentication Routes — `/api/auth`

**POST /api/auth/login**

Body: `{ email, password }`

Process:
1. Call Cognito `InitiateAuth` with `AUTH_FLOW: USER_PASSWORD_AUTH`, `USERNAME: email`, `PASSWORD: password`, `CLIENT_ID`.
2. On success: receive `AccessToken`, `IdToken`, `RefreshToken`.
3. Set `RefreshToken` as a `signed httpOnly` cookie: name `cdv_rt`, `sameSite: strict`, `secure: true` in production, `maxAge: 30 days`.
4. Return JSON: `{ accessToken, idToken, user: { email, name, sub } }`.
5. On `NotAuthorizedException` or `UserNotFoundException` from Cognito: return `401` with `{ error: "Invalid credentials" }`. No specifics.
6. On any other error: return `500` with `{ error: "Authentication failed" }`.

**POST /api/auth/refresh**

Body: none (reads `cdv_rt` cookie).

Process:
1. Read signed cookie `cdv_rt`.
2. If absent: return `401 { error: "No refresh token" }`.
3. Call Cognito `InitiateAuth` with `AUTH_FLOW: REFRESH_TOKEN_AUTH`, `REFRESH_TOKEN: cookie value`.
4. On success: return new `{ accessToken, idToken }`. Do not reissue the cookie unless Cognito returns a new refresh token.
5. On failure: clear the cookie, return `401 { error: "Session expired" }`.

**POST /api/auth/logout**

Require: valid access token (via `authGuard` middleware).
Process: Call Cognito `GlobalSignOut` with the access token to invalidate all sessions. Clear the `cdv_rt` cookie. Return `200 { message: "Logged out" }`.

### 6.6 Auth Guard Middleware

File: `middleware/authGuard.js`

Applied to all routes under `/api/documents`, `/api/upload`, `/api/logs`, `/api/metrics`, `/api/settings`.

Process:
1. Extract the Bearer token from the `Authorization` header.
2. If absent: return `401`.
3. Verify the JWT signature using `jwks-rsa` — fetch Cognito's JWKS endpoint: `https://cognito-idp.{COGNITO_REGION}.amazonaws.com/{COGNITO_USER_POOL_ID}/.well-known/jwks.json`. Cache the JWKS in memory for `1 hour`.
4. Verify `iss`, `aud`, and `exp` claims.
5. On success: attach `req.user = { sub, email, groups }` and call `next()`.
6. On failure: return `401 { error: "Unauthorized" }`.

### 6.7 Documents Routes — `/api/documents`

All routes protected by `authGuard`.

**GET /api/documents**

Query params: `page` (default 1), `limit` (default 24), `type` (file extension filter), `sort` (newest | oldest | name | size), `scope` (all | mine | shared).

Process:
1. Call S3 `ListObjectsV2` on `S3_BUCKET_PRIMARY`. Use a prefix based on scope: if `mine`, prefix `users/{req.user.sub}/`. If `all` (admin) or `shared`, prefix `shared/`.
2. For each object in the result, extract `Key`, `Size`, `LastModified`, `ETag`, `StorageClass`.
3. Call S3 `HeadObject` for each item to retrieve custom metadata tags (`x-amz-meta-*`): `uploaded-by`, `original-name`, `tags`, `description`, `access-level`.
4. Apply type filter client-side (after fetch).
5. Apply sort.
6. Paginate: return `{ documents: [...], total, page, totalPages }`.

Note: `HeadObject` calls are made in parallel using `Promise.all` in batches of 10 to avoid throttling.

**GET /api/documents/:id**

`:id` is the URL-encoded S3 object key.

Process:
1. Call S3 `HeadObject` to retrieve metadata.
2. Generate a pre-signed GET URL using `@aws-sdk/s3-request-presigner` with `GetObjectCommand`. Expiry: `900` seconds (15 minutes).
3. Query CloudTrail for access events on this specific object key: call `LookupEvents` with `AttributeKey: ResourceName`, `AttributeValue: bucket-name/object-key`. Return last 5 events.
4. Return `{ key, name, size, lastModified, storageClass, metadata, presignedUrl, accessHistory }`.

**DELETE /api/documents/:id**

Process:
1. Call S3 `DeleteObject`. If versioning is enabled, this creates a delete marker — do not do a hard delete.
2. Log the deletion event to CloudTrail via a custom CloudWatch log entry (the audit trail is auto-populated by S3 data events but add an application log for correlation).
3. Return `200 { message: "Document deleted" }`.

**GET /api/documents/:id/link**

Generates a fresh pre-signed URL for sharing. Expiry: `3600` seconds (1 hour). Returns `{ url, expiresAt }`.

### 6.8 Upload Routes — `/api/upload`

All routes protected by `authGuard`.

**POST /api/upload/presign**

Body: `{ filename, contentType, size, metadata: { tags, description, accessLevel } }`

Validation:
- `size` must be below `5368709120` (5 GB). Return `400` if exceeded.
- `contentType` must be in an allowlist: `application/pdf`, `application/msword`, `application/vnd.openxmlformats-officedocument.*`, `image/png`, `image/jpeg`, `image/webp`, `application/zip`, `text/plain`. Return `415` for anything else.

Process:
1. Construct the S3 key: `users/{req.user.sub}/{UUID}/{sanitised-filename}`. The UUID is generated server-side with `crypto.randomUUID()`. Filename sanitisation: replace all characters that are not alphanumeric, dot, hyphen, or underscore with an underscore.
2. Generate a pre-signed PUT URL using `PutObjectCommand`. Expiry: `1800` seconds (30 minutes).
3. Include S3 object metadata headers in the pre-signed URL: `x-amz-meta-uploaded-by`, `x-amz-meta-original-name`, `x-amz-meta-tags`, `x-amz-meta-access-level`.
4. Return `{ uploadUrl, key, expiresAt }`.

The client frontend puts the file directly to S3 using the returned `uploadUrl` — the file bytes never touch the backend server.

**POST /api/upload/confirm**

Body: `{ key }` — called by the frontend after a successful PUT to S3.

Process:
1. Call S3 `HeadObject` on the key to verify the object exists and its ETag is present (confirming the upload completed).
2. If verified: return `200 { document: { key, name, size, uploadedAt } }`.
3. If not found: return `404 { error: "Upload not confirmed — object not found" }`.

### 6.9 Logs Routes — `/api/logs`

All routes protected by `authGuard`.

**GET /api/logs**

Query params: `page` (default 1), `limit` (default 50), `startTime` (ISO8601), `endTime` (ISO8601), `action` (Upload | Download | Delete | AccessDenied | Login), `user`.

Process:
1. Call AWS CloudTrail `LookupEvents` with `StartTime` and `EndTime`.
2. Map CloudTrail event names to friendly action labels: `PutObject` → Upload, `GetObject` → Download, `DeleteObject` → Delete, `GetObject` with error code `AccessDenied` → Access Denied.
3. Extract from each event: `EventTime`, `Username`, `EventName`, `Resources[0].ResourceName`, `SourceIPAddress`, `ErrorCode` (null if successful).
4. Apply action and user filters.
5. Return `{ events: [...], total, page, totalPages }`.

**GET /api/logs/export**

Query params: same as above, plus `format` (csv | json).

Process: fetch all matching events (no pagination limit), format, and stream the response with appropriate Content-Disposition header for download.

### 6.10 Metrics Routes — `/api/metrics`

All routes protected by `authGuard`.

**GET /api/metrics/summary**

Returns the five summary stats displayed in the Observability stat row and the Dashboard stat cards.

Process:
1. Call CloudWatch `GetMetricStatistics` for each of the following metrics in parallel:
   - `AWS/Lambda` → `Errors` (sum, period 86400s) → upload error rate
   - `AWS/Lambda` → `Duration` (p95, period 3600s) → API P95 latency
   - `AWS/CloudFront` → `CacheHitRate` (average, period 3600s)
   - `AWS/S3` → `NumberOfObjects` (average, period 86400s) for `S3_BUCKET_PRIMARY`
   - `AWS/S3` → `BucketSizeBytes` (average, period 86400s) for `S3_BUCKET_PRIMARY`
2. For uploads and downloads today: call S3 `ListObjectsV2` and count objects modified in the last 24 hours (or use a CloudWatch metric if available).
3. For active sessions: call Cognito `ListUsers` and count confirmed users with an active session (approximate — use the metric from Prometheus if `PROMETHEUS_URL` is configured, otherwise return null).
4. Return all metrics as a flat JSON object.

**GET /api/metrics/timeseries**

Query params: `metric` (operations | bucketsize), `range` (1h | 6h | 24h | 7d).

Process:
1. Map `range` to CloudWatch `Period` and `StartTime`.
2. Call `GetMetricStatistics` with the appropriate parameters.
3. Return `{ datapoints: [{ timestamp, value }] }` sorted ascending by timestamp.

**GET /api/metrics/alerts**

Process:
1. Call CloudWatch `DescribeAlarms`. Filter to alarms in state `ALARM`.
2. Return `{ alerts: [{ name, severity, triggeredAt, description, source }] }`.
3. If `PROMETHEUS_URL` is configured: also call the Prometheus `/api/v1/alerts` endpoint (HTTP GET), merge Prometheus firing alerts into the response array.

### 6.11 Dashboard Route — `/api/dashboard`

**GET /api/dashboard/summary**

Returns all data needed for the Dashboard page in a single request to minimise frontend round-trips.

Process: call `/api/metrics/summary` data (internal function call, not HTTP), and the 8 most recent S3 objects, and the 10 most recent CloudTrail events, in parallel. Return as:

```json
{
  "stats": { ... },
  "recentDocuments": [ ... ],
  "recentActivity": [ ... ]
}
```

### 6.12 Error Handler Middleware

File: `middleware/errorHandler.js`. Applied last in `app.js` after all routes.

Catches all errors thrown or passed via `next(err)`. Returns:

```json
{
  "error": "Human-readable message",
  "code": "MACHINE_READABLE_CODE",
  "requestId": "uuid"
}
```

Log the full error (including stack trace) to stdout. Never expose stack traces in the HTTP response. Status code mapping: `ValidationError` → 400, `AuthError` → 401, `ForbiddenError` → 403, `NotFoundError` → 404, all others → 500.

### 6.13 Settings Routes — `/api/settings`

**GET /api/settings/profile** — returns the current user's Cognito attributes.
**PUT /api/settings/profile** — body `{ name }` — calls Cognito `UpdateUserAttributes`.
**GET /api/settings/sessions** — calls Cognito `ListDevices` with the user's access token.
**DELETE /api/settings/sessions/:deviceKey** — calls Cognito `ForgetDevice`.
**GET /api/settings/apikeys** — lists application-managed API keys stored as items in an S3 object at key `config/apikeys/{user.sub}.json` in the primary bucket. Returns only key names and metadata, never the raw key.
**POST /api/settings/apikeys** — generates a new random 48-character API key (using `crypto.randomBytes(24).toString('hex')`), hashes it with SHA-256, stores the hash, and returns the raw key exactly once.
**DELETE /api/settings/apikeys/:keyId** — deletes the key record.

---

## 7. FRONTEND — REACT APPLICATION

### 7.1 Technology

- Build tool: Vite 5.x
- Framework: React 18.x
- Routing: React Router v6
- HTTP client: Axios with an interceptor that attaches the `Authorization: Bearer {accessToken}` header and handles `401` responses by calling `/api/auth/refresh` once before redirecting to login.
- Charts: Recharts 2.x
- Icons: Lucide React
- State: React Context API only — no Redux, no Zustand. Three contexts: `AuthContext` (user, tokens), `ToastContext` (notification queue), `ThemeContext` (future use only — hardcode dark theme for now).

### 7.2 Folder Structure

```
/client
  /src
    /components
      /common       ← Button, Badge, Modal, Toast, Card, Table, etc.
      /layout       ← Sidebar, TopBar, AuthGuard, PageWrapper
      /charts       ← OperationsChart, BucketSizeChart, AlertsTable
      /forms        ← UploadForm, MetadataForm, LoginForm
    /pages
      Login.jsx
      Dashboard.jsx
      Documents.jsx
      DocumentDetail.jsx
      Upload.jsx
      Logs.jsx
      Observability.jsx
      Settings.jsx
    /contexts
      AuthContext.jsx
      ToastContext.jsx
    /services
      api.js          ← Axios instance + all API calls
      auth.js         ← login, logout, refresh helpers
    /styles
      variables.css   ← all CSS custom properties from Section 2
      global.css      ← resets, base body styles
    App.jsx
    main.jsx
  index.html
  vite.config.js
  package.json
```

### 7.3 API Service Layer

All backend calls go through `/src/services/api.js`. Create an Axios instance with `baseURL: '/api'` (Nginx proxies `/api` to the backend on `3001`). Define typed functions for each backend endpoint and import them in page components. Never use raw `fetch()` or `axios.get()` inline in components.

### 7.4 Loading States

Every page that fetches data must show a skeleton loading state while the request is in flight. Skeleton elements: a `div` with background `linear-gradient(90deg, var(--color-bg-elevated) 25%, var(--color-bg-card-hover) 50%, var(--color-bg-elevated) 75%)`, background-size `200% 100%`, animated with a keyframe that shifts the background-position from `100% 0` to `-100% 0` over `1.5s` in a loop. Apply this to placeholder bars of appropriate widths to mimic the expected content shape.

---

## 8. NGINX CONFIGURATION

Nginx serves as the reverse proxy on port `80` (and `443` if SSL is configured). The deploy script writes the Nginx config to `/etc/nginx/sites-available/clouddocvault` and symlinks it to `sites-enabled`.

```nginx
server {
    listen 80;
    server_name _;

    # Serve React build (static files)
    root /home/ubuntu/clouddocvault/client/dist;
    index index.html;

    # Frontend SPA — all non-API routes return index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy API calls to Node.js backend
    location /api/ {
        proxy_pass http://localhost:3001/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 60s;
    }

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/javascript application/json image/svg+xml;
    gzip_min_length 1024;

    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header Referrer-Policy strict-origin-when-cross-origin;
}
```

---

## 9. PM2 CONFIGURATION

File: `server/ecosystem.config.js`

```javascript
module.exports = {
  apps: [
    {
      name: 'clouddocvault-api',
      script: './src/server.js',
      cwd: '/home/ubuntu/clouddocvault/server',
      instances: 2,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
      env_file: '/home/ubuntu/clouddocvault/server/.env',
      error_file: '/home/ubuntu/clouddocvault/logs/api-error.log',
      out_file: '/home/ubuntu/clouddocvault/logs/api-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      max_memory_restart: '512M',
      restart_delay: 5000,
      autorestart: true,
    },
  ],
};
```

---

## 10. DEPLOY SCRIPT

### 10.1 What the script must do

The deploy script is a single Bash file named `deploy.sh` located at the repository root. When the user runs `bash deploy.sh`, it must perform every step listed below without any human interaction. The script assumes:

- Running as `ubuntu` user on Ubuntu 22.04 EC2.
- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, and `AWS_DEFAULT_REGION` are already exported in the current shell.
- An internet connection is available.
- The repository has been cloned to `/home/ubuntu/clouddocvault`.

The script must exit immediately on any failure (`set -euo pipefail`). Each step must print a clear header line to stdout so the user can follow progress.

### 10.2 Script Steps

**Step 1 — Validate AWS credentials**

Run `aws sts get-caller-identity` and assert it returns a JSON response with an `Account` field. If the AWS CLI is not installed, install it first. If credentials are invalid, print an error and exit with code 1.

**Step 2 — Install system dependencies**

```bash
sudo apt-get update -qq
sudo apt-get install -y -qq nginx curl unzip
```

**Step 3 — Install Node.js 20.x**

Check if `node` is installed and is version 20+. If not:

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

**Step 4 — Install PM2 globally**

```bash
sudo npm install -g pm2 --silent
```

**Step 5 — Derive configuration from AWS**

Run the following AWS CLI commands and capture output into shell variables. These are used to populate the `.env` file:

```bash
S3_BUCKET_PRIMARY=$(aws s3api list-buckets --query "Buckets[?contains(Name,'clouddocvault') && !contains(Name,'audit') && !contains(Name,'state') && !contains(Name,'replica')].Name" --output text | head -1)

S3_BUCKET_AUDIT=$(aws s3api list-buckets --query "Buckets[?contains(Name,'audit')].Name" --output text | head -1)

CLOUDFRONT_DOMAIN=$(aws cloudfront list-distributions --query "DistributionList.Items[0].DomainName" --output text)

COGNITO_USER_POOL_ID=$(aws cognito-idp list-user-pools --max-results 10 --query "UserPools[?contains(Name,'clouddocvault')].Id" --output text | head -1)

COGNITO_CLIENT_ID=$(aws cognito-idp list-user-pool-clients --user-pool-id "$COGNITO_USER_POOL_ID" --query "UserPoolClients[0].ClientId" --output text)

EC2_PUBLIC_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)
```

If any variable is empty after the query, the script must print which resource was not found and instructions to set it manually, then exit with code 1.

**Step 6 — Write backend .env file**

Write `/home/ubuntu/clouddocvault/server/.env` with all variables. Generate `JWT_COOKIE_SECRET` using `openssl rand -hex 32` if not already present in the file (idempotent — do not overwrite an existing secret on re-runs).

```bash
cat > /home/ubuntu/clouddocvault/server/.env <<EOF
PORT=3001
NODE_ENV=production
AWS_REGION=${AWS_DEFAULT_REGION}
AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY_ID}
AWS_SECRET_ACCESS_KEY=${AWS_SECRET_ACCESS_KEY}
S3_BUCKET_PRIMARY=${S3_BUCKET_PRIMARY}
S3_BUCKET_AUDIT=${S3_BUCKET_AUDIT}
CLOUDFRONT_DOMAIN=${CLOUDFRONT_DOMAIN}
COGNITO_USER_POOL_ID=${COGNITO_USER_POOL_ID}
COGNITO_CLIENT_ID=${COGNITO_CLIENT_ID}
COGNITO_REGION=${AWS_DEFAULT_REGION}
CLOUDWATCH_NAMESPACE=CloudDocVault
PROMETHEUS_URL=http://localhost:9090
CORS_ORIGIN=http://${EC2_PUBLIC_IP}
JWT_COOKIE_SECRET=${JWT_COOKIE_SECRET:-$(openssl rand -hex 32)}
EOF
```

**Step 7 — Write frontend .env file**

Write `/home/ubuntu/clouddocvault/client/.env` with the Vite public variables:

```bash
cat > /home/ubuntu/clouddocvault/client/.env <<EOF
VITE_API_BASE_URL=/api
VITE_APP_NAME=CloudDocVault
EOF
```

**Step 8 — Install backend dependencies**

```bash
cd /home/ubuntu/clouddocvault/server
npm ci --omit=dev --silent
```

**Step 9 — Install and build frontend**

```bash
cd /home/ubuntu/clouddocvault/client
npm ci --silent
npm run build --silent
```

This produces `/home/ubuntu/clouddocvault/client/dist`.

**Step 10 — Create log directory**

```bash
mkdir -p /home/ubuntu/clouddocvault/logs
```

**Step 11 — Write and enable Nginx config**

Write the Nginx config (as defined in Section 8) to `/etc/nginx/sites-available/clouddocvault`.

```bash
sudo ln -sf /etc/nginx/sites-available/clouddocvault /etc/nginx/sites-enabled/clouddocvault
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
sudo systemctl enable nginx
```

**Step 12 — Start or reload PM2**

```bash
cd /home/ubuntu/clouddocvault/server
pm2 delete clouddocvault-api 2>/dev/null || true
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup systemd -u ubuntu --hp /home/ubuntu | tail -1 | sudo bash
```

The `pm2 startup` command generates a `sudo env PATH=...` command — capture the last line and pipe it to `sudo bash` to register PM2 as a systemd service so the backend survives reboots.

**Step 13 — Health check**

Wait 5 seconds, then run:

```bash
sleep 5
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/api/health)
if [ "$HTTP_STATUS" != "200" ]; then
  echo "HEALTH CHECK FAILED — HTTP status: $HTTP_STATUS"
  echo "Check logs: pm2 logs clouddocvault-api"
  exit 1
fi
```

Add a `/api/health` route to the backend that returns `200 { status: "ok", timestamp: ISO8601 }` without any auth guard — this is used only by the deploy script and AWS load balancers.

**Step 14 — Print summary**

```bash
echo ""
echo "============================================"
echo " CloudDocVault — Deployment Complete"
echo "============================================"
echo " Application URL : http://${EC2_PUBLIC_IP}"
echo " API Health      : http://${EC2_PUBLIC_IP}/api/health"
echo " PM2 status      : pm2 status"
echo " Backend logs    : pm2 logs clouddocvault-api"
echo " Nginx logs      : sudo tail -f /var/log/nginx/access.log"
echo "============================================"
```

---

## 11. REPOSITORY STRUCTURE

The agent must produce the following top-level structure:

```
/
  deploy.sh                 ← the deploy script (chmod +x)
  README.md                 ← brief setup instructions (3 steps: clone, export creds, run deploy.sh)
  /server
    /src
      /routes
      /middleware
      /services
      app.js
      server.js
    ecosystem.config.js
    package.json
  /client
    /src
      /components
      /pages
      /contexts
      /services
      /styles
      App.jsx
      main.jsx
    index.html
    vite.config.js
    package.json
  .gitignore                ← must exclude server/.env, client/.env, node_modules, dist
```

---

## 12. BUILD ORDER FOR THE AGENT

The agent must complete work in this sequence. Do not begin a step until the prior step is fully complete and verified.

1. Create the repository folder structure (all directories and empty placeholder files).
2. Write `variables.css` and `global.css` with the complete design token set.
3. Write all global reusable components (Section 3) one by one, in the order listed.
4. Write the `AuthContext` and `ToastContext`.
5. Write the `Sidebar`, `TopBar`, `AuthGuard`, and `PageWrapper` layout components.
6. Write `api.js` service layer with all endpoint functions defined (bodies can be stubs at this point).
7. Write each page component in the order listed in Section 4 (Login first, then Dashboard, Documents, Upload, Document Detail, Logs, Observability, Settings).
8. Wire up React Router in `App.jsx`.
9. Write the backend `app.js` and `server.js` entry points.
10. Write all backend service files (`s3.js`, `cognito.js`, `cloudwatch.js`, `cloudtrail.js`, `prometheus.js`) with fully implemented functions.
11. Write all route handlers in the order listed (auth, documents, upload, logs, metrics, dashboard, settings).
12. Write `errorHandler.js`, `authGuard.js`, and `rateLimiter.js`.
13. Write `ecosystem.config.js` and `package.json` for both server and client.
14. Write `vite.config.js`.
15. Write `deploy.sh` and make it executable.
16. Write `.gitignore` and `README.md`.
17. Verify: the agent must mentally trace a full user journey — login → dashboard load → document upload → document list → logout — and confirm every function in the stack has a complete implementation with no stubs remaining.

---

## 13. CRITICAL CONSTRAINTS

- No file bytes ever transit through the Express backend. S3 uploads use pre-signed PUT URLs. S3 downloads use pre-signed GET URLs or CloudFront. The backend only generates and validates URLs.
- No AWS credentials are ever sent to the frontend. The frontend only holds Cognito JWT tokens.
- No token is ever written to localStorage or sessionStorage. Tokens live in React memory. The refresh token travels only as an httpOnly cookie.
- All S3 keys generated by the backend are sanitised before use. No user input is interpolated directly into S3 API calls.
- The deploy script must be idempotent — running it twice must not break a running deployment. PM2 delete + start handles this. `ln -sf` for Nginx handles this. `.env` secret preservation handles this.
- Do not hardcode any AWS resource names in application code. All names come from environment variables. The deploy script populates those variables automatically from the AWS account.
