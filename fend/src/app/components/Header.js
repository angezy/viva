"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AccountCircleOutlined,
  ArrowForwardRounded,
  Close,
  ExpandMore,
  HelpOutline,
  LocalShippingOutlined,
  Menu as MenuIcon,
  Search,
  ShoppingBagOutlined,
} from "@mui/icons-material";
import {
  AppBar,
  Avatar,
  Badge,
  Box,
  Button,
  Divider,
  Drawer,
  Fade,
  IconButton,
  InputBase,
  List,
  ListItem,
  ListItemAvatar,
  ListItemButton,
  ListItemText,
  Menu,
  MenuItem,
  Popover,
  Skeleton,
  Stack,
  Toolbar,
  Tooltip,
  Typography,
} from "@mui/material";
import { fetchCart, fetchSession } from "../lib/apiClient";
import { DEFAULT_SITE_SETTINGS, fetchSiteSettings } from "../lib/siteSettings";
import { DEFAULT_SITE_CHROME, fetchSiteChrome } from "../lib/siteChrome";
import { endLiveChatSession } from "../lib/chatSession";

const DEFAULT_HEADER = {
  Name: "Weluxo",
  Home: "Home",
  Blog: "Journal",
  Shop: "Shop",
  AboutUs: "About",
  LogoUrl: "",
};

const categoryLinks = [
  { label: "Training", href: "/category/training" },
  { label: "Strength", href: "/category/strength" },
  { label: "Recovery", href: "/category/recovery" },
];

const aboutLinks = [
  { label: "About Weluxo", href: "/aboutus" },
  { label: "How it works", href: "/how-it-works" },
  { label: "Why Weluxo", href: "/why-weluxo" },
  { label: "FAQ", href: "/faq" },
];

const headerLinkSx = {
  transition: "color 160ms ease, background-color 160ms ease",
  "&:hover": {
    color: "var(--color-link-hover)",
  },
};

const headerMenuLinkSx = {
  color: "var(--color-text-primary)",
  transition: "color 160ms ease, background-color 160ms ease",
  "&:hover": {
    color: "var(--color-link-hover)",
    bgcolor: "var(--color-primary-soft)",
  },
};

function formatPrice(value) {
  const amount = Number(value) || 0;
  return `$${amount.toFixed(2)}`;
}

