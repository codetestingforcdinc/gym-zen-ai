import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

interface PageData {
  id: string;
  slug: string;
  title: string;
  meta_description: string | null;
  content: any;
  published: boolean;
}

const DynamicPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const [page, setPage] = useState<PageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchPage();
  }, [slug]);

  const fetchPage = async () => {
    if (!slug) return;

    const { data, error } = await supabase
      .from("pages")
      .select("*")
      .eq("slug", slug)
      .eq("published", true)
      .single();

    if (error || !data) {
      setNotFound(true);
    } else {
      setPage(data);
      if (data.meta_description) {
        document
          .querySelector('meta[name="description"]')
          ?.setAttribute("content", data.meta_description);
      }
      document.title = data.title || "FitAI";
    }
    setLoading(false);
  };

  const renderContent = (content: any) => {
    if (!content || !content.sections) return null;

    return content.sections.map((section: any, index: number) => {
      switch (section.type) {
        case "heading":
          return (
            <h2 key={index} className="text-3xl font-bold mb-4">
              {section.content}
            </h2>
          );
        case "text":
          return (
            <p key={index} className="mb-4 text-muted-foreground">
              {section.content}
            </p>
          );
        case "html":
          return (
            <div
              key={index}
              className="mb-4"
              dangerouslySetInnerHTML={{ __html: section.content }}
            />
          );
        case "image":
          return (
            <img
              key={index}
              src={section.content}
              alt={section.alt || ""}
              className="w-full rounded-lg mb-4"
            />
          );
        default:
          return null;
      }
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <h1 className="text-4xl font-bold">Page Not Found</h1>
        <p className="text-muted-foreground">
          The page you're looking for doesn't exist or hasn't been published yet.
        </p>
        <Button onClick={() => navigate("/")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Go Home
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <Button variant="ghost" onClick={() => navigate("/")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <article>
          <h1 className="text-4xl font-bold mb-8">{page?.title}</h1>
          <div className="prose prose-lg max-w-none">
            {page && renderContent(page.content)}
          </div>
        </article>
      </main>
    </div>
  );
};

export default DynamicPage;