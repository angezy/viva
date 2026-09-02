"use client";

import React, { useEffect, useState } from "react";
import Header from "@/app/components/Header";
import Footer from "@/app/components/footer";
import Section from "@/app/components/section";
import BlogSection from "@/app/components/blog";
import AboutSection from "@/app/components/aboutSection";
import WhyWeluxoSection from "@/app/components/WhyWeluxoSection";
import HowItWorksSection from "@/app/components/HowItWorksSection";
import FaqPageSection from "@/app/components/FaqPageSection";
import HelpCenterSection from "@/app/components/HelpCenterSection";
import LegalPageSection from "@/app/components/LegalPageSection";
import ShopPage from "@/app/shop/page";
import { Box } from "@mui/material";
import { DEFAULT_SITE_CHROME } from "@/app/lib/siteChrome";
import PageSkeleton from "@/app/components/LoadingSkeletons";

const EMPTY_PRODUCT = { title: "", price: "", image: "", alt: "" };
const DEFAULT_PRODUCTS_SECTION = {
  announcement: "New drops land every Monday \u00b7 Build your stack and save more on bundles",
  title: "Products",
};
const EMPTY_FEATURE = { title: "", copy: "" };
const readFileAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
const EMPTY_POST = {
  id: "",
  title: "",
  excerpt: "",
  author: "",
  date: "",
  image: "",
  alt: "",
  tags: [],
  slug: "",
};
const EMPTY_APPROACH = { title: "", copy: "" };
const EMPTY_TEAM = { name: "", role: "", bio: "", img: "", alt: "" };
const EMPTY_ABOUT = {
  hero: {},
  mission: "",
  values: "",
  team: [],
  story: [],
  approach: [],
  contactCta: {},
};
const EMPTY_WHY_CARD = { title: "", copy: "" };
const EMPTY_WHY_LINK = { label: "", url: "" };
const EMPTY_HOW_STEP = { id: "", number: "", eyebrow: "", title: "", copy: "", items: [], flow: [], ctaText: "", ctaUrl: "", image: "", alt: "" };
const EMPTY_HOW_LINK = { label: "", url: "" };
const EMPTY_HOW_PRINCIPLE = { title: "", copy: "" };
const EMPTY_HOW_FAQ = { question: "", answer: "" };
const EMPTY_FAQ_ITEM = { question: "", answer: "" };
const EMPTY_HELP_CATEGORY = { title: "", articles: [] };
const EMPTY_HELP_FAQ = { question: "", answer: "" };
const LEGAL_SLUGS = ["privacy-policy", "terms-conditions", "shipping-policy", "return-refund-policy"];

