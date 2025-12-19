"use client";
import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Backup = {
  id: string;
  created_at: string;
  backup_type: "manual" | "auto";
  description?: string;
};

type Props = {
  currentState: any;
  onRestore: (state: any) => void;
};

export default function BackupManager({ currentState, onRestore }: Props) {
  const [backups, setBackups] = useState<Backup[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [tableWarning, setTableWarning] = useState<string | null>(null);

  const fetchBackups = useCallback(async () => {
    try {
      const res = await fetch("/api/backup");
      const data = await res.json();
      if (data.warning) {
        setTableWarning(data.warning);
        setBackups([]);
      } else {
        setTableWarning(null);
        setBackups(data.backups || []);
      }
    } catch (err) {
      console.error("Yedekler yüklenemedi", err);
    }
  }, []);

  useEffect(() => {
    fetchBackups();
  }, [fetchBackups]);

  const createBackup = async (type: "manual" | "auto" = "manual") => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          state: currentState,
          backupType: type,
          description: type === "manual" ? "Manuel yedek" : "Otomatik yedek",
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setMessage({ type: "success", text: "✅ Yedek oluşturuldu!" });
        fetchBackups();
      } else {
        setMessage({ type: "error", text: data.error || "Yedek oluşturulamadı" });
      }
    } catch (err) {
      setMessage({ type: "error", text: "Bağlantı hatası" });
    } finally {
      setLoading(false);
    }
  };

  const restoreBackup = async (backupId: string) => {
    if (!confirm("Bu yedeği geri yüklemek istediğinize emin misiniz? Mevcut veriler değiştirilecek.")) {
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/backup", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ backupId }),
      });
      const data = await res.json();
      if (data.ok) {
        setMessage({ type: "success", text: "✅ Yedek geri yüklendi! Sayfa yenileniyor..." });
        onRestore(data.state);
        setTimeout(() => window.location.reload(), 1500);
      } else {
        setMessage({ type: "error", text: data.error || "Geri yükleme başarısız" });
      }
    } catch (err) {
      setMessage({ type: "error", text: "Bağlantı hatası" });
    } finally {
      setLoading(false);
    }
  };

  const deleteBackup = async (backupId: string) => {
    if (!confirm("Bu yedeği silmek istediğinize emin misiniz?")) {
      return;
    }
    try {
      const res = await fetch(`/api/backup?id=${backupId}`, { method: "DELETE" });
      const data = await res.json();
      if (data.ok) {
        fetchBackups();
      }
    } catch (err) {
      console.error("Silme hatası", err);
    }
  };

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleString("tr-TR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">💾 Yedekleme Yönetimi</CardTitle>
        <Button onClick={() => createBackup("manual")} disabled={loading}>
          {loading ? "İşleniyor..." : "➕ Yeni Yedek Al"}
        </Button>
      </CardHeader>
      <CardContent>
        {message && (
          <div className={`mb-4 p-3 rounded-md ${message.type === "success" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
            {message.text}
          </div>
        )}

        {tableWarning && (
          <div className="mb-4 p-4 rounded-md bg-amber-50 border border-amber-200">
            <div className="font-medium text-amber-800 mb-2">⚠️ Yedekleme Tablosu Bulunamadı</div>
            <p className="text-sm text-amber-700 mb-3">
              Supabase dashboard'dan aşağıdaki SQL ile tablo oluşturun:
            </p>
            <pre className="text-xs bg-slate-800 text-green-400 p-3 rounded overflow-x-auto">
{`CREATE TABLE app_backups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  backup_type TEXT DEFAULT 'manual',
  state_snapshot JSONB,
  description TEXT
);`}
            </pre>
          </div>
        )}

        {!tableWarning && backups.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <div className="text-4xl mb-2">📦</div>
            <div>Henüz yedek yok</div>
            <div className="text-sm mt-1">İlk yedeğinizi alın!</div>
          </div>
        ) : (
          <div className="space-y-2">
            {backups.map((backup) => (
              <div
                key={backup.id}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${backup.backup_type === "auto" ? "bg-blue-500" : "bg-green-500"}`} />
                  <div>
                    <div className="font-medium text-sm">
                      {formatDate(backup.created_at)}
                    </div>
                    <div className="text-xs text-slate-500">
                      {backup.backup_type === "auto" ? "🔄 Otomatik" : "👆 Manuel"}
                      {backup.description && ` • ${backup.description}`}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => restoreBackup(backup.id)}
                    disabled={loading}
                  >
                    ↩️ Geri Yükle
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => deleteBackup(backup.id)}
                    disabled={loading}
                  >
                    🗑️
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 p-3 bg-slate-50 rounded-md text-xs text-slate-600">
          <strong>💡 Bilgi:</strong> Yedekler 30 gün boyunca saklanır. Eski yedekler otomatik silinir.
        </div>
      </CardContent>
    </Card>
  );
}




