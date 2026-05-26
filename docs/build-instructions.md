# KernelWallet Build Instructions

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run build` | Production build |
| `npm run dev` | Development with watch |
| `npm test` | Run test suite |
| `npm run lint` | ESLint check |
| `npm run clean` | Remove dist/ |

## Build Process

1. Webpack bundles JS modules
2. CSS extracted and minified
3. Static files copied to dist/
4. Manifest validated

## Production Build

```bash
npm run build
