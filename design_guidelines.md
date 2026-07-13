{
  "product": {
    "name": "Meditrax (Premium iOS-style PWA)",
    "design_personality": {
      "keywords": [
        "calm",
        "reassuring",
        "premium",
        "human",
        "native-iOS",
        "softly tactile",
        "not-clinical",
        "not-generic-dashboard"
      ],
      "visual_metaphor": "A quiet apothecary journal: warm paper + ink + sea-glass accents. Large rounded surfaces, subtle depth, and iOS-like sheets.",
      "brand_attributes": {
        "sophisticated": "Muted palette, restrained accents, high-quality typography, minimal borders.",
        "motivating": "Clear progress rings, streak micro-celebrations (subtle), next-dose countdown.",
        "trustworthy": "Medical disclaimers, conservative color semantics, predictable navigation, WCAG AA contrast."
      }
    }
  },

  "design_tokens": {
    "notes": [
      "Set tokens in /src/index.css :root and .dark (HSL variables already exist).",
      "Avoid loud gradients; use only mild section background washes (<=20% viewport).",
      "Prefer warm neutrals + sea-glass teal accents (no purple)."
    ],

    "color_system": {
      "mode": ["light", "dark"],
      "light": {
        "background": "36 33% 97%",
        "foreground": "222 18% 14%",
        "card": "0 0% 100%",
        "card_foreground": "222 18% 14%",
        "popover": "0 0% 100%",
        "popover_foreground": "222 18% 14%",

        "primary": "186 38% 32%",
        "primary_foreground": "0 0% 100%",

        "secondary": "36 22% 92%",
        "secondary_foreground": "222 18% 14%",

        "muted": "36 18% 94%",
        "muted_foreground": "215 10% 42%",

        "accent": "164 28% 88%",
        "accent_foreground": "186 38% 22%",

        "destructive": "6 72% 52%",
        "destructive_foreground": "0 0% 100%",

        "border": "30 14% 86%",
        "input": "30 14% 86%",
        "ring": "186 38% 32%",

        "semantic": {
          "success": "152 45% 34%",
          "success_surface": "152 35% 92%",
          "warning": "34 88% 52%",
          "warning_surface": "34 90% 92%",
          "info": "199 78% 44%",
          "info_surface": "199 70% 92%",
          "neutral_surface": "36 18% 94%"
        },

        "risk_badges": {
          "low": { "bg": "152 35% 92%", "fg": "152 45% 24%", "border": "152 25% 82%" },
          "medium": { "bg": "34 90% 92%", "fg": "34 88% 28%", "border": "34 55% 82%" },
          "high": { "bg": "6 85% 94%", "fg": "6 72% 34%", "border": "6 55% 84%" },
          "dependency": { "bg": "18 55% 92%", "fg": "18 70% 28%", "border": "18 35% 82%" }
        },

        "charts": {
          "chart_1": "186 38% 32%",
          "chart_2": "152 45% 34%",
          "chart_3": "34 88% 52%",
          "chart_4": "199 78% 44%",
          "chart_5": "18 70% 48%"
        }
      },

      "dark": {
        "background": "222 22% 10%",
        "foreground": "36 20% 96%",
        "card": "222 22% 12%",
        "card_foreground": "36 20% 96%",
        "popover": "222 22% 12%",
        "popover_foreground": "36 20% 96%",

        "primary": "164 38% 52%",
        "primary_foreground": "222 22% 10%",

        "secondary": "222 18% 18%",
        "secondary_foreground": "36 20% 96%",

        "muted": "222 16% 16%",
        "muted_foreground": "36 10% 72%",

        "accent": "186 28% 18%",
        "accent_foreground": "164 38% 72%",

        "destructive": "6 62% 42%",
        "destructive_foreground": "0 0% 100%",

        "border": "222 14% 22%",
        "input": "222 14% 22%",
        "ring": "164 38% 52%",

        "semantic": {
          "success": "152 45% 44%",
          "success_surface": "152 25% 16%",
          "warning": "34 88% 58%",
          "warning_surface": "34 35% 16%",
          "info": "199 78% 56%",
          "info_surface": "199 35% 16%",
          "neutral_surface": "222 16% 16%"
        },

        "charts": {
          "chart_1": "164 38% 52%",
          "chart_2": "199 78% 56%",
          "chart_3": "34 88% 58%",
          "chart_4": "152 45% 44%",
          "chart_5": "18 70% 58%"
        }
      },

      "allowed_gradients": {
        "hero_wash_light": "linear-gradient(135deg, hsla(164, 28%, 88%, 0.55), hsla(36, 33%, 97%, 0.85), hsla(199, 70%, 92%, 0.35))",
        "hero_wash_dark": "linear-gradient(135deg, hsla(186, 28%, 18%, 0.55), hsla(222, 22%, 10%, 0.92), hsla(164, 38%, 52%, 0.12))",
        "rule": "Use only as section background overlays; never on cards; keep under 20% viewport height."
      },

      "texture": {
        "noise_css": "background-image: url('data:image/svg+xml,%3Csvg xmlns=\"http://www.w3.org/2000/svg\" width=\"160\" height=\"160\"%3E%3Cfilter id=\"n\"%3E%3CfeTurbulence type=\"fractalNoise\" baseFrequency=\"0.9\" numOctaves=\"3\" stitchTiles=\"stitch\"/%3E%3C/filter%3E%3Crect width=\"160\" height=\"160\" filter=\"url(%23n)\" opacity=\"0.06\"/%3E%3C/svg%3E');",
        "usage": "Apply as a subtle overlay on app background only (not on text-heavy cards)."
      }
    },

    "typography": {
      "google_fonts": {
        "display": {
          "name": "Fraunces",
          "weights": ["400", "600", "700"],
          "use": "Large titles (Today, Taper Planner, Knowledge Base headings). Adds premium editorial warmth without feeling playful."
        },
        "body": {
          "name": "Manrope",
          "weights": ["400", "500", "600", "700"],
          "use": "UI body, labels, buttons. High legibility on mobile."
        }
      },
      "css_vars": {
        "font_display": "--font-display: 'Fraunces', ui-serif, Georgia, serif;",
        "font_body": "--font-body: 'Manrope', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;"
      },
      "scale_tailwind": {
        "h1": "text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-[-0.02em]",
        "h2": "text-base md:text-lg font-medium text-muted-foreground",
        "section_title": "text-xl font-semibold tracking-[-0.01em]",
        "body": "text-sm sm:text-base leading-6",
        "caption": "text-xs text-muted-foreground"
      }
    },

    "spacing": {
      "principles": [
        "Mobile-first: generous whitespace; 2–3x more spacing than feels necessary.",
        "Tap targets: minimum 44px height for primary actions."
      ],
      "container": {
        "mobile_padding": "px-4",
        "desktop_max": "max-w-3xl",
        "desktop_padding": "md:px-6"
      },
      "stack_gaps": {
        "tight": "gap-2",
        "default": "gap-3",
        "roomy": "gap-5"
      }
    },

    "radius": {
      "base": "--radius: 1rem",
      "card": "rounded-2xl",
      "pill": "rounded-full",
      "sheet": "rounded-t-3xl",
      "ios_controls": "rounded-xl"
    },

    "shadows": {
      "card": "shadow-[0_10px_30px_-18px_rgba(15,23,42,0.35)]",
      "card_dark": "shadow-[0_14px_40px_-22px_rgba(0,0,0,0.65)]",
      "floating": "shadow-[0_18px_50px_-28px_rgba(15,23,42,0.45)]",
      "hairline": "shadow-[0_1px_0_rgba(15,23,42,0.06)]"
    }
  },

  "layout_system": {
    "global": {
      "safe_area": {
        "css": [
          ":root { --sat: env(safe-area-inset-top); --sab: env(safe-area-inset-bottom); --sal: env(safe-area-inset-left); --sar: env(safe-area-inset-right); }",
          ".safe-top { padding-top: calc(12px + var(--sat)); }",
          ".safe-bottom { padding-bottom: calc(12px + var(--sab)); }"
        ],
        "usage": "Apply safe-bottom to pages with fixed tab bar; ensure content isn't hidden behind it."
      },
      "grid": {
        "mobile": "single column; cards full width",
        "tablet_desktop": "two-column only for analytics/knowledge base lists; keep primary flows single-column for iOS feel",
        "recommended": "Use CSS grid with gap-4; avoid dense tables on mobile."
      }
    },

    "navigation": {
      "bottom_tab_bar": {
        "pattern": "iOS-style blurred bar with 4–5 tabs + centered quick action (+).",
        "height": "h-[72px]",
        "style": "bg-background/70 backdrop-blur-xl border-t border-border",
        "icon": "lucide-react icons, 22–24px",
        "label": "text-[11px] font-medium",
        "active_state": "text-primary; inactive text-muted-foreground",
        "data_testids": {
          "tab_today": "bottom-tab-today",
          "tab_meds": "bottom-tab-medications",
          "tab_calendar": "bottom-tab-calendar",
          "tab_insights": "bottom-tab-insights",
          "tab_settings": "bottom-tab-settings",
          "quick_add": "bottom-tab-quick-add"
        }
      },
      "top_bar": {
        "pattern": "Large iOS title + trailing actions (search, add, filter).",
        "title_font": "font-display",
        "title_class": "text-3xl font-semibold tracking-[-0.02em]",
        "actions": "IconButton (ghost) with 44px hit area"
      }
    }
  },

  "components": {
    "component_path": {
      "shadcn_primary": "/app/frontend/src/components/ui",
      "use_components": [
        "button.jsx",
        "card.jsx",
        "badge.jsx",
        "tabs.jsx",
        "sheet.jsx",
        "drawer.jsx",
        "dialog.jsx",
        "calendar.jsx",
        "progress.jsx",
        "tooltip.jsx",
        "separator.jsx",
        "scroll-area.jsx",
        "command.jsx",
        "input.jsx",
        "textarea.jsx",
        "switch.jsx",
        "slider.jsx",
        "toggle-group.jsx",
        "sonner.jsx"
      ]
    },

    "core_patterns": {
      "card": {
        "usage": "Primary surface for meds, logs, taper steps, knowledge articles.",
        "classes": "rounded-2xl bg-card text-card-foreground border border-border/70 shadow-[0_10px_30px_-18px_rgba(15,23,42,0.35)]",
        "header": "px-4 pt-4 pb-2",
        "content": "px-4 pb-4",
        "micro_interaction": "On press: scale-[0.99] + shadow reduces slightly (no transition: all)."
      },

      "ios_sheet_drawer": {
        "use": "Use Drawer for mobile-first bottom sheets (Quick Log, Add/Edit Medication, Snooze). Use Sheet for side panels on desktop.",
        "classes": "rounded-t-3xl border border-border bg-card/95 backdrop-blur-xl",
        "grabber": "Add a small top grabber: w-10 h-1 rounded-full bg-muted mx-auto mt-2",
        "data_testids": {
          "open_quick_log": "quick-log-open",
          "sheet_close": "sheet-close"
        }
      },

      "buttons": {
        "primary": {
          "shape": "rounded-xl",
          "classes": "h-11 px-4 rounded-xl bg-primary text-primary-foreground shadow-[0_10px_24px_-18px_rgba(15,23,42,0.55)]",
          "hover": "hover:brightness-[0.98]",
          "active": "active:scale-[0.98]",
          "focus": "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "transition": "transition-[filter,box-shadow] duration-200"
        },
        "secondary": {
          "classes": "h-11 px-4 rounded-xl bg-secondary text-secondary-foreground border border-border/70",
          "transition": "transition-[background-color,border-color] duration-200"
        },
        "ghost_icon": {
          "classes": "h-11 w-11 rounded-xl hover:bg-muted",
          "transition": "transition-[background-color] duration-150"
        },
        "destructive": {
          "classes": "h-11 px-4 rounded-xl bg-destructive text-destructive-foreground",
          "transition": "transition-[background-color,filter] duration-200"
        }
      },

      "chips": {
        "pattern": "Use ToggleGroup for filters (Today: All / Morning / Afternoon / Evening / PRN).",
        "classes": "rounded-full bg-muted text-foreground data-[state=on]:bg-accent data-[state=on]:text-accent-foreground",
        "data_testids": {
          "filter_chip": "filter-chip"
        }
      },

      "badges": {
        "risk_levels": {
          "low": "bg-[hsl(var(--risk-low-bg))] text-[hsl(var(--risk-low-fg))] border border-[hsl(var(--risk-low-border))]",
          "medium": "bg-[hsl(var(--risk-medium-bg))] text-[hsl(var(--risk-medium-fg))] border border-[hsl(var(--risk-medium-border))]",
          "high": "bg-[hsl(var(--risk-high-bg))] text-[hsl(var(--risk-high-fg))] border border-[hsl(var(--risk-high-border))]",
          "dependency": "bg-[hsl(var(--risk-dependency-bg))] text-[hsl(var(--risk-dependency-fg))] border border-[hsl(var(--risk-dependency-border))]"
        },
        "inventory": {
          "ok": "bg-[hsl(var(--success-surface))] text-[hsl(var(--success))]",
          "low": "bg-[hsl(var(--warning-surface))] text-[hsl(var(--warning))]",
          "critical": "bg-[hsl(var(--destructive)/0.12)] text-[hsl(var(--destructive))]"
        }
      },

      "adherence_ring": {
        "implementation": "Use SVG ring (stroke-dasharray) or Recharts RadialBarChart. Keep ring thick (10–12px) with rounded caps.",
        "style": {
          "track": "stroke: hsl(var(--muted)); opacity: 0.9",
          "progress": "stroke: hsl(var(--primary)); stroke-linecap: round",
          "center": "Show % + streak caption"
        },
        "micro_interaction": "On completion: subtle confetti-free pulse (scale 1.02 -> 1.0) + haptic-like vibration via navigator.vibrate(10) when available (guarded).",
        "data_testids": {
          "ring": "adherence-ring",
          "streak": "adherence-streak"
        }
      },

      "taper_curve_chart": {
        "library": "recharts",
        "style": {
          "line": "stroke: hsl(var(--chart-1)); strokeWidth: 3; dot: false; activeDot: r=5",
          "grid": "stroke: hsl(var(--border)); strokeDasharray: 4 6; opacity: 0.6",
          "area_optional": "If using Area: fill with hsla(primary, 0.12) only; no gradients.",
          "tooltip": "Use shadcn Tooltip/Popover styling; rounded-xl; bg-card; border-border"
        },
        "timeline": "Below chart: Step cards in a vertical timeline (left rail + nodes). Each step shows date, target dose, pill breakdown, and a 'Pause' toggle.",
        "safety": "Always show a warning callout when reduction > X% per step (configurable).",
        "data_testids": {
          "chart": "taper-curve-chart",
          "step_item": "taper-step-item",
          "method_selector": "taper-method-selector"
        }
      },

      "chat_ui": {
        "pattern": "iMessage-inspired bubbles (but not blue). Assistant uses sea-glass tint; user uses neutral ink bubble.",
        "assistant_bubble": "max-w-[85%] rounded-2xl rounded-tl-md bg-accent text-accent-foreground border border-border/60",
        "user_bubble": "max-w-[85%] rounded-2xl rounded-tr-md bg-secondary text-foreground border border-border/60",
        "composer": "Sticky bottom composer above tab bar; Input + Send button; suggested prompt chips in horizontal ScrollArea.",
        "streaming": "Show typing indicator: 3 dots with subtle opacity animation (framer-motion).",
        "disclaimer": "Pinned small Alert at top of chat: 'Not medical advice'.",
        "data_testids": {
          "chat_message": "ai-chat-message",
          "chat_input": "ai-chat-input",
          "chat_send": "ai-chat-send",
          "chat_suggestion": "ai-chat-suggestion"
        }
      },

      "search": {
        "knowledge_base": "Use Command component for global search (meds + knowledge base).",
        "data_testids": {
          "global_search_open": "global-search-open",
          "global_search_input": "global-search-input",
          "knowledge_search_input": "knowledge-search-input"
        }
      },

      "empty_states": {
        "style": "Illustration-free by default (avoid generic). Use icon + warm copy + single CTA.",
        "classes": "rounded-2xl border border-dashed border-border bg-muted/40 p-6 text-center",
        "copy_tone": "Supportive, non-judgmental: 'No doses logged yet — want to add your first medication?'",
        "data_testids": {
          "empty_state": "empty-state"
        }
      }
    }
  },

  "motion": {
    "library": "framer-motion",
    "principles": [
      "Use spring for sheets/cards; ease-out for fades.",
      "No universal transitions; only transition specific properties.",
      "Respect prefers-reduced-motion: reduce (disable parallax and large transforms)."
    ],
    "durations": {
      "fast": "150ms",
      "base": "220ms",
      "slow": "320ms"
    },
    "patterns": {
      "page_enter": "opacity 0 -> 1 + y 6 -> 0 (spring, damping 22)",
      "card_press": "whileTap scale 0.99",
      "sheet": "slide up with spring; backdrop fade",
      "tab_switch": "subtle underline/indicator glide (layoutId)"
    }
  },

  "page_blueprints": {
    "today_dashboard": {
      "layout": [
        "Top: Large title 'Today' + date + quick search icon",
        "Hero card: adherence ring + next dose countdown + streak",
        "Dose list: grouped by time-of-day with sticky mini headers",
        "Each dose card: med name, dose, time, badges (risk/inventory), actions row (Take / Snooze / Skip)",
        "Bottom: refill alerts + taper progress snippet"
      ],
      "key_ctas": ["Take", "Snooze", "Skip", "Quick Log"],
      "data_testids": {
        "take_button": "dose-take-button",
        "snooze_button": "dose-snooze-button",
        "skip_button": "dose-skip-button",
        "next_dose": "next-dose-countdown"
      }
    },

    "medications_list": {
      "layout": [
        "Search + filter chips (Active / PRN / Tapering / Archived)",
        "List as large cards with pill color dot + strength summary",
        "Swipe actions (optional): archive, refill, edit (ensure accessible alternatives)"
      ],
      "data_testids": {
        "med_search": "medications-search-input",
        "med_card": "medication-card",
        "add_med": "add-medication-button"
      }
    },

    "medication_detail": {
      "layout": [
        "Header: med name + risk badge + edit",
        "Schedule card: next dose + cadence + cyclic dosing summary",
        "Inventory card: remaining + projected refill date",
        "Notes/side effects/interactions sections as accordions",
        "Quick actions: Log dose, Adjust inventory, Start taper"
      ]
    },

    "quick_log": {
      "pattern": "Bottom Drawer",
      "layout": [
        "Segmented control: Taken / Missed / Partial",
        "Dose picker (slider or stepper) + pill breakdown",
        "Optional: mood, side effects chips, effectiveness slider",
        "Primary CTA: Save log"
      ],
      "data_testids": {
        "log_status": "quick-log-status-toggle",
        "log_save": "quick-log-save-button"
      }
    },

    "calendar": {
      "layout": [
        "Use shadcn Calendar for month view",
        "Day detail as sheet: doses + adherence + notes",
        "Color dots under dates for adherence status"
      ],
      "data_testids": {
        "calendar": "adherence-calendar",
        "calendar_day": "calendar-day"
      }
    },

    "analytics_insights": {
      "layout": [
        "Top: timeframe chips (7d / 30d / 90d / custom)",
        "Cards: adherence trend line, streaks, per-med breakdown",
        "Use Recharts with muted grid + strong line color"
      ],
      "data_testids": {
        "timeframe": "analytics-timeframe-toggle",
        "chart": "analytics-chart"
      }
    },

    "inventory": {
      "layout": [
        "List meds with remaining count + projected days left",
        "Refill CTA per item",
        "Settings: default refill threshold"
      ]
    },

    "taper_planner": {
      "layout": [
        "Top: Large title + method selector (Linear/Hyperbolic/Custom)",
        "Chart card: taper curve + key milestones",
        "Step timeline: each step card with date, dose, pill breakdown, notes",
        "Controls: pause, shift dates, export plan",
        "Safety callouts: reduction % warnings"
      ],
      "data_testids": {
        "create_plan": "taper-create-plan-button",
        "export_plan": "taper-export-plan-button"
      }
    },

    "knowledge_base": {
      "layout": [
        "Search (Command) + categories (chips)",
        "Article cards with reading time + last updated",
        "Detail page: typography-friendly reading layout; inline callouts"
      ],
      "data_testids": {
        "kb_card": "knowledge-article-card",
        "kb_open": "knowledge-article-open"
      }
    },

    "ai_assistant": {
      "layout": [
        "Pinned disclaimer alert",
        "Chat transcript (ScrollArea)",
        "Suggested prompts row",
        "Composer with send button"
      ]
    },

    "settings_onboarding": {
      "pwa_onboarding": {
        "moment": "A friendly onboarding card that appears until dismissed: 'Install to Home Screen' + 'Enable reminders'.",
        "ios_note": "Explain iOS install steps with 3-step mini list; keep copy short.",
        "push": "Use a sheet to request notification permission with clear value proposition.",
        "data_testids": {
          "pwa_install": "pwa-install-cta",
          "push_enable": "push-enable-cta"
        }
      }
    }
  },

  "libraries_and_integrations": {
    "recharts": {
      "use": "Analytics + taper curve",
      "notes": "Prefer LineChart/AreaChart; keep tooltips shadcn-styled; avoid heavy gradients."
    },
    "framer_motion": {
      "use": "Page transitions, sheet micro-animations, typing indicator",
      "scaffold_js": "// Example: import { motion } from 'framer-motion';\n// <motion.div initial={{opacity:0,y:6}} animate={{opacity:1,y:0}} transition={{type:'spring',damping:22,stiffness:260}} />"
    },
    "pwa": {
      "notes": [
        "Design for standalone: add safe-area padding and avoid fixed headers overlapping.",
        "Add an app icon concept: warm off-white background + sea-glass capsule mark (simple, no gradients).",
        "Push notifications: ensure permission prompts are user-initiated (CTA tap)."
      ]
    }
  },

  "image_urls": {
    "hero_or_onboarding": [
      {
        "category": "onboarding",
        "description": "Optional onboarding background image (use very subtly, blurred, behind a solid overlay).",
        "url": "https://images.unsplash.com/photo-1593672827643-a49f0af32d88?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDk1Nzl8MHwxfHNlYXJjaHwxfHxtZWRpY2luZSUyMHBpbGxzJTIwZmxhdCUyMGxheSUyMHdhcm0lMjBuZXV0cmFsJTIwYmFja2dyb3VuZHxlbnwwfHx8Z3JlZW58MTc4MjY4MzAyOXww&ixlib=rb-4.1.0&q=85"
      }
    ],
    "notes": "Prefer iconography + subtle textures over stock photos for trust. Use images only in onboarding/knowledge base headers with strong overlays."
  },

  "instructions_to_main_agent": {
    "global_css_updates": [
      "Replace default shadcn tokens in /app/frontend/src/index.css with the HSL values above.",
      "Add CSS vars for risk badge colors (e.g., --risk-low-bg etc.) derived from tokens.",
      "Remove CRA demo styles in App.css (App-header centering etc.)."
    ],
    "implementation_rules": [
      "All interactive + key informational elements MUST include data-testid (kebab-case).",
      "Use shadcn components from /src/components/ui; do not use raw HTML dropdown/calendar/toast.",
      "Mobile-first: bottom tab bar fixed; add safe-area padding; ensure scroll areas account for tab bar height.",
      "No 'transition: all'. Use transition-[background-color,border-color,filter,box-shadow] only.",
      "Avoid gradients except allowed hero wash overlays (<=20% viewport)."
    ],
    "js_files_note": "Project uses .js/.jsx. Provide components in .jsx and hooks in .js; avoid .tsx guidance.",
    "testing": {
      "data_testid_convention": "role-based kebab-case (e.g., 'dose-take-button', 'taper-curve-chart').",
      "coverage_targets": [
        "Bottom tabs",
        "Primary CTAs",
        "Forms inputs",
        "Charts containers",
        "Error banners",
        "AI chat composer"
      ]
    }
  },

  "general_ui_ux_design_guidelines_appendix": "<General UI UX Design Guidelines>\n    - You must **not** apply universal transition. Eg: `transition: all`. This results in breaking transforms. Always add transitions for specific interactive elements like button, input excluding transforms\n    - You must **not** center align the app container, ie do not add `.App { text-align: center; }` in the css file. This disrupts the human natural reading flow of text\n   - NEVER: use AI assistant Emoji characters like`🤖🧠💭💡🔮🎯📚🎭🎬🎪🎉🎊🎁🎀🎂🍰🎈🎨🎰💰💵💳🏦💎🪙💸🤑📊📈📉💹🔢🏆🥇 etc for icons. Always use **FontAwesome cdn** or **lucid-react** library already installed in the package.json\n\n **GRADIENT RESTRICTION RULE**\nNEVER use dark/saturated gradient combos (e.g., purple/pink) on any UI element.  Prohibited gradients: blue-500 to purple 600, purple 500 to pink-500, green-500 to blue-500, red to pink etc\nNEVER use dark gradients for logo, testimonial, footer etc\nNEVER let gradients cover more than 20% of the viewport.\nNEVER apply gradients to text-heavy content or reading areas.\nNEVER use gradients on small UI elements (<100px width).\nNEVER stack multiple gradient layers in the same viewport.\n\n**ENFORCEMENT RULE:**\n    • Id gradient area exceeds 20% of viewport OR affects readability, **THEN** use solid colors\n\n**How and where to use:**\n   • Section backgrounds (not content backgrounds)\n   • Hero section header content. Eg: dark to light to dark color\n   • Decorative overlays and accent elements only\n   • Hero section with 2-3 mild color\n   • Gradients creation can be done for any angle say horizontal, vertical or diagonal\n\n- For AI chat, voice application, **do not use purple color. Use color like light green, ocean blue, peach orange etc**\n\n</Font Guidelines>\n\n- Every interaction needs micro-animations - hover states, transitions, parallax effects, and entrance animations. Static = dead. \n   \n- Use 2-3x more spacing than feels comfortable. Cramped designs look cheap.\n\n- Subtle grain textures, noise overlays, custom cursors, selection states, and loading animations: separates good from extraordinary.\n   \n- Before generating UI, infer the visual style from the problem statement (palette, contrast, mood, motion) and immediately instantiate it by setting global design tokens (primary, secondary/accent, background, foreground, ring, state colors), rather than relying on any library defaults. Don't make the background dark as a default step, always understand problem first and define colors accordingly\n    Eg: - if it implies playful/energetic, choose a colorful scheme\n           - if it implies monochrome/minimal, choose a black–white/neutral scheme\n\n**Component Reuse:**\n\t- Prioritize using pre-existing components from src/components/ui when applicable\n\t- Create new components that match the style and conventions of existing components when needed\n\t- Examine existing components to understand the project's component patterns before creating new ones\n\n**IMPORTANT**: Do not use HTML based component like dropdown, calendar, toast etc. You **MUST** always use `/app/frontend/src/components/ui/ ` only as a primary components as these are modern and stylish component\n\n**Best Practices:**\n\t- Use Shadcn/UI as the primary component library for consistency and accessibility\n\t- Import path: ./components/[component-name]\n\n**Export Conventions:**\n\t- Components MUST use named exports (export const ComponentName = ...)\n\t- Pages MUST use default exports (export default function PageName() {...})\n\n**Toasts:**\n  - Use `sonner` for toasts\"\n  - Sonner component are located in `/app/src/components/ui/sonner.tsx`\n\nUse 2–4 color gradients, subtle textures/noise overlays, or CSS-based noise to avoid flat visuals.\n</General UI UX Design Guidelines>"
}
