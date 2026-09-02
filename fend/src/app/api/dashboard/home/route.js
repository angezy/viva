"use server";

import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { requireDashboardAdmin } from "../auth";

const dataPath = path.join(process.cwd(), "data", "home.json");

const DEFAULT_CONTENT = {
  heroCards: [
    {
      title: "Hybrid Training Method",
      subtitle: "Explosive strength · Core stability",
      image:
        "https://images.unsplash.com/photo-1558611848-73f7eb4001a1?auto=format&fit=crop&w=900&q=80",
    },
    {
      title: "9% OFF Grand opening sale!",
      subtitle: "Limited time launch pricing + pro plans.",
      highlights: [
        "Ergonomic design for every move",
        "Durable build, gym and home ready",
        "Free global shipping & easy returns",
      ],
      cta: "Shop the drop",
    },
  ],
  trainingBlock: {
    image:
      "https://images.unsplash.com/photo-1579751626657-72bc17010498?auto=format&fit=crop&w=900&q=80",
    title: "TRAIN SMARTER. LOOK STRONGER. FEEL BETTER.",
    copy:
      "Engineered for athletes who demand more. Master posture, mobility, and power with equipment that keeps up with you—session after session.",
    cta: "Start Training",
  },
  bannerText: "Functional Fitness · Pro Gear · Coach Built Programs",
  productsSection: {
    announcement: "New drops land every Monday \u00b7 Build your stack and save more on bundles",
    title: "Products",
  },
  products: [
    {
      title: "Grip Trainer",
      price: "$69.00",
      image:
        "https://images.unsplash.com/photo-1526506118085-60ce8714f8c5?auto=format&fit=crop&w=800&q=80",
    },
    {
      title: "Power Handles",
      price: "$54.00",
      image:
        "https://images.unsplash.com/photo-1528372444006-1bfc81acab02?auto=format&fit=crop&w=800&q=80",
    },
    {
      title: "Strap Kit",
      price: "$47.00",
      image:
        "https://images.unsplash.com/photo-1527933053326-89d1746b76dc?auto=format&fit=crop&w=800&q=80",
    },
    {
      title: "Level 2 Kit",
      price: "$99.00",
      image:
        "https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=800&q=80",
    },
  ],
  actionShots: [
    "https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=600&q=80",
    "https://images.unsplash.com/photo-1540497077202-7c8a3999166f?auto=format&fit=crop&w=600&q=80",
    "https://images.unsplash.com/photo-1541537103745-ea3429c65dc1?auto=format&fit=crop&w=600&q=80",
    "https://images.unsplash.com/photo-1556817411-31ae72fa3ea0?auto=format&fit=crop&w=600&q=80",
  ],
  welcome: {
    headline: "Welcome to",
    title: "Your Partner in Performance.",
    copy: "Programs, gear, and coaching built to keep you progressing. Sweat tested. Athlete approved.",
    cta: "Join Now",
    image:
      "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=800&q=80",
  },
  reviews: {
    headline: "+100 Reviews From Happy Athletes",
    ratingText: "Average rating 4.9 / 5.0",
  },
  features: [
    { title: "Fast Shipping", copy: "Worldwide delivery on every order." },
    { title: "Secure Payment", copy: "Encrypted checkout for peace of mind." },
    { title: "One Warranty", copy: "Covered for every serious training day." },
    { title: "Expert Support", copy: "Coaches ready to guide your program." },
  ],
  menus: {
    main: ["Home", "Shop", "Programs", "Support"],
    footerTitle: "Stay on our list",
  },
};

async function ensureFile() {
  try {
    await fs.access(dataPath);
  } catch {
    await fs.writeFile(dataPath, JSON.stringify(DEFAULT_CONTENT, null, 2), "utf8");
  }
}

async function readContent() {
  try {
    await ensureFile();
    const raw = await fs.readFile(dataPath, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    console.error("home content read error", err);
    return DEFAULT_CONTENT;
  }
}

async function writeContent(content) {
  await fs.writeFile(dataPath, JSON.stringify(content, null, 2), "utf8");
}

export async function GET() {
  const content = await readContent();
  return NextResponse.json(content);
}

export async function POST(req) {
  const authError = await requireDashboardAdmin("content.manage");
  if (authError) return authError;
  try {
    const body = await req.json();
    if (!body || typeof body !== "object" || !body.content) {
      return NextResponse.json({ error: "Missing content" }, { status: 400 });
    }
    await ensureFile();
    await writeContent(body.content);
    return NextResponse.json({ ok: true, content: body.content });
  } catch (err) {
    console.error("home content write error", err);
    return NextResponse.json({ error: "Save failed" }, { status: 500 });
  }
}
