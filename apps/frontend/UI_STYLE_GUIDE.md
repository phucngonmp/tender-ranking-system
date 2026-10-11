# Skylabel CRM UI Style Guide & Setup Instructions

This document provides a comprehensive guide to replicating the exact UI design system and configuration from the Skylabel CRM frontend project into a new Next.js project. It is specifically formatted to be easily parsed and applied by AI agents (like Gemini Flash or Pro).

## 1. Core Technology Stack
- **Framework:** Next.js (App Router), React 19
- **Styling:** Tailwind CSS v4 (configured via `@tailwindcss/postcss`)
- **Component Library:** shadcn/ui (customized `radix-nova` style)
- **Color Format:** OKLCH (for advanced accessible color palettes)

## 2. Initial Setup & Dependencies
To replicate the setup in a new project, you need the following core dependencies installed:

```bash
npm install tailwindcss@^4.2.1 @tailwindcss/postcss@^4.2.1 postcss@^8 class-variance-authority clsx tailwind-merge lucide-react radix-ui
npx shadcn@latest init
```

## 3. Configuration Files

### `components.json` (shadcn/ui configuration)
When initializing shadcn, ensure the configuration aligns with these settings to use CSS variables and standard aliases:

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "radix-nova",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "app/globals.css",
    "baseColor": "neutral",
    "cssVariables": true,
    "prefix": ""
  },
  "iconLibrary": "lucide",
  "rtl": false,
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  }
}
```

### `tailwind.config.ts`
The font family is explicitly set to support Japanese typography efficiently:

```typescript
export default {
  theme: {
    extend: {
      fontFamily: {
        sans: [
          '"Helvetica Neue"',
          '"Hiragino Sans"',
          '"Yu Gothic"',
          "sans-serif",
        ],
      },
    },
  },
}
```

## 4. Global CSS & OKLCH Color System (`app/globals.css`)
This is the most critical part of the design system. It uses **Color System v0.3 — UCL/Rider-Stockman lens transmittance baseline**, utilizing `oklch()` for perceptually uniform colors.

**Important rules from the system:**
- **Tier A (4.5:1):** Minimum contrast for text/labels.
- **Tier B (7:1):** Target for body text/badges.
- **Tier C (10:1):** Safety margin for critical CTAs and errors.
- **Non-text (3:1):** Borders, inputs, focus rings.

Apply this exact CSS configuration to your `globals.css`:

```css
@import "tailwindcss";
@import "tw-animate-css";
@import "shadcn/tailwind.css";

@custom-variant dark (&:is(.dark *));

@theme inline {
  --font-sans: "Helvetica Neue", "Hiragino Sans", "Yu Gothic", sans-serif;
  --font-heading: var(--font-sans);
  
  /* Map standard tailwind colors to custom variables */
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-destructive: var(--destructive);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);

  /* Border radius */
  --radius-sm: calc(var(--radius) * 0.6);
  --radius-md: calc(var(--radius) * 0.8);
  --radius-lg: var(--radius);
}

:root {
  /* Base — canvas / textPrimary */
  --background: oklch(0.973 0.004 91.4); /* canvas #F7F6F3 — warm white */
  --foreground: oklch(0.214 0.002 67.7); /* textPrimary #1A1918 */

  /* Card / Popover — surface */
  --card: oklch(1.000 0.000 89.9); /* surface #FFFFFF */
  --card-foreground: oklch(0.214 0.002 67.7);
  --popover: oklch(1.000 0.000 89.9);
  --popover-foreground: oklch(0.214 0.002 67.7);

  /* Primary — ctaPrimary #1E4D8C */
  --primary: oklch(0.423 0.116 256.9);
  --primary-foreground: oklch(0.984 0.004 106.5); /* nearWhite #FAFAF7 */

  /* Secondary — surfaceDim #EDEBE8 */
  --secondary: oklch(0.941 0.005 78.3);
  --secondary-foreground: oklch(0.214 0.002 67.7);

  /* Muted — neutralTint #F3F1EF */
  --muted: oklch(0.959 0.003 67.8);
  --muted-foreground: oklch(0.443 0.011 62.4); /* textSecondary #58524D */

  /* Accent — surfaceDim (hover/highlight) */
  --accent: oklch(0.941 0.005 78.3);
  --accent-foreground: oklch(0.214 0.002 67.7);

  /* Destructive — dangerBadge #8C1C13 */
  --destructive: oklch(0.419 0.149 29.5);

  /* Borders & Input — stroke #D5D1CD */
  --border: oklch(0.863 0.007 67.7);
  --input: oklch(0.863 0.007 67.7); 
  --ring: oklch(0.476 0.160 261.6); /* focusRing #2456B5 */

  --radius: 0.625rem;
}

.dark {
  /* Dark mode mappings (ensure readability against dark navies) */
  --background: oklch(0.14 0.02 255);
  --foreground: oklch(0.95 0.008 240);
  --card: oklch(0.2 0.025 255);
  --card-foreground: oklch(0.95 0.008 240);
  --popover: oklch(0.2 0.025 255);
  --popover-foreground: oklch(0.95 0.008 240);
  --primary: oklch(0.58 0.18 248);
  --primary-foreground: oklch(0.97 0.008 240);
  --secondary: oklch(0.26 0.04 255);
  --secondary-foreground: oklch(0.92 0.01 240);
  --muted: oklch(0.24 0.02 255);
  --muted-foreground: oklch(0.65 0.02 255);
  --accent: oklch(0.26 0.04 255);
  --accent-foreground: oklch(0.92 0.01 240);
  --destructive: oklch(0.65 0.2 22);
  --border: oklch(1 0 0 / 10%);
  --input: oklch(1 0 0 / 12%);
  --ring: oklch(0.58 0.18 248);
}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background font-sans text-foreground;
  }
  html {
    font-size: 17px;
  }
}
```

## 5. UI Component Guidelines (shadcn/ui overrides)
When implementing shadcn/ui components (e.g., `components/ui/button.tsx`), apply the following strict accessibility and design rules:

- **Touch Targets (WCAG 2.5.5 AAA):** Default sizes for interactable elements (buttons, inputs) must have a **44px floor**. In Tailwind this translates to `h-11` (`size-11` for icons).
- **Focus Rings:** Ensure highly visible focus rings using standard variables.
  - Class structure: `focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background`
- **Compact Variants:** If a smaller size is needed for dense tables/rows (`xs`: `h-6`, `sm`: `h-7`), explicitly document that it breaks the 44px floor and use rounded scales accordingly (`rounded-[min(var(--radius-md),10px)]`).

### Example: Standardized Button Component
```tsx
import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent text-sm font-medium transition-all outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/80",
        outline: "border-border bg-background hover:bg-muted hover:text-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-muted hover:text-foreground",
        destructive: "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive focus-visible:ring-destructive",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 px-4 py-2", /* 44px touch target */
        sm: "h-9 rounded-md px-3",
        lg: "h-12 rounded-md px-8",
        icon: "h-11 w-11", /* 44px touch target */
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot.Root : "button"
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
```

## Agent Instruction
**Prompt when providing this file to an AI Agent:**
> "Read this `UI_STYLE_GUIDE.md` document and apply the exact styling configuration (Tailwind 4, shadcn/ui, OKLCH globals.css, and WCAG accessibility standards) to our current project."
