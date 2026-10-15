import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { ZipArchive } = require('archiver');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

async function createOtaBundle() {
  const pkgPath = path.join(rootDir, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const version = pkg.version || '0.1.0';

  const distDir = path.join(rootDir, 'dist');
  if (!fs.existsSync(distDir)) {
    console.error('[OTA Bundle] Error: dist directory does not exist. Run vite build first.');
    process.exit(1);
  }

  const updatesDir = path.join(distDir, 'updates');
  fs.mkdirSync(updatesDir, { recursive: true });

  const zipPath = path.join(updatesDir, 'bundle.zip');
  const output = fs.createWriteStream(zipPath);
  const archive = new ZipArchive({ zlib: { level: 9 } });

  console.log(`[OTA Bundle] Zipping dist/ for OTA update v${version}...`);

  await new Promise((resolve, reject) => {
    output.on('close', () => {
      console.log(`[OTA Bundle] Created bundle.zip (${(archive.pointer() / 1024 / 1024).toFixed(2)} MB)`);
      resolve(null);
    });
    archive.on('error', (err) => reject(err));

    archive.pipe(output);

    // Archive all dist files except updates/ and any .apk files
    archive.glob('**/*', {
      cwd: distDir,
      ignore: ['updates/**', '*.apk'],
    });

    archive.finalize();
  });

  // Auto-detect production URL from Vercel system environment variables if available
  const vercelDomain = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  const baseUrl = process.env.VITE_PUBLIC_URL || (vercelDomain ? `https://${vercelDomain}` : '');
  const bundleUrl = baseUrl ? `${baseUrl}/updates/bundle.zip` : '/updates/bundle.zip';

  // Create version.json
  const versionInfo = {
    version: version,
    url: bundleUrl,
    releaseDate: new Date().toISOString(),
  };

  const versionJsonPath = path.join(updatesDir, 'version.json');
  fs.writeFileSync(versionJsonPath, JSON.stringify(versionInfo, null, 2), 'utf8');
  console.log(`[OTA Bundle] Generated version.json for version ${version}`);

  // Also copy to public/updates so it exists during dev / test
  const publicUpdatesDir = path.join(rootDir, 'public', 'updates');
  fs.mkdirSync(publicUpdatesDir, { recursive: true });
  fs.writeFileSync(path.join(publicUpdatesDir, 'version.json'), JSON.stringify(versionInfo, null, 2), 'utf8');
  if (fs.existsSync(zipPath)) {
    fs.copyFileSync(zipPath, path.join(publicUpdatesDir, 'bundle.zip'));
  }

  console.log('[OTA Bundle] Complete! Ready for Vercel deployment.');
}

createOtaBundle().catch((err) => {
  console.error('[OTA Bundle] Failed to package OTA update:', err);
  process.exit(1);
});
