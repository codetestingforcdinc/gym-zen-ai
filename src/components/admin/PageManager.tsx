import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Plus, Save, ExternalLink } from "lucide-react";

interface Page {
  id: string;
  slug: string;
  title: string;
  meta_description: string | null;
  content: any;
  published: boolean;
}

export const PageManager = () => {
  const [pages, setPages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPage, setEditingPage] = useState<Page | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchPages();
  }, []);

  const fetchPages = async () => {
    const { data, error } = await supabase
      .from("pages")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast({
        title: "Error fetching pages",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setPages(data || []);
    }
    setLoading(false);
  };

  const createNewPage = () => {
    setEditingPage({
      id: "",
      slug: "",
      title: "",
      meta_description: "",
      content: { sections: [] },
      published: false,
    });
    setIsCreating(true);
  };

  const savePage = async () => {
    if (!editingPage) return;

    if (!editingPage.slug || !editingPage.title) {
      toast({
        title: "Missing fields",
        description: "Slug and title are required",
        variant: "destructive",
      });
      return;
    }

    if (isCreating) {
      const { error } = await supabase.from("pages").insert([{
        slug: editingPage.slug,
        title: editingPage.title,
        meta_description: editingPage.meta_description,
        content: editingPage.content,
        published: editingPage.published,
      }]);

      if (error) {
        toast({
          title: "Error creating page",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({ title: "Page created successfully" });
        setEditingPage(null);
        setIsCreating(false);
        fetchPages();
      }
    } else {
      const { error } = await supabase
        .from("pages")
        .update({
          slug: editingPage.slug,
          title: editingPage.title,
          meta_description: editingPage.meta_description,
          content: editingPage.content,
          published: editingPage.published,
        })
        .eq("id", editingPage.id);

      if (error) {
        toast({
          title: "Error updating page",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({ title: "Page updated successfully" });
        setEditingPage(null);
        fetchPages();
      }
    }
  };

  const deletePage = async (id: string) => {
    const { error } = await supabase.from("pages").delete().eq("id", id);

    if (error) {
      toast({
        title: "Error deleting page",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({ title: "Page deleted successfully" });
      fetchPages();
    }
  };

  if (loading) return <div>Loading pages...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Page Manager</h2>
        <Button onClick={createNewPage}>
          <Plus className="mr-2 h-4 w-4" /> Create New Page
        </Button>
      </div>

      {editingPage && (
        <Card className="border-primary">
          <CardHeader>
            <CardTitle>{isCreating ? "Create New Page" : "Edit Page"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="page-slug">Slug (URL path)</Label>
              <Input
                id="page-slug"
                value={editingPage.slug}
                onChange={(e) =>
                  setEditingPage({ ...editingPage, slug: e.target.value })
                }
                placeholder="about-us"
              />
            </div>
            <div>
              <Label htmlFor="page-title">Title</Label>
              <Input
                id="page-title"
                value={editingPage.title}
                onChange={(e) =>
                  setEditingPage({ ...editingPage, title: e.target.value })
                }
                placeholder="About Us"
              />
            </div>
            <div>
              <Label htmlFor="page-meta">Meta Description</Label>
              <Textarea
                id="page-meta"
                value={editingPage.meta_description || ""}
                onChange={(e) =>
                  setEditingPage({ ...editingPage, meta_description: e.target.value })
                }
                placeholder="SEO description"
              />
            </div>
            <div>
              <Label htmlFor="page-content">Content (JSON)</Label>
              <Textarea
                id="page-content"
                value={JSON.stringify(editingPage.content, null, 2)}
                onChange={(e) => {
                  try {
                    const content = JSON.parse(e.target.value);
                    setEditingPage({ ...editingPage, content });
                  } catch (err) {
                    // Invalid JSON
                  }
                }}
                rows={15}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                checked={editingPage.published}
                onCheckedChange={(checked) =>
                  setEditingPage({ ...editingPage, published: checked })
                }
              />
              <Label>Published</Label>
            </div>
            <div className="flex gap-2">
              <Button onClick={savePage}>
                <Save className="mr-2 h-4 w-4" /> Save
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setEditingPage(null);
                  setIsCreating(false);
                }}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4">
        {pages.map((page) => (
          <Card key={page.id}>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">{page.title}</h3>
                  <p className="text-sm text-muted-foreground">/{page.slug}</p>
                  <p className="text-xs mt-2">
                    {page.published ? "✅ Published" : "❌ Draft"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(`/${page.slug}`, "_blank")}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditingPage(page);
                      setIsCreating(false);
                    }}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => deletePage(page.id)}
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