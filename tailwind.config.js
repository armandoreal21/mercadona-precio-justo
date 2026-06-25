/** @type {import('tailwindcss').Config} */
module.exports = {
 content: [
 './src/**/*.{html,ts}',
 ],
 theme: {
 extend: {
 colors: {
 accent: {
 teal: '#06b6d4',
 indigo: '#6366f1'
 }
 },
 keyframes: {
 'fade-in-up': {
 '0%': { opacity: '0', transform: 'translateY(8px)' },
 '100%': { opacity: '1', transform: 'translateY(0)' },
 },
 'confetti-drop': {
 '0%': { transform: 'translateY(-20vh) rotate(0deg)', opacity: '1' },
 '100%': { transform: 'translateY(120vh) rotate(360deg)', opacity: '0.85' },
 }
 },
 animation: {
 'fade-in-up': 'fade-in-up 420ms cubic-bezier(.2,.9,.2,1) both',
 'confetti-drop': 'confetti-drop 2200ms linear both'
 }
 },
 },
 plugins: [],
}
