import { exportAllData, importBackupData } from '../storage/db';
import { DriveBackupPayload } from '@/types';

/**
 * Triggers a browser/device download of the entire database as a JSON backup file
 */
export async function downloadLocalBackupFile(): Promise<void> {
  const data = await exportAllData();
  const jsonStr = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const dateStr = new Date().toISOString().slice(0, 10);
  const fileName = `kult-konnect-backup-${dateStr}.json`;

  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Parses and restores a JSON backup file from an <input type="file"> event
 */
export async function restoreFromFile(file: File): Promise<{ profilesAdded: number; measurementsAdded: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        const payload: DriveBackupPayload = JSON.parse(text);
        const result = await importBackupData(payload);
        resolve(result);
      } catch (err) {
        reject(new Error('Failed to parse backup file. Please ensure it is a valid Kult Konnect JSON backup.'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

/**
 * Uploads backup payload to Google Drive using a user-provided OAuth2 access token
 * Uses the isolated 'drive.appdata' application folder.
 */
export async function uploadToGoogleDrive(accessToken: string): Promise<{ fileId: string }> {
  const payload = await exportAllData();
  const fileContent = JSON.stringify(payload, null, 2);

  const metadata = {
    name: 'kult_konnect_backup.json',
    parents: ['appDataFolder'],
    mimeType: 'application/json',
  };

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', new Blob([fileContent], { type: 'application/json' }));

  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: form,
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Google Drive upload failed (${res.status}): ${errorText}`);
  }

  const result = await res.json();
  return { fileId: result.id };
}

/**
 * Downloads the latest backup payload from Google Drive appDataFolder
 */
export async function downloadFromGoogleDrive(accessToken: string): Promise<{ profilesAdded: number; measurementsAdded: number }> {
  // 1. Search for kult_konnect_backup.json in appDataFolder
  const searchUrl = 'https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=name=%27kult_konnect_backup.json%27&orderBy=modifiedTime%20desc&pageSize=1';
  
  const searchRes = await fetch(searchUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!searchRes.ok) {
    throw new Error('Failed to search Google Drive appDataFolder');
  }

  const searchData = await searchRes.json();
  if (!searchData.files || searchData.files.length === 0) {
    throw new Error('No Kult Konnect backup found on Google Drive');
  }

  const fileId = searchData.files[0].id;

  // 2. Download file contents
  const downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
  const fileRes = await fetch(downloadUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!fileRes.ok) {
    throw new Error('Failed to download backup file from Google Drive');
  }

  const payload: DriveBackupPayload = await fileRes.json();
  return await importBackupData(payload);
}
