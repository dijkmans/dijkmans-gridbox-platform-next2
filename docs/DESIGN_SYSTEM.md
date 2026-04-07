# Gridbox Design System

Gebaseerd op de broncode van `gridbox-portal`. Alle stijlwaarden zijn afgeleid uit de bestaande Tailwind classes in de componenten.

---

## Kleuren

### Achtergronden
| Naam | Tailwind | Hex | Gebruik |
|---|---|---|---|
| Page background | `bg-slate-50` | `#f8fafc` | Hoofdpagina achtergrond |
| Card background | `bg-white` | `#ffffff` | Alle cards |
| Sectie achtergrond | `bg-slate-50` | `#f8fafc` | Content panels, stap content |
| Sidebar | `bg-slate-900` | `#0f172a` | Navigatiezijbalk |
| Sidebar footer | `bg-slate-950/40` | — | Footer card in sidebar |

### Tekst
| Naam | Tailwind | Hex | Gebruik |
|---|---|---|---|
| Primair | `text-slate-900` | `#0f172a` | Titels, labels, waarden |
| Secundair | `text-slate-600` | `#475569` | Body tekst, beschrijvingen |
| Tertiair | `text-slate-500` | `#64748b` | Labels, metadata |
| Placeholder | `text-slate-400` | `#94a3b8` | Subtekst, uitgeschakeld |
| Sidebar primair | `text-slate-100` | `#f1f5f9` | Sidebar tekst |
| Sidebar secundair | `text-slate-400` | `#94a3b8` | Sidebar subtekst |
| Sidebar inactief | `text-slate-300` | `#cbd5e1` | Navigatie-items inactief |

### Borders
| Naam | Tailwind | Hex | Gebruik |
|---|---|---|---|
| Standaard | `border-slate-200` | `#e2e8f0` | Alle cards en containers |
| Sidebar | `border-slate-800` | `#1e293b` | Sidebar dividers |
| Sidebar item | `border-slate-700` | `#334155` | Operations Center link |
| Focus | `border-slate-900` | `#0f172a` | Actieve stap, focus state |

### Accent — Blauw
| Naam | Tailwind | Hex | Gebruik |
|---|---|---|---|
| Accent tekst | `text-blue-700` | `#1d4ed8` | Links, accenttekst |
| Accent bg | `bg-blue-50` | `#eff6ff` | Informatie-alerts, highlight |
| Accent border | `border-blue-200` | `#bfdbfe` | Informatie-alerts |
| Accent donker | `text-blue-900` | `#1e3a8a` | Tekst in blauwe alerts |

### Status — Amber (waarschuwing)
| Naam | Tailwind | Hex | Gebruik |
|---|---|---|---|
| Amber bg | `bg-amber-50` | `#fffbeb` | Waarschuwingsblokken |
| Amber border | `border-amber-200` | `#fde68a` | Waarschuwingsblokken |
| Amber tekst | `text-amber-900` | `#78350f` | Tekst in amber blokken |
| Amber label | `text-amber-800` | `#92400e` | Labels in amber blokken |

### Status — Groen (succes)
| Naam | Tailwind | Hex | Gebruik |
|---|---|---|---|
| Groen bg | `bg-emerald-50` | `#ecfdf5` | Succes knoppen, voltooid |
| Groen border | `border-emerald-300` | `#6ee7b7` | Succes knoppen |
| Groen tekst | `text-emerald-800` | `#065f46` | Tekst in succes knoppen |

---

## Typography

**Font**: Geist Sans (Next.js standaard) — gebruik `Inter` als fallback in statische HTML.

### Groottes
| Naam | Tailwind | px | Gebruik |
|---|---|---|---|
| xs | `text-xs` | 12px | Labels, metadata, uppercase tracking |
| sm | `text-sm` | 14px | Body tekst, formulierelementen |
| base | `text-base` | 16px | — (zelden gebruikt) |
| xl | `text-xl` | 20px | Stap-titels (h3) |
| 2xl | `text-2xl` | 24px | Sectie-titels (h2) |
| 4xl | `text-4xl` | 36px | Paginatitels |

### Weights
| Naam | Tailwind | Gebruik |
|---|---|---|
| Medium | `font-medium` | Navigatieitems |
| Semibold | `font-semibold` | Labels, sublabels, waarden in rijen |
| Bold | `font-bold` | Stap-titels, kaarttitels |
| Extrabold | `font-extrabold` | — |
| Black (800) | — | Paginatitels (via `font-bold` + grote size) |

### Line-height
| Naam | Tailwind | Gebruik |
|---|---|---|
| Compact | `leading-6` | Status labels, kleine tekst |
| Standaard | `leading-7` | Body tekst in beschrijvingen |

### Uppercase labels
```
text-xs font-semibold uppercase tracking-[0.18em]
```
Gebruik voor: stap-nummers ("Stap 1"), sectielabels in sidebar.

---

## Spacing & Radius

