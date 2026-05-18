/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['Verdana', 'Geneva', 'Tahoma', 'sans-serif'] },
      colors: {
        google: {
          blue: '#4285F4',
          red: '#EA4335',
          yellow: '#FBBC04',
          green: '#34A853',
          lightBlue: '#e8f0fe',
          lightYellow: '#fef9e7',
          lightGreen: '#e6f4ea',
        },
        meta: {
          blue: '#0082FB',
          darkBlue: '#0064D2',
          lightBlue: '#e8f4ff',
          oceanBlue: '#006AFF',
        },
      },
    },
  },
  plugins: [],
};