export default function PageEditor() {
  const [content, setContent] = useState(null);
  const [blogContent, setBlogContent] = useState(null);
  const [aboutContent, setAboutContent] = useState(null);
  const [whyContent, setWhyContent] = useState(null);
  const [howContent, setHowContent] = useState(null);
  const [faqContent, setFaqContent] = useState(null);
  const [helpCenterContent, setHelpCenterContent] = useState(null);
  const [legalContent, setLegalContent] = useState(null);
  const [shopContent, setShopContent] = useState(null);
  const [siteChromeContent, setSiteChromeContent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingBlog, setLoadingBlog] = useState(true);
  const [loadingAbout, setLoadingAbout] = useState(true);
  const [loadingWhy, setLoadingWhy] = useState(true);
  const [loadingHow, setLoadingHow] = useState(true);
  const [loadingFaq, setLoadingFaq] = useState(true);
  const [loadingHelpCenter, setLoadingHelpCenter] = useState(true);
  const [loadingLegal, setLoadingLegal] = useState(true);
  const [loadingShop, setLoadingShop] = useState(true);
  const [loadingSiteChrome, setLoadingSiteChrome] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [activeSection, setActiveSection] = useState(null);
  const [previewPath, setPreviewPath] = useState("/");

  useEffect(() => {
    let mounted = true;
    fetch("/api/dashboard/home")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => mounted && setContent(data))
      .catch(() => mounted && setError("Failed to load content"))
      .finally(() => mounted && setLoading(false));

    fetch("/api/dashboard/blog")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => mounted && setBlogContent(data))
      .catch(() => mounted && setError("Failed to load blog content"))
      .finally(() => mounted && setLoadingBlog(false));
    fetch("/api/dashboard/about")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => mounted && setAboutContent(data))
      .catch(() => mounted && setError("Failed to load about content"))
      .finally(() => mounted && setLoadingAbout(false));
    fetch("/api/dashboard/why-weluxo")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => mounted && setWhyContent(data))
      .catch(() => mounted && setError("Failed to load Why Weluxo content"))
      .finally(() => mounted && setLoadingWhy(false));
    fetch("/api/dashboard/how-it-works")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => mounted && setHowContent(data))
      .catch(() => mounted && setError("Failed to load How It Works content"))
      .finally(() => mounted && setLoadingHow(false));
    fetch("/api/dashboard/faq")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => mounted && setFaqContent(data))
      .catch(() => mounted && setError("Failed to load FAQ content"))
      .finally(() => mounted && setLoadingFaq(false));
    fetch("/api/dashboard/help-center")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => mounted && setHelpCenterContent(data))
      .catch(() => mounted && setError("Failed to load Help content"))
      .finally(() => mounted && setLoadingHelpCenter(false));
    fetch("/api/dashboard/shop")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => mounted && setShopContent(data))
      .catch(() => mounted && setError("Failed to load Shop content"))
      .finally(() => mounted && setLoadingShop(false));
    fetch("/api/dashboard/site-chrome")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => mounted && setSiteChromeContent(data))
      .catch(() => mounted && setSiteChromeContent(DEFAULT_SITE_CHROME))
      .finally(() => mounted && setLoadingSiteChrome(false));
    Promise.all(
      LEGAL_SLUGS.map((slug) =>
        fetch(`/api/dashboard/legal/${slug}`).then((res) => (res.ok ? res.json() : Promise.reject()))
      )
    )
      .then((pages) => mounted && setLegalContent(Object.fromEntries(LEGAL_SLUGS.map((slug, index) => [slug, pages[index]]))))
      .catch(() => mounted && setError("Failed to load legal page content"))
      .finally(() => mounted && setLoadingLegal(false));
    return () => {
      mounted = false;
    };
  }, []);

  const inlinePreviewPaths = ["/", "/blog", "/shop", "/aboutus", "/why-weluxo", "/how-it-works", "/faq", "/help-center", ...LEGAL_SLUGS.map((slug) => `/${slug}`)];
  const showInlinePreview = inlinePreviewPaths.includes(previewPath);
  const activeLegalSlug = LEGAL_SLUGS.find((slug) => previewPath === `/${slug}`);

  const updateField = (path, value) => {
    setContent((prev) => {
      const next = { ...(prev || {}) };
      let cursor = next;
      for (let i = 0; i < path.length - 1; i++) {
        const key = path[i];
        cursor[key] = Array.isArray(cursor[key])
          ? [...cursor[key]]
          : typeof cursor[key] === "object"
          ? { ...cursor[key] }
          : {};
        cursor = cursor[key];
      }
      cursor[path[path.length - 1]] = value;
      return next;
    });
  };

  const updateArrayItem = (key, index, value) => {
    setContent((prev) => {
      const arr = Array.isArray(prev?.[key]) ? [...prev[key]] : [];
      arr[index] = value;
      return { ...(prev || {}), [key]: arr };
    });
  };

  const updateBlogPost = (index, value) => {
    setBlogContent((prev) => {
      const arr = Array.isArray(prev?.posts) ? [...prev.posts] : [];
      arr[index] = { ...(arr[index] || EMPTY_POST), ...value };
      return { ...(prev || {}), posts: arr };
    });
  };

  const updateAboutArray = (key, index, value) => {
    setAboutContent((prev) => {
      const arr = Array.isArray(prev?.[key]) ? [...prev[key]] : [];
      arr[index] = value;
      return { ...(prev || {}), [key]: arr };
    });
  };

  const updateShopField = (path, value) => {
    setShopContent((prev) => {
      const next = { ...(prev || {}) };
      let cursor = next;
      for (let i = 0; i < path.length - 1; i++) {
        const key = path[i];
        const current = cursor[key];
        cursor[key] = current && typeof current === "object" ? { ...current } : {};
        cursor = cursor[key];
      }
      cursor[path[path.length - 1]] = value;
      return next;
    });
  };

  const updateSiteChromeField = (path, value) => {
    setSiteChromeContent((prev) => {
      const next = { ...(prev || {}) };
      let cursor = next;
      for (let i = 0; i < path.length - 1; i++) {
        const key = path[i];
        const current = cursor[key];
        cursor[key] = Array.isArray(current)
          ? [...current]
          : current && typeof current === "object"
          ? { ...current }
          : {};
        cursor = cursor[key];
      }
      cursor[path[path.length - 1]] = value;
      return next;
    });
  };

  const updateSiteChromeArrayItem = (path, index, value) => {
    setSiteChromeContent((prev) => {
      const next = { ...(prev || {}) };
      let cursor = next;
      for (let i = 0; i < path.length - 1; i++) {
        const key = path[i];
        const current = cursor[key];
        cursor[key] = Array.isArray(current)
          ? [...current]
          : current && typeof current === "object"
          ? { ...current }
          : {};
        cursor = cursor[key];
      }
      const key = path[path.length - 1];
      const items = Array.isArray(cursor[key]) ? [...cursor[key]] : [];
      items[index] = value;
      cursor[key] = items;
      return next;
    });
  };

  const updateWhyField = (path, value) => {
    setWhyContent((prev) => {
      const next = { ...(prev || {}) };
      let cursor = next;
      for (let i = 0; i < path.length - 1; i++) {
        const key = path[i];
        cursor[key] = Array.isArray(cursor[key])
          ? [...cursor[key]]
          : cursor[key] && typeof cursor[key] === "object"
          ? { ...cursor[key] }
          : {};
        cursor = cursor[key];
      }
      cursor[path[path.length - 1]] = value;
      return next;
    });
  };

  const updateWhyArrayItem = (path, index, value) => {
    setWhyContent((prev) => {
      const next = { ...(prev || {}) };
      let cursor = next;
      for (let i = 0; i < path.length - 1; i++) {
        const key = path[i];
        cursor[key] = cursor[key] && typeof cursor[key] === "object" ? { ...cursor[key] } : {};
        cursor = cursor[key];
      }
      const key = path[path.length - 1];
      const arr = Array.isArray(cursor[key]) ? [...cursor[key]] : [];
      arr[index] = value;
      cursor[key] = arr;
      return next;
    });
  };

  const updateHowField = (path, value) => {
    setHowContent((prev) => {
      const next = { ...(prev || {}) };
      let cursor = next;
      for (let i = 0; i < path.length - 1; i++) {
        const key = path[i];
        const current = cursor[key];
        cursor[key] = Array.isArray(current)
          ? [...current]
          : current && typeof current === "object"
          ? { ...current }
          : {};
        cursor = cursor[key];
      }
      cursor[path[path.length - 1]] = value;
      return next;
    });
  };

  const updateHowArrayItem = (path, index, value) => {
    setHowContent((prev) => {
      const next = { ...(prev || {}) };
      let cursor = next;
      for (let i = 0; i < path.length - 1; i++) {
        const key = path[i];
        const current = cursor[key];
        cursor[key] = Array.isArray(current)
          ? [...current]
          : current && typeof current === "object"
          ? { ...current }
          : {};
        cursor = cursor[key];
      }
      const key = path[path.length - 1];
      const arr = Array.isArray(cursor[key]) ? [...cursor[key]] : [];
      arr[index] = value;
      cursor[key] = arr;
      return next;
    });
  };

  const updateFaqField = (path, value) => {
    setFaqContent((prev) => {
      const next = { ...(prev || {}) };
      let cursor = next;
      for (let i = 0; i < path.length - 1; i++) {
        const key = path[i];
        const current = cursor[key];
        cursor[key] = Array.isArray(current)
          ? [...current]
          : current && typeof current === "object"
          ? { ...current }
          : {};
        cursor = cursor[key];
      }
      cursor[path[path.length - 1]] = value;
      return next;
    });
  };

  const updateFaqArrayItem = (path, index, value) => {
    setFaqContent((prev) => {
      const next = { ...(prev || {}) };
      let cursor = next;
      for (let i = 0; i < path.length - 1; i++) {
        const key = path[i];
        const current = cursor[key];
        cursor[key] = Array.isArray(current)
          ? [...current]
          : current && typeof current === "object"
          ? { ...current }
          : {};
        cursor = cursor[key];
      }
      const key = path[path.length - 1];
      const arr = Array.isArray(cursor[key]) ? [...cursor[key]] : [];
      arr[index] = value;
      cursor[key] = arr;
      return next;
    });
  };

  const updateHelpCenterField = (path, value) => {
    setHelpCenterContent((prev) => {
      const next = { ...(prev || {}) };
      let cursor = next;
      for (let i = 0; i < path.length - 1; i++) {
        const key = path[i];
        const current = cursor[key];
        cursor[key] = Array.isArray(current)
          ? [...current]
          : current && typeof current === "object"
          ? { ...current }
          : {};
        cursor = cursor[key];
      }
      cursor[path[path.length - 1]] = value;
      return next;
    });
  };

  const updateHelpCenterArrayItem = (path, index, value) => {
    setHelpCenterContent((prev) => {
      const next = { ...(prev || {}) };
      let cursor = next;
      for (let i = 0; i < path.length - 1; i++) {
        const key = path[i];
        const current = cursor[key];
        cursor[key] = Array.isArray(current)
          ? [...current]
          : current && typeof current === "object"
          ? { ...current }
          : {};
        cursor = cursor[key];
      }
      const key = path[path.length - 1];
      const arr = Array.isArray(cursor[key]) ? [...cursor[key]] : [];
      arr[index] = value;
      cursor[key] = arr;
      return next;
    });
  };

  const updateLegalField = (slug, path, value) => {
    setLegalContent((prev) => {
      const next = { ...(prev || {}) };
      const page = { ...(next[slug] || {}) };
      next[slug] = page;
      let cursor = page;
      for (let i = 0; i < path.length - 1; i++) {
        const key = path[i];
        const current = cursor[key];
        cursor[key] = Array.isArray(current)
          ? [...current]
          : current && typeof current === "object"
          ? { ...current }
          : {};
        cursor = cursor[key];
      }
      cursor[path[path.length - 1]] = value;
      return next;
    });
  };

  const updateLegalArrayItem = (slug, path, index, value) => {
    setLegalContent((prev) => {
      const next = { ...(prev || {}) };
      const page = { ...(next[slug] || {}) };
      next[slug] = page;
      let cursor = page;
      for (let i = 0; i < path.length - 1; i++) {
        const key = path[i];
        const current = cursor[key];
        cursor[key] = Array.isArray(current)
          ? [...current]
          : current && typeof current === "object"
          ? { ...current }
          : {};
        cursor = cursor[key];
      }
      const key = path[path.length - 1];
      const arr = Array.isArray(cursor[key]) ? [...cursor[key]] : [];
      arr[index] = value;
      cursor[key] = arr;
      return next;
    });
  };

  const addAboutItem = (key, value) => {
    setAboutContent((prev) => {
      const arr = Array.isArray(prev?.[key]) ? [...prev[key]] : [];
      return { ...(prev || {}), [key]: [...arr, value] };
    });
  };

  const removeAboutItem = (key, index) => {
    setAboutContent((prev) => {
      const arr = Array.isArray(prev?.[key]) ? [...prev[key]] : [];
      arr.splice(index, 1);
      return { ...(prev || {}), [key]: arr };
    });
  };

  async function handleSave() {
    if (!content || !blogContent || !aboutContent || !whyContent || !howContent || !faqContent || !helpCenterContent || !legalContent || !shopContent || !siteChromeContent) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/dashboard/home", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const blogRes = await fetch("/api/dashboard/blog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: blogContent }),
      });
      const aboutRes = await fetch("/api/dashboard/about", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: aboutContent }),
      });
      const whyRes = await fetch("/api/dashboard/why-weluxo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: whyContent }),
      });
      const howRes = await fetch("/api/dashboard/how-it-works", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: howContent }),
      });
      const faqRes = await fetch("/api/dashboard/faq", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: faqContent }),
      });
      const helpCenterRes = await fetch("/api/dashboard/help-center", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: helpCenterContent }),
      });
      const shopRes = await fetch("/api/dashboard/shop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: shopContent }),
      });
      const siteChromeRes = await fetch("/api/dashboard/site-chrome", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(siteChromeContent),
      });
      const legalResponses = await Promise.all(
        LEGAL_SLUGS.map((slug) =>
          fetch(`/api/dashboard/legal/${slug}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content: legalContent[slug] }),
          })
        )
      );

      if (!res.ok || !blogRes.ok || !aboutRes.ok || !whyRes.ok || !howRes.ok || !faqRes.ok || !helpCenterRes.ok || !shopRes.ok || !siteChromeRes.ok || legalResponses.some((response) => !response.ok)) throw new Error("save");
      setMessage("Saved! Refresh preview if needed.");
    } catch (err) {
      setError("Save failed. Try again.");
    } finally {
      setSaving(false);
    }
  }

  const openModal = (key) => {
    setActiveSection(key);
    setModalOpen(true);
    setMessage("");
    setError("");
  };

  const closeModal = () => {
    setModalOpen(false);
    setActiveSection(null);
  };

  const renderModalBody = () => {
    if (activeSection?.startsWith("howStep:")) {
      const idx = Number(activeSection.split(":")[1]);
      const step = howContent?.detailSteps?.[idx] || EMPTY_HOW_STEP;
      const updateStep = (field, value) => updateHowField(["detailSteps", idx, field], value);
      return (
        <>
          <Input label="ID" value={step.id || ""} onChange={(v) => updateStep("id", v)} />
          <Input label="Number" value={step.number || ""} onChange={(v) => updateStep("number", v)} />
          <Input label="Eyebrow" value={step.eyebrow || ""} onChange={(v) => updateStep("eyebrow", v)} />
          <Input label="Title" value={step.title || ""} onChange={(v) => updateStep("title", v)} />
          <Textarea label="Copy" value={step.copy || ""} onChange={(v) => updateStep("copy", v)} />
          <Textarea label="Highlights (one per line)" value={(step.items || []).join("\n")} onChange={(v) => updateStep("items", v.split("\n").filter(Boolean))} />
          <Textarea label="Visual flow (one per line)" value={(step.flow || []).join("\n")} onChange={(v) => updateStep("flow", v.split("\n").filter(Boolean))} />
          <Input label="CTA text" value={step.ctaText || ""} onChange={(v) => updateStep("ctaText", v)} />
          <Input label="CTA URL" value={step.ctaUrl || ""} onChange={(v) => updateStep("ctaUrl", v)} />
          <Input label="Image URL" value={step.image || ""} onChange={(v) => updateStep("image", v)} />
          <Input label="Alt text" value={step.alt || ""} onChange={(v) => updateStep("alt", v)} />
          <FileInput
            label="Upload image"
            onSelect={async (file) => {
              const dataUrl = await readFileAsDataUrl(file);
              updateStep("image", dataUrl);
              updateStep("alt", step.alt || file.name);
            }}
          />
        </>
      );
    }
    if (activeSection?.startsWith("legal:")) {
      const [, slug, type, indexValue] = activeSection.split(":");
      const page = legalContent?.[slug] || {};
      const index = Number(indexValue);
      if (type === "hero") {
        const hero = page.hero || {};
        const seo = page.seo || {};
        return (
          <>
            <Input label="Eyebrow" value={hero.eyebrow || ""} onChange={(v) => updateLegalField(slug, ["hero", "eyebrow"], v)} />
            <Input label="Title" value={hero.title || ""} onChange={(v) => updateLegalField(slug, ["hero", "title"], v)} />
            <Textarea label="Opening answer" value={hero.intro || ""} onChange={(v) => updateLegalField(slug, ["hero", "intro"], v)} />
            <Input label="SEO title" value={seo.title || ""} onChange={(v) => updateLegalField(slug, ["seo", "title"], v)} />
            <Textarea label="Meta description" value={seo.description || ""} onChange={(v) => updateLegalField(slug, ["seo", "description"], v)} />
            <Input label="Primary keyword" value={seo.primaryKeyword || ""} onChange={(v) => updateLegalField(slug, ["seo", "primaryKeyword"], v)} />
            <Input label="Secondary keywords" value={seo.secondaryKeywords || ""} onChange={(v) => updateLegalField(slug, ["seo", "secondaryKeywords"], v)} />
          </>
        );
      }
      if (type === "section") {
        const section = page.sections?.[index] || {};
        const updateSection = (field, value) => updateLegalField(slug, ["sections", index, field], value);
        return (
          <>
            <Input label="Section title" value={section.title || ""} onChange={(v) => updateSection("title", v)} />
            <Textarea label="Body" value={section.body || ""} onChange={(v) => updateSection("body", v)} />
            <Textarea label="Bullets (one per line)" value={(section.bullets || []).join("\n")} onChange={(v) => updateSection("bullets", v.split("\n").filter(Boolean))} />
            <Textarea label="Steps (one per line)" value={(section.steps || []).join("\n")} onChange={(v) => updateSection("steps", v.split("\n").filter(Boolean))} />
            <LegalTableEditor table={section.table} onChange={(value) => updateSection("table", value)} />
          </>
        );
      }
      if (type === "faq") {
        const faq = page.faq || {};
        const faqItems = Array.isArray(faq.items) ? faq.items : [];
        return (
          <>
            <Input label="FAQ title" value={faq.title || ""} onChange={(v) => updateLegalField(slug, ["faq", "title"], v)} />
            <LegalFaqEditor
              slug={slug}
              path={["faq", "items"]}
              items={faqItems}
              onChange={updateLegalArrayItem}
              onAdd={() => updateLegalField(slug, ["faq", "items"], [...faqItems, { ...EMPTY_HOW_FAQ }])}
              onRemove={(index) => updateLegalField(slug, ["faq", "items"], faqItems.filter((_, itemIndex) => itemIndex !== index))}
            />
          </>
        );
      }
    }
    if (activeSection === "siteChrome") {
      const header = siteChromeContent?.header || {};
      const footer = siteChromeContent?.footer || {};
      const updateHeader = (field, value) => updateSiteChromeField(["header", field], value);
      const updateFooter = (field, value) => updateSiteChromeField(["footer", field], value);
      const updateFooterNested = (field, nestedField, value) => updateSiteChromeField(["footer", field, nestedField], value);
      const updateLink = (field, index, key, value) => {
        const items = Array.isArray(footer[field]) ? footer[field] : [];
        updateSiteChromeArrayItem(["footer", field], index, { ...(items[index] || {}), [key]: value });
      };
      const updateHeaderLink = (field, index, key, value) => {
        const items = Array.isArray(header[field]) ? header[field] : [];
        updateSiteChromeArrayItem(["header", field], index, { ...(items[index] || {}), [key]: value });
      };
      return (
        <>
          <h4 style={{ margin: "4px 0 0" }}>Header announcement</h4>
          <Input label="Shipping message" value={header.announcementShipping || ""} onChange={(v) => updateHeader("announcementShipping", v)} />
          <Input label="Support message" value={header.announcementSupport || ""} onChange={(v) => updateHeader("announcementSupport", v)} />
          <Input label="Announcement separator" value={header.announcementSeparator || ""} onChange={(v) => updateHeader("announcementSeparator", v)} />

          <h4 style={{ margin: "12px 0 0" }}>Header navigation and cart</h4>
          {["searchPlaceholder", "searchButtonLabel", "trackOrderLabel", "signInLabel", "accountLabel", "accountTooltip", "signInTooltip", "cartTooltip", "shopAllLabel", "trendingLabel", "categoriesLabel", "categoryHeading", "blogLabel", "aboutLabel", "helpLabel", "helpTooltip", "allProductsLabel", "myAccountLabel", "ordersLabel", "supportLabel", "signOutLabel", "helpCenterLabel", "mobileTrackOrderLabel", "cartLabel", "mobileSearchPlaceholder", "yourCartLabel", "cartReadyLabel", "cartItemLabel", "cartItemsLabel", "closeCartLabel", "emptyCartLabel", "startShoppingLabel", "quantityLabel", "quantitySeparator", "subtotalLabel", "viewCartLabel", "checkoutLabel"].map((field) => (
            <Input key={field} label={field.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase())} value={header[field] || ""} onChange={(v) => updateHeader(field, v)} />
          ))}

          <h4 style={{ margin: "12px 0 0" }}>Header category links</h4>
          {(header.categoryLinks || []).map((link, index) => (
            <div key={`category-${index}`} style={{ border: "1px solid #eee", borderRadius: 8, padding: 10, background: "#fafafa" }}>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>Category {index + 1}</div>
              <Input label="Label" value={link?.label || ""} onChange={(v) => updateHeaderLink("categoryLinks", index, "label", v)} />
              <Input label="URL" value={link?.href || ""} onChange={(v) => updateHeaderLink("categoryLinks", index, "href", v)} />
            </div>
          ))}
          <h4 style={{ margin: "12px 0 0" }}>Header about links</h4>
          {(header.aboutLinks || []).map((link, index) => (
            <div key={`about-${index}`} style={{ border: "1px solid #eee", borderRadius: 8, padding: 10, background: "#fafafa" }}>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>About link {index + 1}</div>
              <Input label="Label" value={link?.label || ""} onChange={(v) => updateHeaderLink("aboutLinks", index, "label", v)} />
              <Input label="URL" value={link?.href || ""} onChange={(v) => updateHeaderLink("aboutLinks", index, "href", v)} />
            </div>
          ))}

          <h4 style={{ margin: "12px 0 0" }}>Footer brand and trust cards</h4>
          <Input label="Logo text" value={footer.logoText || ""} onChange={(v) => updateFooter("logoText", v)} />
          <Textarea label="Brand description" value={footer.brandDescription || ""} onChange={(v) => updateFooter("brandDescription", v)} />
          {(footer.trustItems || []).map((item, index) => (
            <div key={`trust-${index}`} style={{ border: "1px solid #eee", borderRadius: 8, padding: 10, background: "#fafafa" }}>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>Trust card {index + 1}</div>
              <Input label="Icon key (shipping, support, or secure)" value={item?.icon || ""} onChange={(v) => updateSiteChromeArrayItem(["footer", "trustItems"], index, { ...(item || {}), icon: v })} />
              <Input label="Title" value={item?.title || ""} onChange={(v) => updateSiteChromeArrayItem(["footer", "trustItems"], index, { ...(item || {}), title: v })} />
              <Textarea label="Copy" value={item?.copy || ""} onChange={(v) => updateSiteChromeArrayItem(["footer", "trustItems"], index, { ...(item || {}), copy: v })} />
            </div>
          ))}

          <h4 style={{ margin: "12px 0 0" }}>Footer columns</h4>
          <Input label="Shop column title" value={footer.columns?.shopTitle || ""} onChange={(v) => updateFooterNested("columns", "shopTitle", v)} />
          <Input label="Support column title" value={footer.columns?.supportTitle || ""} onChange={(v) => updateFooterNested("columns", "supportTitle", v)} />
          <Input label="Company column title" value={footer.columns?.companyTitle || ""} onChange={(v) => updateFooterNested("columns", "companyTitle", v)} />
          <Input label="Legal column title" value={footer.columns?.legalTitle || ""} onChange={(v) => updateFooterNested("columns", "legalTitle", v)} />
          {["shopLinks", "supportLinks", "companyLinks", "legalLinks"].map((field) => (
            <div key={field} style={{ display: "grid", gap: 8 }}>
              <h4 style={{ margin: "8px 0 0" }}>{field.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase())}</h4>
              {(footer[field] || []).map((link, index) => (
                <div key={`${field}-${index}`} style={{ border: "1px solid #eee", borderRadius: 8, padding: 10, background: "#fafafa" }}>
                  <div style={{ fontWeight: 600, marginBottom: 6 }}>Link {index + 1}</div>
                  <Input label="Label" value={link?.label || ""} onChange={(v) => updateLink(field, index, "label", v)} />
                  <Input label="URL" value={link?.href || ""} onChange={(v) => updateLink(field, index, "href", v)} />
                </div>
              ))}
            </div>
          ))}

          <h4 style={{ margin: "12px 0 0" }}>Footer support callout</h4>
          <Input label="Eyebrow" value={footer.contact?.eyebrow || ""} onChange={(v) => updateFooterNested("contact", "eyebrow", v)} />
          <Input label="Title" value={footer.contact?.title || ""} onChange={(v) => updateFooterNested("contact", "title", v)} />
          <Textarea label="Copy" value={footer.contact?.copy || ""} onChange={(v) => updateFooterNested("contact", "copy", v)} />
          <Input label="Button label" value={footer.contact?.buttonLabel || ""} onChange={(v) => updateFooterNested("contact", "buttonLabel", v)} />
          <Input label="Button URL" value={footer.contact?.buttonHref || ""} onChange={(v) => updateFooterNested("contact", "buttonHref", v)} />

          <h4 style={{ margin: "12px 0 0" }}>Footer utility text</h4>
          <Input label="Copyright suffix" value={footer.copyrightSuffix || ""} onChange={(v) => updateFooter("copyrightSuffix", v)} />
          <Input label="Security status" value={footer.securityLabel || ""} onChange={(v) => updateFooter("securityLabel", v)} />
          <Input label="Support status" value={footer.supportStatusLabel || ""} onChange={(v) => updateFooter("supportStatusLabel", v)} />
          <h4 style={{ margin: "12px 0 0" }}>Footer social links</h4>
          {(footer.socials || []).map((social, index) => (
            <div key={`social-${index}`} style={{ border: "1px solid #eee", borderRadius: 8, padding: 10, background: "#fafafa" }}>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>{social?.platform || `Social ${index + 1}`}</div>
              <Input label="Accessible label" value={social?.label || ""} onChange={(v) => updateLink("socials", index, "label", v)} />
              <Input label="URL" value={social?.href || ""} onChange={(v) => updateLink("socials", index, "href", v)} />
            </div>
          ))}
        </>
      );
    }
    switch (activeSection) {
      case "faqHero": {
        const hero = faqContent?.hero || {};
        const seo = faqContent?.seo || {};
        return (
          <>
            <Input label="Eyebrow" value={hero.eyebrow || ""} onChange={(v) => updateFaqField(["hero", "eyebrow"], v)} />
            <Input label="Title" value={hero.title || ""} onChange={(v) => updateFaqField(["hero", "title"], v)} />
            <Textarea label="Intro" value={hero.intro || ""} onChange={(v) => updateFaqField(["hero", "intro"], v)} />
            <Input label="SEO title" value={seo.title || ""} onChange={(v) => updateFaqField(["seo", "title"], v)} />
            <Textarea label="Meta description" value={seo.description || ""} onChange={(v) => updateFaqField(["seo", "description"], v)} />
            <Input label="Social title" value={seo.ogTitle || ""} onChange={(v) => updateFaqField(["seo", "ogTitle"], v)} />
            <Textarea label="Social description" value={seo.ogDescription || ""} onChange={(v) => updateFaqField(["seo", "ogDescription"], v)} />
          </>
        );
      }
      case "faqQuestions": {
        const section = faqContent?.faq || {};
        const faqItems = Array.isArray(section.items) ? section.items : [];
        return (
          <>
            <Input label="Eyebrow" value={section.eyebrow || ""} onChange={(v) => updateFaqField(["faq", "eyebrow"], v)} />
            <Input label="Title" value={section.title || ""} onChange={(v) => updateFaqField(["faq", "title"], v)} />
            <FaqEditor
              path={["faq", "items"]}
              items={faqItems}
              onChange={updateFaqArrayItem}
              onAdd={() => updateFaqField(["faq", "items"], [...faqItems, { ...EMPTY_FAQ_ITEM }])}
              onRemove={(index) => updateFaqField(["faq", "items"], faqItems.filter((_, itemIndex) => itemIndex !== index))}
            />
          </>
        );
      }
      case "faqSupport": {
        const section = faqContent?.support || {};
        return (
          <>
            <Input label="Eyebrow" value={section.eyebrow || ""} onChange={(v) => updateFaqField(["support", "eyebrow"], v)} />
            <Input label="Title" value={section.title || ""} onChange={(v) => updateFaqField(["support", "title"], v)} />
            <Textarea label="Copy" value={section.copy || ""} onChange={(v) => updateFaqField(["support", "copy"], v)} />
            <Input label="Primary CTA" value={section.primaryCta || ""} onChange={(v) => updateFaqField(["support", "primaryCta"], v)} />
            <Input label="Primary URL" value={section.primaryUrl || ""} onChange={(v) => updateFaqField(["support", "primaryUrl"], v)} />
            <Input label="Secondary CTA" value={section.secondaryCta || ""} onChange={(v) => updateFaqField(["support", "secondaryCta"], v)} />
            <Input label="Secondary URL" value={section.secondaryUrl || ""} onChange={(v) => updateFaqField(["support", "secondaryUrl"], v)} />
          </>
        );
      }
      case "helpHero": {
        const hero = helpCenterContent?.hero || {};
        const seo = helpCenterContent?.seo || {};
        return (
          <>
            <Input label="Eyebrow" value={hero.eyebrow || ""} onChange={(v) => updateHelpCenterField(["hero", "eyebrow"], v)} />
            <Input label="Title" value={hero.title || ""} onChange={(v) => updateHelpCenterField(["hero", "title"], v)} />
            <Textarea label="Copy" value={hero.copy || ""} onChange={(v) => updateHelpCenterField(["hero", "copy"], v)} />
            <Input label="Search placeholder" value={hero.searchPlaceholder || ""} onChange={(v) => updateHelpCenterField(["hero", "searchPlaceholder"], v)} />
            <Input label="SEO title" value={seo.title || ""} onChange={(v) => updateHelpCenterField(["seo", "title"], v)} />
            <Textarea label="Meta description" value={seo.description || ""} onChange={(v) => updateHelpCenterField(["seo", "description"], v)} />
            <Input label="Social title" value={seo.ogTitle || ""} onChange={(v) => updateHelpCenterField(["seo", "ogTitle"], v)} />
            <Textarea label="Social description" value={seo.ogDescription || ""} onChange={(v) => updateHelpCenterField(["seo", "ogDescription"], v)} />
          </>
        );
      }
      case "helpCategories": {
        const section = helpCenterContent?.categories || {};
        const categories = Array.isArray(section.items) ? section.items : [];
        return (
          <>
            <Input label="Eyebrow" value={section.eyebrow || ""} onChange={(v) => updateHelpCenterField(["categories", "eyebrow"], v)} />
            <Input label="Title" value={section.title || ""} onChange={(v) => updateHelpCenterField(["categories", "title"], v)} />
            <Textarea label="Copy" value={section.copy || ""} onChange={(v) => updateHelpCenterField(["categories", "copy"], v)} />
            <HelpCategoryEditor
              path={["categories", "items"]}
              items={categories}
              onChange={updateHelpCenterArrayItem}
              onAdd={() => updateHelpCenterField(["categories", "items"], [...categories, { ...EMPTY_HELP_CATEGORY }])}
              onRemove={(index) => updateHelpCenterField(["categories", "items"], categories.filter((_, itemIndex) => itemIndex !== index))}
            />
          </>
        );
      }
      case "helpContact": {
        const section = helpCenterContent?.contactSupport || {};
        return (
          <>
            <Input label="Eyebrow" value={section.eyebrow || ""} onChange={(v) => updateHelpCenterField(["contactSupport", "eyebrow"], v)} />
            <Input label="Title" value={section.title || ""} onChange={(v) => updateHelpCenterField(["contactSupport", "title"], v)} />
            <Textarea label="Copy" value={section.copy || ""} onChange={(v) => updateHelpCenterField(["contactSupport", "copy"], v)} />
            <Input label="Support email" value={section.email || ""} onChange={(v) => updateHelpCenterField(["contactSupport", "email"], v)} />
            <Input label="Email note" value={section.emailNote || ""} onChange={(v) => updateHelpCenterField(["contactSupport", "emailNote"], v)} />
            <Input label="Live chat title" value={section.liveChatTitle || ""} onChange={(v) => updateHelpCenterField(["contactSupport", "liveChatTitle"], v)} />
            <Textarea label="Live chat copy" value={section.liveChatCopy || ""} onChange={(v) => updateHelpCenterField(["contactSupport", "liveChatCopy"], v)} />
            <Input label="Live chat button" value={section.liveChatButton || ""} onChange={(v) => updateHelpCenterField(["contactSupport", "liveChatButton"], v)} />
            <Input label="Telegram title" value={section.telegramTitle || ""} onChange={(v) => updateHelpCenterField(["contactSupport", "telegramTitle"], v)} />
            <Textarea label="Telegram copy" value={section.telegramCopy || ""} onChange={(v) => updateHelpCenterField(["contactSupport", "telegramCopy"], v)} />
            <Input label="Telegram button" value={section.telegramButton || ""} onChange={(v) => updateHelpCenterField(["contactSupport", "telegramButton"], v)} />
            <Input label="Telegram URL" value={section.telegramUrl || ""} onChange={(v) => updateHelpCenterField(["contactSupport", "telegramUrl"], v)} />
            <Input label="Form title" value={section.formTitle || ""} onChange={(v) => updateHelpCenterField(["contactSupport", "formTitle"], v)} />
            <Input label="Submit button" value={section.submitButton || ""} onChange={(v) => updateHelpCenterField(["contactSupport", "submitButton"], v)} />
            <Textarea label="Success message" value={section.successMessage || ""} onChange={(v) => updateHelpCenterField(["contactSupport", "successMessage"], v)} />
          </>
        );
      }
      case "helpFaq": {
        const section = helpCenterContent?.faq || {};
        const faqItems = Array.isArray(section.items) ? section.items : [];
        return (
          <>
            <Input label="Eyebrow" value={section.eyebrow || ""} onChange={(v) => updateHelpCenterField(["faq", "eyebrow"], v)} />
            <Input label="Title" value={section.title || ""} onChange={(v) => updateHelpCenterField(["faq", "title"], v)} />
            <HelpFaqEditor
              path={["faq", "items"]}
              items={faqItems}
              onChange={updateHelpCenterArrayItem}
              onAdd={() => updateHelpCenterField(["faq", "items"], [...faqItems, { ...EMPTY_HELP_FAQ }])}
              onRemove={(index) => updateHelpCenterField(["faq", "items"], faqItems.filter((_, itemIndex) => itemIndex !== index))}
            />
          </>
        );
      }
      case "shopHero": {
        const hero = shopContent?.hero || {};
        return (
          <>
            <Input label="Title" value={hero.title || ""} onChange={(v) => updateShopField(["hero", "title"], v)} />
            <Textarea label="Description" value={hero.description || ""} onChange={(v) => updateShopField(["hero", "description"], v)} />
            <Input label="Background image URL" value={hero.backgroundImage || ""} onChange={(v) => updateShopField(["hero", "backgroundImage"], v)} />
            <Input label="Background position" value={hero.backgroundPosition || "center"} onChange={(v) => updateShopField(["hero", "backgroundPosition"], v)} />
            <FileInput
              label="Upload background image"
              onSelect={async (file) => {
                const dataUrl = await readFileAsDataUrl(file);
                updateShopField(["hero", "backgroundImage"], dataUrl);
              }}
            />
          </>
        );
      }
      case "shopCatalog":
        return (
          <>
            <Input label="Search placeholder" value={shopContent?.searchPlaceholder || ""} onChange={(v) => updateShopField(["searchPlaceholder"], v)} />
            <Input label="CTA text" value={shopContent?.ctaText || ""} onChange={(v) => updateShopField(["ctaText"], v)} />
            <Input label="Catalog title" value={shopContent?.catalogTitle || ""} onChange={(v) => updateShopField(["catalogTitle"], v)} />
            <Textarea label="Empty state message" value={shopContent?.emptyMessage || ""} onChange={(v) => updateShopField(["emptyMessage"], v)} />
            <Input label="Maximum category filters" value={shopContent?.categoryLimit ?? 6} onChange={(v) => updateShopField(["categoryLimit"], v)} />
          </>
        );
      case "hero1":
      case "hero2": {
        const idx = activeSection === "hero1" ? 0 : 1;
        const card = content?.heroCards?.[idx] || {};
        return (
          <>
            <Input label="Title" value={card.title || ""} onChange={(v) => updateArrayItem("heroCards", idx, { ...card, title: v })} />
            <Input label="Subtitle" value={card.subtitle || ""} onChange={(v) => updateArrayItem("heroCards", idx, { ...card, subtitle: v })} />
            <Input label="Alt text" value={card.alt || ""} onChange={(v) => updateArrayItem("heroCards", idx, { ...card, alt: v })} />
            <Input label="Image URL" value={card.image || ""} onChange={(v) => updateArrayItem("heroCards", idx, { ...card, image: v })} />
            <FileInput
              label="Upload image"
              onSelect={async (file) => {
                const dataUrl = await readFileAsDataUrl(file);
                updateArrayItem("heroCards", idx, { ...card, image: dataUrl, alt: card.alt || file.name });
              }}
            />
            {idx === 1 && (
              <>
                <Textarea
                  label="Highlights (one per line)"
                  value={(card.highlights || []).join("\n")}
                  onChange={(v) => updateArrayItem("heroCards", idx, { ...card, highlights: v.split("\n").filter(Boolean) })}
                />
                <Input label="CTA text" value={card.cta || ""} onChange={(v) => updateArrayItem("heroCards", idx, { ...card, cta: v })} />
              </>
            )}
          </>
        );
      }
      case "training": {
        const block = content?.trainingBlock || {};
        return (
          <>
            <Input label="Title" value={block.title || ""} onChange={(v) => updateField(["trainingBlock", "title"], v)} />
            <Textarea label="Copy" value={block.copy || ""} onChange={(v) => updateField(["trainingBlock", "copy"], v)} />
            <Input label="CTA text" value={block.cta || ""} onChange={(v) => updateField(["trainingBlock", "cta"], v)} />
            <Input label="Alt text" value={block.alt || ""} onChange={(v) => updateField(["trainingBlock", "alt"], v)} />
            <Input label="Image URL" value={block.image || ""} onChange={(v) => updateField(["trainingBlock", "image"], v)} />
            <FileInput
              label="Upload image"
              onSelect={async (file) => {
                const dataUrl = await readFileAsDataUrl(file);
                updateField(["trainingBlock", "image"], dataUrl);
                updateField(["trainingBlock", "alt"], block.alt || file.name);
              }}
            />
          </>
        );
      }
      case "banner":
        return <Input label="Banner text" value={content?.bannerText || ""} onChange={(v) => updateField(["bannerText"], v)} />;
      case "welcome": {
        const welcome = content?.welcome || {};
        return (
          <>
            <Input label="Headline" value={welcome.headline || ""} onChange={(v) => updateField(["welcome", "headline"], v)} />
            <Input label="Title" value={welcome.title || ""} onChange={(v) => updateField(["welcome", "title"], v)} />
            <Textarea label="Copy" value={welcome.copy || ""} onChange={(v) => updateField(["welcome", "copy"], v)} />
            <Input label="CTA text" value={welcome.cta || ""} onChange={(v) => updateField(["welcome", "cta"], v)} />
            <Input label="Alt text" value={welcome.alt || ""} onChange={(v) => updateField(["welcome", "alt"], v)} />
            <Input label="Image URL" value={welcome.image || ""} onChange={(v) => updateField(["welcome", "image"], v)} />
            <FileInput
              label="Upload image"
              onSelect={async (file) => {
                const dataUrl = await readFileAsDataUrl(file);
                updateField(["welcome", "image"], dataUrl);
                updateField(["welcome", "alt"], welcome.alt || file.name);
              }}
            />
          </>
        );
      }
      case "reviews": {
        const reviews = content?.reviews || {};
        return (
          <>
            <Input label="Headline" value={reviews.headline || ""} onChange={(v) => updateField(["reviews", "headline"], v)} />
            <Input label="Rating text" value={reviews.ratingText || ""} onChange={(v) => updateField(["reviews", "ratingText"], v)} />
          </>
        );
      }
      case "menus": {
        const menus = content?.menus || {};
        return (
          <>
            <Textarea
              label="Main menu items (one per line)"
              value={(menus.main || []).join("\n")}
              onChange={(v) => updateField(["menus", "main"], v.split("\n").filter(Boolean))}
            />
            <Input label="Footer title" value={menus.footerTitle || ""} onChange={(v) => updateField(["menus", "footerTitle"], v)} />
          </>
        );
      }
      case "products": {
        const productsSection = { ...DEFAULT_PRODUCTS_SECTION, ...(content?.productsSection || {}) };
        return (
          <>
            <Input label="Announcement text" value={productsSection.announcement || ""} onChange={(v) => updateField(["productsSection", "announcement"], v)} />
            <Input label="Products section title" value={productsSection.title || ""} onChange={(v) => updateField(["productsSection", "title"], v)} />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10 }}>
              {(content?.products || []).map((p, idx) => (
                <div key={idx} style={{ border: "1px solid #eee", borderRadius: 8, padding: 10, background: "white" }}>
                  <div style={{ fontWeight: 600, marginBottom: 6 }}>Product {idx + 1}</div>
                  <Input label="Title" value={p?.title || ""} onChange={(v) => updateArrayItem("products", idx, { ...(p || EMPTY_PRODUCT), title: v })} />
                  <Input label="Price" value={p?.price || ""} onChange={(v) => updateArrayItem("products", idx, { ...(p || EMPTY_PRODUCT), price: v })} />
                  <Input label="Alt text" value={p?.alt || ""} onChange={(v) => updateArrayItem("products", idx, { ...(p || EMPTY_PRODUCT), alt: v })} />
                  <Input label="Image URL" value={p?.image || ""} onChange={(v) => updateArrayItem("products", idx, { ...(p || EMPTY_PRODUCT), image: v })} />
                  <FileInput
                    label="Upload image"
                    onSelect={async (file) => {
                      const dataUrl = await readFileAsDataUrl(file);
                      updateArrayItem("products", idx, { ...(p || EMPTY_PRODUCT), image: dataUrl, alt: p?.alt || file.name });
                    }}
                  />
                </div>
              ))}
            </div>
          </>
        );
      }
      case "actionShots":
        return (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10 }}>
            {(content?.actionShots || []).map((url, idx) => (
              <div key={idx} style={{ border: "1px solid #eee", borderRadius: 8, padding: 10, background: "white" }}>
                <Input
                  label={`Action ${idx + 1} video URL (mp4/webm)`}
                  value={typeof url === "string" ? url : url?.video || url?.src || ""}
                  onChange={(v) =>
                    updateArrayItem(
                      "actionShots",
                      idx,
                      typeof url === "string" ? { video: v } : { ...(url || {}), video: v, src: url?.src }
                    )
                  }
                />
                <Input
                  label="Poster image URL (optional)"
                  value={typeof url === "string" ? "" : url?.poster || url?.src || ""}
                  onChange={(v) =>
                    updateArrayItem(
                      "actionShots",
                      idx,
                      typeof url === "string" ? { poster: v } : { ...(url || {}), poster: v }
                    )
                  }
                />
                <Input
                  label="Alt text"
                  value={typeof url === "string" ? "" : url?.alt || ""}
                  onChange={(v) =>
                    updateArrayItem("actionShots", idx, typeof url === "string" ? { video: url, alt: v } : { ...(url || {}), alt: v })
                  }
                />
                <FileInput
                  label="Upload poster"
                  onSelect={async (file) => {
                    const dataUrl = await readFileAsDataUrl(file);
                    const alt = typeof url === "string" ? "" : url?.alt;
                    updateArrayItem("actionShots", idx, { ...(typeof url === "string" ? { video: url } : url), poster: dataUrl, alt: alt || file.name });
                  }}
                />
              </div>
            ))}
          </div>
        );
      case "features":
        return (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10 }}>
            {(content?.features || []).map((feat, idx) => (
              <div key={idx} style={{ border: "1px solid #eee", borderRadius: 8, padding: 10, background: "white" }}>
                <Input label="Title" value={feat?.title || ""} onChange={(v) => updateArrayItem("features", idx, { ...(feat || EMPTY_FEATURE), title: v })} />
                <Textarea label="Copy" value={feat?.copy || ""} onChange={(v) => updateArrayItem("features", idx, { ...(feat || EMPTY_FEATURE), copy: v })} />
              </div>
            ))}
          </div>
        );
      case "aboutHero": {
        const hero = aboutContent?.hero || {};
        return (
          <>
            <Input label="Title" value={hero.title || ""} onChange={(v) => setAboutContent((prev) => ({ ...(prev || {}), hero: { ...(hero || {}), title: v } }))} />
            <Textarea label="Subtitle" value={hero.subtitle || ""} onChange={(v) => setAboutContent((prev) => ({ ...(prev || {}), hero: { ...(hero || {}), subtitle: v } }))} />
          </>
        );
      }
      case "aboutMission":
        return <Textarea label="About Weluxo (paragraphs)" value={aboutContent?.mission || ""} onChange={(v) => setAboutContent((prev) => ({ ...(prev || {}), mission: v }))} />;
      case "aboutValues":
        return <Textarea label="Our Philosophy (paragraphs)" value={aboutContent?.values || ""} onChange={(v) => setAboutContent((prev) => ({ ...(prev || {}), values: v }))} />;
      case "aboutStory":
        return <Textarea label="Looking Ahead (paragraphs)" value={aboutContent?.story || ""} onChange={(v) => setAboutContent((prev) => ({ ...(prev || {}), story: v }))} />;
      case "aboutContactCta": {
        const cta = aboutContent?.contactCta || {};
        return (
          <>
            <Input label="Footer title" value={cta.title || ""} onChange={(v) => setAboutContent((prev) => ({ ...(prev || {}), contactCta: { ...(cta || {}), title: v } }))} />
            <Input label="Footer subtitle" value={cta.copy || ""} onChange={(v) => setAboutContent((prev) => ({ ...(prev || {}), contactCta: { ...(cta || {}), copy: v } }))} />
          </>
        );
      }
      case "aboutApproach":
        return <Textarea label="Our Commitment (paragraphs)" value={aboutContent?.approach || ""} onChange={(v) => setAboutContent((prev) => ({ ...(prev || {}), approach: v }))} />;
      case "aboutTeam":
        return <Textarea label="Why Customers Choose Weluxo (paragraphs)" value={aboutContent?.team || ""} onChange={(v) => setAboutContent((prev) => ({ ...(prev || {}), team: v }))} />;
      case "whyHero": {
        const hero = whyContent?.hero || {};
        return (
          <>
            <Input label="Eyebrow" value={hero.eyebrow || ""} onChange={(v) => updateWhyField(["hero", "eyebrow"], v)} />
            <Input label="Title" value={hero.title || ""} onChange={(v) => updateWhyField(["hero", "title"], v)} />
            <Textarea label="Subtitle" value={hero.subtitle || ""} onChange={(v) => updateWhyField(["hero", "subtitle"], v)} />
            <Input label="Alt text" value={hero.alt || ""} onChange={(v) => updateWhyField(["hero", "alt"], v)} />
            <Input label="Image URL" value={hero.image || ""} onChange={(v) => updateWhyField(["hero", "image"], v)} />
            <FileInput
              label="Upload image"
              onSelect={async (file) => {
                const dataUrl = await readFileAsDataUrl(file);
                updateWhyField(["hero", "image"], dataUrl);
                updateWhyField(["hero", "alt"], hero.alt || file.name);
              }}
            />
          </>
        );
      }
      case "whyCurated": {
        const section = whyContent?.curatedProducts || {};
        return (
          <>
            <Input label="Eyebrow" value={section.eyebrow || ""} onChange={(v) => updateWhyField(["curatedProducts", "eyebrow"], v)} />
            <Input label="Title" value={section.title || ""} onChange={(v) => updateWhyField(["curatedProducts", "title"], v)} />
            <Textarea label="Copy" value={section.copy || ""} onChange={(v) => updateWhyField(["curatedProducts", "copy"], v)} />
          </>
        );
      }
      case "whyShopping": {
        const section = whyContent?.smartShopping || {};
        return (
          <>
            <Input label="Eyebrow" value={section.eyebrow || ""} onChange={(v) => updateWhyField(["smartShopping", "eyebrow"], v)} />
            <Input label="Title" value={section.title || ""} onChange={(v) => updateWhyField(["smartShopping", "title"], v)} />
            <Textarea label="Checklist (one per line)" value={(section.items || []).join("\n")} onChange={(v) => updateWhyField(["smartShopping", "items"], v.split("\n").filter(Boolean))} />
          </>
        );
      }
      case "whyShipping": {
        const section = whyContent?.globalShipping || {};
        return (
          <>
            <Input label="Eyebrow" value={section.eyebrow || ""} onChange={(v) => updateWhyField(["globalShipping", "eyebrow"], v)} />
            <Input label="Title" value={section.title || ""} onChange={(v) => updateWhyField(["globalShipping", "title"], v)} />
            <Textarea label="Copy" value={section.copy || ""} onChange={(v) => updateWhyField(["globalShipping", "copy"], v)} />
            <WhyCardEditor path={["globalShipping", "cards"]} cards={section.cards} onChange={updateWhyArrayItem} />
          </>
        );
      }
      case "whySupport": {
        const section = whyContent?.customerSupport || {};
        return (
          <>
            <Input label="Eyebrow" value={section.eyebrow || ""} onChange={(v) => updateWhyField(["customerSupport", "eyebrow"], v)} />
            <Input label="Title" value={section.title || ""} onChange={(v) => updateWhyField(["customerSupport", "title"], v)} />
            <Textarea label="Copy" value={section.copy || ""} onChange={(v) => updateWhyField(["customerSupport", "copy"], v)} />
            <Textarea label="Checklist (one per line)" value={(section.items || []).join("\n")} onChange={(v) => updateWhyField(["customerSupport", "items"], v.split("\n").filter(Boolean))} />
            <WhyLinkEditor path={["customerSupport", "links"]} links={section.links} onChange={updateWhyArrayItem} />
          </>
        );
      }
      case "whyQuality": {
        const section = whyContent?.qualityFocus || {};
        return (
          <>
            <Input label="Eyebrow" value={section.eyebrow || ""} onChange={(v) => updateWhyField(["qualityFocus", "eyebrow"], v)} />
            <Input label="Title" value={section.title || ""} onChange={(v) => updateWhyField(["qualityFocus", "title"], v)} />
            <Textarea label="Copy" value={section.copy || ""} onChange={(v) => updateWhyField(["qualityFocus", "copy"], v)} />
            <WhyCardEditor path={["qualityFocus", "cards"]} cards={section.cards} onChange={updateWhyArrayItem} />
          </>
        );
      }
      case "whySecure": {
        const section = whyContent?.secureShopping || {};
        return (
          <>
            <Input label="Eyebrow" value={section.eyebrow || ""} onChange={(v) => updateWhyField(["secureShopping", "eyebrow"], v)} />
            <Input label="Title" value={section.title || ""} onChange={(v) => updateWhyField(["secureShopping", "title"], v)} />
            <Textarea label="Items (one per line)" value={(section.items || []).join("\n")} onChange={(v) => updateWhyField(["secureShopping", "items"], v.split("\n").filter(Boolean))} />
          </>
        );
      }
      case "whyPromise": {
        const section = whyContent?.promise || {};
        return (
          <>
            <Input label="Eyebrow" value={section.eyebrow || ""} onChange={(v) => updateWhyField(["promise", "eyebrow"], v)} />
            <Input label="Title" value={section.title || ""} onChange={(v) => updateWhyField(["promise", "title"], v)} />
            <Textarea label="Copy" value={section.copy || ""} onChange={(v) => updateWhyField(["promise", "copy"], v)} />
          </>
        );
      }
      case "whyCta": {
        const section = whyContent?.finalCta || {};
        return (
          <>
            <Input label="Title" value={section.title || ""} onChange={(v) => updateWhyField(["finalCta", "title"], v)} />
            <Input label="Button text" value={section.buttonText || ""} onChange={(v) => updateWhyField(["finalCta", "buttonText"], v)} />
            <Input label="Button URL" value={section.buttonUrl || ""} onChange={(v) => updateWhyField(["finalCta", "buttonUrl"], v)} />
          </>
        );
      }
      case "howHero": {
        const hero = howContent?.hero || {};
        return (
          <>
            <Input label="Eyebrow" value={hero.eyebrow || ""} onChange={(v) => updateHowField(["hero", "eyebrow"], v)} />
            <Input label="Title" value={hero.title || ""} onChange={(v) => updateHowField(["hero", "title"], v)} />
            <Textarea label="Copy" value={hero.copy || ""} onChange={(v) => updateHowField(["hero", "copy"], v)} />
            <Input label="Primary CTA" value={hero.primaryCta || ""} onChange={(v) => updateHowField(["hero", "primaryCta"], v)} />
            <Input label="Primary URL" value={hero.primaryUrl || ""} onChange={(v) => updateHowField(["hero", "primaryUrl"], v)} />
            <Input label="Secondary CTA" value={hero.secondaryCta || ""} onChange={(v) => updateHowField(["hero", "secondaryCta"], v)} />
            <Input label="Secondary URL" value={hero.secondaryUrl || ""} onChange={(v) => updateHowField(["hero", "secondaryUrl"], v)} />
            <Input label="Image URL" value={hero.image || ""} onChange={(v) => updateHowField(["hero", "image"], v)} />
            <Input label="Alt text" value={hero.alt || ""} onChange={(v) => updateHowField(["hero", "alt"], v)} />
            <FileInput
              label="Upload image"
              onSelect={async (file) => {
                const dataUrl = await readFileAsDataUrl(file);
                updateHowField(["hero", "image"], dataUrl);
                updateHowField(["hero", "alt"], hero.alt || file.name);
              }}
            />
          </>
        );
      }
      case "howProcess": {
        const section = howContent?.processOverview || {};
        return (
          <>
            <Input label="Eyebrow" value={section.eyebrow || ""} onChange={(v) => updateHowField(["processOverview", "eyebrow"], v)} />
            <Input label="Title" value={section.title || ""} onChange={(v) => updateHowField(["processOverview", "title"], v)} />
            <HowOverviewEditor steps={section.steps} onChange={updateHowArrayItem} />
          </>
        );
      }
      case "howSupport": {
        const section = howContent?.support || {};
        return (
          <>
            <Input label="Eyebrow" value={section.eyebrow || ""} onChange={(v) => updateHowField(["support", "eyebrow"], v)} />
            <Input label="Title" value={section.title || ""} onChange={(v) => updateHowField(["support", "title"], v)} />
            <Textarea label="Copy" value={section.copy || ""} onChange={(v) => updateHowField(["support", "copy"], v)} />
            <HowLinkEditor path={["support", "links"]} links={section.links} onChange={updateHowArrayItem} />
          </>
        );
      }
      case "howWay": {
        const section = howContent?.way || {};
        return (
          <>
            <Input label="Eyebrow" value={section.eyebrow || ""} onChange={(v) => updateHowField(["way", "eyebrow"], v)} />
            <Input label="Title" value={section.title || ""} onChange={(v) => updateHowField(["way", "title"], v)} />
            <HowPrincipleEditor path={["way", "principles"]} principles={section.principles} onChange={updateHowArrayItem} />
          </>
        );
      }
      case "howFaq": {
        const section = howContent?.faq || {};
        const faqItems = Array.isArray(section.items) ? section.items : [];
        return (
          <>
            <Input label="Eyebrow" value={section.eyebrow || ""} onChange={(v) => updateHowField(["faq", "eyebrow"], v)} />
            <Input label="Title" value={section.title || ""} onChange={(v) => updateHowField(["faq", "title"], v)} />
            <HowFaqEditor
              path={["faq", "items"]}
              items={faqItems}
              onChange={updateHowArrayItem}
              onAdd={() => updateHowField(["faq", "items"], [...faqItems, { ...EMPTY_HOW_FAQ }])}
              onRemove={(index) => updateHowField(["faq", "items"], faqItems.filter((_, itemIndex) => itemIndex !== index))}
            />
          </>
        );
      }
      case "howCta": {
        const section = howContent?.finalCta || {};
        return (
          <>
            <Input label="Eyebrow" value={section.eyebrow || ""} onChange={(v) => updateHowField(["finalCta", "eyebrow"], v)} />
            <Input label="Title" value={section.title || ""} onChange={(v) => updateHowField(["finalCta", "title"], v)} />
            <Textarea label="Copy" value={section.copy || ""} onChange={(v) => updateHowField(["finalCta", "copy"], v)} />
            <Input label="Primary CTA" value={section.primaryCta || ""} onChange={(v) => updateHowField(["finalCta", "primaryCta"], v)} />
            <Input label="Primary URL" value={section.primaryUrl || ""} onChange={(v) => updateHowField(["finalCta", "primaryUrl"], v)} />
            <Input label="Secondary CTA" value={section.secondaryCta || ""} onChange={(v) => updateHowField(["finalCta", "secondaryCta"], v)} />
            <Input label="Secondary URL" value={section.secondaryUrl || ""} onChange={(v) => updateHowField(["finalCta", "secondaryUrl"], v)} />
          </>
        );
      }
      case "blogHero": {
        const hero = blogContent?.hero || {};
        return (
          <>
            <Input label="Title" value={hero.title || ""} onChange={(v) => setBlogContent((prev) => ({ ...(prev || {}), hero: { ...(hero || {}), title: v } }))} />
            <Textarea label="Subtitle" value={hero.subtitle || ""} onChange={(v) => setBlogContent((prev) => ({ ...(prev || {}), hero: { ...(hero || {}), subtitle: v } }))} />
            <Input label="CTA text" value={hero.ctaText || ""} onChange={(v) => setBlogContent((prev) => ({ ...(prev || {}), hero: { ...(hero || {}), ctaText: v } }))} />
            <Input label="CTA URL" value={hero.ctaUrl || ""} onChange={(v) => setBlogContent((prev) => ({ ...(prev || {}), hero: { ...(hero || {}), ctaUrl: v } }))} />
            <Input label="Alt text" value={hero.alt || ""} onChange={(v) => setBlogContent((prev) => ({ ...(prev || {}), hero: { ...(hero || {}), alt: v } }))} />
            <Input label="Image URL" value={hero.image || ""} onChange={(v) => setBlogContent((prev) => ({ ...(prev || {}), hero: { ...(hero || {}), image: v } }))} />
            <FileInput
              label="Upload image"
              onSelect={async (file) => {
                const dataUrl = await readFileAsDataUrl(file);
                setBlogContent((prev) => ({
                  ...(prev || {}),
                  hero: { ...(hero || {}), image: dataUrl, alt: hero.alt || file.name },
                }));
              }}
            />
          </>
        );
      }
      case "blogPosts": {
        return (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 10 }}>
            {(blogContent?.posts || []).map((post, idx) => (
              <div key={post?.id || idx} style={{ border: "1px solid #eee", borderRadius: 8, padding: 10, background: "white" }}>
                <Input label="Title" value={post?.title || ""} onChange={(v) => updateBlogPost(idx, { ...post, title: v })} />
                <Textarea label="Excerpt" value={post?.excerpt || ""} onChange={(v) => updateBlogPost(idx, { ...post, excerpt: v })} />
                <Input label="Author" value={post?.author || ""} onChange={(v) => updateBlogPost(idx, { ...post, author: v })} />
                <Input label="Date" value={post?.date || ""} onChange={(v) => updateBlogPost(idx, { ...post, date: v })} />
                <Input label="Slug/URL" value={post?.slug || ""} onChange={(v) => updateBlogPost(idx, { ...post, slug: v })} />
                <Input label="Alt text" value={post?.alt || ""} onChange={(v) => updateBlogPost(idx, { ...post, alt: v })} />
                <Input label="Image URL" value={post?.image || ""} onChange={(v) => updateBlogPost(idx, { ...post, image: v })} />
                <Textarea
                  label="Tags (one per line)"
                  value={(post?.tags || []).join("\n")}
                  onChange={(v) => updateBlogPost(idx, { ...post, tags: v.split("\n").filter(Boolean) })}
                />
                <FileInput
                  label="Upload image"
                  onSelect={async (file) => {
                    const dataUrl = await readFileAsDataUrl(file);
                    updateBlogPost(idx, { ...post, image: dataUrl, alt: post?.alt || file.name });
                  }}
                />
              </div>
            ))}
          </div>
        );
      }
      default:
        return null;
    }
  };

  if (loading || loadingBlog || loadingAbout || loadingWhy || loadingHow || loadingFaq || loadingHelpCenter || loadingShop || loadingSiteChrome) {
    return <PageSkeleton variant="table" />;
  }

  if (!content) {
    return <div style={{ padding: 16, color: "#b00" }}>{error || "No content loaded."}</div>;
  }
  if (!blogContent) {
    return <div style={{ padding: 16, color: "#b00" }}>{error || "No blog content loaded."}</div>;
  }
  if (!aboutContent) {
    return <div style={{ padding: 16, color: "#b00" }}>{error || "No about content loaded."}</div>;
  }
  if (!whyContent) {
    return <div style={{ padding: 16, color: "#b00" }}>{error || "No Why Weluxo content loaded."}</div>;
  }
  if (!howContent) {
    return <div style={{ padding: 16, color: "#b00" }}>{error || "No How It Works content loaded."}</div>;
  }
  if (!faqContent) {
    return <div style={{ padding: 16, color: "#b00" }}>{error || "No FAQ content loaded."}</div>;
  }
  if (!helpCenterContent) {
    return <div style={{ padding: 16, color: "#b00" }}>{error || "No Help content loaded."}</div>;
  }
  if (!shopContent) {
    return <div style={{ padding: 16, color: "#b00" }}>{error || "No Shop content loaded."}</div>;
  }
  if (!legalContent) {
    return <div style={{ padding: 16, color: "#b00" }}>{error || "No legal page content loaded."}</div>;
  }
  if (!siteChromeContent) {
    return <div style={{ padding: 16, color: "#b00" }}>{error || "No header and footer content loaded."}</div>;
  }

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: "#0b0f1a" }}>
      <div style={{ padding: 16, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: "#94a3b8", fontSize: 12 }}>Preview route:</span>
          {[
            { label: "Home", path: "/" },
            { label: "Blog", path: "/blog" },
            { label: "Shop", path: "/shop" },
            { label: "About", path: "/aboutus" },
            { label: "Why Weluxo", path: "/why-weluxo" },
            { label: "How It Works", path: "/how-it-works" },
            { label: "FAQ", path: "/faq" },
            { label: "Help", path: "/help-center" },
            { label: "Privacy", path: "/privacy-policy" },
            { label: "Terms", path: "/terms-conditions" },
            { label: "Shipping", path: "/shipping-policy" },
            { label: "Returns", path: "/return-refund-policy" },
          ].map((item) => (
            <button
              key={item.path}
              onClick={() => setPreviewPath(item.path)}
              style={{
                padding: "6px 10px",
                borderRadius: 6,
                border: "1px solid #0a66ff",
                background: previewPath === item.path ? "#0a66ff" : "white",
                color: previewPath === item.path ? "white" : "#0a66ff",
                cursor: "pointer",
              }}
            >
              {item.label}
            </button>
          ))}
          <button
            onClick={() => openModal("siteChrome")}
            style={{
              padding: "6px 10px",
              borderRadius: 6,
              border: "1px solid #0a8a5b",
              background: "#0a8a5b",
              color: "white",
              cursor: "pointer",
            }}
          >
            Edit header & footer
          </button>
          <span style={{ color: "#64748b", fontSize: 12 }}>Page copy and global site text are editable here.</span>
        </div>
        {message && <span style={{ color: "#0a8", alignSelf: "center" }}>{message}</span>}
        {error && <span style={{ color: "#c00", alignSelf: "center" }}>{error}</span>}
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            padding: "8px 14px",
            borderRadius: 6,
            border: "1px solid #0a66ff",
            background: saving ? "#dbeafe" : "#0a66ff",
            color: "white",
            cursor: saving ? "default" : "pointer",
          }}
        >
          {saving ? "Saving..." : "Save changes"}
        </button>
      </div>

      <div style={{ flex: 1, overflow: "auto" }}>
        <Header initialChrome={siteChromeContent} disableNav />
        {!showInlinePreview && <iframe title="Preview" src={previewPath} style={{ width: "100%", height: "60vh", border: 0, background: "white" }} />}
        {showInlinePreview && previewPath === "/" && (
          <>
            <Section
              initialContent={content}
              onEdit={{
                banner: () => openModal("banner"),
                hero1: () => openModal("hero1"),
                hero2: () => openModal("hero2"),
                training: () => openModal("training"),
                products: () => openModal("products"),
                actionShots: () => openModal("actionShots"),
                welcome: () => openModal("welcome"),
                reviews: () => openModal("reviews"),
                features: () => openModal("features"),
                menus: () => openModal("menus"),
              }}
            />
            <Box sx={{ my: 4 }}>
              <BlogSection
                initialContent={blogContent}
                onEdit={{
                  hero: () => openModal("blogHero"),
                  posts: () => openModal("blogPosts"),
                }}
              />
            </Box>
          </>
        )}
        {showInlinePreview && previewPath === "/blog" && (
          <Box sx={{ my: 4 }}>
            <BlogSection
              initialContent={blogContent}
              onEdit={{
                hero: () => openModal("blogHero"),
                posts: () => openModal("blogPosts"),
              }}
            />
          </Box>
        )}
        {showInlinePreview && previewPath === "/shop" && (
          <ShopPage
            initialContent={shopContent}
            editable
            onEdit={{
              hero: () => openModal("shopHero"),
              catalog: () => openModal("shopCatalog"),
            }}
          />
        )}
        {showInlinePreview && previewPath === "/aboutus" && (
          <Box sx={{ my: 4 }}>
            <AboutSection
              initialContent={aboutContent}
              onEdit={{
                hero: () => openModal("aboutHero"),
                mission: () => openModal("aboutMission"),
                values: () => openModal("aboutValues"),
                approach: () => openModal("aboutApproach"),
                team: () => openModal("aboutTeam"),
                story: () => openModal("aboutStory"),
                contactCta: () => openModal("aboutContactCta"),
              }}
            />
          </Box>
        )}
        {showInlinePreview && previewPath === "/why-weluxo" && (
          <WhyWeluxoSection
            initialContent={whyContent}
            editable
            onEdit={{
              hero: () => openModal("whyHero"),
              curatedProducts: () => openModal("whyCurated"),
              smartShopping: () => openModal("whyShopping"),
              globalShipping: () => openModal("whyShipping"),
              customerSupport: () => openModal("whySupport"),
              qualityFocus: () => openModal("whyQuality"),
              secureShopping: () => openModal("whySecure"),
              promise: () => openModal("whyPromise"),
              finalCta: () => openModal("whyCta"),
            }}
          />
        )}
        {showInlinePreview && previewPath === "/how-it-works" && (
          <HowItWorksSection
            initialContent={howContent}
            editable
            onEdit={{
              hero: () => openModal("howHero"),
              processOverview: () => openModal("howProcess"),
              step: (index) => openModal(`howStep:${index}`),
              support: () => openModal("howSupport"),
              way: () => openModal("howWay"),
              faq: () => openModal("howFaq"),
              finalCta: () => openModal("howCta"),
            }}
          />
        )}
        {showInlinePreview && previewPath === "/faq" && (
          <FaqPageSection
            initialContent={faqContent}
            editable
            onEdit={{
              hero: () => openModal("faqHero"),
              faq: () => openModal("faqQuestions"),
              support: () => openModal("faqSupport"),
            }}
          />
        )}
        {showInlinePreview && previewPath === "/help-center" && (
          <HelpCenterSection
            initialContent={helpCenterContent}
            editable
            onEdit={{
              hero: () => openModal("helpHero"),
              categories: () => openModal("helpCategories"),
              contactSupport: () => openModal("helpContact"),
              faq: () => openModal("helpFaq"),
            }}
          />
        )}
        {showInlinePreview && activeLegalSlug && (
          <LegalPageSection
            pageSlug={activeLegalSlug}
            initialContent={legalContent[activeLegalSlug]}
            editable
            onEdit={{
              hero: () => openModal(`legal:${activeLegalSlug}:hero`),
              section: (index) => openModal(`legal:${activeLegalSlug}:section:${index}`),
              faq: () => openModal(`legal:${activeLegalSlug}:faq`),
            }}
          />
        )}
        <Footer initialChrome={siteChromeContent} />
      </div>

      {modalOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000 }}>
          <div style={{ width: 800, maxWidth: "95%", maxHeight: "90vh", overflow: "auto", background: "white", borderRadius: 10, padding: 16, boxShadow: "0 12px 40px rgba(0,0,0,0.25)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <h3 style={{ margin: 0, textTransform: "capitalize" }}>{activeSection}</h3>
              <button onClick={closeModal} style={{ border: "1px solid #ddd", borderRadius: 6, background: "white", padding: "6px 10px", cursor: "pointer" }}>Close</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{renderModalBody()}</div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
              <button onClick={closeModal} style={{ padding: "8px 12px", borderRadius: 6, border: "1px solid #ccc", background: "white" }} disabled={saving}>Cancel</button>
              <button onClick={handleSave} disabled={saving} style={{ padding: "8px 12px", borderRadius: 6, border: "0", background: "#0a66ff", color: "white" }}>
                {saving ? "Saving..." : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Input({ label, value, onChange }) {
  return (
    <label style={{ display: "block" }}>
      <div style={{ fontSize: 12, color: "#555", marginBottom: 4 }}>{label}</div>
      <input
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: "100%",
          padding: "8px 10px",
          borderRadius: 6,
          border: "1px solid #d4d4d8",
        }}
      />
    </label>
  );
}

function Textarea({ label, value, onChange }) {
  return (
    <label style={{ display: "block" }}>
      <div style={{ fontSize: 12, color: "#555", marginBottom: 4 }}>{label}</div>
      <textarea
        value={value || ""}
        rows={4}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: "100%",
          padding: "8px 10px",
          borderRadius: 6,
          border: "1px solid #d4d4d8",
          resize: "vertical",
          minHeight: 80,
        }}
      />
    </label>
  );
}

function FileInput({ label, onSelect }) {
  return (
    <label style={{ display: "block" }}>
      <div style={{ fontSize: 12, color: "#555", marginBottom: 4 }}>{label}</div>
      <input
        type="file"
        accept="image/*"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (file) {
            await onSelect(file);
          }
        }}
      />
    </label>
  );
}

function LegalTableEditor({ table, onChange }) {
  if (!table) return null;
  const headers = Array.isArray(table.headers) ? table.headers : [];
  const rows = Array.isArray(table.rows) ? table.rows : [];
  const updateHeader = (index, value) => {
    const nextHeaders = [...headers];
    nextHeaders[index] = value;
    onChange({ ...table, headers: nextHeaders });
  };
  const updateCell = (rowIndex, cellIndex, value) => {
    const nextRows = rows.map((row) => [...row]);
    nextRows[rowIndex][cellIndex] = value;
    onChange({ ...table, rows: nextRows });
  };
  return (
    <div style={{ display: "grid", gap: 10, border: "1px solid #e5e7eb", borderRadius: 8, padding: 10, background: "#fafafa" }}>
      <div style={{ fontWeight: 600 }}>Table content</div>
      <Textarea label="Headers (one per line)" value={headers.join("\n")} onChange={(value) => onChange({ ...table, headers: value.split("\n").filter(Boolean) })} />
      {rows.map((row, rowIndex) => (
        <div key={rowIndex} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 8 }}>
          {row.map((cell, cellIndex) => (
            <Input key={`${rowIndex}-${cellIndex}`} label={`Row ${rowIndex + 1}, column ${cellIndex + 1}`} value={cell || ""} onChange={(value) => updateCell(rowIndex, cellIndex, value)} />
          ))}
        </div>
      ))}
    </div>
  );
}

function LegalFaqEditor({ slug, path, items = [], onChange, onAdd, onRemove }) {
  return (
    <div style={{ display: "grid", gap: 10 }}>
      {(Array.isArray(items) ? items : []).map((item, index) => (
        <div key={index} style={{ border: "1px solid #eee", borderRadius: 8, padding: 10, background: "#fafafa", position: "relative" }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>FAQ {index + 1}</div>
          <Input label="Question" value={item?.question || ""} onChange={(value) => onChange(slug, path, index, { ...(item || EMPTY_HOW_FAQ), question: value })} />
          <Textarea label="Answer" value={item?.answer || ""} onChange={(value) => onChange(slug, path, index, { ...(item || EMPTY_HOW_FAQ), answer: value })} />
          <button type="button" onClick={() => onRemove?.(index)} style={{ border: "1px solid #fecaca", color: "#b91c1c", background: "#fff", borderRadius: 6, padding: "6px 9px", cursor: "pointer" }}>Remove question</button>
        </div>
      ))}
      <button type="button" onClick={onAdd} style={{ padding: "10px", borderRadius: 8, border: "1px dashed #94a3b8", background: "white", cursor: "pointer" }}>+ Add question</button>
    </div>
  );
}

function HowOverviewEditor({ steps = [], onChange }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 10 }}>
      {(Array.isArray(steps) ? steps : []).map((step, index) => (
        <div key={index} style={{ border: "1px solid #eee", borderRadius: 8, padding: 10, background: "#fafafa" }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Journey step {index + 1}</div>
          <Input label="Number" value={step?.number || ""} onChange={(v) => onChange(["processOverview", "steps"], index, { ...(step || {}), number: v })} />
          <Input label="Label" value={step?.label || ""} onChange={(v) => onChange(["processOverview", "steps"], index, { ...(step || {}), label: v })} />
        </div>
      ))}
    </div>
  );
}

function HowLinkEditor({ path, links = [], onChange }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10 }}>
      {(Array.isArray(links) ? links : []).map((link, index) => (
        <div key={index} style={{ border: "1px solid #eee", borderRadius: 8, padding: 10, background: "#fafafa" }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Support link {index + 1}</div>
          <Input label="Label" value={link?.label || ""} onChange={(v) => onChange(path, index, { ...(link || EMPTY_HOW_LINK), label: v })} />
          <Input label="URL" value={link?.url || ""} onChange={(v) => onChange(path, index, { ...(link || EMPTY_HOW_LINK), url: v })} />
        </div>
      ))}
    </div>
  );
}

function HowPrincipleEditor({ path, principles = [], onChange }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10 }}>
      {(Array.isArray(principles) ? principles : []).map((principle, index) => (
        <div key={index} style={{ border: "1px solid #eee", borderRadius: 8, padding: 10, background: "#fafafa" }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Principle {index + 1}</div>
          <Input label="Title" value={principle?.title || ""} onChange={(v) => onChange(path, index, { ...(principle || EMPTY_HOW_PRINCIPLE), title: v })} />
          <Textarea label="Copy" value={principle?.copy || ""} onChange={(v) => onChange(path, index, { ...(principle || EMPTY_HOW_PRINCIPLE), copy: v })} />
        </div>
      ))}
    </div>
  );
}

function HowFaqEditor({ path, items = [], onChange, onAdd, onRemove }) {
  return (
    <div style={{ display: "grid", gap: 10 }}>
      {(Array.isArray(items) ? items : []).map((item, index) => (
        <div key={index} style={{ border: "1px solid #eee", borderRadius: 8, padding: 10, background: "#fafafa" }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>FAQ {index + 1}</div>
          <Input label="Question" value={item?.question || ""} onChange={(v) => onChange(path, index, { ...(item || EMPTY_HOW_FAQ), question: v })} />
          <Textarea label="Answer" value={item?.answer || ""} onChange={(v) => onChange(path, index, { ...(item || EMPTY_HOW_FAQ), answer: v })} />
          <button type="button" onClick={() => onRemove?.(index)} style={{ border: "1px solid #fecaca", color: "#b91c1c", background: "#fff", borderRadius: 6, padding: "6px 9px", cursor: "pointer" }}>Remove question</button>
        </div>
      ))}
      <button type="button" onClick={onAdd} style={{ padding: "10px", borderRadius: 8, border: "1px dashed #94a3b8", background: "white", cursor: "pointer" }}>+ Add question</button>
    </div>
  );
}

function FaqEditor({ path, items = [], onChange, onAdd, onRemove }) {
  return (
    <div style={{ display: "grid", gap: 10 }}>
      {(Array.isArray(items) ? items : []).map((item, index) => (
        <div key={index} style={{ border: "1px solid #eee", borderRadius: 8, padding: 10, background: "#fafafa" }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Question {index + 1}</div>
          <Input label="Question" value={item?.question || ""} onChange={(value) => onChange(path, index, { ...(item || EMPTY_FAQ_ITEM), question: value })} />
          <Textarea label="Answer" value={item?.answer || ""} onChange={(value) => onChange(path, index, { ...(item || EMPTY_FAQ_ITEM), answer: value })} />
          <button type="button" onClick={() => onRemove?.(index)} style={{ border: "1px solid #fecaca", color: "#b91c1c", background: "#fff", borderRadius: 6, padding: "6px 9px", cursor: "pointer" }}>Remove question</button>
        </div>
      ))}
      <button type="button" onClick={onAdd} style={{ padding: "10px", borderRadius: 8, border: "1px dashed #94a3b8", background: "white", cursor: "pointer" }}>+ Add question</button>
    </div>
  );
}

function HelpCategoryEditor({ path, items = [], onChange, onAdd, onRemove }) {
  return (
    <div style={{ display: "grid", gap: 10 }}>
      {(Array.isArray(items) ? items : []).map((item, index) => (
        <div key={index} style={{ border: "1px solid #eee", borderRadius: 8, padding: 10, background: "#fafafa" }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Help category {index + 1}</div>
          <Input label="Category title" value={item?.title || ""} onChange={(value) => onChange(path, index, { ...(item || EMPTY_HELP_CATEGORY), title: value })} />
          <Textarea label="Articles (one per line)" value={(item?.articles || []).join("\n")} onChange={(value) => onChange(path, index, { ...(item || EMPTY_HELP_CATEGORY), articles: value.split("\n").filter(Boolean) })} />
          <button type="button" onClick={() => onRemove?.(index)} style={{ border: "1px solid #fecaca", color: "#b91c1c", background: "#fff", borderRadius: 6, padding: "6px 9px", cursor: "pointer" }}>Remove category</button>
        </div>
      ))}
      <button type="button" onClick={onAdd} style={{ padding: "10px", borderRadius: 8, border: "1px dashed #94a3b8", background: "white", cursor: "pointer" }}>+ Add category</button>
    </div>
  );
}

function HelpFaqEditor({ path, items = [], onChange, onAdd, onRemove }) {
  return (
    <div style={{ display: "grid", gap: 10 }}>
      {(Array.isArray(items) ? items : []).map((item, index) => (
        <div key={index} style={{ border: "1px solid #eee", borderRadius: 8, padding: 10, background: "#fafafa" }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>FAQ {index + 1}</div>
          <Input label="Question" value={item?.question || ""} onChange={(value) => onChange(path, index, { ...(item || EMPTY_HELP_FAQ), question: value })} />
          <Textarea label="Answer" value={item?.answer || ""} onChange={(value) => onChange(path, index, { ...(item || EMPTY_HELP_FAQ), answer: value })} />
          <button type="button" onClick={() => onRemove?.(index)} style={{ border: "1px solid #fecaca", color: "#b91c1c", background: "#fff", borderRadius: 6, padding: "6px 9px", cursor: "pointer" }}>Remove question</button>
        </div>
      ))}
      <button type="button" onClick={onAdd} style={{ padding: "10px", borderRadius: 8, border: "1px dashed #94a3b8", background: "white", cursor: "pointer" }}>+ Add question</button>
    </div>
  );
}

function WhyCardEditor({ path, cards = [], onChange }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10 }}>
      {(Array.isArray(cards) ? cards : []).map((card, index) => (
        <div key={index} style={{ border: "1px solid #eee", borderRadius: 8, padding: 10, background: "#fafafa" }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Card {index + 1}</div>
          <Input label="Title" value={card?.title || ""} onChange={(v) => onChange(path, index, { ...(card || EMPTY_WHY_CARD), title: v })} />
          <Textarea label="Copy" value={card?.copy || ""} onChange={(v) => onChange(path, index, { ...(card || EMPTY_WHY_CARD), copy: v })} />
        </div>
      ))}
    </div>
  );
}

function WhyLinkEditor({ path, links = [], onChange }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10 }}>
      {(Array.isArray(links) ? links : []).map((link, index) => (
        <div key={index} style={{ border: "1px solid #eee", borderRadius: 8, padding: 10, background: "#fafafa" }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Support link {index + 1}</div>
          <Input label="Label" value={link?.label || ""} onChange={(v) => onChange(path, index, { ...(link || EMPTY_WHY_LINK), label: v })} />
          <Input label="URL" value={link?.url || ""} onChange={(v) => onChange(path, index, { ...(link || EMPTY_WHY_LINK), url: v })} />
        </div>
      ))}
    </div>
  );
}