### Border radius
| Naam | Tailwind | px | Gebruik |
|---|---|---|---|
| sm | `rounded-xl` | 12px | Knoppen, inputs, kleine kaarten, checklistitems |
| md | `rounded-2xl` | 16px | Sub-cards, interne kaarten, stap-navigatieknoppen |
| lg | `rounded-3xl` | 24px | **Hoofdcards**, content panels, step content area |

**Regel**: gebruik altijd `rounded-3xl` voor top-level cards, `rounded-2xl` voor interne sub-cards, `rounded-xl` voor knoppen en inputs.

### Padding
| Context | Tailwind |
|---|---|
| Card header | `px-6 py-6` of `p-6` |
| Card sectie | `px-4 py-4` |
| Knop primair | `px-4 py-3` |
| Input | `px-4 py-3` |
| Checklistitem | `px-4 py-3` |
| KV-rij | `px-4 py-3` |
| Sidebar | `px-6 py-6` (header), `px-4 py-6` (nav) |

### Gap / Space
| Context | Tailwind |
|---|---|
| Stapnavigatie lijst | `space-y-2` |
| Content blokken | `space-y-6` |
| Formuliervelden | `gap-5` |
| Grid kolommen | `gap-4` of `gap-6` |

---

## Componenten

### Card (hoofdniveau)
```
bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden
```

### Card header
```
px-6 py-6 border-b border-slate-200
```

### Sub-card (intern)
```
bg-white border border-slate-200 rounded-2xl p-5
```

### Content panel (stap-achtergrond)
```
rounded-3xl border border-slate-200 bg-slate-50 p-6
```

### Stap-navigatieknop actief
```
rounded-2xl border border-slate-900 bg-slate-900 text-white px-4 py-4 text-left
```

### Stap-navigatieknop inactief
```
rounded-2xl border border-slate-200 bg-slate-50 text-slate-800 hover:bg-slate-100 px-4 py-4 text-left
```

### Knop — primair
```
rounded-xl bg-slate-900 text-white px-4 py-3 text-sm font-semibold hover:bg-slate-800
```

### Knop — secundair / outline
```
rounded-xl border border-slate-200 bg-white text-slate-900 px-4 py-3 text-sm font-semibold hover:bg-slate-50
```

### Knop — succes
```
rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-800 px-4 py-3 text-sm font-semibold hover:bg-emerald-100
```

### Knop — uitgeschakeld
```
rounded-xl bg-slate-100 text-slate-400 px-4 py-3 text-sm font-semibold cursor-not-allowed opacity-60
```

### Input
```
w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900
```

### Select
```
w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900
```

### Checklistitem
```
flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3
```

### KV-rij (key-value in overzichtskaart)
```
flex items-start justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3
```

### Alert — blauw (informatie)
```
rounded-2xl border border-blue-200 bg-blue-50 px-4 py-4 text-sm leading-7 text-blue-900
```

### Alert — amber (waarschuwing)
```
rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm leading-7 text-amber-900
```

### Badge / Pill
```
rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700
```

### Status label klein
```
rounded-full px-3 py-1 text-xs font-semibold
```

---

## Sidebar

```
hidden w-72 shrink-0 border-r border-slate-200 bg-slate-900 text-slate-100 lg:flex lg:flex-col
```

### Sidebar header
```
border-b border-slate-800 px-6 py-6
```
- Label: `text-sm uppercase tracking-[0.18em] text-slate-400`
- Titel: `text-2xl font-bold`
- Subtekst: `text-sm leading-6 text-slate-400`

### Sidebar navigatieitem — actief
```
w-full rounded-xl px-4 py-3 text-left text-sm font-semibold bg-white text-slate-900
```

### Sidebar navigatieitem — inactief
```
w-full rounded-xl px-4 py-3 text-left text-sm font-semibold text-slate-300 hover:bg-slate-800 hover:text-white
```

### Operations Center link
```
mb-3 flex w-full items-center rounded-xl border border-slate-700 px-4 py-3 text-left text-sm font-semibold text-slate-300 hover:bg-slate-800 hover:text-white
```

---

## Regels

1. **Hoofdcards altijd `rounded-3xl`** — nooit `rounded-2xl` of minder voor top-level cards
2. **Knoppen en inputs altijd `rounded-xl`** — consistent door de hele admin
3. **Sub-cards altijd `rounded-2xl`** — voor kaarten binnen een hoofdcard
4. **Geen inline kleuren** — gebruik altijd Tailwind kleurklassen
5. **Body tekst altijd `text-sm leading-7 text-slate-600`** in beschrijvingen
6. **Labels altijd `text-xs font-semibold uppercase tracking-[0.18em]`** voor sectietitels
7. **Alerts nooit in rood** — gebruik amber voor waarschuwingen, blauw voor informatie
8. **Sidebar altijd `bg-slate-900`** — nooit een andere donkere kleur
9. **Geen `text-black`** — gebruik altijd `text-slate-900`
10. **Knoppen nooit `rounded-full`** — badges en pills wel
