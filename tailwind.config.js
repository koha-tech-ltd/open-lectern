/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        cream: '#F4EFE6',
        ivory: '#FAF7F1',
        walnut: '#5C3A21',
        brass: '#C4A35A',
        ochre: '#B8843A',
        forest: '#24382C',
        moss: '#3A5644',
        ink: '#1A1612',
      },
      fontFamily: {
        display: ['"Source Serif 4"', 'Georgia', 'serif'],
        sans: ['"Source Sans 3"', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
        landing: ['"Bricolage Grotesque"', '"Source Sans 3"', 'system-ui', 'sans-serif'],
        editorial: ['Fraunces', '"Source Serif 4"', 'Georgia', 'serif'],
      },
      boxShadow: {
        lectern: '0 18px 40px rgba(36, 56, 44, 0.08)',
      },
    },
  },
  plugins: [],
};
