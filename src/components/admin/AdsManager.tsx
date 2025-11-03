import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Plus } from "lucide-react";

interface Ad {
  id: string;
  title: string;
  image_url: string;
  link_url: string | null;
  impressions: number;
  clicks: number;
  active: boolean;
}

export const AdsManager = () => {
  const [ads, setAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);
  const [newAd, setNewAd] = useState({
    title: "",
    image_url: "",
    link_url: "",
    active: true,
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchAds();
  }, []);

  const fetchAds = async () => {
    const { data, error } = await supabase
      .from("ads")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast({
        title: "Error fetching ads",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setAds(data || []);
    }
    setLoading(false);
  };

  const addAd = async () => {
    if (!newAd.title || !newAd.image_url) {
      toast({
        title: "Missing fields",
        description: "Title and image URL are required",
        variant: "destructive",
      });
      return;
    }

    const { error } = await supabase.from("ads").insert([newAd]);

    if (error) {
      toast({
        title: "Error adding ad",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({ title: "Ad added successfully" });
      setNewAd({ title: "", image_url: "", link_url: "", active: true });
      fetchAds();
    }
  };

  const toggleAdStatus = async (id: string, currentStatus: boolean) => {
    const { error } = await supabase
      .from("ads")
      .update({ active: !currentStatus })
      .eq("id", id);

    if (error) {
      toast({
        title: "Error updating ad",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({ title: "Ad status updated" });
      fetchAds();
    }
  };

  const deleteAd = async (id: string) => {
    const { error } = await supabase.from("ads").delete().eq("id", id);

    if (error) {
      toast({
        title: "Error deleting ad",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({ title: "Ad deleted successfully" });
      fetchAds();
    }
  };

  if (loading) return <div>Loading ads...</div>;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Add New Ad</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="ad-title">Title</Label>
            <Input
              id="ad-title"
              value={newAd.title}
              onChange={(e) => setNewAd({ ...newAd, title: e.target.value })}
              placeholder="Ad title"
            />
          </div>
          <div>
            <Label htmlFor="ad-image">Image URL</Label>
            <Input
              id="ad-image"
              value={newAd.image_url}
              onChange={(e) => setNewAd({ ...newAd, image_url: e.target.value })}
              placeholder="https://example.com/image.jpg"
            />
          </div>
          <div>
            <Label htmlFor="ad-link">Link URL (optional)</Label>
            <Input
              id="ad-link"
              value={newAd.link_url}
              onChange={(e) => setNewAd({ ...newAd, link_url: e.target.value })}
              placeholder="https://example.com"
            />
          </div>
          <div className="flex items-center space-x-2">
            <Switch
              checked={newAd.active}
              onCheckedChange={(checked) => setNewAd({ ...newAd, active: checked })}
            />
            <Label>Active</Label>
          </div>
          <Button onClick={addAd}>
            <Plus className="mr-2 h-4 w-4" /> Add Ad
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {ads.map((ad) => (
          <Card key={ad.id}>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-2">
                  <h3 className="font-semibold">{ad.title}</h3>
                  <img src={ad.image_url} alt={ad.title} className="w-48 h-auto rounded" />
                  {ad.link_url && (
                    <p className="text-sm text-muted-foreground">Link: {ad.link_url}</p>
                  )}
                  <div className="flex gap-4 text-sm">
                    <span>👁️ {ad.impressions} impressions</span>
                    <span>🖱️ {ad.clicks} clicks</span>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={ad.active}
                      onCheckedChange={() => toggleAdStatus(ad.id, ad.active)}
                    />
                    <Label className="text-xs">{ad.active ? "Active" : "Inactive"}</Label>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => deleteAd(ad.id)}
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