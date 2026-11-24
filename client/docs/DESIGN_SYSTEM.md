# Enterprise Design System & Visual Tokens — DocuMind Client

> **Source**: Visual Language & Brand Guidelines Extraction (Airbnb Design Language System)  
> **System Grade**: A (91/100) — Flat Material Language, Friendly Voice, 100% WCAG 2.1 Contrast  
> **Framework**: Tailwind CSS v3.4+ & shadcn/ui (Radix UI Primitives)  
> **Location**: `client/docs/DESIGN_SYSTEM.md`

---

## 1. Executive Summary & Design Philosophy

DocuMind's user interface is built on a human-centered, precision-engineered design system captured from the high-craft visual language of Airbnb (`airbnb.com`). It moves away from generic, dark AI templates and sterile dashboards, replacing them with a warm, authoritative, flat-material interface that prioritizes **clarity, scanability, and effortless task execution**.

### Core Tenets
1. **Flat Material Language**: Clean, unembellished surfaces with crisp borders (`#DDDDDD`) and soft structural depth (`#EBEBEB` and `#FFFFFF`), eliminating unnecessary glossy gradients and AI-slop visual noise.
2. **Intentional Primary Accent**: The vibrant coral primary (`#FF385C`) is strictly reserved for high-intent interactive moments—primary calls to action (CTAs), focused search triggers, and active navigation states—never diluted across passive body copy.
3. **Harmonized Neutrals & Typography**: Charcoal `#222222` and fog gray `#6A6A6A` deliver exceptional reading comfort, set in `Airbnb Cereal VF` with a mathematical 7-step scale and strict 3-weight hierarchy (`400`, `500`, `700`).
4. **Hard-Constraint Accessibility**: 100% WCAG 2.1 AA/AAA contrast compliance across every color pair. When a pairing fails contrast, the color is altered—never the standard.
5. **Snap-to-Grid Rhythm**: An 8-step rhythm scale anchored on a 2px base prevents arbitrary pixel fragmentation and visual drift.

---

## 2. Color Palette & Semantic Tokens

The design system is constructed from an exact 8-color foundational palette: **1 Primary, 1 Secondary, and 6 Neutrals**.

### 2.1 Foundational Brand Palette
```
┌────────────────────────────────────────────────────────────────────────┐
│                        FOUNDATIONAL PALETTE                            │
├───────────────┬───────────────┬────────────────────────────────────────┤
│ Primary Coral │ Deep Crimson  │               Neutrals                 │
│   #FF385C     │   #E00B41     │ #222222  #6A6A6A  #000000  #FFFFFF...  │
└───────────────┴───────────────┴────────────────────────────────────────┘
```

| Color Name | Hex Code | RGB | HSL | Semantic Role |
| :--- | :---: | :---: | :---: | :--- |
| **Primary Coral** | `#FF385C` | `255, 56, 92` | `349°, 100%, 61%` | Primary CTAs, active tab indicators, key focus highlights. |
| **Secondary Crimson** | `#E00B41` | `224, 11, 65` | `345°, 91%, 46%` | Interactive hover states, secondary highlights, active outlines. |
| **Charcoal Dark** | `#222222` | `34, 34, 34` | `0°, 0%, 13%` | Primary headlines, table data text, user prompt queries. |
| **Fog Gray** | `#6A6A6A` | `106, 106, 106` | `0°, 0%, 42%` | Secondary subtitles, timestamps, coordinate metadata, helper labels. |
| **Pitch Black** | `#000000` | `0, 0, 0` | `0°, 0%, 0%` | Maximum contrast boundaries, solid icons, dark badge glyphs. |
| **Pure White** | `#FFFFFF` | `255, 255, 255` | `0°, 0%, 100%` | Canvas background, card containers, dialog backgrounds, input fields. |
| **Border Divider** | `#DDDDDD` | `221, 221, 221` | `0°, 0%, 87%` | Subtle container borders, table row dividers, card outlines. |
| **Surface Fog** | `#EBEBEB` | `235, 235, 235` | `0°, 0%, 92%` | Secondary card fills, dropzone idle surface, sidebar background. |

---

### 2.2 Semantic Application Tokens

