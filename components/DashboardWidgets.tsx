"use client";
import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { GripVertical, Settings2, RotateCcw } from "lucide-react";
import {
  getWidgets,
  saveWidgets,
  toggleWidget,
  reorderWidgets,
  resetWidgets,
  type WidgetConfig,
} from "@/lib/widgets";

export default function DashboardWidgets() {
  const [widgets, setWidgets] = useState<WidgetConfig[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    setWidgets(getWidgets());
  }, []);

  const handleToggle = (id: string) => {
    const updated = toggleWidget(id);
    setWidgets(updated);
  };

  const handleSizeChange = (id: string, size: "small" | "medium" | "large") => {
    const updated = widgets.map(w => 
      w.id === id ? { ...w, size } : w
    );
    saveWidgets(updated);
    setWidgets(updated);
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const newWidgets = [...widgets];
    [newWidgets[index - 1], newWidgets[index]] = [newWidgets[index], newWidgets[index - 1]];
    newWidgets[index - 1].order = index - 1;
    newWidgets[index].order = index;
    saveWidgets(newWidgets);
    setWidgets(newWidgets);
  };

  const handleMoveDown = (index: number) => {
    if (index === widgets.length - 1) return;
    const newWidgets = [...widgets];
    [newWidgets[index], newWidgets[index + 1]] = [newWidgets[index + 1], newWidgets[index]];
    newWidgets[index].order = index;
    newWidgets[index + 1].order = index + 1;
    saveWidgets(newWidgets);
    setWidgets(newWidgets);
  };

  const handleReset = () => {
    if (confirm("Tüm widget ayarlarını sıfırlamak istediğinize emin misiniz?")) {
      const reset = resetWidgets();
      setWidgets(reset);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Settings2 className="h-5 w-5" />
          Dashboard Widget Ayarları
        </CardTitle>
        <Button variant="outline" size="sm" onClick={handleReset}>
          <RotateCcw className="h-4 w-4 mr-2" />
          Sıfırla
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-slate-600 mb-4">
          Widget'ları açıp kapatabilir, sıralarını değiştirebilir ve boyutlarını ayarlayabilirsiniz.
        </div>

        <div className="space-y-2">
          {widgets.map((widget, index) => (
            <div
              key={widget.id}
              className="flex items-center gap-3 p-3 border rounded-lg hover:bg-slate-50 transition-colors"
            >
              <GripVertical className="h-5 w-5 text-slate-400 cursor-move" />
              
              <Checkbox
                checked={widget.enabled}
                onCheckedChange={() => handleToggle(widget.id)}
                id={`widget-${widget.id}`}
              />
              
              <Label
                htmlFor={`widget-${widget.id}`}
                className="flex-1 cursor-pointer"
              >
                {widget.title}
              </Label>

              <div className="flex items-center gap-2">
                <Label className="text-xs text-slate-600">Boyut:</Label>
                <select
                  value={widget.size}
                  onChange={(e) => handleSizeChange(widget.id, e.target.value as any)}
                  className="text-xs border rounded px-2 py-1"
                  disabled={!widget.enabled}
                >
                  <option value="small">Küçük</option>
                  <option value="medium">Orta</option>
                  <option value="large">Büyük</option>
                </select>
              </div>

              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleMoveUp(index)}
                  disabled={index === 0}
                  className="h-7 w-7 p-0"
                >
                  ↑
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleMoveDown(index)}
                  disabled={index === widgets.length - 1}
                  className="h-7 w-7 p-0"
                >
                  ↓
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="pt-4 border-t text-xs text-slate-500">
          <p>💡 İpucu: Widget'ları sıralamak için yukarı/aşağı butonlarını kullanın.</p>
          <p>Widget'ları kapatmak için checkbox'ı işaretini kaldırın.</p>
        </div>
      </CardContent>
    </Card>
  );
}

