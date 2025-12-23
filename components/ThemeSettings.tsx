"use client";
import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Palette, Moon, Sun, Monitor, Save, RotateCcw } from "lucide-react";
import {
  getThemeMode,
  setThemeMode,
  getColorScheme,
  setColorScheme,
  setCustomColors,
  DEFAULT_COLOR_SCHEMES,
  type ThemeMode,
  type ColorScheme,
} from "@/lib/theme";

export default function ThemeSettings() {
  const [themeMode, setThemeModeState] = useState<ThemeMode>("auto");
  const [selectedScheme, setSelectedScheme] = useState<string>("default");
  const [customColors, setCustomColorsState] = useState<Partial<ColorScheme>>({});
  const [showCustomColors, setShowCustomColors] = useState(false);

  useEffect(() => {
    setThemeModeState(getThemeMode());
    const scheme = getColorScheme();
    if (scheme.name === "Özel Tema") {
      setSelectedScheme("custom");
      setCustomColorsState(scheme);
      setShowCustomColors(true);
    } else {
      const schemeName = Object.keys(DEFAULT_COLOR_SCHEMES).find(
        (key) => DEFAULT_COLOR_SCHEMES[key].name === scheme.name
      ) || "default";
      setSelectedScheme(schemeName);
    }
  }, []);

  const handleThemeModeChange = (mode: ThemeMode) => {
    setThemeModeState(mode);
    setThemeMode(mode, true); // Supabase'e senkronize et
  };

  const handleSchemeChange = (schemeName: string) => {
    setSelectedScheme(schemeName);
    if (schemeName === "custom") {
      setShowCustomColors(true);
      const current = getColorScheme();
      setCustomColorsState(current);
    } else {
      setShowCustomColors(false);
      setColorScheme(schemeName, true); // Supabase'e senkronize et
    }
  };

  const handleCustomColorChange = (key: keyof ColorScheme, value: string) => {
    setCustomColorsState((prev) => ({ ...prev, [key]: value }));
  };

  const handleSaveCustomColors = () => {
    setCustomColors(customColors, true); // Supabase'e senkronize et
  };

  const handleReset = () => {
    setSelectedScheme("default");
    setShowCustomColors(false);
    setCustomColorsState({});
    setColorScheme("default");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Palette className="h-5 w-5" />
          Tema ve Renk Ayarları
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Tema Modu */}
        <div className="space-y-2">
          <Label className="text-base font-semibold">Tema Modu</Label>
          <div className="flex gap-2">
            <Button
              variant={themeMode === "light" ? "default" : "outline"}
              onClick={() => handleThemeModeChange("light")}
              className="flex-1"
            >
              <Sun className="h-4 w-4 mr-2" />
              Açık
            </Button>
            <Button
              variant={themeMode === "dark" ? "default" : "outline"}
              onClick={() => handleThemeModeChange("dark")}
              className="flex-1"
            >
              <Moon className="h-4 w-4 mr-2" />
              Koyu
            </Button>
            <Button
              variant={themeMode === "auto" ? "default" : "outline"}
              onClick={() => handleThemeModeChange("auto")}
              className="flex-1"
            >
              <Monitor className="h-4 w-4 mr-2" />
              Otomatik
            </Button>
          </div>
        </div>

        {/* Renk Şeması */}
        <div className="space-y-2">
          <Label className="text-base font-semibold">Renk Şeması</Label>
          <Select value={selectedScheme} onValueChange={handleSchemeChange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.keys(DEFAULT_COLOR_SCHEMES).map((key) => (
                <SelectItem key={key} value={key}>
                  {DEFAULT_COLOR_SCHEMES[key].name}
                </SelectItem>
              ))}
              <SelectItem value="custom">Özel Renkler</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Özel Renkler */}
        {showCustomColors && (
          <div className="space-y-4 p-4 border rounded-lg bg-slate-50">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">Özel Renkler</Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleReset}
                className="text-xs"
              >
                <RotateCcw className="h-3 w-3 mr-1" />
                Sıfırla
              </Button>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm">Ana Renk</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={customColors.primary || "#0d9488"}
                    onChange={(e) => handleCustomColorChange("primary", e.target.value)}
                    className="w-16 h-10"
                  />
                  <Input
                    type="text"
                    value={customColors.primary || "#0d9488"}
                    onChange={(e) => handleCustomColorChange("primary", e.target.value)}
                    className="flex-1"
                    placeholder="#0d9488"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm">Aksan Renk</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={customColors.accent || "#f97316"}
                    onChange={(e) => handleCustomColorChange("accent", e.target.value)}
                    className="w-16 h-10"
                  />
                  <Input
                    type="text"
                    value={customColors.accent || "#f97316"}
                    onChange={(e) => handleCustomColorChange("accent", e.target.value)}
                    className="flex-1"
                    placeholder="#f97316"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm">Arka Plan</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={customColors.bgBase || "#faf8f5"}
                    onChange={(e) => handleCustomColorChange("bgBase", e.target.value)}
                    className="w-16 h-10"
                  />
                  <Input
                    type="text"
                    value={customColors.bgBase || "#faf8f5"}
                    onChange={(e) => handleCustomColorChange("bgBase", e.target.value)}
                    className="flex-1"
                    placeholder="#faf8f5"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm">Kart Arka Plan</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={customColors.bgCard || "#ffffff"}
                    onChange={(e) => handleCustomColorChange("bgCard", e.target.value)}
                    className="w-16 h-10"
                  />
                  <Input
                    type="text"
                    value={customColors.bgCard || "#ffffff"}
                    onChange={(e) => handleCustomColorChange("bgCard", e.target.value)}
                    className="flex-1"
                    placeholder="#ffffff"
                  />
                </div>
              </div>
            </div>

            <Button onClick={handleSaveCustomColors} className="w-full">
              <Save className="h-4 w-4 mr-2" />
              Özel Renkleri Kaydet
            </Button>
          </div>
        )}

        {/* Önizleme */}
        <div className="space-y-2">
          <Label className="text-base font-semibold">Önizleme</Label>
          <div className="grid grid-cols-4 gap-2">
            <div
              className="h-12 rounded-lg"
              style={{ backgroundColor: getColorScheme().primary }}
            />
            <div
              className="h-12 rounded-lg"
              style={{ backgroundColor: getColorScheme().accent }}
            />
            <div
              className="h-12 rounded-lg border"
              style={{ backgroundColor: getColorScheme().bgBase }}
            />
            <div
              className="h-12 rounded-lg border"
              style={{ backgroundColor: getColorScheme().bgCard }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

