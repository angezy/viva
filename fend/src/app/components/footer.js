"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowForwardRounded,
  Facebook,
  FavoriteRounded,
  Instagram,
  LinkedIn,
  LocalShippingOutlined,
  LockOutlined,
  MailOutline,
  SecurityOutlined,
  Twitter,
  VerifiedOutlined,
} from "@mui/icons-material";
import { Box, Button, Container, Divider, IconButton, Link as MuiLink, Skeleton, Stack, Typography } from "@mui/material";
import { DEFAULT_SITE_SETTINGS, fetchSiteSettings } from "../lib/siteSettings";
import { DEFAULT_SITE_CHROME, fetchSiteChrome } from "../lib/siteChrome";

const DEFAULT_FOOTER = {
  logoText: "Weluxo",
  description: "Thoughtful gear and guidance for the way you move.",
  homeLabel: "Home",
  homeHref: "/",
  shopLabel: "Shop",
  shopHref: "/shop",
  blogLabel: "Journal",
  blogHref: "/blog",
  aboutusLabel: "About us",
  aboutusHref: "/aboutus",
  facebook: "",
  twitter: "",
  instagram: "",
  linkedin: "",
};

function FooterLink({ href, children }) {
  return (
    <MuiLink
      component={Link}
      href={href || "/"}
      underline="none"
      sx={{
        display: "block",
        width: "fit-content",
        color: "var(--color-text-secondary)",
        fontSize: 13,
        lineHeight: 1.45,
        transition: "color 160ms ease, transform 160ms ease",
        "&:hover": { color: "var(--color-link-hover)", transform: "translateX(2px)" },
      }}
    >
      {children}
    </MuiLink>
  );
}

function FooterColumn({ title, links }) {
  return (
    <Box>
      <Typography sx={{ color: "var(--color-text-primary)", fontSize: 12, fontWeight: 850, letterSpacing: "0.14em", textTransform: "uppercase", mb: 2.25 }}>
        {title}
      </Typography>
      <Stack spacing={1.35}>
        {links.map((link) => <FooterLink key={`${link.href}-${link.label}`} href={link.href}>{link.label}</FooterLink>)}
      </Stack>
    </Box>
  );
}

