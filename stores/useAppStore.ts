// ============================================
// RAM Dosya Atama - Zustand Store
// ============================================

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type {
    Teacher,
    CaseFile,
    Announcement,
    PdfAppointment,
    EArchiveEntry,
    Settings,
    AbsenceRecord,
    Toast,
    AssignmentPopup,
    LiveStatus,
    QueueTicket,
} from "@/types";
import { DEFAULT_SETTINGS, LS_KEYS } from "@/lib/constants";

// ---- App State Interface
interface AppState {
    // === Teachers ===
    teachers: Teacher[];
    setTeachers: (teachers: Teacher[]) => void;
    addTeacher: (teacher: Teacher) => void;
    updateTeacher: (id: string, updates: Partial<Teacher>) => void;
    removeTeacher: (id: string) => void;

    // === Cases ===
    cases: CaseFile[];
    setCases: (cases: CaseFile[]) => void;
    addCase: (caseFile: CaseFile) => void;
    updateCase: (id: string, updates: Partial<CaseFile>) => void;
    removeCase: (id: string) => void;

    // === History ===
    history: Record<string, CaseFile[]>;
    setHistory: (history: Record<string, CaseFile[]>) => void;
    addToHistory: (date: string, cases: CaseFile[]) => void;

    // === E-Archive ===
    eArchive: EArchiveEntry[];
    setEArchive: (entries: EArchiveEntry[]) => void;
    addToEArchive: (entry: EArchiveEntry) => void;

    // === Announcements ===
    announcements: Announcement[];
    setAnnouncements: (announcements: Announcement[]) => void;
    addAnnouncement: (announcement: Announcement) => void;
    removeAnnouncement: (id: string) => void;

    // === Announcement Popup ===
    announcementPopupData: Announcement | null;
    showAnnouncementPopup: (announcement: Announcement) => void;
    hideAnnouncementPopup: () => void;

    // === PDF Entries ===
    pdfEntries: PdfAppointment[];
    setPdfEntries: (entries: PdfAppointment[]) => void;
    pdfDate: string | null;
    setPdfDate: (date: string | null) => void;
    pdfDateIso: string | null;
    setPdfDateIso: (date: string | null) => void;
    selectedPdfEntryId: string | null;
    setSelectedPdfEntryId: (id: string | null) => void;

    // === Settings ===
    settings: Settings;
    setSettings: (settings: Settings) => void;
    updateSettings: (updates: Partial<Settings>) => void;

    // === Absence Records ===
    absenceRecords: AbsenceRecord[];
    setAbsenceRecords: (records: AbsenceRecord[]) => void;

    // === Rollover State ===
    lastRollover: string;
    setLastRollover: (date: string) => void;
    lastAbsencePenalty: string;
    setLastAbsencePenalty: (date: string) => void;

    // === UI State ===
    isAdmin: boolean;
    setIsAdmin: (isAdmin: boolean) => void;
    liveStatus: LiveStatus;
    setLiveStatus: (status: LiveStatus) => void;
    soundOn: boolean;
    setSoundOn: (on: boolean) => void;
    hydrated: boolean;
    setHydrated: (hydrated: boolean) => void;

    // === Toasts ===
    toasts: Toast[];
    addToast: (text: string) => string;
    removeToast: (id: string) => void;

    // === Assignment Popup ===
    assignmentPopup: AssignmentPopup | null;
    showAssignmentPopup: (popup: AssignmentPopup) => void;
    hideAssignmentPopup: () => void;

    // === Queue System ===
    queue: QueueTicket[];
    setQueue: (queue: QueueTicket[]) => void;
    addQueueTicket: (name?: string) => void;
    callQueueTicket: (id: string, teacherId?: string) => void;
    updateQueueTicketStatus: (id: string, status: 'waiting' | 'called' | 'done') => void;
    resetQueue: () => void;

    // === Reset ===
    resetState: () => void;
}

// ---- Helper: Generate unique ID
function uid(): string {
    return Math.random().toString(36).slice(2, 9);
}

// ---- Initial State
const initialState = {
    teachers: [],
    cases: [],
    history: {},
    eArchive: [],
    announcements: [],
    announcementPopupData: null,
    pdfEntries: [],
    pdfDate: null,
    pdfDateIso: null,
    selectedPdfEntryId: null,
    settings: DEFAULT_SETTINGS,
    absenceRecords: [],
    lastRollover: "",
    lastAbsencePenalty: "",
    isAdmin: false,
    liveStatus: "connecting" as LiveStatus,
    soundOn: true,
    hydrated: false,
    toasts: [],
    assignmentPopup: null,
    queue: [],
};

