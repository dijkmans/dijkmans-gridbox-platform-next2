/**
 * Gridbox Design Tokens
 *
 * Tailwind class strings voor consistente stijlen door de hele admin portal.
 * Importeer wat je nodig hebt en gebruik in className-props.
 *
 * Gebaseerd op DESIGN_SYSTEM.md en de bestaande broncode.
 */

// ─── Kleuren (Tailwind class namen) ────────────────────────────────────────

export const colors = {
  // Achtergronden
  pageBg:       "bg-slate-50",
  cardBg:       "bg-white",
  sectionBg:    "bg-slate-50",
  sidebar:      "bg-slate-900",

  // Tekst
  textPrimary:  "text-slate-900",
  textBody:     "text-slate-600",
  textMeta:     "text-slate-500",
  textMuted:    "text-slate-400",

  // Borders
  border:       "border-slate-200",
  borderFocus:  "border-slate-900",
  borderSidebar:"border-slate-800",

  // Accent blauw
  accentText:   "text-blue-700",
  accentBg:     "bg-blue-50",
  accentBorder: "border-blue-200",

  // Amber
  amberBg:      "bg-amber-50",
  amberBorder:  "border-amber-200",
  amberText:    "text-amber-900",

  // Groen
  greenBg:      "bg-emerald-50",
  greenBorder:  "border-emerald-300",
  greenText:    "text-emerald-800",
} as const;

// ─── Typography ────────────────────────────────────────────────────────────

export const typography = {
  // Body tekst in beschrijvingen
  body:         "text-sm leading-7 text-slate-600",
  bodySmall:    "text-sm leading-6 text-slate-600",

  // Labels / metadata
  label:        "text-sm font-semibold text-slate-700",
  labelSmall:   "text-xs font-semibold text-slate-500",
  labelMeta:    "text-xs text-slate-500",

  // Uppercase sectielabels ("Stap 1", sidebar labels)
  sectionLabel: "text-xs font-semibold uppercase tracking-[0.18em]",

  // Titels
  cardTitle:    "text-2xl font-bold text-slate-900",
  stepTitle:    "text-xl font-bold text-slate-900",
  subTitle:     "text-sm font-semibold text-slate-900",

  // Sidebar
  sidebarLabel: "text-sm uppercase tracking-[0.18em] text-slate-400",
  sidebarTitle: "text-2xl font-bold",
  sidebarBody:  "text-sm leading-6 text-slate-400",
} as const;

// ─── Radius ────────────────────────────────────────────────────────────────

export const radius = {
  card:    "rounded-3xl",   // Hoofdcards
  subCard: "rounded-2xl",   // Sub-cards binnen een card
  button:  "rounded-xl",    // Knoppen en inputs
  pill:    "rounded-full",  // Badges en pills
} as const;

// ─── Cards ─────────────────────────────────────────────────────────────────

export const card = {
  // Top-level card
  base:    "bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden",

  // Card header sectie
  header:  "px-6 py-6 border-b border-slate-200",

  // Sub-card binnen een card
  sub:     "bg-white border border-slate-200 rounded-2xl p-5",

  // Content panel (stap achtergrond)
  panel:   "rounded-3xl border border-slate-200 bg-slate-50 p-6",
} as const;

// ─── Knoppen ───────────────────────────────────────────────────────────────

export const button = {
  primary:
    "rounded-xl bg-slate-900 text-white px-4 py-3 text-sm font-semibold transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60",

  secondary:
    "rounded-xl border border-slate-200 bg-white text-slate-900 px-4 py-3 text-sm font-semibold transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60",

  success:
    "rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-800 px-4 py-3 text-sm font-semibold transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60",

  disabled:
    "rounded-xl bg-slate-100 text-slate-400 px-4 py-3 text-sm font-semibold cursor-not-allowed opacity-60",
} as const;

// ─── Inputs ────────────────────────────────────────────────────────────────

export const input = {
  base:
    "w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900",

  disabled:
    "w-full rounded-xl border border-slate-300 bg-slate-100 px-4 py-3 text-sm text-slate-400 cursor-not-allowed",

  warning:
    "w-full rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-500",
} as const;

// ─── Alerts ────────────────────────────────────────────────────────────────

export const alert = {
  blue:
    "rounded-2xl border border-blue-200 bg-blue-50 px-4 py-4 text-sm leading-7 text-blue-900",

  amber:
    "rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm leading-7 text-amber-900",

  green:
    "rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm leading-7 text-emerald-900",
} as const;

// ─── Badges / Pills ────────────────────────────────────────────────────────

export const badge = {
  // Grote pill (bijv. "Alleen voor platformbeheer")
  blue:
    "rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700",

  // Kleine status pill
  slate:
    "rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600",

  amber:
    "rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800",

  green:
    "rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700",
} as const;

// ─── Lijstitems (checklist / KV-rijen) ─────────────────────────────────────

export const listItem = {
  // Checklistitem (checkbox + tekst)
  check:
    "flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3",

  // Key-value rij (label links, waarde rechts)
  kv:
    "flex items-start justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3",

  // KV amber variant
  kvAmber:
    "flex items-start justify-between gap-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3",
} as const;

// ─── Stap-navigatie ────────────────────────────────────────────────────────

export const stepNav = {
  active:
    "w-full rounded-2xl border border-slate-900 bg-slate-900 text-white px-4 py-4 text-left transition",

  inactive:
    "w-full rounded-2xl border border-slate-200 bg-slate-50 text-slate-800 px-4 py-4 text-left transition hover:bg-slate-100",
} as const;

// ─── Sidebar ───────────────────────────────────────────────────────────────

export const sidebar = {
  nav: {
    active:
      "w-full rounded-xl px-4 py-3 text-left text-sm font-semibold bg-white text-slate-900 transition",

    inactive:
      "w-full rounded-xl px-4 py-3 text-left text-sm font-semibold text-slate-300 transition hover:bg-slate-800 hover:text-white",
  },

  operationsLink:
    "mb-3 flex w-full items-center rounded-xl border border-slate-700 px-4 py-3 text-left text-sm font-semibold text-slate-300 transition hover:bg-slate-800 hover:text-white",
} as const;

// ─── Samengestelde helpers ─────────────────────────────────────────────────

/**
 * Combineer meerdere class-strings (simpele helper, geen dependency nodig).
 * Gebruik alleen voor conditionele klassen — niet als vervanging voor tailwind-merge.
 */
export function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}
