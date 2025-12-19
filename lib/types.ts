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
};

export type CaseFile = {
  id: string;
  student: string;
  fileNo?: string;
  score: number;
  createdAt: string;      // ISO
  assignedTo?: string;    // teacher.id
  type: "YONLENDIRME" | "DESTEK" | "IKISI";
  isNew: boolean;
  diagCount: number;
  isTest: boolean;
  assignReason?: string;
  absencePenalty?: boolean;
  backupBonus?: boolean;
};