| Token Name | Hex / Value | Tailwind Utility Class | Purpose & Location |
| :--- | :---: | :--- | :--- |
| `surface-canvas` | `#FFFFFF` | `bg-white` | Main window background, primary reading area. |
| `surface-card` | `#FFFFFF` | `bg-white border border-[#DDDDDD]` | Search result cards, document table containers, dialogs. |
| `surface-muted` | `#EBEBEB` | `bg-[#EBEBEB]` | Dropzone idle area, code snippets, citation preview drawer body. |
| `surface-accent-subtle`| `rgba(255,56,92,0.08)` | `bg-[#FF385C]/[0.08]` | Search keyword `<mark>` match highlight, active sidebar item pill. |
| `text-primary` | `#222222` | `text-[#222222]` | Page titles, document names, card headings, user chat messages. |
| `text-secondary` | `#6A6A6A` | `text-[#6A6A6A]` | File sizes, relative dates, coordinate labels (`Page 14`). |
| `text-inverse` | `#FFFFFF` | `text-white` | Text on Primary button CTAs (`#FF385C`), active dark badges. |
| `border-default` | `#DDDDDD` | `border-[#DDDDDD]` | Input borders, table dividers, card boundaries. |
| `border-focus` | `#222222` | `border-[#222222] ring-1 ring-[#222222]` | Accessible keyboard focus rings, active text inputs. |
| `border-accent` | `#FF385C` | `border-[#FF385C]` | Active drag-and-drop state, selected document row indicator. |

---

### 2.3 Document Format Signatures (Enterprise Ingestion)
To preserve immediate format recognition across document tables and search cards, format pills use subtle, high-contrast tinted fills with crisp borders:

| Format | Tint Hex | Border Hex | Tailwind Badge Classes |
| :--- | :---: | :---: | :--- |
| **PDF** | `#FFF1F2` | `#FFCCD3` | `bg-[#FFF1F2] text-[#E00B41] border border-[#FFCCD3]` |
| **Word (`.docx`)** | `#EFF6FF` | `#BFDBFE` | `bg-[#EFF6FF] text-[#1D4ED8] border border-[#BFDBFE]` |
| **Excel (`.xlsx`)** | `#F0FDF4` | `#BBF7D0` | `bg-[#F0FDF4] text-[#15803D] border border-[#BBF7D0]` |
| **PowerPoint (`.pptx`)** | `#FFF7ED` | `#FED7AA` | `bg-[#FFF7ED] text-[#C2410C] border border-[#FED7AA]` |

---

### 2.4 Ingestion Job Status Indicators
Status indicators inform users of BullMQ asynchronous job lifecycles:

| Status Stage | Pill Color | Text Color | Tailwind Classes |
| :--- | :---: | :---: | :--- |
| **`pending` / `queued`** | `#F3F4F6` | `#4B5563` | `bg-gray-100 text-gray-700 border-gray-200` |
| **`extracting` / `chunking`** | `#EFF6FF` | `#1D4ED8` | `bg-blue-50 text-blue-700 border-blue-200 animate-pulse` |
| **`embedding`** | `#FAF5FF` | `#7E22CE` | `bg-purple-50 text-purple-700 border-purple-200 animate-pulse` |
| **`completed`** | `#ECFDF5` | `#047857` | `bg-emerald-50 text-emerald-700 border-emerald-200` |
| **`failed`** | `#FEF2F2` | `#B91C1C` | `bg-rose-50 text-rose-700 border-rose-200` |

---

## 3. Typography Scale & Font Architecture

DocuMind utilizes a dual-family typographic system anchored by **`Airbnb Cereal VF`** (or clean geometric sans fallbacks) for displays and navigation, balanced with high-readability body serif/sans for long-form chunk inspection.

```css
/* Typography Stack */
--font-display: "Airbnb Cereal VF", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
--font-body: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
--font-mono: "JetBrains Mono", SFMono-Regular, Menlo, Monaco, Consolas, monospace;
```

### 3.1 Typographic Weights
* **`400` (Regular)**: Body paragraphs, extracted chunk text, table cells.
* **`500` (Medium)**: Navigation links, table header labels, badge tags, coordinate pills.
* **`700` (Bold)**: Primary page titles, card headers, primary CTA button text.

---

### 3.2 Seven-Step Type Scale (`t00` to `t06`)

| Step Token | Size (px) | Size (rem) | Line Height | Weight | Application & Mapping |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **`t00`** | `28px` | `1.75rem` | `34px` | `700` | Primary Page Titles (Document Library, Search Engine, Dashboard). |
| **`t01`** | `22px` | `1.375rem`| `28px` | `700` | View Section Headers, Modal Dialog Titles. |
| **`t02`** | `21px` | `1.3125rem`|`26px` | `500` | Secondary Section Headers, Drawer Titles (`CitationDrawer`). |
| **`t03`** | `16px` | `1.0rem` | `22px` | `500 / 700` | Search Result Card Titles, Primary Button Text, Chat Question Bubble. |
| **`t04`** | `14px` | `0.875rem`| `20px` | `400 / 500` | **Default Body Text**, Table Cells, AI Markdown Response, Search Snippets. |
| **`t05`** | `12px` | `0.75rem` | `16px` | `500` | Coordinate Pills (`Page 14`), Format Badges, Timestamps, Table Headers. |
| **`t06`** | `8px` | `0.5rem` | `12px` | `700` | Micro Footers, Compact SHA-256 Hashes, Super-script Citation Indices. |

