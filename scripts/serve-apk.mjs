import http from 'http';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Find the APK file
const apkCandidates = [
  path.join(rootDir, 'android/app/build/outputs/apk/release/app-release.apk'),
  path.join(rootDir, 'public/kult-konnect.apk'),
  path.join(rootDir, 'dist/kult-konnect.apk'),
];

let apkPath = null;
for (const cand of apkCandidates) {
  if (fs.existsSync(cand)) {
    apkPath = cand;
    break;
  }
}

if (!apkPath) {
  console.error('❌ Could not locate release APK. Please run "JAVA_HOME=... ./gradlew assembleRelease" first.');
  process.exit(1);
}

const apkStats = fs.statSync(apkPath);
const apkSizeMb = (apkStats.size / (1024 * 1024)).toFixed(2);

// Detect LAN IP
const nets = os.networkInterfaces();
let lanIp = '127.0.0.1';
for (const name of Object.keys(nets)) {
  for (const net of nets[name] || []) {
    if (net.family === 'IPv4' && !net.internal) {
      lanIp = net.address;
      break;
    }
  }
}

const PORT = parseInt(process.env.PORT || '8080', 10);
const HOST = '0.0.0.0';

const downloadUrl = `http://${lanIp}:${PORT}/kult-konnect.apk`;
const pageUrl = `http://${lanIp}:${PORT}/`;

const htmlPage = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Download Kult Konnect APK</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: #020617;
      color: #f8fafc;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 1.5rem;
    }
    .card {
      max-width: 440px;
      width: 100%;
      background: #0f172a;
      border: 1px solid #1e293b;
      border-radius: 1.5rem;
      padding: 2rem;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
      text-align: center;
    }
    .logo-badge {
      width: 64px;
      height: 64px;
      margin: 0 auto 1.25rem;
      background: linear-gradient(135deg, #0ea5e9, #0284c7);
      border-radius: 1.25rem;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 10px 25px -5px rgba(14, 165, 233, 0.4);
    }
    .logo-badge svg {
      width: 34px;
      height: 34px;
      color: white;
    }
    h1 {
      font-size: 1.5rem;
      font-weight: 700;
      color: #ffffff;
      margin-bottom: 0.25rem;
    }
    .subtitle {
      font-size: 0.875rem;
      color: #94a3b8;
      margin-bottom: 1.5rem;
    }
    .btn-download {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.6rem;
      width: 100%;
      background: linear-gradient(135deg, #0ea5e9, #0284c7);
      color: white;
      text-decoration: none;
      font-weight: 600;
      font-size: 1rem;
      padding: 0.9rem 1.25rem;
      border-radius: 1rem;
      box-shadow: 0 10px 25px -5px rgba(14, 165, 233, 0.5);
      transition: all 0.2s ease;
      cursor: pointer;
      border: none;
    }
    .btn-download:hover {
      background: linear-gradient(135deg, #0284c7, #0369a1);
      transform: translateY(-1px);
    }
    .file-meta {
      display: flex;
      justify-content: space-between;
      background: #1e293b;
      border-radius: 0.75rem;
      padding: 0.6rem 1rem;
      font-size: 0.75rem;
      color: #94a3b8;
      margin-top: 1rem;
      margin-bottom: 1.5rem;
    }
    .file-meta span strong {
      color: #e2e8f0;
    }
    .qr-container {
      background: #ffffff;
      padding: 12px;
      border-radius: 1rem;
      display: inline-block;
      margin-bottom: 1.25rem;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    }
    .qr-container img {
      display: block;
      width: 180px;
      height: 180px;
    }
    .steps {
      text-align: left;
      background: #090d16;
      border: 1px solid #1e293b;
      border-radius: 1rem;
      padding: 1rem 1.25rem;
      font-size: 0.8rem;
      color: #94a3b8;
      line-height: 1.5;
    }
    .steps h3 {
      font-size: 0.85rem;
      color: #f1f5f9;
      margin-bottom: 0.5rem;
      display: flex;
      align-items: center;
      gap: 0.4rem;
    }
    .steps ol {
      padding-left: 1.2rem;
    }
    .steps li {
      margin-bottom: 0.35rem;
    }
    .footer {
      margin-top: 1.25rem;
      font-size: 0.75rem;
      color: #64748b;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo-badge">
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
      </svg>
    </div>

    <h1>Kult Konnect</h1>
    <p class="subtitle">Cult Smart Scale Pro Companion App</p>

    <!-- Scan to download on phone -->
    <div class="qr-container">
      <img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(downloadUrl)}" alt="Scan QR Code to download" onerror="this.parentElement.style.display='none'" />
    </div>

    <a href="/kult-konnect.apk" download="kult-konnect.apk" class="btn-download">
      <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
      </svg>
      Download Production APK
    </a>

    <div class="file-meta">
      <span>File: <strong>kult-konnect.apk</strong></span>
      <span>Size: <strong>${apkSizeMb} MB</strong></span>
      <span>Build: <strong>Release</strong></span>
    </div>

    <div class="steps">
      <h3>
        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Installation Instructions:
      </h3>
      <ol>
        <li>Scan the QR code or tap <strong>Download Production APK</strong>.</li>
        <li>If Android displays <em>"File might be harmful"</em>, tap <strong>Download anyway</strong>.</li>
        <li>Open the completed download and tap <strong>Install</strong> (enable "Install unknown apps" for browser if prompted).</li>
        <li>Open <strong>Kult Konnect</strong>, grant Bluetooth permissions, and step on your scale!</li>
      </ol>
    </div>

    <div class="footer">
      Serving over LAN: ${pageUrl}
    </div>
  </div>
</body>
</html>
`;

const server = http.createServer((req, res) => {
  const urlPath = req.url?.split('?')[0];

  if (urlPath === '/' || urlPath === '/index.html') {
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Length': Buffer.byteLength(htmlPage),
    });
    res.end(htmlPage);
    return;
  }

  if (urlPath === '/kult-konnect.apk' || urlPath === '/app-release.apk') {
    const stat = fs.statSync(apkPath);
    res.writeHead(200, {
      'Content-Type': 'application/vnd.android.package-archive',
      'Content-Disposition': 'attachment; filename="kult-konnect.apk"',
      'Content-Length': stat.size,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'no-cache',
    });
    const readStream = fs.createReadStream(apkPath);
    readStream.pipe(res);
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
});

server.listen(PORT, HOST, () => {
  console.log(`\n======================================================`);
  console.log(`🚀 Kult Konnect APK HTTP Server is live!`);
  console.log(`------------------------------------------------------`);
  console.log(`📱 Download Portal:  http://${lanIp}:${PORT}/`);
  console.log(`📦 Direct APK URL:   http://${lanIp}:${PORT}/kult-konnect.apk`);
  console.log(`💻 Local Machine:    http://localhost:${PORT}/`);
  console.log(`======================================================\n`);
});
