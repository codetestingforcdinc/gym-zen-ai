import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";

interface Ad {
  id: string;
  title: string;
  image_url: string;
  link_url: string | null;
}

export const AdDisplay = () => {
  const [ad, setAd] = useState<Ad | null>(null);

  useEffect(() => {
    fetchRandomAd();
  }, []);

  const fetchRandomAd = async () => {
    const { data, error } = await supabase
      .from("ads")
      .select("*")
      .eq("active", true);

    if (!error && data && data.length > 0) {
      const randomAd = data[Math.floor(Math.random() * data.length)];
      setAd(randomAd);
      trackImpression(randomAd.id);
    }
  };

  const trackImpression = async (adId: string) => {
    const { data } = await supabase
      .from("ads")
      .select("impressions")
      .eq("id", adId)
      .single();
    
    if (data) {
      await supabase
        .from("ads")
        .update({ impressions: (data.impressions || 0) + 1 })
        .eq("id", adId);
    }
  };

  const handleClick = async () => {
    if (!ad) return;

    await supabase
      .from("ads")
      .select("clicks")
      .eq("id", ad.id)
      .single()
      .then(({ data }) => {
        if (data) {
          supabase
            .from("ads")
            .update({ clicks: (data.clicks || 0) + 1 })
            .eq("id", ad.id);
        }
      });

    if (ad.link_url) {
      window.open(ad.link_url, "_blank");
    }
  };

  if (!ad) return null;

  return (
    <Card
      className="overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
      onClick={handleClick}
    >
      <img
        src={ad.image_url}
        alt={ad.title}
        className="w-full h-auto object-cover"
      />
    </Card>
  );
};