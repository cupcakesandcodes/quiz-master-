/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                background: "#0c1222",
                surface: "#162032",
                primary: "#0ea5e9",    // Sky 500 — clean, professional blue
                secondary: "#06b6d4",  // Cyan 500
                accent: "#14b8a6",     // Teal 500
                danger: "#f43f5e",     // Rose 500
            },
            animation: {
                'fade-in': 'fadeIn 0.5s ease-out',
                'bounce-slow': 'bounce 3s infinite',
                'pulse-fast': 'pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
            },
            keyframes: {
                fadeIn: {
                    '0%': { opacity: '0', transform: 'translateY(10px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                }
            }
        },
    },
    plugins: [],
}
