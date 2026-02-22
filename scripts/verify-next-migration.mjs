import { existsSync } from 'node:fs';

const requiredForbidden = [
  'vite.config.ts',
  'index.html',
  'src/main.tsx',
  'src/App.tsx',
  'src/App.css',
  'tsconfig.app.json',
  'tsconfig.node.json',
];

const optionalForbidden = ['tailwind.config.js'];

const stillThere = requiredForbidden.filter((path) => existsSync(path));
if (stillThere.length > 0) {
  console.error('Forbidden legacy files still exist:', stillThere.join(', '));
  process.exit(1);
}

const optionalStillThere = optionalForbidden.filter((path) => existsSync(path));
if (optionalStillThere.length > 0) {
  console.warn('Optional legacy files still exist:', optionalStillThere.join(', '));
}

console.log('Migration structure check passed.');
