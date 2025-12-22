// Dashboard widgets yönetimi

export type WidgetType = 
  | "summary-cards"
  | "daily-stats"
  | "teacher-list"
  | "recent-files"
  | "weekly-chart"
  | "monthly-chart"
  | "type-distribution"
  | "hourly-distribution";

export type WidgetConfig = {
  id: string;
  type: WidgetType;
  title: string;
  enabled: boolean;
  order: number;
  size: "small" | "medium" | "large";
  position?: { x: number; y: number };
};

export const DEFAULT_WIDGETS: WidgetConfig[] = [
  { id: "summary-cards", type: "summary-cards", title: "Özet Kartları", enabled: true, order: 0, size: "large" },
  { id: "daily-stats", type: "daily-stats", title: "Günlük İstatistikler", enabled: true, order: 1, size: "medium" },
  { id: "teacher-list", type: "teacher-list", title: "Öğretmen Listesi", enabled: true, order: 2, size: "medium" },
  { id: "recent-files", type: "recent-files", title: "Son Dosyalar", enabled: true, order: 3, size: "medium" },
  { id: "weekly-chart", type: "weekly-chart", title: "Haftalık Grafik", enabled: false, order: 4, size: "large" },
  { id: "monthly-chart", type: "monthly-chart", title: "Aylık Grafik", enabled: false, order: 5, size: "large" },
  { id: "type-distribution", type: "type-distribution", title: "Tür Dağılımı", enabled: false, order: 6, size: "medium" },
  { id: "hourly-distribution", type: "hourly-distribution", title: "Saatlik Dağılım", enabled: false, order: 7, size: "medium" },
];

const WIDGETS_KEY = "dashboard_widgets";

export function getWidgets(): WidgetConfig[] {
  if (typeof window === "undefined") return DEFAULT_WIDGETS;
  
  try {
    const saved = localStorage.getItem(WIDGETS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as WidgetConfig[];
      // Varsayılan widget'ları merge et (yeni widget'lar eklenmiş olabilir)
      const savedIds = new Set(parsed.map(w => w.id));
      const newWidgets = DEFAULT_WIDGETS.filter(w => !savedIds.has(w.id));
      return [...parsed, ...newWidgets].sort((a, b) => a.order - b.order);
    }
  } catch {
    // Hatalı JSON, varsayılan döndür
  }
  
  return DEFAULT_WIDGETS;
}

export function saveWidgets(widgets: WidgetConfig[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(WIDGETS_KEY, JSON.stringify(widgets));
  } catch (error) {
    console.error("Widgets kaydedilemedi:", error);
  }
}

export function updateWidget(id: string, updates: Partial<WidgetConfig>) {
  const widgets = getWidgets();
  const index = widgets.findIndex(w => w.id === id);
  if (index >= 0) {
    widgets[index] = { ...widgets[index], ...updates };
    saveWidgets(widgets);
  }
  return widgets;
}

export function toggleWidget(id: string) {
  const widgets = getWidgets();
  const widget = widgets.find(w => w.id === id);
  if (widget) {
    widget.enabled = !widget.enabled;
    saveWidgets(widgets);
  }
  return widgets;
}

export function reorderWidgets(widgetIds: string[]) {
  const widgets = getWidgets();
  const reordered = widgetIds.map((id, index) => {
    const widget = widgets.find(w => w.id === id);
    return widget ? { ...widget, order: index } : null;
  }).filter((w): w is WidgetConfig => w !== null);
  
  // Eksik widget'ları sona ekle
  const reorderedIds = new Set(reordered.map(w => w.id));
  const remaining = widgets.filter(w => !reorderedIds.has(w));
  remaining.forEach((w, i) => {
    w.order = reordered.length + i;
  });
  
  saveWidgets([...reordered, ...remaining]);
  return [...reordered, ...remaining];
}

export function resetWidgets() {
  if (typeof window === "undefined") return DEFAULT_WIDGETS;
  localStorage.removeItem(WIDGETS_KEY);
  return DEFAULT_WIDGETS;
}

