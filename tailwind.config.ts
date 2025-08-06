import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/domains/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        // Karaoke specific colors
        karaoke: {
          text: "var(--karaoke-text)",
          highlighted: "var(--karaoke-highlighted)",
          shadow: "var(--karaoke-shadow)",
        },
        // Neon colors
        neon: {
          pink: "#FF10F0",
          blue: "#00FFF0",
          purple: "#9D00FF",
          green: "#00FF88",
          yellow: "#FFD700",
          orange: "#FF6B35",
        },
        // Glass colors
        glass: {
          white: "rgba(255, 255, 255, 0.1)",
          dark: "rgba(0, 0, 0, 0.3)",
          blur: "rgba(255, 255, 255, 0.05)",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "word-highlight": {
          from: { 
            color: "var(--karaoke-text)",
            textShadow: "2px 2px 4px var(--karaoke-shadow)",
          },
          to: { 
            color: "var(--karaoke-highlighted)",
            textShadow: "3px 3px 6px var(--karaoke-shadow)",
            transform: "scale(1.05)",
          },
        },
        "fade-in": {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "neon-pulse": {
          "0%, 100%": {
            textShadow: "0 0 4px currentColor, 0 0 11px currentColor, 0 0 19px currentColor",
          },
          "50%": {
            textShadow: "0 0 4px currentColor, 0 0 14px currentColor, 0 0 24px currentColor",
          },
        },
        "neon-flicker": {
          "0%, 100%": { opacity: "1" },
          "10%": { opacity: "0.9" },
          "20%": { opacity: "1" },
          "30%": { opacity: "0.9" },
          "40%": { opacity: "1" },
          "50%": { opacity: "0.95" },
          "60%": { opacity: "1" },
          "70%": { opacity: "0.9" },
          "80%": { opacity: "1" },
        },
        "float": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" },
        },
        "particle-float": {
          "0%": {
            transform: "translate(0, 100vh) scale(0)",
            opacity: "0",
          },
          "10%": {
            opacity: "1",
          },
          "90%": {
            opacity: "1",
          },
          "100%": {
            transform: "translate(100vw, -100vh) scale(1)",
            opacity: "0",
          },
        },
        "gradient-shift": {
          "0%, 100%": {
            backgroundPosition: "0% 50%",
          },
          "50%": {
            backgroundPosition: "100% 50%",
          },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "word-highlight": "word-highlight 0.3s ease-out forwards",
        "fade-in": "fade-in 0.3s ease-out",
        "neon-pulse": "neon-pulse 1.5s ease-in-out infinite",
        "neon-flicker": "neon-flicker 2s linear infinite",
        "float": "float 3s ease-in-out infinite",
        "particle-float": "particle-float 15s linear infinite",
        "gradient-shift": "gradient-shift 8s ease infinite",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        karaoke: ["var(--font-karaoke)", "Noto Sans KR", "sans-serif"],
      },
    },
  },
  plugins: [animate],
};

export default config;