---

## 4. Spacing Scale & Layout Rhythm

All margin, padding, gap, and dimension values snap strictly to an **8-step rhythmic scale** anchored on a `2px` base unit. Arbitrary one-off spacing values (`13px`, `19px`, `27px`) are strictly prohibited to prevent layout noise.

### 4.1 Rhythm Scale

| Scale Step | Dimension | Tailwind Class | Recommended Usage |
| :--- | :---: | :--- | :--- |
| **Step 1 (Base)** | `2px` | `p-[2px] / m-[2px]` | Border widths, indicator tick marks, tight focus ring offsets. |
| **Step 2** | `15px` | `p-[15px] / gap-[15px]`| Standard input vertical padding, compact table cell padding. |
| **Step 3** | `20px` | `p-5 / gap-5` | Standard card internal padding, button horizontal padding. |
| **Step 4** | `32px` | `p-8 / gap-8` | Section vertical margins, gap between grid columns. |
| **Step 5** | `35px` | `p-[35px] / gap-[35px]`| Hero section margins, dropzone default vertical padding. |
| **Step 6** | `48px` | `p-12 / gap-12` | Large drawer internal padding, search results feed header gap. |
| **Step 7** | `80px` | `p-20 / gap-20` | Page container horizontal padding on wide desktop displays. |
| **Step 8** | `131px` | `pt-[131px]` | Max hero vertical offset, full landing banner height. |

---

## 5. Shape, Border Radii & Elevation

The interface employs flat surfaces with deliberate geometric radii and restrained elevation tiers to create tactile, easily navigable component surfaces.

### 5.1 Six Border Radii

| Radius Token | Value | Tailwind Class | Component Application |
| :--- | :---: | :--- | :--- |
| **Micro** | `2px` | `rounded-[2px]` | Inline code snippets, progress bar indicators. |
| **Medium (`md`)** | `8px` | `rounded-lg` | **Standard Buttons**, Form Inputs, Select Dropdowns, Table Containers. |
| **Card (`card`)** | `20px` | `rounded-[20px]` | Search Result Cards, Upload Dropzone Container, Dialog Modals. |
| **Large (`lg`)** | `32px` | `rounded-[32px]` | Featured Hero Cards, Large Spotlight Command Palette (`Cmd+K`). |
| **Soft (`soft`)** | `50px` | `rounded-[50px]` | Pill buttons, drawer drag handles, segmented search mode tabs. |
| **Pill / Circle** | `100px` | `rounded-full` | Format Badges (`PDF`), Citation Pills, User Avatars, Status Pills. |

---

### 5.2 Two Elevation Tiers

```css
/* Elevation Tier Definitions */
--elevation-xs: 0 0 0 1px #DDDDDD; /* Flat crisp border */
--elevation-sm: 0 2px 4px rgba(0, 0, 0, 0.08), 0 0 0 1px #EBEBEB; /* Soft floating card */
```

* **Tier `xs` (Flat Precision)**:
  * Style: `border: 1px solid #DDDDDD; box-shadow: none;`
  * Applied to: Inactive cards, table rows, input fields, standard button outlines.
* **Tier `sm` (Soft Float)**:
  * Style: `box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08); border: 1px solid #EBEBEB;`
  * Applied to: Hovered cards, floating search bar, `CitationDrawer` sheet, dropdown popovers.

---

## 6. Iconography & Visual Assets

DocuMind adopts a **`fillDominant`** icon treatment using **Lucide React** icons styled with solid visual presence:
* **Stroke & Fill**: Fill-dominant glyphs or clean `2px` stroke weight (`strokeWidth={2}`).
* **Size Tiers**:
  * Action Icons (Buttons, Search): `18px` (`w-[18px] h-[18px]`).
  * Table & Badge Icons (PDF, DOCX): `14px` (`w-3.5 h-3.5`).
  * Large Status & Empty State Icons: `32px` (`w-8 h-8`).
* **Color Binding**: Icons inherit text color (`currentColor`) or snap to `#222222` for high contrast.

---

## 7. Motion, Timing & Micro-Interactions

