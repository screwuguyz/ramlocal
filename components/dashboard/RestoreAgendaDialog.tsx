import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/stores/useAppStore"; // Adjust import path
import { Upload, RefreshCw, AlertTriangle, FileJson } from "lucide-react";

export default function RestoreAgendaDialog() {
    const [isOpen, setIsOpen] = useState(false);
    const [oldData, setOldData] = useState<string | null>(null);
    const { setAgendaNotes } = useAppStore();

    useEffect(() => {
        // Check for old data automatically
        const v2 = localStorage.getItem("ram-agenda-notes-v2");
        const v1 = localStorage.getItem("ram-agenda-notes");
        if (v2 && v2 !== "{}") setOldData(v2);
        else if (v1 && v1 !== "{}") setOldData(v1);
    }, []);

    const handleRestoreOld = () => {
        if (!oldData) return;
        try {
            const parsed = JSON.parse(oldData);
            setAgendaNotes(parsed);
            alert("Eski veriler başarıyla yüklendi! Sayfa yenileniyor...");
            window.location.reload();
        } catch (e) {
            alert("Veri kurtarma hatası: " + e);
        }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const json = JSON.parse(event.target?.result as string);
                // Check if it's a full backup or just notes
                let notes = json;
                if (json.state_snapshot && json.state_snapshot.agendaNotes) {
                    notes = json.state_snapshot.agendaNotes;
                } else if (json.agendaNotes) {
                    notes = json.agendaNotes;
                }

                // Basic validation
                if (typeof notes === 'object') {
                    setAgendaNotes(notes);
                    alert("Yedekten veriler yüklendi! Sayfa yenileniyor...");
                    window.location.reload();
                } else {
                    alert("Bu dosyada ajanda notu bulunamadı.");
                }
            } catch (err) {
                alert("Dosya okunamadı: " + err);
            }
        };
        reader.readAsText(file);
    };

    if (!isOpen) {
        return (
            <div className="fixed bottom-4 left-4 z-50">
                <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setIsOpen(true)}
                    className="shadow-lg animate-pulse"
                >
                    <AlertTriangle className="w-4 h-4 mr-2" />
                    Veri Kurtarma / Eski Notlarım Nerede?
                </Button>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 space-y-6">
                <div className="text-center">
                    <h2 className="text-2xl font-bold text-slate-800">Veri Kurtarma Merkezi</h2>
                    <p className="text-slate-500 mt-2">
                        Silindiğini düşündüğünüz notları buradan kurtarmayı deneyebilirsiniz.
                    </p>
                </div>

                <div className="space-y-4">
                    {/* Option 1: Local Storage Recovery */}
                    <div className={`p-4 rounded-lg border-2 ${oldData ? "border-green-200 bg-green-50" : "border-slate-100 bg-slate-50"}`}>
                        <div className="flex items-center gap-3 mb-2">
                            <RefreshCw className={`w-5 h-5 ${oldData ? "text-green-600" : "text-slate-400"}`} />
                            <h3 className="font-bold text-slate-700">1. Otomatik Kurtarma</h3>
                        </div>
                        {oldData ? (
                            <div>
                                <p className="text-sm text-green-700 mb-3">
                                    Cihazınızda eski tarihli not kayıtları bulundu!
                                </p>
                                <Button onClick={handleRestoreOld} className="w-full bg-green-600 hover:bg-green-700 text-white">
                                    Bu Kayıtları Geri Yükle
                                </Button>
                            </div>
                        ) : (
                            <p className="text-sm text-slate-500">
                                Cihaz hafızasında eski kayıt bulunamadı.
                            </p>
                        )}
                    </div>

                    {/* Option 2: Backup File */}
                    <div className="p-4 rounded-lg border-2 border-indigo-100 bg-indigo-50">
                        <div className="flex items-center gap-3 mb-2">
                            <Upload className="w-5 h-5 text-indigo-600" />
                            <h3 className="font-bold text-slate-700">2. Yedekten Yükle</h3>
                        </div>
                        <p className="text-sm text-slate-600 mb-3">
                            Eğer elinizde <code>.json</code> uzantılı bir yedek dosyası varsa (masaüstündeki <code>data/backups</code> klasörüne bakın), buradan yükleyebilirsiniz.
                        </p>
                        <label className="block">
                            <span className="sr-only">Dosya Seç</span>
                            <div className="relative">
                                <input
                                    type="file"
                                    accept=".json"
                                    onChange={handleFileUpload}
                                    className="block w-full text-sm text-slate-500
                                      file:mr-4 file:py-2 file:px-4
                                      file:rounded-full file:border-0
                                      file:text-xs file:font-semibold
                                      file:bg-indigo-100 file:text-indigo-700
                                      hover:file:bg-indigo-200 cursor-pointer
                                    "
                                />
                            </div>
                        </label>
                    </div>
                </div>

                <div className="flex justify-between pt-4 border-t border-slate-100">
                    <Button
                        variant="ghost"
                        onClick={() => window.location.reload()}
                        title="Sayfayı tamamen yeniler"
                    >
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Sayfayı Yenile
                    </Button>
                    <Button variant="outline" onClick={() => setIsOpen(false)}>
                        Vazgeç / Kapat
                    </Button>
                </div>
            </div>
        </div>
    );
}
