import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: 'class',
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        trumley: {
          50: '#F5FAF4',
          100: '#E7F4E5',
          200: '#CEE8CB',
          300: '#B4DCB0',
          400: '#9EC29A', // Brand Signature Sage
          500: '#86B382',
          600: '#6FA06B',
          700: '#568053',
          800: '#3D5C3A',
          900: '#273C25',
          950: '#142013',
        },
        indigo: {
          50: '#f7fbf6',
          100: '#ebf5ea',
          200: '#d3ebd1',
          300: '#afd9ac',
          400: '#a3cfa0',
          500: '#a5cba1',
          600: '#9EC29A', // Primary Target
          700: '#7ea17b',
          800: '#617d5e',
          900: '#4b6149',
          950: '#283626',
        },
      },
      animation: {
        'float': 'float 6s ease-in-out infinite',
        'pulse-subtle': 'pulseSubtle 3s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        pulseSubtle: {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.85', transform: 'scale(1.02)' },
        },
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic":
          "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
};
export default config;
