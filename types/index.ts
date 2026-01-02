export type CaseType = "YONLENDIRME" | "DESTEK" | "IKISI";

export type Teacher = {
    id: string;
    name: string;
    isAbsent: boolean;
    yearlyLoad: number;
    monthly?: Record<string, number>;
    active: boolean;
    pushoverKey?: string;
    isTester: boolean;
    backupDay?: string;
    birthDate?: string;
};

export type CaseFile = {
    id: string;
    student: string;
    fileNo?: string;
    score: number;
    createdAt: string;      // ISO
    assignedTo?: string;    // teacher.id
    type: CaseType;
    isNew: boolean;
    diagCount: number;
    isTest: boolean;
    assignReason?: string;
    absencePenalty?: boolean;
    backupBonus?: boolean;
    sourcePdfEntry?: PdfAppointment; // Link to the PDF entry (if any)
};

export type PdfAppointment = {
    id: string;
    time: string;
    name: string;
    fileNo?: string;
    extra?: string;
};

export type Announcement = {
    id: string;
    text: string;
    createdAt: string;
};

export type EArchiveEntry = {
    id: string;
    studentName: string;
    fileNo?: string;
    teacherName: string; // or teacherId? Usage seems to be name for display or ID. Let's assume name for now, or check usage more.
    date: string; // YYYY-MM-DD
    type?: string;
};

export type AbsenceRecord = {
    teacherId: string;
    date: string;
};

export type Toast = {
    id: string;
    text: string;
};

export type AssignmentPopup = {
    teacherName: string;
    studentName: string;
    score: number;
};

export type LiveStatus = "connecting" | "online" | "offline";

export type QueueTicket = {
    id: string;
    no: number;
    name?: string;
    status: 'waiting' | 'called' | 'done';
    createdAt: string;
    updatedAt: string;
    calledBy?: string;
};

export type Settings = {
    dailyLimit: number;
    scoreTest: number;
    scoreNewBonus: number;
    scoreTypeY: number;
    scoreTypeD: number;
    scoreTypeI: number;
    backupBonusAmount: number;
    absencePenaltyAmount: number;
    musicUrl: string;
    musicPlaying: boolean;
};

export type ThemeMode = "light" | "dark" | "system";
export type ColorScheme = "zinc" | "slate" | "stone" | "gray" | "neutral" | "red" | "rose" | "orange" | "green" | "blue" | "yellow" | "violet";

export type ThemeSettings = {
    mode: ThemeMode;
    colorScheme: ColorScheme;
    customColors?: {
        primary: string;
        secondary: string;
        accent: string;
        background: string;
        foreground: string;
    };
};
