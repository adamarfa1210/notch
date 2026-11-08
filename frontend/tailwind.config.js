/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        notch: {
          dark: "#0B0F19",
          slot: "#1E293B",
          accent: "#38BDF8",
        },
      },
    },
  },
  plugins: [],
};