// ---- Create Store
export const useAppStore = create<AppState>()(
    persist(
        (set, get) => ({
            ...initialState,

            // === Teachers ===
            setTeachers: (teachers) => set({ teachers }),
            addTeacher: (teacher) =>
                set((state) => ({ teachers: [...state.teachers, teacher] })),
            updateTeacher: (id, updates) =>
                set((state) => ({
                    teachers: state.teachers.map((t) =>
                        t.id === id ? { ...t, ...updates } : t
                    ),
                })),
            removeTeacher: (id) =>
                set((state) => ({
                    teachers: state.teachers.filter((t) => t.id !== id),
                })),

            // === Cases ===
            setCases: (cases) => set({ cases }),
            addCase: (caseFile) =>
                set((state) => ({ cases: [...state.cases, caseFile] })),
            updateCase: (id, updates) =>
                set((state) => ({
                    cases: state.cases.map((c) =>
                        c.id === id ? { ...c, ...updates } : c
                    ),
                })),
            removeCase: (id) =>
                set((state) => ({
                    cases: state.cases.filter((c) => c.id !== id),
                    eArchive: state.eArchive.filter((a) => a.id !== id)
                })),

            // === History ===
            setHistory: (history) => set({ history }),
            addToHistory: (date, cases) =>
                set((state) => ({
                    history: { ...state.history, [date]: cases },
                })),

            // === E-Archive ===
            setEArchive: (eArchive) => set({ eArchive }),
            addToEArchive: (entry) =>
                set((state) => ({ eArchive: [...state.eArchive, entry] })),

            // === Announcements ===
            setAnnouncements: (announcements) => set({ announcements }),
            addAnnouncement: (announcement) =>
                set((state) => ({
                    announcements: [...state.announcements, announcement],
                })),
            removeAnnouncement: (id) =>
                set((state) => ({
                    announcements: state.announcements.filter((a) => a.id !== id),
                })),

            // === Announcement Popup ===
            showAnnouncementPopup: (announcement) => set({ announcementPopupData: announcement }),
            hideAnnouncementPopup: () => set({ announcementPopupData: null }),

            // === PDF Entries ===
            setPdfEntries: (pdfEntries) => set({ pdfEntries }),
            setPdfDate: (pdfDate) => set({ pdfDate }),
            setPdfDateIso: (pdfDateIso) => set({ pdfDateIso }),
            setSelectedPdfEntryId: (selectedPdfEntryId) =>
                set({ selectedPdfEntryId }),

            // === Settings ===
            setSettings: (settings) => set({ settings }),
            updateSettings: (updates) =>
                set((state) => ({ settings: { ...state.settings, ...updates } })),

            // === Absence Records ===
            setAbsenceRecords: (absenceRecords) => set({ absenceRecords }),

            // === Rollover State ===
            setLastRollover: (lastRollover) => set({ lastRollover }),
            setLastAbsencePenalty: (lastAbsencePenalty) =>
                set({ lastAbsencePenalty }),

            // === UI State ===
            setIsAdmin: (isAdmin) => set({ isAdmin }),
            setLiveStatus: (liveStatus) => set({ liveStatus }),
            setSoundOn: (soundOn) => set({ soundOn }),
            setHydrated: (hydrated) => set({ hydrated }),

            // === Toasts ===
            addToast: (text) => {
                const id = uid();
                set((state) => ({ toasts: [...state.toasts, { id, text }] }));
                // Auto-remove after 2.5 seconds
                setTimeout(() => {
                    set((state) => ({
                        toasts: state.toasts.filter((t) => t.id !== id),
                    }));
                }, 2500);
                return id;
            },
            removeToast: (id) =>
                set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),

            // === Assignment Popup ===
            showAssignmentPopup: (popup) => {
                set({ assignmentPopup: popup });
                // Auto-hide after 3 seconds
                setTimeout(() => {
                    set({ assignmentPopup: null });
                }, 3000);
            },
            hideAssignmentPopup: () => set({ assignmentPopup: null }),

            // === Queue System ===
            setQueue: (queue) => set({ queue }),
            addQueueTicket: (name) => set((state) => {
                const maxNo = state.queue.length > 0 ? Math.max(...state.queue.map(t => t.no)) : 0;
                // Eğer gün dönümü olduysa 0'dan başla (Veya manuel resetQueue ile yapılır)
                // Şimdilik sadece max+1.
                const newTicket: QueueTicket = {
                    id: uid(),
                    no: maxNo + 1,
                    name,
                    status: 'waiting',
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                };
                return { queue: [...state.queue, newTicket] };
            }),
            callQueueTicket: (id, teacherId) => set((state) => ({
                queue: state.queue.map(t => t.id === id ? { ...t, status: 'called', calledBy: teacherId, updatedAt: new Date().toISOString() } : t)
            })),
            updateQueueTicketStatus: (id, status) => set((state) => ({
                queue: state.queue.map(t => t.id === id ? { ...t, status, updatedAt: new Date().toISOString() } : t)
            })),
            resetQueue: () => set({ queue: [] }),

            // === Reset ===
            resetState: () => set(initialState),
        }),
        {
            name: "ram-dosya-atama-store",
            storage: createJSONStorage(() => localStorage),
            partialize: (state) => ({
                // Only persist these fields
                teachers: state.teachers,
                cases: state.cases,
                history: state.history,
                eArchive: state.eArchive,
                settings: state.settings,
                lastRollover: state.lastRollover,
                lastAbsencePenalty: state.lastAbsencePenalty,
                soundOn: state.soundOn,
                queue: state.queue,
            }),
            onRehydrateStorage: () => (state) => {
                if (state) {
                    state.setHydrated(true);
                }
            },
        }
    )
);

// ---- Selectors (for optimized re-renders)
export const selectTeachers = (state: AppState) => state.teachers;
export const selectActiveTeachers = (state: AppState) =>
    state.teachers.filter((t) => t.active);
export const selectCases = (state: AppState) => state.cases;
export const selectSettings = (state: AppState) => state.settings;
export const selectIsAdmin = (state: AppState) => state.isAdmin;
export const selectLiveStatus = (state: AppState) => state.liveStatus;
export const selectToasts = (state: AppState) => state.toasts;
