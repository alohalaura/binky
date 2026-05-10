/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        lavender: {
          DEFAULT: '#9B91D8',
          light: '#EEEDFE',
          mid: '#CEC9F0',
          dark: '#3C3489',
        },
        salmon: {
          DEFAULT: '#E8897A',
          light: '#FAECE7',
        },
        cream: '#F5F2EC',
        'warm-white': '#FDFCFA',
        text: {
          dark: '#2C2A3A',
          mid: '#6B6880',
          light: '#9E9BB0',
        },
        severity: {
          1: '#639922',
          2: '#93C021',
          3: '#EF9F27',
          4: '#E86E2B',
          5: '#E24B4A',
        },
      },
      fontFamily: {
        sans: ['Urbanist', 'system-ui', 'sans-serif'],
        display: ['Urbanist', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        xl: '12px',
        '2xl': '16px',
        '3xl': '20px',
      },
    },
  },
  plugins: [],
}