export default function Footer({ initialChrome = null }) {
  const [footer, setFooter] = useState(null);
  const [chrome, setChrome] = useState(initialChrome);
  const [loading, setLoading] = useState(true);
  const [siteSettings, setSiteSettings] = useState(DEFAULT_SITE_SETTINGS);

  useEffect(() => {
    let active = true;

    fetch("/api/footer", { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then((data) => {
        if (!active) return;
        const record = Array.isArray(data) ? data[0] : data;
        setFooter(record && typeof record === "object" ? record : null);
      })
      .catch((error) => console.error("Error fetching footer:", error))
      .finally(() => active && setLoading(false));

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (initialChrome) {
      setChrome(initialChrome);
      return undefined;
    }

    let active = true;
    fetchSiteChrome()
      .then((data) => active && setChrome(data && typeof data === "object" ? data : DEFAULT_SITE_CHROME))
      .catch((error) => {
        console.error("Error fetching site chrome:", error);
        if (active) setChrome(DEFAULT_SITE_CHROME);
      });

    return () => {
      active = false;
    };
  }, [initialChrome]);

  useEffect(() => {
    fetchSiteSettings().then(setSiteSettings).catch(() => undefined);
  }, []);

  const displayFooter = {
    ...DEFAULT_FOOTER,
    ...(footer || {}),
    logoText: chrome?.footer?.logoText || siteSettings.siteName || footer?.logoText || DEFAULT_FOOTER.logoText,
    description: chrome?.footer?.brandDescription || siteSettings.siteDescription || footer?.description || DEFAULT_FOOTER.description,
  };
  const footerCopy = { ...DEFAULT_SITE_CHROME.footer, ...(chrome?.footer || {}) };
  const shopLinks = Array.isArray(footerCopy.shopLinks) ? footerCopy.shopLinks : [];
  const supportLinks = Array.isArray(footerCopy.supportLinks) ? footerCopy.supportLinks : [];
  const companyLinks = Array.isArray(footerCopy.companyLinks) ? footerCopy.companyLinks : [];
  const legalLinks = Array.isArray(footerCopy.legalLinks) ? footerCopy.legalLinks : [];
  const socialIcon = {
    facebook: <Facebook fontSize="small" />,
    instagram: <Instagram fontSize="small" />,
    twitter: <Twitter fontSize="small" />,
    linkedin: <LinkedIn fontSize="small" />,
  };
  const socialLinks = (Array.isArray(footerCopy.socials) ? footerCopy.socials : []).map((social) => ({
    ...social,
    href: social.href || displayFooter[social.platform] || "",
    icon: socialIcon[social.platform] || <Facebook fontSize="small" />,
  })).filter((link) => link.href);
  const trustItems = Array.isArray(footerCopy.trustItems) ? footerCopy.trustItems : [];
  const footerColumns = footerCopy.columns || {};
  const contactCopy = footerCopy.contact || {};

  return (
    <Box component="footer" sx={{ mt: { xs: 8, md: 12 }, bgcolor: "var(--color-background)", color: "var(--color-text-primary)", borderTop: "1px solid var(--color-border)" }}>
      <Container maxWidth="xl" sx={{ px: { xs: 2.5, sm: 4, lg: 6 } }}>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" },
            gap: { xs: 2, sm: 3 },
            py: { xs: 3, md: 3.5 },
          }}
        >
          {trustItems.map((item) => (
            <Stack key={`${item.title}-${item.copy}`} direction="row" spacing={1.5} alignItems="center">
              <Box sx={{ display: "grid", placeItems: "center", width: 38, height: 38, flexShrink: 0, borderRadius: "50%", bgcolor: "var(--color-accent-soft)", color: "var(--color-accent)" }}>
                {item.icon === "support" ? <VerifiedOutlined /> : item.icon === "secure" ? <LockOutlined /> : <LocalShippingOutlined />}
              </Box>
              <Box>
                <Typography sx={{ fontSize: 13, fontWeight: 850 }}>{item.title}</Typography>
                <Typography sx={{ mt: 0.25, color: "var(--color-text-secondary)", fontSize: 12 }}>{item.copy}</Typography>
              </Box>
            </Stack>
          ))}
        </Box>

        <Divider sx={{ borderColor: "var(--color-border)" }} />

        <Box
          sx={{
            display: "grid",
             gridTemplateColumns: { xs: "1fr 1fr", md: "minmax(240px, 1.5fr) repeat(4, minmax(120px, 1fr)) minmax(220px, 1.2fr)" },
            gap: { xs: 4, md: 5 },
            py: { xs: 6, md: 8 },
          }}
        >
          <Box sx={{ gridColumn: { xs: "1 / -1", md: "auto" } }}>
            {loading ? (
              <>
                <Skeleton variant="text" width={150} height={38} sx={{ bgcolor: "rgba(43,43,43,0.08)" }} />
                <Skeleton variant="text" width="90%" sx={{ bgcolor: "rgba(43,43,43,0.08)" }} />
                <Skeleton variant="text" width="72%" sx={{ bgcolor: "rgba(43,43,43,0.08)" }} />
              </>
            ) : (
              <>
                 <Typography component={Link} href="/" sx={{ display: "inline-block", color: "var(--color-text-primary)", fontSize: 27, fontWeight: 950, letterSpacing: "-0.05em", transition: "color 160ms ease", "&:hover": { color: "var(--color-link-hover)" } }}>
                  {displayFooter.logoText}
                </Typography>
                <Typography sx={{ maxWidth: 280, mt: 1.5, color: "var(--color-text-secondary)", fontSize: 14, lineHeight: 1.7 }}>
                  {displayFooter.description}
                </Typography>
              </>
            )}

            <Stack direction="row" spacing={0.75} sx={{ mt: 2.5 }}>
              {socialLinks.map((social) => (
                 <IconButton key={social.label} component="a" href={social.href} target="_blank" rel="noreferrer" aria-label={social.label} sx={{ width: 34, height: 34, color: "var(--color-text-secondary)", border: "1px solid var(--color-border)", "&:hover": { color: "var(--color-link-hover)", borderColor: "var(--color-link-hover)", bgcolor: "var(--color-primary-soft)" } }}>
                  {social.icon}
                </IconButton>
              ))}
            </Stack>
          </Box>

           <FooterColumn title={footerColumns.shopTitle} links={shopLinks} />
           <FooterColumn title={footerColumns.supportTitle} links={supportLinks} />
           <FooterColumn title={footerColumns.companyTitle} links={companyLinks} />
           <FooterColumn title={footerColumns.legalTitle || "Legal"} links={legalLinks} />

           <Box sx={{ gridColumn: { xs: "1 / -1", md: "auto" }, p: { xs: 2.5, md: 3 }, borderRadius: 3, bgcolor: "#ffffff", border: "1px solid var(--color-border)", boxShadow: "0 10px 30px rgba(43,43,43,0.06)", "& .MuiTypography-root": { color: "var(--color-text-primary)" }, "& .MuiTypography-root:first-of-type": { color: "var(--color-accent)" }, "& .MuiButton-root": { color: "var(--color-primary)", "&:hover": { color: "var(--color-link-hover)", bgcolor: "transparent" } } }}>
            <Typography sx={{ color: "var(--color-accent)", fontSize: 11, fontWeight: 850, letterSpacing: "0.14em", textTransform: "uppercase" }}>{contactCopy.eyebrow}</Typography>
            <Typography sx={{ mt: 1, color: "white", fontSize: 19, fontWeight: 850, letterSpacing: "-0.02em" }}>{contactCopy.title}</Typography>
            <Typography sx={{ mt: 1, color: "var(--color-text-secondary)", fontSize: 13, lineHeight: 1.6 }}>{contactCopy.copy}</Typography>
             <Button component={Link} href={contactCopy.buttonHref || "/contact"} endIcon={<ArrowForwardRounded />} sx={{ mt: 2, px: 0, color: "var(--color-primary)", textTransform: "none", fontWeight: 850, "&:hover": { bgcolor: "transparent", color: "var(--color-link-hover)" } }}>{contactCopy.buttonLabel}</Button>
          </Box>
        </Box>

        <Divider sx={{ borderColor: "var(--color-border)" }} />

        <Box sx={{ display: "flex", flexDirection: { xs: "column", md: "row" }, alignItems: { md: "center" }, justifyContent: "space-between", gap: 2, py: 3 }}>
          <Typography sx={{ flex: { md: 1 }, color: "#7a7d82", fontSize: 12, textAlign: { md: "left" } }}>
            © {new Date().getFullYear()} {displayFooter.logoText}. {footerCopy.copyrightSuffix}
          </Typography>
           <Stack direction="row" spacing={0.65} alignItems="center" justifyContent={{ md: "center" }} sx={{ flex: { md: 1 }, color: "#7a7d82", fontSize: 12 }}>
             <Typography component="span" sx={{ fontSize: "inherit" }}>{footerCopy.createdByLabel || "Created with"}</Typography>
             <FavoriteRounded aria-hidden="true" sx={{ color: "#e25563", fontSize: 16 }} />
             <Typography component="span" sx={{ fontSize: "inherit" }}>by</Typography>
             <Box component="a" href={footerCopy.createdByHref || "https://nickwebproject.com"} target="_blank" rel="noreferrer" sx={{ color: "var(--color-text-primary)", fontSize: "inherit", fontWeight: 800, textDecoration: "none", transition: "color 160ms ease", "&:hover": { color: "var(--color-link-hover)" } }}>
               {footerCopy.createdByName || "Nick Web Project"}
             </Box>
           </Stack>
           <Stack direction="row" flexWrap="wrap" spacing={2} alignItems="center" justifyContent={{ md: "flex-end" }} sx={{ flex: { md: 1 }, color: "#7a7d82" }}>
             <Stack direction="row" spacing={0.7} alignItems="center">
               <SecurityOutlined sx={{ fontSize: 17 }} />
               <Typography sx={{ fontSize: 12 }}>{footerCopy.securityLabel}</Typography>
             </Stack>
             <Stack direction="row" spacing={0.7} alignItems="center">
               <MailOutline sx={{ fontSize: 17 }} />
               <Typography sx={{ fontSize: 12 }}>{footerCopy.supportStatusLabel}</Typography>
             </Stack>
           </Stack>
        </Box>
      </Container>
    </Box>
  );
}
