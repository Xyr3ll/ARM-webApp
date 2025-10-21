# ARM Admin Dashboard

Academic Resource Management System - Admin Dashboard

## Project Structure

```
admin-dashboard/
├── public/              # Static assets
│   └── background.jpg   # Login page background image
├── src/
│   ├── assets/         # Images, icons, fonts
│   ├── components/     # Reusable components
│   ├── pages/          # Page components
│   │   └── LoginPage.jsx
│   ├── styles/         # CSS files
│   │   └── LoginPage.css
│   ├── App.jsx         # Main app component
│   ├── App.css         # App styles
│   ├── main.jsx        # Entry point
│   └── index.css       # Global styles
├── package.json
└── vite.config.js
```

## Getting Started

1. Install dependencies:
```bash
npm install
```

2. Add your background image to the `public` folder as `background.jpg`

3. Start development server:
```bash
npm run dev
```

4. Build for production:
```bash
npm run build
```

## Features

- 🔐 Login page with glassmorphic design
- 📱 Responsive layout
- 🎨 Modern UI with smooth animations

## Technologies

- React 19
- Vite 7
- CSS3

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
