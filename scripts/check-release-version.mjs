import { readFile } from 'node:fs/promises';

const packageFiles = [
  'packages/core/package.json',
  'packages/browser/package.json',
  'packages/vite/package.json',
];

const tag = process.argv[2];
if (!tag) {
  throw new Error('Pass the GitHub release tag as the first argument.');
}

const packages = await Promise.all(
  packageFiles.map(async file => JSON.parse(await readFile(file, 'utf8'))),
);
const versions = new Set(packages.map(pkg => pkg.version));

if (versions.size !== 1) {
  throw new Error(
    `Published package versions must match: ${packages.map(pkg => `${pkg.name}@${pkg.version}`).join(', ')}`,
  );
}

const [version] = versions;
if (tag !== `v${version}`) {
  throw new Error(`Release tag ${tag} does not match package version v${version}.`);
}

console.log(`Release tag ${tag} matches all published packages.`);
