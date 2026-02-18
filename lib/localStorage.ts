// ============================================
// Local Storage Utilities for LOCAL_MODE
// ============================================

import { promises as fs } from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
const STATE_FILE = path.join(DATA_DIR, "state.json");
const PDF_DIR = path.join(DATA_DIR, "pdf");
const BACKUP_DIR = path.join(DATA_DIR, "backups");

// Ensure directories exist
async function ensureDir(dir: string): Promise<void> {
    try {
        await fs.mkdir(dir, { recursive: true });
    } catch (err: any) {
        if (err.code !== "EEXIST") throw err;
    }
}

// Initialize data directories
export async function initDataDirs(): Promise<void> {
    await ensureDir(DATA_DIR);
    await ensureDir(PDF_DIR);
    await ensureDir(BACKUP_DIR);
}

// ============================================
// State (app_state equivalent)
// ============================================

export async function readState<T>(): Promise<T | null> {
    try {
        await ensureDir(DATA_DIR);
        const data = await fs.readFile(STATE_FILE, "utf-8");
        return JSON.parse(data) as T;
    } catch (err: any) {
        if (err.code === "ENOENT") return null;
        console.error("[localStorage] Read state error:", err);
        return null;
    }
}

export async function writeState<T>(state: T): Promise<boolean> {
    try {
        await ensureDir(DATA_DIR);
        await fs.writeFile(STATE_FILE, JSON.stringify(state, null, 2), "utf-8");
        return true;
    } catch (err) {
        console.error("[localStorage] Write state error:", err);
        return false;
    }
}

// ============================================
// PDF Appointments (ram_pdf_appointments equivalent)
// ============================================

export async function readPdfByDate(dateIso: string): Promise<any[] | null> {
    try {
        await ensureDir(PDF_DIR);
        const filePath = path.join(PDF_DIR, `${dateIso}.json`);
        const data = await fs.readFile(filePath, "utf-8");
        return JSON.parse(data);
    } catch (err: any) {
        if (err.code === "ENOENT") return null;
        console.error("[localStorage] Read PDF error:", err);
        return null;
    }
}

export async function writePdfByDate(dateIso: string, entries: any[]): Promise<boolean> {
    try {
        await ensureDir(PDF_DIR);
        const filePath = path.join(PDF_DIR, `${dateIso}.json`);
        await fs.writeFile(filePath, JSON.stringify(entries, null, 2), "utf-8");
        return true;
    } catch (err) {
        console.error("[localStorage] Write PDF error:", err);
        return false;
    }
}

export async function deletePdfByDate(dateIso: string): Promise<boolean> {
    try {
        const filePath = path.join(PDF_DIR, `${dateIso}.json`);
        await fs.unlink(filePath);
        return true;
    } catch (err: any) {
        if (err.code === "ENOENT") return true; // Already deleted
        console.error("[localStorage] Delete PDF error:", err);
        return false;
    }
}

export async function getLatestPdfDate(): Promise<string | null> {
    try {
        await ensureDir(PDF_DIR);
        const files = await fs.readdir(PDF_DIR);
        const jsonFiles = files.filter(f => f.endsWith(".json")).sort().reverse();
        if (jsonFiles.length === 0) return null;
        return jsonFiles[0].replace(".json", "");
    } catch (err) {
        console.error("[localStorage] Get latest PDF error:", err);
        return null;
    }
}

// ============================================
// Backups (app_backups equivalent)
// ============================================

export type LocalBackup = {
    id: string;
    created_at: string;
    backup_type: "manual" | "auto";
    description?: string;
    state_snapshot?: any;
};

export async function listBackups(): Promise<LocalBackup[]> {
    try {
        await ensureDir(BACKUP_DIR);
        const files = await fs.readdir(BACKUP_DIR);
        const backups: LocalBackup[] = [];

        for (const file of files.filter(f => f.endsWith(".json")).sort().reverse()) {
            try {
                const filePath = path.join(BACKUP_DIR, file);
                const data = await fs.readFile(filePath, "utf-8");
                const backup = JSON.parse(data) as LocalBackup;
                // Don't include full state in list
                backups.push({
                    id: backup.id,
                    created_at: backup.created_at,
                    backup_type: backup.backup_type,
                    description: backup.description,
                });
            } catch { }
        }

        return backups.slice(0, 50); // Max 50
    } catch (err) {
        console.error("[localStorage] List backups error:", err);
        return [];
    }
}

export async function createBackup(backup: LocalBackup): Promise<boolean> {
    try {
        await ensureDir(BACKUP_DIR);
        const fileName = `${backup.created_at.replace(/[:.]/g, "-")}_${backup.id}.json`;
        const filePath = path.join(BACKUP_DIR, fileName);
        await fs.writeFile(filePath, JSON.stringify(backup, null, 2), "utf-8");

        // YENİ: Sadece son yedeği sakla, diğerlerini sil.
        await cleanAllOtherBackups(backup.id);

        return true;
    } catch (err) {
        console.error("[localStorage] Create backup error:", err);
        return false;
    }
}

export async function getBackupById(backupId: string): Promise<LocalBackup | null> {
    try {
        await ensureDir(BACKUP_DIR);
        const files = await fs.readdir(BACKUP_DIR);
        const matchingFile = files.find(f => f.includes(backupId));
        if (!matchingFile) return null;

        const filePath = path.join(BACKUP_DIR, matchingFile);
        const data = await fs.readFile(filePath, "utf-8");
        return JSON.parse(data) as LocalBackup;
    } catch (err) {
        console.error("[localStorage] Get backup error:", err);
        return null;
    }
}

export async function deleteBackupById(backupId: string): Promise<boolean> {
    try {
        await ensureDir(BACKUP_DIR);
        const files = await fs.readdir(BACKUP_DIR);
        const matchingFile = files.find(f => f.includes(backupId));
        if (!matchingFile) return false;

        await fs.unlink(path.join(BACKUP_DIR, matchingFile));
        return true;
    } catch (err) {
        console.error("[localStorage] Delete backup error:", err);
        return false;
    }
}

async function cleanAllOtherBackups(currentBackupId: string): Promise<void> {
    try {
        const files = await fs.readdir(BACKUP_DIR);

        for (const file of files.filter(f => f.endsWith(".json"))) {
            // Eğer dosya ismi şu anki backup ID'sini içermiyorsa sil
            if (!file.includes(currentBackupId)) {
                try {
                    const filePath = path.join(BACKUP_DIR, file);
                    await fs.unlink(filePath);
                    console.log(`[localStorage] Old backup cleaned: ${file}`);
                } catch (e) {
                    console.error(`[localStorage] Failed to delete ${file}`, e);
                }
            }
        }
    } catch (err) {
        console.error("[localStorage] Clean backups error:", err);
    }
}

// ============================================
// Helper: Check if LOCAL_MODE is enabled
// ============================================

export function isLocalMode(): boolean {
    return process.env.LOCAL_MODE === "true" || process.env.LOCAL_MODE === "1";
}