export default function Header({ initialHeader = null, initialChrome = null, disableNav = false }) {
  const [header, setHeader] = useState(initialHeader);
  const [chrome, setChrome] = useState(initialChrome);
  const [loading, setLoading] = useState(!initialHeader);
  const [fadeIn, setFadeIn] = useState(Boolean(initialHeader));
  const [session, setSession] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [cartAnchor, setCartAnchor] = useState(null);
  const [cartItems, setCartItems] = useState([]);
  const [cartSubtotal, setCartSubtotal] = useState(0);
  const [cartLoading, setCartLoading] = useState(false);
  const [cartError, setCartError] = useState("");
  const [accountAnchor, setAccountAnchor] = useState(null);
  const [aboutAnchor, setAboutAnchor] = useState(null);
  const [shopAnchor, setShopAnchor] = useState(null);
  const aboutCloseTimer = useRef(null);
  const aboutHoverState = useRef({ button: false, menu: false });
  const shopCloseTimer = useRef(null);
  const shopHoverState = useRef({ button: false, menu: false });
  const [siteSettings, setSiteSettings] = useState(DEFAULT_SITE_SETTINGS);

  useEffect(() => {
    if (initialHeader) {
      setHeader(initialHeader);
      setLoading(false);
      setFadeIn(true);
      return undefined;
    }

    let active = true;
    fetch("/api/header")
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then((data) => {
        if (!active) return;
        const apiHeader = Array.isArray(data) ? data[0] : data;
        setHeader(apiHeader && typeof apiHeader === "object" ? apiHeader : DEFAULT_HEADER);
        setFadeIn(true);
      })
      .catch((error) => {
        console.error("Error fetching header:", error);
        if (active) {
          setHeader(DEFAULT_HEADER);
          setFadeIn(true);
        }
      })
      .finally(() => active && setLoading(false));

    return () => {
      active = false;
    };
  }, [initialHeader]);

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
    fetchSession().then((data) => setSession(data?.user || null)).catch(() => setSession(null));
  }, []);

  useEffect(() => {
    fetchSiteSettings().then(setSiteSettings).catch(() => undefined);
  }, []);

  useEffect(() => () => {
    if (aboutCloseTimer.current) window.clearTimeout(aboutCloseTimer.current);
    if (shopCloseTimer.current) window.clearTimeout(shopCloseTimer.current);
  }, []);

  useEffect(() => {
    const handleCartUpdated = (event) => {
      const data = event.detail || {};
      setCartItems(Array.isArray(data.items) ? data.items : []);
      setCartSubtotal(Number(data.subtotal) || 0);
      setCartError("");
    };

    window.addEventListener("weluxo:cart-updated", handleCartUpdated);
    return () => window.removeEventListener("weluxo:cart-updated", handleCartUpdated);
  }, []);

  const displayHeader = header && typeof header === "object" ? { ...DEFAULT_HEADER, ...header } : DEFAULT_HEADER;
  const headerCopy = {
    ...DEFAULT_SITE_CHROME.header,
    ...(chrome?.header || {}),
    blogLabel: chrome?.header?.blogLabel ?? displayHeader.Blog ?? DEFAULT_SITE_CHROME.header.blogLabel,
    aboutLabel: chrome?.header?.aboutLabel ?? displayHeader.AboutUs ?? DEFAULT_SITE_CHROME.header.aboutLabel,
  };
  const displayCategoryLinks = Array.isArray(headerCopy.categoryLinks) ? headerCopy.categoryLinks : categoryLinks;
  const displayAboutLinks = Array.isArray(headerCopy.aboutLinks) ? headerCopy.aboutLinks : aboutLinks;
  const brandName = siteSettings.siteName || displayHeader.Name || "Weluxo";
  const brandLogo = siteSettings.siteLogoUrl || displayHeader.LogoUrl || "";
  const brandTagline = siteSettings.siteTagline || "Move with intent";
  const cartOpen = Boolean(cartAnchor);
  const cartCount = cartItems.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
  const accountOpen = Boolean(accountAnchor);
  const aboutOpen = Boolean(aboutAnchor);
  const shopOpen = Boolean(shopAnchor);

  const openAboutMenu = (event) => {
    if (disableNav) return;
    if (aboutCloseTimer.current) window.clearTimeout(aboutCloseTimer.current);
    setAccountAnchor(null);
    setShopAnchor(null);
    setAboutAnchor(event.currentTarget);
  };

  const handleAboutMouseEnter = (event) => {
    aboutHoverState.current.button = true;
    openAboutMenu(event);
  };

  const scheduleAboutMenuClose = () => {
    if (aboutCloseTimer.current) window.clearTimeout(aboutCloseTimer.current);
    aboutCloseTimer.current = window.setTimeout(() => {
      if (!aboutHoverState.current.button && !aboutHoverState.current.menu) setAboutAnchor(null);
    }, 250);
  };

  const handleAboutMouseLeave = () => {
    aboutHoverState.current.button = false;
    scheduleAboutMenuClose();
  };

  const handleAboutMenuEnter = () => {
    aboutHoverState.current.menu = true;
    if (aboutCloseTimer.current) window.clearTimeout(aboutCloseTimer.current);
  };

  const handleAboutMenuLeave = () => {
    aboutHoverState.current.menu = false;
    scheduleAboutMenuClose();
  };

  const openShopMenu = (event) => {
    if (disableNav) return;
    if (shopCloseTimer.current) window.clearTimeout(shopCloseTimer.current);
    setAccountAnchor(null);
    setAboutAnchor(null);
    setShopAnchor(event.currentTarget);
  };

  const handleShopMouseEnter = (event) => {
    shopHoverState.current.button = true;
    openShopMenu(event);
  };

  const scheduleShopMenuClose = () => {
    if (shopCloseTimer.current) window.clearTimeout(shopCloseTimer.current);
    shopCloseTimer.current = window.setTimeout(() => {
      if (!shopHoverState.current.button && !shopHoverState.current.menu) setShopAnchor(null);
    }, 250);
  };

  const handleShopMouseLeave = () => {
    shopHoverState.current.button = false;
    scheduleShopMenuClose();
  };

  const handleShopMenuEnter = () => {
    shopHoverState.current.menu = true;
    if (shopCloseTimer.current) window.clearTimeout(shopCloseTimer.current);
  };

  const handleShopMenuLeave = () => {
    shopHoverState.current.menu = false;
    scheduleShopMenuClose();
  };

  const handleNav = () => (event) => {
    if (disableNav) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    setMobileOpen(false);
    setAccountAnchor(null);
    setAboutAnchor(null);
    setShopAnchor(null);
  };

  const handleSignOut = async (event) => {
    event.preventDefault();
    if (disableNav) return;
    setAccountAnchor(null);
    await endLiveChatSession();
    window.location.assign("/api/auth/signout?role=customer");
  };

  const submitSearch = (event) => {
    event.preventDefault();
    if (disableNav) return;
    const query = searchQuery.trim();
    window.location.assign(query ? `/shop?search=${encodeURIComponent(query)}` : "/shop");
    setMobileOpen(false);
  };

  const loadCart = async () => {
    setCartError("");
    setCartLoading(true);
    try {
      const cart = await fetchCart();
      setCartItems(cart.items || []);
      setCartSubtotal(Number(cart.subtotal) || 0);
    } catch (error) {
      setCartError(error.message || "Unable to load cart");
    } finally {
      setCartLoading(false);
    }
  };

  const handleCartClick = (event) => {
    if (disableNav) return;
    setCartAnchor(event.currentTarget);
    loadCart();
  };

  const logo = loading ? (
    <Skeleton variant="rounded" width={42} height={42} />
  ) : (
    <Fade in={fadeIn} timeout={450}>
      <Avatar
        src={brandLogo || undefined}
        alt={brandName}
        sx={{ width: 42, height: 42, bgcolor: "var(--color-primary)", color: "#ffffff", fontWeight: 900, fontSize: 15 }}
      >
        {brandName.slice(0, 2).toUpperCase()}
      </Avatar>
    </Fade>
  );

  return (
    <Box component="header" sx={{ position: "sticky", top: 0, zIndex: (theme) => theme.zIndex.appBar, bgcolor: "#ffffff", color: "var(--color-text-primary)", borderBottom: "1px solid var(--color-border)" }}>
      <Box sx={{ bgcolor: "var(--color-primary)", color: "white", px: { xs: 2, md: 4 }, py: 0.8 }}>
        <Stack direction="row" justifyContent="center" alignItems="center" spacing={1} sx={{ fontSize: 12, letterSpacing: "0.02em" }}>
          <LocalShippingOutlined sx={{ fontSize: 16, color: "var(--color-accent)" }} />
          <Typography component="span" sx={{ fontSize: "inherit", fontWeight: 650 }}>{headerCopy.announcementShipping}</Typography>
          <Box component="span" sx={{ display: { xs: "none", sm: "inline" }, color: "rgba(255,255,255,0.46)" }}>{headerCopy.announcementSeparator}</Box>
          <Typography component="span" sx={{ display: { xs: "none", sm: "inline" }, fontSize: "inherit", color: "rgba(255,255,255,0.78)" }}>{headerCopy.announcementSupport}</Typography>
        </Stack>
      </Box>

      <AppBar position="static" elevation={0} color="transparent" sx={{ color: "inherit", bgcolor: "white" }}>
        <Toolbar sx={{ minHeight: { xs: 68, md: 82 }, px: { xs: 1.5, sm: 3, md: 5 }, gap: { xs: 1, md: 3 } }}>
          <IconButton onClick={() => setMobileOpen(true)} aria-label="Open navigation" sx={{ display: { md: "none" }, color: "var(--color-text-primary)" }}>
            <MenuIcon />
          </IconButton>

          <Box component={Link} href="/" onClick={handleNav("/")} sx={{ ...headerLinkSx, display: "flex", alignItems: "center", gap: 1.25, minWidth: { xs: "auto", md: 170 }, flexShrink: 0, color: "var(--color-text-primary)" }}>
            {logo}
            <Box sx={{ display: { xs: "none", sm: "block" } }}>
              {loading ? <Skeleton variant="text" width={105} height={30} /> : <Typography className="header-brand-name" sx={{ fontWeight: 950, fontSize: { sm: 20, md: 22 }, letterSpacing: "-0.045em" }}>{brandName}</Typography>}
              <Typography sx={{ display: { xs: "none", md: "block" }, color: "var(--color-text-secondary)", fontSize: 10, letterSpacing: "0.18em", fontWeight: 800 }}>{brandTagline}</Typography>
            </Box>
          </Box>

          <Box component="form" onSubmit={submitSearch} sx={{ display: { xs: "none", md: "flex" }, alignItems: "center", flex: 1, maxWidth: 620, bgcolor: "var(--color-surface-muted)", border: "1px solid var(--color-border)", borderRadius: 999, px: 1.5, py: 0.25, transition: "border-color 160ms ease, box-shadow 160ms ease", "&:focus-within": { borderColor: "var(--color-primary)", boxShadow: "0 0 0 4px rgba(37,99,235,0.12)" } }}>
            <Search sx={{ color: "#6d8174", mr: 1 }} />
            <InputBase value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder={headerCopy.searchPlaceholder} inputProps={{ "aria-label": headerCopy.searchPlaceholder }} sx={{ flex: 1, color: "#17352a", fontSize: 14 }} />
            <Button type="submit" size="small" sx={{ ...headerLinkSx, minWidth: 0, px: 2, borderRadius: 999, color: "var(--color-primary)", fontWeight: 800, textTransform: "none" }}>{headerCopy.searchButtonLabel}</Button>
          </Box>

          <Stack direction="row" alignItems="center" spacing={{ xs: 0, sm: 0.5 }} sx={{ ml: "auto" }}>
            <Button component={Link} href="/tracking" onClick={handleNav("/tracking")} startIcon={<LocalShippingOutlined />} sx={{ ...headerLinkSx, display: { xs: "none", lg: "flex" }, color: "var(--color-text-secondary)", textTransform: "none", fontWeight: 750, whiteSpace: "nowrap" }}>{headerCopy.trackOrderLabel}</Button>
            <Tooltip title={session ? headerCopy.accountTooltip : headerCopy.signInTooltip}>
              <IconButton onClick={(event) => { if (disableNav) return; setShopAnchor(null); setAboutAnchor(null); setAccountAnchor(event.currentTarget); }} aria-label={session ? headerCopy.accountLabel : headerCopy.signInLabel} sx={{ ...headerLinkSx, color: "var(--color-text-primary)", "&:hover": { color: "var(--color-link-hover)", bgcolor: "var(--color-primary-soft)" } }}>
                <AccountCircleOutlined />
              </IconButton>
            </Tooltip>
            <Button component={Link} href={session ? "/account" : "/signin"} onClick={handleNav(session ? "/account" : "/signin")} sx={{ ...headerLinkSx, display: { xs: "none", lg: "flex" }, color: "var(--color-text-secondary)", textTransform: "none", fontWeight: 800, px: 0.5 }}>{session ? headerCopy.accountLabel : headerCopy.signInLabel}</Button>
            <Tooltip title={headerCopy.cartTooltip}>
              <IconButton onClick={handleCartClick} aria-label={`Open cart${cartCount ? `, ${cartCount} items` : ""}`} sx={{ ...headerLinkSx, color: "var(--color-text-primary)", ml: { sm: 0.5 }, "&:hover": { color: "var(--color-link-hover)", bgcolor: "var(--color-primary-soft)" } }}>
                <Badge badgeContent={cartCount || null} color="secondary" max={99} overlap="circular">
                  <ShoppingBagOutlined />
                </Badge>
              </IconButton>
            </Tooltip>
          </Stack>
        </Toolbar>

          <Box component="nav" aria-label="Primary navigation" sx={{ display: { xs: "none", md: "flex" }, alignItems: "center", justifyContent: "center", gap: 0.5, borderTop: "1px solid var(--color-border)", px: 3, minHeight: 49 }}>
          <Button component={Link} href="/shop" onClick={handleNav("/shop")} sx={{ ...headerLinkSx, color: "var(--color-text-primary)", textTransform: "none", fontWeight: 850, px: 2 }}>{headerCopy.shopAllLabel}</Button>
          <Button component={Link} href="/shop#trending-collection" onClick={handleNav("/shop#trending-collection")} sx={{ ...headerLinkSx, color: "var(--color-text-primary)", textTransform: "none", fontWeight: 700, px: 2 }}>{headerCopy.trendingLabel}</Button>
          <Button onMouseEnter={handleShopMouseEnter} onMouseLeave={handleShopMouseLeave} onFocus={openShopMenu} onClick={openShopMenu} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") openShopMenu(event); }} endIcon={<ExpandMore sx={{ fontSize: 17 }} />} aria-haspopup="menu" aria-expanded={shopOpen ? "true" : undefined} sx={{ ...headerLinkSx, color: "var(--color-text-primary)", textTransform: "none", fontWeight: 700, px: 2 }}>{headerCopy.categoriesLabel}</Button>
          <Button component={Link} href="/blog" onClick={handleNav("/blog")} sx={{ ...headerLinkSx, color: "var(--color-text-primary)", textTransform: "none", fontWeight: 700, px: 2 }}>{headerCopy.blogLabel}</Button>
          <Button
            onMouseEnter={handleAboutMouseEnter}
            onMouseLeave={handleAboutMouseLeave}
            onFocus={openAboutMenu}
            onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") openAboutMenu(event); }}
            endIcon={<ExpandMore sx={{ fontSize: 17 }} />}
            aria-haspopup="menu"
            aria-expanded={aboutOpen ? "true" : undefined}
            sx={{ ...headerLinkSx, color: "var(--color-text-primary)", textTransform: "none", fontWeight: 700, px: 2 }}
          >
            {headerCopy.aboutLabel}
          </Button>
          <Tooltip title={headerCopy.helpTooltip} arrow enterDelay={300} placement="bottom">
            <Button component={Link} href="/help-center" onClick={handleNav("/help-center")} startIcon={<HelpOutline sx={{ fontSize: 18 }} />} sx={{ ...headerLinkSx, color: "var(--color-text-primary)", textTransform: "none", fontWeight: 700, px: 2 }}>{headerCopy.helpLabel}</Button>
          </Tooltip>
        </Box>
      </AppBar>

      <Menu anchorEl={shopAnchor} open={shopOpen} onClose={() => setShopAnchor(null)} MenuListProps={{ "aria-label": "Shop categories", onMouseEnter: handleShopMenuEnter, onMouseLeave: handleShopMenuLeave }} slotProps={{ root: { sx: { pointerEvents: "none" } }, paper: { sx: { pointerEvents: "auto" } } }}>
        <MenuItem component={Link} href="/shop" onClick={handleNav("/shop")} sx={headerMenuLinkSx}>{headerCopy.allProductsLabel}</MenuItem>
        {displayCategoryLinks.map((item) => <MenuItem key={item.href} component={Link} href={item.href} onClick={handleNav(item.href)} sx={headerMenuLinkSx}>{item.label}</MenuItem>)}
      </Menu>

      <Menu anchorEl={accountAnchor} open={accountOpen} onClose={() => setAccountAnchor(null)} MenuListProps={{ "aria-label": "Account menu" }}>
        <MenuItem component={Link} href={session ? "/account" : "/signin"} onClick={handleNav(session ? "/account" : "/signin")} sx={headerMenuLinkSx}>{session ? headerCopy.myAccountLabel : headerCopy.signInLabel}</MenuItem>
        <MenuItem component={Link} href="/account/orders" onClick={handleNav("/account/orders")} sx={headerMenuLinkSx}>{headerCopy.ordersLabel}</MenuItem>
        <MenuItem component={Link} href="/account/saved" onClick={handleNav("/account/saved")} sx={headerMenuLinkSx}>Saved products</MenuItem>
        <MenuItem component={Link} href="/account/support" onClick={handleNav("/account/support")} sx={headerMenuLinkSx}>{headerCopy.supportLabel}</MenuItem>
        {session && <MenuItem component={Link} href="/api/auth/signout" onClick={handleSignOut} sx={headerMenuLinkSx}>{headerCopy.signOutLabel}</MenuItem>}
      </Menu>

      <Menu
        anchorEl={aboutAnchor}
        open={aboutOpen}
        onClose={() => setAboutAnchor(null)}
        autoFocus={false}
        MenuListProps={{ "aria-label": "About menu", onMouseEnter: handleAboutMenuEnter, onMouseLeave: handleAboutMenuLeave }}
        slotProps={{ root: { sx: { pointerEvents: "none" } }, paper: { sx: { pointerEvents: "auto" } } }}
      >
        {displayAboutLinks.map((item) => <MenuItem key={item.href} component={Link} href={item.href} onClick={handleNav(item.href)} sx={headerMenuLinkSx}>{item.label}</MenuItem>)}
      </Menu>

      <Popover open={cartOpen} anchorEl={cartAnchor} onClose={() => setCartAnchor(null)} anchorOrigin={{ vertical: "bottom", horizontal: "right" }} transformOrigin={{ vertical: "top", horizontal: "right" }} PaperProps={{ sx: { width: { xs: "calc(100vw - 24px)", sm: 380 }, maxWidth: 380, p: 2, borderRadius: 3, mt: 1, boxShadow: "0 18px 50px rgba(15,23,42,0.18)" } }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
          <Box><Typography sx={{ fontWeight: 900, color: "var(--color-text-primary)" }}>{headerCopy.yourCartLabel}</Typography><Typography variant="caption" sx={{ color: "var(--color-text-secondary)" }}>{cartCount ? `${cartCount} ${cartCount === 1 ? headerCopy.cartItemLabel : headerCopy.cartItemsLabel}` : headerCopy.cartReadyLabel}</Typography></Box>
          <IconButton size="small" onClick={() => setCartAnchor(null)} aria-label={headerCopy.closeCartLabel} sx={{ ...headerLinkSx, "&:hover": { color: "var(--color-link-hover)", bgcolor: "var(--color-primary-soft)" } }}><Close fontSize="small" /></IconButton>
        </Stack>
        {cartLoading ? <Stack spacing={1}><Skeleton variant="rounded" height={58} /><Skeleton variant="rounded" height={58} /></Stack> : cartError ? <Typography sx={{ color: "error.main", fontSize: 14 }}>{cartError}</Typography> : cartItems.length === 0 ? (
          <Box sx={{ py: 3, textAlign: "center" }}><ShoppingBagOutlined sx={{ color: "var(--color-accent)", fontSize: 34, mb: 1 }} /><Typography sx={{ color: "var(--color-text-secondary)", fontSize: 14 }}>{headerCopy.emptyCartLabel}</Typography><Button component={Link} href="/shop" onClick={handleNav("/shop")} endIcon={<ArrowForwardRounded />} sx={{ ...headerLinkSx, mt: 1, color: "var(--color-primary)", textTransform: "none", fontWeight: 800 }}>{headerCopy.startShoppingLabel}</Button></Box>
        ) : (
          <>
            <List dense disablePadding sx={{ maxHeight: 280, overflowY: "auto" }}>
              {cartItems.map((item) => <ListItem key={item.productId} disableGutters sx={{ py: 0.75 }}><ListItemAvatar><Avatar src={item.image || undefined} alt={item.title || "item"} variant="rounded" sx={{ width: 48, height: 48, mr: 1.25, bgcolor: "var(--color-accent-soft)", color: "var(--color-accent)" }}>{String(item.title || "W").slice(0, 1).toUpperCase()}</Avatar></ListItemAvatar><ListItemText primary={item.title || "Item"} secondary={`${headerCopy.quantityLabel} ${item.quantity} ${headerCopy.quantitySeparator} ${formatPrice(item.price)}`} primaryTypographyProps={{ fontWeight: 750, fontSize: 14, color: "var(--color-text-primary)" }} secondaryTypographyProps={{ fontSize: 12 }} /></ListItem>)}
            </List>
            <Divider sx={{ my: 1.5 }} />
            <Stack direction="row" alignItems="center" justifyContent="space-between"><Typography sx={{ fontWeight: 800, color: "var(--color-text-secondary)" }}>{headerCopy.subtotalLabel}</Typography><Typography sx={{ fontWeight: 900, color: "var(--color-text-primary)" }}>{formatPrice(cartSubtotal)}</Typography></Stack>
            <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}><Button fullWidth variant="outlined" component={Link} href="/cart" onClick={handleNav("/cart")} sx={{ ...headerLinkSx, borderRadius: 999, color: "var(--color-primary)", borderColor: "var(--color-primary-light)", textTransform: "none", fontWeight: 800 }}>{headerCopy.viewCartLabel}</Button><Button fullWidth variant="contained" component={Link} href="/checkout" onClick={handleNav("/checkout")} sx={{ borderRadius: 999, bgcolor: "var(--color-accent)", color: "var(--color-text-primary)", textTransform: "none", fontWeight: 800, "&:hover": { bgcolor: "#d97817", color: "var(--color-primary)" } }}>{headerCopy.checkoutLabel}</Button></Stack>
          </>
        )}
      </Popover>

      <Drawer anchor="left" open={mobileOpen} onClose={() => setMobileOpen(false)} PaperProps={{ sx: { width: "min(88vw, 360px)", bgcolor: "var(--color-background)", color: "var(--color-text-primary)" } }}>
        <Box role="presentation" sx={{ p: 2.5 }}>
           <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 3 }}><Box sx={{ ...headerLinkSx, display: "flex", alignItems: "center", gap: 1.25, color: "var(--color-text-primary)" }} component={Link} href="/" onClick={handleNav("/")}>{logo}<Typography sx={{ fontWeight: 950, fontSize: 21, letterSpacing: "-0.04em" }}>{brandName}</Typography></Box><IconButton onClick={() => setMobileOpen(false)} aria-label="Close navigation" sx={{ ...headerLinkSx, "&:hover": { color: "var(--color-link-hover)", bgcolor: "var(--color-primary-soft)" } }}><Close /></IconButton></Stack>
          <Box component="form" onSubmit={submitSearch} sx={{ display: "flex", alignItems: "center", bgcolor: "var(--color-surface-muted)", border: "1px solid var(--color-border)", borderRadius: 999, px: 1.5, mb: 2.5 }}><Search sx={{ color: "var(--color-text-secondary)", mr: 1 }} /><InputBase value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder={headerCopy.mobileSearchPlaceholder} inputProps={{ "aria-label": headerCopy.searchPlaceholder }} sx={{ flex: 1, py: 0.8 }} /></Box>
          <List disablePadding>
             <ListItem disablePadding><ListItemButton component={Link} href="/shop" onClick={handleNav("/shop")} sx={{ ...headerMenuLinkSx, borderRadius: 2, fontWeight: 850 }}>{headerCopy.shopAllLabel}</ListItemButton></ListItem>
             <ListItem disablePadding><ListItemButton component={Link} href="/shop#trending-collection" onClick={handleNav("/shop#trending-collection")} sx={{ ...headerMenuLinkSx, borderRadius: 2 }}>{headerCopy.trendingLabel}</ListItemButton></ListItem>
            <Typography sx={{ mt: 2, mb: 0.5, px: 2, color: "#718078", fontSize: 11, letterSpacing: "0.14em", fontWeight: 850 }}>{headerCopy.categoryHeading}</Typography>
             {displayCategoryLinks.map((item) => <ListItem key={item.href} disablePadding><ListItemButton component={Link} href={item.href} onClick={handleNav(item.href)} sx={{ ...headerMenuLinkSx, borderRadius: 2 }}>{item.label}</ListItemButton></ListItem>)}
            <Divider sx={{ my: 1.5 }} />
             <ListItem disablePadding><ListItemButton component={Link} href="/blog" onClick={handleNav("/blog")} sx={{ ...headerMenuLinkSx, borderRadius: 2 }}>{headerCopy.blogLabel}</ListItemButton></ListItem>
             {displayAboutLinks.map((item) => <ListItem key={item.href} disablePadding><ListItemButton component={Link} href={item.href} onClick={handleNav(item.href)} sx={{ ...headerMenuLinkSx, borderRadius: 2 }}>{item.label}</ListItemButton></ListItem>)}
             <ListItem disablePadding><ListItemButton component={Link} href="/help-center" onClick={handleNav("/help-center")} sx={{ ...headerMenuLinkSx, borderRadius: 2 }}>{headerCopy.helpCenterLabel}</ListItemButton></ListItem>
             <ListItem disablePadding><ListItemButton component={Link} href="/tracking" onClick={handleNav("/tracking")} sx={{ ...headerMenuLinkSx, borderRadius: 2 }}>{headerCopy.mobileTrackOrderLabel}</ListItemButton></ListItem>
          </List>
          <Divider sx={{ my: 2 }} />
           <Stack spacing={1}><Button component={Link} href={session ? "/account" : "/signin"} onClick={handleNav(session ? "/account" : "/signin")} startIcon={<AccountCircleOutlined />} sx={{ ...headerLinkSx, justifyContent: "flex-start", color: "var(--color-primary)", textTransform: "none", fontWeight: 800 }}>{session ? headerCopy.myAccountLabel : headerCopy.signInLabel}</Button><Button component={Link} href="/cart" onClick={handleNav("/cart")} startIcon={<ShoppingBagOutlined />} sx={{ ...headerLinkSx, justifyContent: "flex-start", color: "var(--color-primary)", textTransform: "none", fontWeight: 800 }}>{headerCopy.cartLabel} {cartCount ? `(${cartCount})` : ""}</Button></Stack>
        </Box>
      </Drawer>
    </Box>
  );
}
