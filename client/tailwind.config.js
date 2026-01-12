/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#a68341",
        "background-light": "#f8fafc",
        "background-dark": "#1a1c1e",
        "card-dark": "#2d2f31",
        "sidebar-dark": "#262b31",
      },
      fontFamily: {
        display: ["Playfair Display", "serif"],
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      borderRadius: {
        DEFAULT: "0.5rem",
      },
    },
  },
  plugins: [],
}
