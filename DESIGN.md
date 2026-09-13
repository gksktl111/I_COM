---
version: alpha
name: ICOM-design-analysis
description: "A refined family-support interface combining Maven-inspired everyday photography and calm teal with Oscar-inspired benefit messaging and direct action. Warm parchment and white surfaces frame readable Korean typography, one prominent policy-matching CTA, and clear application information. Photography adds warmth while the interface helps families find relevant public support without implying confirmed eligibility."

colors:
  primary: "#0D7A73"
  primary-active: "#005F5A"
  primary-focus: "#0D7A73"
  brand-ink: "#164B46"
  ink: "#182C29"
  body: "#182C29"
  ink-muted: "#52635F"
  canvas: "#FFFFFF"
  canvas-parchment: "#FAF8F5"
  surface-soft: "#F1F3F0"
  surface-selected: "#E8F3EF"
  hairline: "#DCE3DE"
  input-border: "#7B8D87"
  error: "#B42318"
  warning: "#8A5700"
  success: "#246342"
  on-primary: "#FFFFFF"
  scrim: "#182C29"

typography:
  hero-display:
    fontFamily: "Pretendard, 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif"
    fontSize: "52px"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.02em"
  hero-mobile:
    fontFamily: "Pretendard, 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif"
    fontSize: "34px"
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: "-0.02em"
  display-lg:
    fontFamily: "Pretendard, 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif"
    fontSize: "32px"
    fontWeight: 700
    lineHeight: 1.35
    letterSpacing: "-0.02em"
  display-md:
    fontFamily: "Pretendard, 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif"
    fontSize: "28px"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "-0.01em"
  section-mobile:
    fontFamily: "Pretendard, 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif"
    fontSize: "24px"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Pretendard, 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif"
    fontSize: "20px"
    fontWeight: 600
    lineHeight: 1.45
    letterSpacing: "0"
  title-mobile:
    fontFamily: "Pretendard, 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif"
    fontSize: "18px"
    fontWeight: 600
    lineHeight: 1.45
    letterSpacing: "0"
  lead:
    fontFamily: "Pretendard, 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif"
    fontSize: "18px"
    fontWeight: 400
    lineHeight: 1.65
    letterSpacing: "0"
  body:
    fontFamily: "Pretendard, 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.65
    letterSpacing: "0"
  body-strong:
    fontFamily: "Pretendard, 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: 1.65
    letterSpacing: "0"
  caption:
    fontFamily: "Pretendard, 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "0"
  caption-strong:
    fontFamily: "Pretendard, 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif"
    fontSize: "14px"
    fontWeight: 600
    lineHeight: 1.5
    letterSpacing: "0"
  button-large:
    fontFamily: "Pretendard, 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "0"
  button-utility:
    fontFamily: "Pretendard, 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif"
    fontSize: "14px"
    fontWeight: 600
    lineHeight: 1.5
    letterSpacing: "0"
  fine-print:
    fontFamily: "Pretendard, 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "0"
  nav-link:
    fontFamily: "Pretendard, 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif"
    fontSize: "14px"
    fontWeight: 500
    lineHeight: 1.5
    letterSpacing: "0"

rounded:
  none: "0px"
  xs: "6px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  pill: "9999px"
  full: "9999px"

spacing:
  xxs: "4px"
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  xxl: "48px"
  section-compact: "64px"
  section: "80px"

