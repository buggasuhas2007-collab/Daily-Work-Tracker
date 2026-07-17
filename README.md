# FlowTrack

Plan · Execute · Reflect — a daily work tracker.

Data lives in `localStorage` (per browser, no account, no backend).
Use Export / Import in the sidebar to back up or move devices.

## Run locally

```bash
npm install
npm run dev
```

## Deploy

**Vercel**
```bash
npm i -g vercel
vercel --prod
```

**Netlify**
```bash
npm run build
npx netlify-cli deploy --prod --dir=dist
```

**GitHub Pages** — add `base: "/<repo-name>/"` to `vite.config.js`, then push `dist/`.

Framework auto-detects as Vite. Build: `npm run build`. Output: `dist`.
