/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        warlocksBlue: "#1e3a8a",
        warlocksGold: "#facc15"
      }
    }
  },
  plugins: [require("@tailwindcss/forms")]
};