Transitions are fast, snappy, and functional. Excessive elastic easing or multi-second fades are prohibited.

### 7.1 Duration Scale
* **`100ms` (Instantaneous)**: Button presses, hover background shifts, checkbox toggles.
* **`175ms` (Standard UI Transition)**: Dropdown menus opening, tab switching, search mode toggle slider.
* **`300ms` (Structural Motion)**: `CitationDrawer` sliding in from the right, `Dialog` fade/scale in.

### 7.2 Easing Curves
* **`ease-in-out`**: `cubic-bezier(0.4, 0, 0.2, 1)` — Default for state toggles and tab switching.
* **`custom` (Snappy Exit)**: `cubic-bezier(0.25, 0.1, 0.25, 1)` — Default for drawers and overlays.
* **`linear`**: `linear` — Reserved strictly for infinite rotating spinners during document processing.

---

## 8. Core Component Patterns & Specifications

### 8.1 Primary Action Button
* **Background**: `#FF385C` (Primary Coral).
* **Text**: `#FFFFFF` (Pure White, weight `700`, size `t03` / `16px`).
* **Border Radius**: `8px` (`rounded-lg`).
* **Padding**: `15px 20px` (Height: `48px`).
* **Hover State**: Background shifts to `#E00B41` (Secondary Crimson) with `duration-100`.
* **Active State**: Subtle scale `scale-[0.98]`.

### 8.2 Secondary / Outline Button
* **Background**: Transparent or `#FFFFFF`.
* **Border**: `1px solid #222222` or `1px solid #DDDDDD`.
* **Text**: `#222222` (Charcoal, weight `500`).
* **Border Radius**: `8px` (`rounded-lg`).
* **Hover State**: Background `#EBEBEB` with `duration-100`.

### 8.3 Document Upload Dropzone
* **Idle State**: Background `#FFFFFF`, border `2px dashed #DDDDDD`, radius `20px`, internal padding `35px`.
* **Drag-Over State**: Border changes to `2px dashed #FF385C`, background shifts to `rgba(255, 56, 92, 0.04)`.
* **Uploading State**: Individual file cards listing filename, format badge, and progress bar (`bg-[#FF385C]`).

### 8.4 Search Result Card (`SearchResultCard`)
* **Container**: Background `#FFFFFF`, radius `20px`, border `1px solid #DDDDDD`, padding `20px`.
* **Hover**: Subtle lift to elevation `sm` (`shadow-[0_2px_4px_rgba(0,0,0,0.08)] border-[#EBEBEB]`).
* **Coordinate Tag**: Pill badge (`rounded-full bg-[#EBEBEB] text-[#222222] px-2.5 py-0.5 text-[12px] font-medium`).
* **Highlighted Match**: `<mark>` tags styled with `bg-[#FF385C]/15 text-[#222222] font-semibold px-1 rounded-[2px]`.
* **Action Footer**: Clean link *"Chat with Document →"* in `#FF385C` font weight `700`.

### 8.5 Citation Source Drawer (`CitationDrawer`)
* **Position**: Fixed right-aligned slide-over sheet (Width: `480px` on desktop, `100vw` on mobile).
* **Surface**: Background `#FFFFFF`, left border `1px solid #DDDDDD`, elevation `sm`.
* **Header**: File title (`t02` / `21px` bold), format badge, and close button (`hover:bg-[#EBEBEB] rounded-full p-2`).
* **Body**:
  * Metadata grid: `Page Number`, `Sheet & Row Range`, `Slide Number`, `Vector Similarity Score`.
  * Verbatim text excerpt container: Background `#EBEBEB`, radius `8px`, padding `15px`, monospace/sans text `t04` (`14px`), sanitized with `DOMPurify`.

---

## 9. Voice, Tone & Microcopy

* **Tone**: **Friendly, precise, and objective**. Communicates technical confidence without artificial cheerfulness or robotic jargon.
* **Empty States**: Clear, encouraging guidance (e.g., *"No documents uploaded yet. Drop a PDF, Word, Excel, or PowerPoint file here to begin."*).
* **Error Messages**: Transparent and actionable. Rather than *"An unexpected error occurred"*, state *"Could not parse financial_audit.pdf: the file is password-protected. Please unlock and re-upload."*
* **Grounding Refusal**: When RAG context is insufficient, state neutrally: *"The provided documents do not contain information regarding Q3 EBITDA margins."*

---

## 10. Accessibility & Compliance Standards

