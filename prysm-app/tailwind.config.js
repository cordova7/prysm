/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Steve Jobs-Inspired Minimalist Color System
        // Only 8 colors - every color serves a purpose
        'black': '#000000',
        'white': '#FFFFFF',
        'blue-500': '#3B82F6',
        'gray-700': '#374151',
        'gray-400': '#9CA3AF',
        'green-500': '#10B981',
        'red-500': '#EF4444',
        'yellow-500': '#EAB308',
      },
      zIndex: {
        'dropdown': '100',
        'popup': '200',
        'modal-backdrop': '300',
        'modal': '400',
        'tooltip': '500',
      },
    },
  },
  plugins: [],
}