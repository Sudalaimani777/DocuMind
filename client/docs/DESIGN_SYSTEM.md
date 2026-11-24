# Enterprise Design System & Tokens — DocuMind Client

> **Theme**: Enterprise Deep Navy  
> **Framework**: Tailwind CSS v3.4+ + shadcn/ui (Radix Primitives)

---

## 1. Design Philosophy & Aesthetic Principles

DocuMind is an enterprise-grade document intelligence platform. Its visual presentation must project **authority, technical precision, and high readability**:
* **Enterprise Deep Navy**: Avoids generic white or black templates by establishing depth with rich navy and slate tones.
* **Functional Color Coding**: High-contrast, standardized status badges and file-format color signatures.
* **Information Density**: Tight, tabular layouts engineered for analysts inspecting dense documents, coordinate tags, and chunk snippets.
* **Accessible Contrast**: All text pairings meet or exceed **WCAG 2.1 AA** contrast ratios (minimum 4.5:1 for body text).

---

## 2. Color Palette & Semantic Tokens

### 2.1 Primary Canvas & Surface Tokens
| Token | Hex Value | Tailwind Class | Semantic Purpose |
| :--- | :---: | :--- | :--- |
| **Canvas Background** | `#0F172A` | `bg-slate-900` | Base application canvas background. |
| **Deep Navy Header** | `#0B192C` | `bg-[#0B192C]` | Top navigation header, primary branding banners. |
| **Card / Surface** | `#1E293B` | `bg-slate-800` | Content cards, data table rows, dropzones. |
| **Elevated Surface** | `#334155` | `bg-slate-700` | Modal dialogs, drawer panels, popover menus. |
| **Subtle Border** | `#1E3E62` | `border-[#1E3E62]` | Clean structural table dividers and card borders. |
| **Default Border** | `#334155` | `border-slate-700` | Input borders, dropdown boundaries. |

### 2.2 Accent & Interactive Tokens
| Token | Hex Value | Tailwind Class | Semantic Purpose |
| :--- | :---: | :--- | :--- |
| **Primary Accent** | `#007BFF` | `bg-blue-600` | Primary action buttons, active tab indicators. |
| **Accent Hover** | `#2563EB` | `hover:bg-blue-700` | Interactive button hover state. |
| **Electric Highlight** | `#38BDF8` | `text-sky-400` | Search match highlights, citation badge text. |
| **Highlight Background**| `rgba(56, 189, 248, 0.15)` | `bg-sky-500/15` | Highlight background for `<mark>` search text. |

### 2.3 Typography Color Tokens
| Token | Hex Value | Tailwind Class | Usage |
| :--- | :---: | :--- | :--- |
| **Primary Text** | `#F8FAFC` | `text-slate-50` | Primary headers, table titles, user chat queries. |
| **Secondary Text** | `#94A3B8` | `text-slate-400` | Subtitles, timestamps, coordinate metadata. |
| **Muted Text** | `#64748B` | `text-slate-500` | Placeholder text, disabled labels. |

### 2.4 Document Format Color Signatures
| Format | Signature Color | Tailwind Badge Classes |
| :--- | :---: | :--- |
| **PDF** | Red (`#EF4444`) | `bg-red-500/10 text-red-400 border-red-500/30` |
| **Word (`.docx`)** | Blue (`#3B82F6`) | `bg-blue-500/10 text-blue-400 border-blue-500/30` |
| **Excel (`.xlsx`)** | Green (`#10B981`) | `bg-emerald-500/10 text-emerald-400 border-emerald-500/30` |
| **PowerPoint (`.pptx`)**| Orange (`#F97316`) | `bg-orange-500/10 text-orange-400 border-orange-500/30` |

---

## 3. Typography Scale & Hierarchy

DocuMind uses the **Inter** system font stack:
```css
font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
```

| Level | Size | Weight | Line Height | Usage |
| :--- | :---: | :---: | :---: | :--- |
| **H1 (Display)** | `28px (1.75rem)` | `700 (Bold)` | `36px` | Page views (Document Library, Search Engine). |
| **H2 (Section)** | `20px (1.25rem)` | `600 (Semibold)` | `28px` | Section titles, drawer headers. |
| **H3 (Card Title)**| `16px (1.0rem)` | `600 (Semibold)` | `24px` | Document card titles, dialog titles. |
| **Body (Base)** | `14px (0.875rem)` | `400 (Regular)` | `20px` | Table cells, body text, chat responses. |
| **Caption (Small)**| `12px (0.75rem)` | `500 (Medium)` | `16px` | Coordinate tags (`Page 14`), status pills. |
| **Code / Coords** | `12px (0.75rem)` | `500 (Mono)` | `16px` | SHA-256 hashes, raw JSON chunks. |

---

## 4. Spacing, Elevation & Component Tokens

* **Spacing Grid**: Based on multiples of `4px` (`p-1` = 4px, `p-2` = 8px, `p-4` = 16px, `p-6` = 24px).
* **Border Radii**:
  * Buttons & Inputs: `rounded-md` (6px).
  * Cards & Containers: `rounded-lg` (8px).
  * Dialogs & Drawers: `rounded-xl` (12px).
  * Citation Pills & Status Badges: `rounded-full` (9999px).
* **Focus States**: High-visibility accessible focus ring:
  ```css
  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900
  ```
* **Transitions**: Smooth, subtle micro-interactions:
  ```css
  transition-all duration-150 ease-out
  ```
