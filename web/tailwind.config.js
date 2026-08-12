/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // --- Hintergruende (tief -> hell) ---
        bg: '#0A0C0D',
        'bg-alt': '#0E1113',
        surface: '#15191C',
        'surface-elevated': '#1B2024',
        'surface-high': '#232A2E',
        // --- Rahmen ---
        border: '#242B2F',
        'border-strong': '#333C41',
        // --- Mint (Akzent) ---
        mint: '#35E0A1',
        'mint-bright': '#5CEFC0',
        'mint-dim': '#23B584',
        'mint-deep': '#0F3D2E',
        'on-mint': '#04130C',
        // --- Text ---
        'text-primary': '#F1F5F3',
        'text-secondary': '#98A29D',
        'text-muted': '#616B66',
        // --- Semantisch ---
        positive: '#35E0A1',
        negative: '#FF6B6B',
        warning: '#FFC24B',
        info: '#63A9FF',
        violet: '#B79BFF',
      },
      fontFamily: {
        sans: ['Manrope', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        sm: '12px',
        md: '16px',
        lg: '20px',
        xl: '28px',
        pill: '999px',
      },
      boxShadow: {
        card: '0 12px 24px rgba(0,0,0,0.20)',
        'card-lg': '0 20px 48px rgba(0,0,0,0.35)',
        glow: '0 0 40px rgba(53,224,161,0.18)',
      },
      backgroundImage: {
        'gradient-mint': 'linear-gradient(135deg, #5CEFC0 0%, #23B584 100%)',
        'gradient-hero': 'linear-gradient(135deg, #1B2A25 0%, #12181A 100%)',
        'gradient-sheen': 'linear-gradient(135deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0) 100%)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.5s cubic-bezier(0.16,1,0.3,1) both',
      },
    },
  },
  plugins: [],
}
