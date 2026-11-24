# Client Engineering Rules & Frontend Directives — DocuMind

> **Target Scope**: `client/`  
> **Audience**: Frontend Engineers & Autonomous Coding Agents  
> **Status**: Mandatory Enforcement

---

## 1. Prime Client Directives

1. **ZERO MOCKUP CODE IN APPLICATION**:
   * Do not commit static HTML mockup files or fake mock datasets into `client/src/`. All features must connect to live endpoints or use standard mock handlers in test suites.
2. **NO PLACEHOLDERS OR CODE TRUNCATION**:
   * Production files must never contain `// TODO: add styles later` or placeholder stubs. Deliver fully realized, accessible React components.
3. **FEATURE SCOPE BOUNDARIES**:
   * Features 5 (One-click batch operations) and 6 (Document-to-document visual diff/comparison) were **explicitly removed from scope**. Do not build components or routes for them.

---

## 2. Security & DOM Sanitization Rules

* **Mandatory DOMPurify Sanitization**:
  * Any HTML rendered via `dangerouslySetInnerHTML` (such as `<mark>` search highlight tags from PostgreSQL `ts_headline`) **must be explicitly sanitized using `DOMPurify`**:
  ```tsx
  // APPROVED PATTERN:
  <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(highlightedText) }} />

  // STRICTLY FORBIDDEN:
  <div dangerouslySetInnerHTML={{ __html: rawServerText }} />
  ```
* **No Inline Executable Scripts**: Never permit raw unescaped user document strings to render as script elements or untrusted `href` URLs.

---

## 3. State Management Boundaries

* **TanStack Query Exclusivity**:
  * All API data fetching, document catalogs, search queries, and job lists must pass through TanStack Query (`useQuery`, `useMutation`).
  * **Strictly Prohibited**: Never duplicate document lists or search results into Zustand stores.
* **Zustand Scope**:
  * Zustand is strictly reserved for client-only UI state: upload drawer toggles, active citation preview payloads, and modal dialog open/close states.
* **Component Form State**:
  * Transient input values must use React `useState` or uncontrolled refs.

---

## 4. Styling & Accessibility Standards

* **Design System Adherence**:
  * All styling must strictly utilize Tailwind CSS utility classes adhering to the **Enterprise Deep Navy** theme defined in `DESIGN_SYSTEM.md`.
  * Inline `style={{ ... }}` objects are prohibited except for dynamic CSS percentage calculations (e.g., upload progress bar width: `style={{ width: `${progress}%` }}`).
* **Accessibility (WCAG 2.1 AA)**:
  * All icon-only buttons must carry an `aria-label` or `sr-only` text span.
  * Interactive elements must support full keyboard navigation (`Tab`, `Enter`, `Escape` to close drawers).
  * Focus rings must be preserved: `focus-visible:ring-2 focus-visible:ring-blue-500`.

---

## 5. Verification Checklist

Before reporting any frontend milestone or component complete:
1. Run typecheck: `npm run typecheck --workspace=client` (or `npx -w client tsc --noEmit`)
2. Run test suites: `npm test --workspace=client`
3. Verify zero console warnings for missing React `key` props.
4. Verify all routes are registered in `client/docs/ROUTING.md`.
