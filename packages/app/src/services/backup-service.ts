import { flushAllWrites } from "@/lib/tauri-storage";
import { invoke } from "@tauri-apps/api/core";
import { join, tempDir } from "@tauri-apps/api/path";
import { open, save } from "@tauri-apps/plugin-dialog";
import { readFile, remove, writeFile } from "@tauri-apps/plugin-fs";

export type BackupImportMode = "merge" | "overwrite";

export interface SkippedBook {
  id: string;
  title: string;
  reason: string;
}

export interface BackupManifest {
  schemaVersion: number;
  createdAt: number;
  skippedBooks: SkippedBook[];
  containsSensitiveData: boolean;
  encrypted: boolean;
}

export interface BackupExportResult {
  archivePath: string;
  fileName: string;
  manifest: BackupManifest;
}

export interface BackupImportResult {
  mode: BackupImportMode;
  importedBooks: number;
  importedRows: number;
  restoredConfigFiles: number;
  localStorageItems: BackupLocalStorageItem[];
}

interface BackupLocalStorageItem {
  key: string;
  value: string;
}

const backupFilters = [
  {
    name: "SageRead Backup",
    extensions: ["zip"],
  },
];

export async function exportBackup(): Promise<BackupExportResult | null> {
  await flushAllWrites();

  const result = await invoke<BackupExportResult>("create_backup_archive", {
    localStorageItems: collectBackupLocalStorageItems(),
  });
  const targetPath = await save({
    defaultPath: result.fileName,
    filters: backupFilters,
  });

  if (!targetPath) {
    await cleanupTempFile(result.archivePath);
    return null;
  }

  const bytes = await readFile(result.archivePath);
  await writeFile(targetPath, bytes);
  await cleanupTempFile(result.archivePath);
  return result;
}

export async function importBackup(mode: BackupImportMode): Promise<BackupImportResult | null> {
  const selectedPath = await open({
    multiple: false,
    filters: backupFilters,
  });

  if (!selectedPath || Array.isArray(selectedPath)) {
    return null;
  }

  const bytes = await readFile(selectedPath);
  const tempPath = await join(await tempDir(), `sageread-import-${Date.now()}.zip`);
  await writeFile(tempPath, bytes);

  try {
    const result = await invoke<BackupImportResult>("import_backup_archive", {
      archivePath: tempPath,
      mode,
    });
    if (mode === "overwrite") {
      restoreBackupLocalStorageItems(result.localStorageItems);
    }
    return result;
  } finally {
    await cleanupTempFile(tempPath);
  }
}

function collectBackupLocalStorageItems(): BackupLocalStorageItem[] {
  if (typeof window === "undefined") {
    return [];
  }

  return ["tts-config-storage"]
    .map((key) => {
      const value = window.localStorage.getItem(key);
      return value ? { key, value } : null;
    })
    .filter((item): item is BackupLocalStorageItem => item !== null);
}

function restoreBackupLocalStorageItems(items: BackupLocalStorageItem[]) {
  if (typeof window === "undefined") {
    return;
  }

  for (const item of items) {
    window.localStorage.setItem(item.key, item.value);
  }
}

async function cleanupTempFile(path: string) {
  try {
    await remove(path);
  } catch {
    // Best-effort cleanup only.
  }
}
