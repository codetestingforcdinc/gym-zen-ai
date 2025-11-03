import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Save } from "lucide-react";

interface ContentSection {
  id: string;
  page: string;
  section_key: string;
  content_type: string;
  content_data: any;
  display_order: number;
  visible: boolean;
}

export const ContentEditor = () => {
  const [sections, setSections] = useState<ContentSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingSection, setEditingSection] = useState<ContentSection | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchSections();
  }, []);

  const fetchSections = async () => {
    const { data, error } = await supabase
      .from("content_sections")
      .select("*")
      .order("page")
      .order("display_order");

    if (error) {
      toast({
        title: "Error fetching content",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setSections(data || []);
    }
    setLoading(false);
  };

  const saveSection = async (section: ContentSection) => {
    const { error } = await supabase
      .from("content_sections")
      .upsert({
        id: section.id,
        page: section.page,
        section_key: section.section_key,
        content_type: section.content_type,
        content_data: section.content_data,
        display_order: section.display_order,
        visible: section.visible,
      });

    if (error) {
      toast({
        title: "Error saving content",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({ title: "Content saved successfully" });
      setEditingSection(null);
      fetchSections();
    }
  };

  const addNewSection = async () => {
    const newSection = {
      page: "home",
      section_key: `section_${Date.now()}`,
      content_type: "text",
      content_data: { text: "" },
      display_order: sections.length,
      visible: true,
    };

    const { data, error } = await supabase
      .from("content_sections")
      .insert([newSection])
      .select()
      .single();

    if (error) {
      toast({
        title: "Error creating section",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({ title: "Section created" });
      setEditingSection(data);
      fetchSections();
    }
  };

  const deleteSection = async (id: string) => {
    const { error } = await supabase
      .from("content_sections")
      .delete()
      .eq("id", id);

    if (error) {
      toast({
        title: "Error deleting section",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({ title: "Section deleted" });
      fetchSections();
    }
  };

  if (loading) return <div>Loading content...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Content Editor</h2>
        <Button onClick={addNewSection}>Add New Section</Button>
      </div>

      {editingSection && (
        <Card className="border-primary">
          <CardHeader>
            <CardTitle>Editing Section</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Page</Label>
              <Input
                value={editingSection.page}
                onChange={(e) =>
                  setEditingSection({ ...editingSection, page: e.target.value })
                }
              />
            </div>
            <div>
              <Label>Section Key</Label>
              <Input
                value={editingSection.section_key}
                onChange={(e) =>
                  setEditingSection({ ...editingSection, section_key: e.target.value })
                }
              />
            </div>
            <div>
              <Label>Content Type</Label>
              <Select
                value={editingSection.content_type}
                onValueChange={(value) =>
                  setEditingSection({ ...editingSection, content_type: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Text</SelectItem>
                  <SelectItem value="html">HTML</SelectItem>
                  <SelectItem value="image">Image</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Content</Label>
              <Textarea
                value={JSON.stringify(editingSection.content_data, null, 2)}
                onChange={(e) => {
                  try {
                    const data = JSON.parse(e.target.value);
                    setEditingSection({ ...editingSection, content_data: data });
                  } catch (err) {
                    // Invalid JSON, ignore
                  }
                }}
                rows={10}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                checked={editingSection.visible}
                onCheckedChange={(checked) =>
                  setEditingSection({ ...editingSection, visible: checked })
                }
              />
              <Label>Visible</Label>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => saveSection(editingSection)}>
                <Save className="mr-2 h-4 w-4" /> Save
              </Button>
              <Button variant="outline" onClick={() => setEditingSection(null)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4">
        {sections.map((section) => (
          <Card key={section.id}>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold">{section.section_key}</h3>
                  <p className="text-sm text-muted-foreground">
                    Page: {section.page} | Type: {section.content_type}
                  </p>
                  <p className="text-xs mt-2">
                    {section.visible ? "✅ Visible" : "❌ Hidden"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditingSection(section)}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => deleteSection(section.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};