components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.button-large}"
    rounded: "{rounded.sm}"
    padding: "12px 24px"
    height: "44px"
  button-primary-focus:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.button-large}"
    rounded: "{rounded.sm}"
    outline: "2px solid {colors.primary-focus}"
    outlineOffset: "2px"
  button-primary-active:
    backgroundColor: "{colors.primary-active}"
    textColor: "{colors.on-primary}"
    typography: "{typography.button-large}"
    rounded: "{rounded.sm}"
  button-primary-disabled:
    backgroundColor: "{colors.surface-soft}"
    textColor: "{colors.ink-muted}"
    typography: "{typography.button-large}"
    rounded: "{rounded.sm}"
  button-primary-loading:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.button-large}"
    rounded: "{rounded.sm}"
  button-secondary:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.primary}"
    typography: "{typography.button-large}"
    rounded: "{rounded.sm}"
    padding: "12px 24px"
    height: "44px"
    border: "1px solid {colors.primary}"
  button-match-hero:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.button-large}"
    rounded: "{rounded.sm}"
    padding: "16px 24px"
    height: "52px"
  button-icon-circular:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    rounded: "{rounded.full}"
    size: "44px"
  text-link:
    backgroundColor: "transparent"
    textColor: "{colors.primary}"
    typography: "{typography.body}"
  global-nav:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.nav-link}"
    minHeight: "64px"
  question-progress:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink-muted}"
    typography: "{typography.caption}"
    padding: "12px 20px"
  hero-family:
    backgroundColor: "{colors.canvas-parchment}"
    textColor: "{colors.brand-ink}"
    typography: "{typography.hero-display}"
    rounded: "{rounded.none}"
    padding: "64px 0"
  benefit-section:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.display-md}"
    rounded: "{rounded.none}"
    padding: "64px 0"
  policy-card:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "24px"
    border: "1px solid {colors.hairline}"
  policy-card-selected:
    backgroundColor: "{colors.surface-selected}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "24px"
    border: "2px solid {colors.primary}"
  question-panel:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "24px"
  option-chip:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.pill}"
    padding: "12px 16px"
    minHeight: "44px"
    border: "1px solid {colors.input-border}"
  option-chip-selected:
    backgroundColor: "{colors.surface-selected}"
    textColor: "{colors.brand-ink}"
    typography: "{typography.body-strong}"
    rounded: "{rounded.pill}"
    padding: "12px 16px"
    minHeight: "44px"
    border: "2px solid {colors.primary}"
  search-input:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: "10px 12px"
    height: "44px"
    border: "1px solid {colors.input-border}"
  text-input:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: "10px 12px"
    height: "44px"
    border: "1px solid {colors.input-border}"
  text-input-focus:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    border: "1px solid {colors.primary-focus}"
    outline: "2px solid {colors.primary-focus}"
    outlineOffset: "2px"
  text-input-error:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    border: "1px solid {colors.error}"
  text-input-disabled:
    backgroundColor: "{colors.surface-soft}"
    textColor: "{colors.ink-muted}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    border: "1px solid {colors.input-border}"
  select-trigger:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: "10px 12px"
    minHeight: "44px"
    border: "1px solid {colors.input-border}"
  status-badge:
    backgroundColor: "{colors.surface-soft}"
    textColor: "{colors.ink-muted}"
    typography: "{typography.caption-strong}"
    rounded: "{rounded.xs}"
    padding: "4px 8px"
  notice-info:
    backgroundColor: "{colors.surface-soft}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: "16px"
  notice-warning:
    backgroundColor: "{colors.canvas-parchment}"
    textColor: "{colors.warning}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: "16px"
  notice-error:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.error}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: "16px"
  notice-success:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.success}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: "16px"
  empty-state:
    backgroundColor: "transparent"
    textColor: "{colors.ink-muted}"
    typography: "{typography.body}"
    padding: "32px 20px"
  dialog:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.lg}"
    padding: "24px"
  admin-table-row:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.caption}"
    minHeight: "44px"
    padding: "12px 16px"
  admin-table-row-selected:
    backgroundColor: "{colors.surface-selected}"
    textColor: "{colors.ink}"
    typography: "{typography.caption}"
    minHeight: "44px"
    padding: "12px 16px"
  footer:
    backgroundColor: "{colors.canvas-parchment}"
    textColor: "{colors.ink-muted}"
    typography: "{typography.fine-print}"
    padding: "48px 20px"
---

## Overview