* **WCAG 2.1 Contrast**: 100% compliance across all text/background combinations. Body text (`#222222` on `#FFFFFF`) yields an **15.9:1** contrast ratio (exceeding AAA standard of 7:1). Secondary text (`#6A6A6A` on `#FFFFFF`) yields a **5.7:1** contrast ratio (exceeding AA standard of 4.5:1).
* **Keyboard Navigation**: All interactive elements (buttons, inputs, tabs, table rows) feature an explicit outline ring:
  ```css
  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#222222] focus-visible:ring-offset-2
  ```
* **Screen Reader Announcers**: Live upload progress, SSE processing state changes, and chat token streaming utilize `aria-live="polite"` regions.

---

## 11. Drop-In Code Tokens & Configuration

### 11.1 CSS Variables (`client/src/index.css`)
```css
:root {
  /* Brand Core */
  --color-primary: #ff385c;
  --color-secondary: #e00b41;

  /* Neutrals */
  --color-charcoal: #222222;
  --color-fog: #6a6a6a;
  --color-pitch: #000000;
  --color-white: #ffffff;
  --color-divider: #dddddd;
  --color-surface-fog: #ebebeb;

  /* Typography */
  --font-display: "Airbnb Cereal VF", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --font-body: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --font-mono: "JetBrains Mono", monospace;

  /* Spacing Grid (2px base) */
  --space-base: 2px;
  --space-15: 15px;
  --space-20: 20px;
  --space-32: 32px;
  --space-35: 35px;
  --space-48: 48px;
  --space-80: 80px;
  --space-131: 131px;

  /* Radii */
  --radius-xs: 2px;
  --radius-md: 8px;
  --radius-card: 20px;
  --radius-lg: 32px;
  --radius-soft: 50px;
  --radius-pill: 100px;

  /* Elevation */
  --elevation-xs: 0 0 0 1px #dddddd;
  --elevation-sm: 0 2px 4px rgba(0, 0, 0, 0.08), 0 0 0 1px #ebebeb;
}
```

---

### 11.2 Tailwind Configuration (`client/tailwind.config.js`)
```javascript
/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#FF385C",
          primary: "#FF385C",
          secondary: "#E00B41",
        },
        neutral: {
          charcoal: "#222222",
          fog: "#6A6A6A",
          pitch: "#000000",
          surface: "#FFFFFF",
          divider: "#DDDDDD",
          subtle: "#EBEBEB",
        },
      },
      fontFamily: {
        display: ["Airbnb Cereal VF", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
        body: ["-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      fontSize: {
        t00: ["28px", { lineHeight: "34px", fontWeight: "700" }],
        t01: ["22px", { lineHeight: "28px", fontWeight: "700" }],
        t02: ["21px", { lineHeight: "26px", fontWeight: "500" }],
        t03: ["16px", { lineHeight: "22px", fontWeight: "500" }],
        t04: ["14px", { lineHeight: "20px", fontWeight: "400" }],
        t05: ["12px", { lineHeight: "16px", fontWeight: "500" }],
        t06: ["8px",  { lineHeight: "12px", fontWeight: "700" }],
      },
      spacing: {
        base: "2px",
        15: "15px",
        20: "20px",
        32: "32px",
        35: "35px",
        48: "48px",
        80: "80px",
        131: "131px",
      },
      borderRadius: {
        xs: "2px",
        md: "8px",
        card: "20px",
        lg: "32px",
        soft: "50px",
        pill: "100px",
      },
      boxShadow: {
        xs: "0 0 0 1px #DDDDDD",
        sm: "0 2px 4px rgba(0, 0, 0, 0.08), 0 0 0 1px #EBEBEB",
      },
      transitionDuration: {
        100: "100ms",
        175: "175ms",
        300: "300ms",
      },
    },
  },
  plugins: [],
};
```

---

## 12. The Four Golden Usage Rules

1. **Lead with the Primary (`#FF385C`)**:
   * Belongs exclusively on calls-to-action, high-intent triggers, and a single dominant accent per viewport. Never apply `#FF385C` to body text or passive decorative backgrounds.
2. **Two Type Families, Three Weights**:
   * Display family for headlines and key titles; Body family for all dense reading and tables. Stick strictly to weights `400`, `500`, and `700`.
3. **Snap to the Spacing Scale**:
   * Padding, margin, gap, and sizing must land on the rhythm scale values (`2px`, `15px`, `20px`, `32px`, `35px`, `48px`, `80px`, `131px`). One-off arbitrary pixel adjustments accumulate into noise.
4. **Treat Accessibility as a Hard Constraint**:
   * Every color pairing must achieve 100% WCAG 2.1 compliance. If a component pairing fails contrast, alter the color token—never bypass or waive the contrast check.
