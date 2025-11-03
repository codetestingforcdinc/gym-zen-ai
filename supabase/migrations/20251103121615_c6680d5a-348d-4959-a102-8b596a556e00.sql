-- Create ads table for ad management and tracking
CREATE TABLE public.ads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  image_url text NOT NULL,
  link_url text,
  impressions integer DEFAULT 0,
  clicks integer DEFAULT 0,
  active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.ads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view active ads"
ON public.ads
FOR SELECT
USING (active = true);

CREATE POLICY "Admins can manage ads"
ON public.ads
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create content_sections table for editable content
CREATE TABLE public.content_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page text NOT NULL,
  section_key text NOT NULL,
  content_type text NOT NULL, -- 'text', 'html', 'image', 'video'
  content_data jsonb NOT NULL,
  display_order integer DEFAULT 0,
  visible boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(page, section_key)
);

ALTER TABLE public.content_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view visible content"
ON public.content_sections
FOR SELECT
USING (visible = true);

CREATE POLICY "Admins can manage content"
ON public.content_sections
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create pages table for dynamic pages
CREATE TABLE public.pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  title text NOT NULL,
  meta_description text,
  content jsonb NOT NULL,
  published boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view published pages"
ON public.pages
FOR SELECT
USING (published = true);

CREATE POLICY "Admins can manage pages"
ON public.pages
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create theme_settings table for customizable theme
CREATE TABLE public.theme_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key text UNIQUE NOT NULL,
  setting_value jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.theme_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view theme settings"
ON public.theme_settings
FOR SELECT
USING (true);

CREATE POLICY "Admins can manage theme settings"
ON public.theme_settings
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add update triggers
CREATE TRIGGER update_ads_updated_at
BEFORE UPDATE ON public.ads
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_content_sections_updated_at
BEFORE UPDATE ON public.content_sections
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_pages_updated_at
BEFORE UPDATE ON public.pages
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_theme_settings_updated_at
BEFORE UPDATE ON public.theme_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();