ICOM helps families with children discover relevant public support, understand benefits and application steps, and find nearby facilities. Its visual direction combines the everyday family photography and calm teal of [Maven Clinic](https://www.mavenclinic.com/) with the concise benefit explanation and direct entry action of [Oscar](https://www.hioscar.com/). Both homepages were visually reviewed on September 13, 2026. This is an original target design specification, not a claim that ICOM already implements these styles or that the references share these exact tokens.

The landing page answers three questions immediately: who the service helps, what the visitor gains, and where to begin. The primary action opens `/policy/match`; a quieter link opens `/policy`. Warm photography supports that decision. It never delays the action or substitutes for a useful explanation.

Public screens and administration share typography, colors, shapes, and components. Public screens allow space for reading and answering questions; administrative screens use denser tables for comparison and review. Existing behavior remains governed by the [public UI record](docs/ui/stitch-implementation.md), [administration contract](docs/admin-console.md), and [recommendation plan](docs/policy/work/recommendation-plan.md).

**Key Characteristics:**
- One prominent policy-matching CTA, visible before scrolling on a standard mobile viewport.
- Everyday family photography beside a concise headline and benefit explanation.
- Warm parchment page canvas, white content surfaces, and a single teal brand accent.
- Pretendard throughout, with Korean-friendly line heights and moderate display tracking.
- Flat cards and sections; shadows reserved for temporary overlays.
- Clear distinctions between recommendations, unconfirmed conditions, application status, and actual eligibility.
- Shared component grammar across landing, questions, results, policy details, maps, and administration.
- Product copy remains Korean. English copy in this document describes message intent and must be localized naturally.

## Colors

> **Reference and implementation scope:** Maven and Oscar inform the visual direction. Tokens below are ICOM-specific target values, informed by its existing teal and shared components. They are not extracted measurements from those brands or a completed application-wide migration.

### Brand & Accent

- **Primary Teal** (`{colors.primary}`): The main action, selected controls, and meaningful links. Map to the existing CSS `--primary` token.
- **Pressed Teal** (`{colors.primary-active}`): Pressed action state; changes color without scaling the control.
- **Focus Teal** (`{colors.primary-focus}`): A visible 2px keyboard outline with 2px offset; map to `--ring`.
- **Brand Ink** (`{colors.brand-ink}`): Landing headlines and text on selected surfaces. Not an additional action color.

### Surface

- **White** (`{colors.canvas}`): Cards, inputs, menus, dialogs, and navigation. Map to `--card` and `--popover`.
- **Warm Parchment** (`{colors.canvas-parchment}`): Default page canvas and hero background. Map to `--background` during the requested migration.
- **Soft Surface** (`{colors.surface-soft}`): Filter groups, muted areas, and disabled controls; map to `--muted` and `--secondary`.
- **Selected Surface** (`{colors.surface-selected}`): Selected answers and rows; map to `--accent`.
- **Scrim** (`{colors.scrim}`): Dialog backdrop base color, rendered at 40% opacity.

### Text

- **Ink / Body** (`{colors.ink}`, `{colors.body}`): Primary text; map to `--foreground` and surface foregrounds.
- **Muted Ink** (`{colors.ink-muted}`): Supporting descriptions, dates, and secondary metadata; map to `--muted-foreground`.
- **On Primary** (`{colors.on-primary}`): Text on primary and pressed teal buttons.
- **Error, Warning, Success** (`{colors.error}`, `{colors.warning}`, `{colors.success}`): Semantic messages with explicit labels or icons. Success describes actual completed actions, not a recommendation or assumed benefit entitlement.

### Hairlines & Borders

- **Hairline** (`{colors.hairline}`): Decorative card and section separation; map to `--border`.
- **Input Border** (`{colors.input-border}`): Visible boundaries of actionable controls; map to `--input`. Do not substitute the softer decorative hairline for a required control boundary.

### Brand Gradient

No decorative gradients. Warmth comes from photography, parchment, and typography. Use one coherent surface palette rather than mixing the existing cool canvas with new hardcoded warm sections. This document specifies a light theme; dark-mode migration requires separate design and verification.

## Typography

### Font Family

- **Display and Body / UI:** `Pretendard, 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif`.
- **Korean first:** Use the existing font setup. Do not import a reference brand's proprietary serif or imitate italic English emphasis in Korean.
- **Numeric information:** Use tabular numerals where aligned administrative values benefit from them; preserve the original meaning and precision of policy data.

### Hierarchy

| Token | Size | Weight | Line Height | Letter Spacing | Use |
|---|---|---|---|---|---|
| `{typography.hero-display}` | 52px | 600 | 1.25 | -0.02em | Landing headline |
| `{typography.hero-mobile}` | 34px | 600 | 1.35 | -0.02em | Mobile landing headline |
| `{typography.display-lg}` | 32px | 700 | 1.35 | -0.02em | Page title |
| `{typography.display-md}` | 28px | 600 | 1.4 | -0.01em | Section heading; mobile page title |
| `{typography.section-mobile}` | 24px | 600 | 1.4 | -0.01em | Mobile section heading |
| `{typography.title}` | 20px | 600 | 1.45 | 0 | Card and subsection title |
| `{typography.title-mobile}` | 18px | 600 | 1.45 | 0 | Mobile card title |
| `{typography.lead}` | 18px | 400 | 1.65 | 0 | Desktop hero explanation |
| `{typography.body}` | 16px | 400 | 1.65 | 0 | Public body and inputs |
| `{typography.body-strong}` | 16px | 600 | 1.65 | 0 | Important inline text and selections |
| `{typography.caption}` | 14px | 400 | 1.5 | 0 | Supporting text and administrative rows |
| `{typography.caption-strong}` | 14px | 600 | 1.5 | 0 | Field and status labels |
| `{typography.button-large}` | 16px | 600 | 1.25 | 0 | Primary and hero action labels |
| `{typography.button-utility}` | 14px | 600 | 1.5 | 0 | Compact utility actions |
| `{typography.fine-print}` | 13px | 400 | 1.5 | 0 | Dates and footer metadata |
| `{typography.nav-link}` | 14px | 500 | 1.5 | 0 | Navigation links |

### Principles

- One h1 per page; heading levels follow information structure.
- Public body text and inputs use `{typography.body}`. Do not reduce mobile input text to fit a layout.
- Display tracking never tightens beyond -0.02em. Body tracking stays neutral.
- Prefer Korean word-boundary wrapping; allow long URLs and identifiers to break safely.
- Policy titles, eligibility conditions, and error messages must remain available in full. Avoid fixed heights that clip meaningful content.
- Keep weight 400 for reading, 500 for navigation, 600 for most headings and actions, and 700 for page titles.

### Note on Font Substitutes

If Pretendard fails to load, the Korean system fallbacks must preserve readable line lengths and component sizing. Do not introduce Inter or a Latin display face as a replacement for Korean text. Verify the fallback at mobile widths and with enlarged text before considering the migration complete.

## Layout

### Spacing System

- **Base unit:** 4px.
- **Tokens:** `{spacing.xxs}` 4px, `{spacing.xs}` 8px, `{spacing.sm}` 12px, `{spacing.md}` 16px, `{spacing.lg}` 24px, `{spacing.xl}` 32px, `{spacing.xxl}` 48px, `{spacing.section-compact}` 64px, `{spacing.section}` 80px.
- **Section padding:** 64–80px on desktop, 40–48px on mobile.
- **Card padding:** 24px on desktop, 20px on mobile.
- **Control and item gaps:** 8–16px, chosen by grouping rather than individual page preference.

### Grid & Container

- **Public content:** Maximum 1200px, centered. Policy prose caps at 760px; question forms at 640px.
- **Hero:** Two columns at desktop, approximately 55:45 after accounting for a 48px gap. Text and actions on the left; a family photograph on the right.
- **Mobile gutters:** 20px, reducing to 16px below 360px.
- **Policy grids:** Three columns when readable, two at tablet widths, one on phones. Long titles determine minimum useful card width.
- **Administration:** Preserve the existing shared header and sidebar. Use 14px table text with 44–48px minimum row heights rather than landing-scale spacing.

### Whitespace Philosophy

Space should make the next action easier to find. The hero is content-sized, never forced to 100vh. At 390×844px and default text size, the headline, explanation, and matching CTA must appear before scrolling. On shorter screens or enlarged text, allow scrolling instead of shrinking type or clipping content.

After the hero, show practical benefits, the six support categories, a truthful result preview, sources and FAQs, then secondary facilities and community entry points. Explain reduced searching effort, relevant support discovery, and access to application instructions. Do not fill space with invented metrics, testimonials, or partner logos.

## Elevation & Depth

| Level | Treatment | Use |
|---|---|---|
| Flat | No shadow | Hero, sections, buttons, photographs, footer |
| Hairline | 1px `{colors.hairline}` | Policy cards and light structural separation |
| Overlay | `0 4px 16px rgb(24 44 41 / 8%)` | Open menus and dropdowns |
| Dialog | `0 16px 48px rgb(24 44 41 / 14%)` | Modal surface over a 40% `{colors.scrim}` backdrop |

**Shadow philosophy.** Depth communicates a temporary layer over the page. It does not decorate every card or make policy recommendations appear more authoritative.

### Decorative Depth

- Photography provides natural depth without extra shadows or gradient overlays.
- White and parchment bands separate sections without nested containers.
- Avoid frosted glass, glowing accents, floating decorative badges, and blurred background ornaments.

## Shapes

### Border Radius Scale

| Token | Value | Use |
|---|---|---|
| `{rounded.none}` | 0px | Full-width sections and structural bands |
| `{rounded.xs}` | 6px | Small status labels |
| `{rounded.sm}` | 8px | Buttons, inputs, and notices |
| `{rounded.md}` | 12px | Policy cards and question panels |
| `{rounded.lg}` | 16px | Dialogs |
| `{rounded.xl}` | 20px | Main family photograph |
| `{rounded.pill}` | 9999px | Selectable option chips |
| `{rounded.full}` | 9999px | Circular icon controls |

### Photography Geometry

- Use one natural family photograph, normally a 4:3 crop, beside the hero copy.
- Keep faces and relevant context visible at every crop; set the focal point deliberately.
- Put essential text on a solid surface rather than over variable photography.
- The photo follows the CTA on mobile. A missing image must not prevent understanding or starting the service.
- Use appropriately licensed assets; retain provenance. Do not copy reference-site photographs or portray stock subjects as actual beneficiaries.
- Choose everyday scenes without implying that only one family structure can use the service.
- Use responsive image sizes and explicit dimensions. Load the above-fold image eagerly; defer below-fold imagery.
- Use existing Lucide icons for general UI and the existing licensed Material Symbols assets for map categories.

## Components

### Top Navigation

**`global-nav`** — White, readable navigation using `{typography.nav-link}`. The default row has a 64px minimum height and grows when needed. Preserve the existing header behavior unless its redesign is explicitly in scope. Keep the brand, essential destinations, and accessible mobile menu clear. The header must not push the hero CTA out of the standard first viewport.

**`question-progress`** — A compact step indicator below the header. Explain the current step without adding competing promotional actions. Sticky layers must not overlap each other, field labels, or focused controls.

### Buttons

**`button-primary`** — Primary teal, white text, `{rounded.sm}`, 44px minimum height. One primary action per decision group; allow growth for wrapping or enlarged text.

- **`button-primary-focus`** — A visible focus outline with offset; never remove focus indication.
- **`button-primary-active`** — Pressed teal without scale or bounce.
- **`button-primary-disabled`** — Soft neutral surface and muted label, with native disabled semantics where appropriate. Explain unavailable actions when the reason is not obvious.
- **`button-primary-loading`** — Preserve width, prevent duplicate submission, and announce progress through a meaningful label and busy state.

**`button-match-hero`** — The 52px landing action linking to `/policy/match`. Its English intent is “Find matching support”; render the approved Korean label in the product. Show it immediately, before image loading or any animation. On phones it spans the available content width.

**`button-secondary`** — White surface, teal outline, same interaction sizing. Use for secondary form actions; the hero's browse alternative should be a quieter text link to `/policy`.

**`button-icon-circular`** — A 44×44px control with an accessible name. Visual icon size may be smaller than its hit area.

**`text-link`** — Teal, with an underline in prose or another clear non-color affordance. Use links for navigation and buttons for in-place actions.

### Cards & Containers

**`hero-family`** — Parchment surface, brand-ink headline, short explanation, one matching CTA, a secondary browse link, and one photograph. Suggested English message intent: “Support for your family, with less searching.” Explain that users can find relevant policies and review benefits and application steps. Localize into Korean; do not claim guaranteed payments or confirmed eligibility.

**`benefit-section`** — A flat white section describing three practical outcomes: search across collected policies, narrow relevant support, and understand application steps. Keep claims within implemented behavior.

**`policy-card`** — White surface, hairline border, 12px corners. Order: policy name, support offered, region and target audience, application period, detail action. It works without imagery. Preserve unknown values rather than generating amounts or conditions.

**`policy-card-selected`** — A selected comparison or navigation state with a visible border and explicit state label. This styling never signifies eligibility or approval.

**`question-panel`** — A readable group of questions. Preserve requiredness, branching, and answer retention from the [question contract](docs/policy/work/question-bank.md); design does not invent or infer answers.

**`option-chip`** and **`option-chip-selected`** — Neutral and selected variants with a check or equivalent non-color signal. Expose radio or toggle semantics as appropriate. Keep the same outer dimensions across border changes.

**`status-badge`** — A concise application or review label. Avoid repeating the same status in multiple badges. Relevance classification, eligibility review, and public release are separate meanings.

**`notice-info`**, **`notice-warning`**, **`notice-error`**, **`notice-success`** — Explicitly labeled information, unresolved conditions, failures, and completed actions. Use text and icons along with color. A recommendation must not receive success styling that implies qualification.

**`empty-state`** — Distinguish no matches, request failure, missing source information, and an unavailable feature. Offer condition editing or retry only when appropriate.

**`dialog`** — White surface, 16px corners, overlay shadow. Include title, close control, scrollable body when needed, and relevant actions. Maintain focus containment, Escape dismissal, and focus restoration.

**`admin-table-row`** and **`admin-table-row-selected`** — Compact, readable administrative rows. Preserve selection semantics and shared admin structure. Allow row height to grow for long titles and text enlargement.

Recommendation results show a summary, leading recommendations, additional results, and an edit-conditions action. Counts remain governed by the engine contract, including the current maximum of 20 and leading group of five. Policy details show support, target audience, period, application steps, and official sources. Maps keep marker and list selections synchronized.

### Inputs & Forms

**`search-input`** and **`text-input`** — White, 16px body text, 8px corners, 44px minimum height, visible input border. Persistent labels are required; placeholders are examples rather than substitutes for labels.

**`text-input-focus`** — Explicit teal focus treatment with offset.

**`text-input-error`** — Error border and a nearby message programmatically associated with the field. Preserve entered values and indicate how to correct them.

**`text-input-disabled`** — Neutral surface with native disabled semantics. Do not silently interpret an unselected or unavailable value as an answer.

**`select-trigger`** — The same visual grammar as text inputs. Reuse existing keyboard navigation and accessible menu behavior. Focus, error, and disabled treatment follow the corresponding input variants.

### Footer

**`footer`** — Parchment, muted text, readable links and metadata. Provide actual information sources and useful destinations. Do not fabricate institutional endorsement, partner logos, beneficiary counts, or testimonials. A repeated matching CTA can appear above the footer on a long page.

## Do's and Don'ts

### Do

- Lead with a concrete user benefit and `{component.button-match-hero}`.
- Use `{colors.primary}` consistently for the main action and selected controls.
- Keep Korean body text readable with `{typography.body}`.
- Use natural family imagery and a restrained two-column hero.
- Preserve all six support categories: pregnancy and childbirth, parenting and childcare, care services, health, child education, and housing and living support. Use the established Korean labels in the product.
- Separate relevant recommendations from conditions still requiring confirmation.
- Reuse shared UI components and semantic CSS variables.
- Include keyboard focus, busy, disabled, error, empty, and selected behavior.
- Check actual contrast combinations: at least 4.5:1 for normal text and 3:1 for large text and essential UI boundaries.

### Don't

- Don't make the hero full-screen or place its image before the CTA on phones.
- Don't create fake benefit amounts, completion times, success rates, testimonials, or guaranteed eligibility claims.
- Don't use six large pastel panels merely to distinguish categories.
- Don't add decorative gradients, glass effects, nested cards, automatic carousels, or background video.
- Don't shrink Korean text, hide eligibility conditions, or clip error messages to fit a fixed layout.
- Don't use color as the sole indicator of status or selection.
- Don't copy reference branding, photography, proprietary fonts, or insurance claims.
- Don't expand a scoped design change into unrelated functionality or a full application redesign.

## Responsive Behavior

### Breakpoints

| Name | Width | Key Changes |
|---|---|---|
| Small phone | Below 360px | Single column; 16px side gutters; allow natural headline wrapping |
| Phone | 360–639px | 20px side gutters; 34px hero; full-width matching CTA before the photograph |
| Tablet | 640–1023px | Single-column hero by default; two-column policy grids when readable; reduced section spacing |
| Desktop | 1024–1439px | Two-column hero; three-column policy grid when readable; content capped at 1200px |
| Wide desktop | 1440px and above | Keep the 1200px content cap; expand outer margins |

These are target layout bands, not a requirement to rewrite existing functional breakpoints. Verify at 320, 390, 768, and 1280px, including the actual header and longest relevant content.

### Touch Targets

- Minimum 44×44px for interactive hit areas, including icon-only controls.
- `{component.button-match-hero}` has a 52px minimum height.
- Compact visual labels may have larger hit areas; never shrink the mobile target to the icon bounds.

### Collapsing Strategy

- **Hero:** Headline → explanation → matching CTA → browse link → photo.
- **Navigation:** Collapse destinations into the existing accessible menu before they collide.
- **Policy grids:** Three → two → one column according to readable content width.
- **Policy details:** Convert an optional desktop contents rail into a collapsible contents list above the body.
- **Maps:** Provide an explicit mobile map/list switch while preserving selection.
- **Administration:** Use a labeled horizontal scrolling region for wide tables when necessary; keep public pages free of horizontal overflow.
- **Text enlargement:** At 200%, allow content and control heights to grow. Sticky headers and progress bars must not cover focused elements. First-viewport CTA visibility never overrides readable enlarged text.

### Image Behavior

- Use responsive sources and explicit dimensions to avoid layout shifts.
- Keep a stable 4:3 hero image where possible and adjust focal points for mobile.
- The primary action remains usable if imagery loads slowly or fails.
- Load the above-fold photo eagerly and below-fold images lazily.
- Use informative alt text only when the image conveys information; decorative images have empty alt text.

## Iteration Guide

1. Focus on one requested component or screen at a time. Reference its YAML entry with `{component.policy-card}` or `{component.text-input}`. Singular `component` references resolve to entries in the plural `components:` map, matching the supplied document convention.
2. Keep variants as separate `components:` entries, including `-active`, `-focus`, `-disabled`, and `-selected` states.
3. Use token references in component rules rather than repeating hex values. Map tokens into `src/app/globals.css` and reuse `src/components/ui`; do not assume this YAML is automatically applied as CSS.
4. Document default, pressed, focus, disabled, busy, and validation behavior. Do not add a separate hover specification in this document format.
5. Preserve Pretendard and Korean reading proportions. Keep the landing benefit explanation and matching action ahead of photography on mobile.
6. Reserve shadows for temporary overlays. Use surface and spacing changes before adding decoration.
7. Keep transitions limited to color and opacity, normally 150–200ms, and honor `prefers-reduced-motion`. Never delay CTA visibility with animation.
8. Verify the changed screen's relevant states, keyboard behavior, contrast, and mobile layout. Reuse valid checks; documentation-only edits require document review rather than a product build or new test suite.
9. Record applied changes and remaining gaps in the relevant UI document. This specification alone does not establish implementation completion, verified eligibility, or release approval.

## Known Gaps

- This is a target specification written on September 13, 2026. The existing application has not yet been migrated to its complete palette, typography, hero, or component styles.
- Final licensed family imagery, responsive crops, and production alt text have not been selected.
- English message examples describe intent. The interface remains Korean; final copy must match the implemented recommendation and eligibility-review coverage.
- Existing policy activation does not establish verified eligibility. Source conflicts and unpublished conditions remain governed by policy workflows.
- A complete dark theme is not specified. Preserve existing behavior until a separately scoped migration defines and verifies its counterparts.
- Current header collapse behavior, administrative density, 200% text resizing, and focus visibility need visual validation when the design is implemented.
- The document defines interaction treatments, but does not claim every current component already implements each state accessibly.
- Social authentication, community persistence, and external map connections retain their actual implementation status; visual examples cannot imply those integrations are complete.
