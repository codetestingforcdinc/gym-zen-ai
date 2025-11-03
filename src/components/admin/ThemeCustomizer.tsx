import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Save } from "lucide-react";

interface ThemeSetting {
  id: string;
  setting_key: string;
  setting_value: any;
}

export const ThemeCustomizer = () => {
  const [settings, setSettings] = useState<ThemeSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [colors, setColors] = useState({
    primary: "#000000",
    secondary: "#ffffff",
    accent: "#ff0000",
    background: "#ffffff",
    foreground: "#000000",
  });
  const [fonts, setFonts] = useState({
    heading: "Arial",
    body: "Arial",
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    const { data, error } = await supabase
      .from("theme_settings")
      .select("*");

    if (error) {
      toast({
        title: "Error fetching theme",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setSettings(data || []);
      
      // Load existing settings
      data?.forEach((setting) => {
        if (setting.setting_key === "colors" && typeof setting.setting_value === "object") {
          setColors(setting.setting_value as any);
        } else if (setting.setting_key === "fonts" && typeof setting.setting_value === "object") {
          setFonts(setting.setting_value as any);
        }
      });
    }
    setLoading(false);
  };

  const saveSetting = async (key: string, value: any) => {
    const existing = settings.find((s) => s.setting_key === key);

    if (existing) {
      const { error } = await supabase
        .from("theme_settings")
        .update({ setting_value: value })
        .eq("setting_key", key);

      if (error) {
        toast({
          title: "Error updating theme",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({ title: "Theme updated successfully" });
        fetchSettings();
      }
    } else {
      const { error } = await supabase
        .from("theme_settings")
        .insert([{ setting_key: key, setting_value: value }]);

      if (error) {
        toast({
          title: "Error saving theme",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({ title: "Theme saved successfully" });
        fetchSettings();
      }
    }
  };

  const applyTheme = () => {
    // Apply colors to CSS variables
    const root = document.documentElement;
    Object.entries(colors).forEach(([key, value]) => {
      root.style.setProperty(`--${key}`, value);
    });

    // Apply fonts
    document.body.style.fontFamily = fonts.body;
    
    toast({ title: "Theme applied! Refresh to see full changes." });
  };

  if (loading) return <div>Loading theme...</div>;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Color Scheme</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="color-primary">Primary Color</Label>
              <div className="flex gap-2">
                <Input
                  id="color-primary"
                  type="color"
                  value={colors.primary}
                  onChange={(e) => setColors({ ...colors, primary: e.target.value })}
                  className="w-20 h-10"
                />
                <Input
                  value={colors.primary}
                  onChange={(e) => setColors({ ...colors, primary: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="color-secondary">Secondary Color</Label>
              <div className="flex gap-2">
                <Input
                  id="color-secondary"
                  type="color"
                  value={colors.secondary}
                  onChange={(e) => setColors({ ...colors, secondary: e.target.value })}
                  className="w-20 h-10"
                />
                <Input
                  value={colors.secondary}
                  onChange={(e) => setColors({ ...colors, secondary: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="color-accent">Accent Color</Label>
              <div className="flex gap-2">
                <Input
                  id="color-accent"
                  type="color"
                  value={colors.accent}
                  onChange={(e) => setColors({ ...colors, accent: e.target.value })}
                  className="w-20 h-10"
                />
                <Input
                  value={colors.accent}
                  onChange={(e) => setColors({ ...colors, accent: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="color-background">Background Color</Label>
              <div className="flex gap-2">
                <Input
                  id="color-background"
                  type="color"
                  value={colors.background}
                  onChange={(e) => setColors({ ...colors, background: e.target.value })}
                  className="w-20 h-10"
                />
                <Input
                  value={colors.background}
                  onChange={(e) => setColors({ ...colors, background: e.target.value })}
                />
              </div>
            </div>
          </div>
          <Button onClick={() => saveSetting("colors", colors)}>
            <Save className="mr-2 h-4 w-4" /> Save Colors
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Typography</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="font-heading">Heading Font</Label>
            <Input
              id="font-heading"
              value={fonts.heading}
              onChange={(e) => setFonts({ ...fonts, heading: e.target.value })}
              placeholder="Arial, sans-serif"
            />
          </div>
          <div>
            <Label htmlFor="font-body">Body Font</Label>
            <Input
              id="font-body"
              value={fonts.body}
              onChange={(e) => setFonts({ ...fonts, body: e.target.value })}
              placeholder="Arial, sans-serif"
            />
          </div>
          <Button onClick={() => saveSetting("fonts", fonts)}>
            <Save className="mr-2 h-4 w-4" /> Save Fonts
          </Button>
        </CardContent>
      </Card>

      <Card className="bg-accent/10">
        <CardContent className="pt-6">
          <Button onClick={applyTheme} size="lg" className="w-full">
            Apply Theme Preview
          </Button>
          <p className="text-xs text-muted-foreground mt-2 text-center">
            Theme changes will be saved to database. Users will see changes on next page load.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};