"use client";

import React, { useEffect, useState } from "react";
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

function formatPrice(value) {
  const amount = Number(value) || 0;
  return `$${amount.toFixed(2)}`;
}

export default function Header({ initialHeader = null, disableNav = false }) {
  const [header, setHeader] = useState(initialHeader);
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
    fetchSession().then((data) => setSession(data?.user || null)).catch(() => setSession(null));
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
  const brandName = displayHeader.Name || "Weluxo";
  const cartOpen = Boolean(cartAnchor);
  const cartCount = cartItems.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
  const accountOpen = Boolean(accountAnchor);
  const aboutOpen = Boolean(aboutAnchor);
  const shopOpen = Boolean(shopAnchor);

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
        src={displayHeader.LogoUrl || undefined}
        alt={brandName}
        sx={{ width: 42, height: 42, bgcolor: "#12372a", color: "#e1c98c", fontWeight: 900, fontSize: 15 }}
      >
        {brandName.slice(0, 2).toUpperCase()}
      </Avatar>
    </Fade>
  );

  return (
    <Box component="header" sx={{ position: "sticky", top: 0, zIndex: (theme) => theme.zIndex.appBar, bgcolor: "#fff", color: "#12372a", borderBottom: "1px solid #e4ebe5" }}>
      <Box sx={{ bgcolor: "#12372a", color: "white", px: { xs: 2, md: 4 }, py: 0.8 }}>
        <Stack direction="row" justifyContent="center" alignItems="center" spacing={1} sx={{ fontSize: 12, letterSpacing: "0.02em" }}>
          <LocalShippingOutlined sx={{ fontSize: 16, color: "#e1c98c" }} />
          <Typography component="span" sx={{ fontSize: "inherit", fontWeight: 650 }}>Free standard shipping on orders over $100</Typography>
          <Box component="span" sx={{ display: { xs: "none", sm: "inline" }, color: "rgba(255,255,255,0.46)" }}>•</Box>
          <Typography component="span" sx={{ display: { xs: "none", sm: "inline" }, fontSize: "inherit", color: "rgba(255,255,255,0.78)" }}>Thoughtful support within 24–48 hours</Typography>
        </Stack>
      </Box>

      <AppBar position="static" elevation={0} color="transparent" sx={{ color: "inherit", bgcolor: "white" }}>
        <Toolbar sx={{ minHeight: { xs: 68, md: 82 }, px: { xs: 1.5, sm: 3, md: 5 }, gap: { xs: 1, md: 3 } }}>
          <IconButton onClick={() => setMobileOpen(true)} aria-label="Open navigation" sx={{ display: { md: "none" }, color: "#12372a" }}>
            <MenuIcon />
          </IconButton>

          <Box component={Link} href="/" onClick={handleNav("/")} sx={{ display: "flex", alignItems: "center", gap: 1.25, minWidth: { xs: "auto", md: 170 }, flexShrink: 0 }}>
            {logo}
            <Box sx={{ display: { xs: "none", sm: "block" } }}>
              {loading ? <Skeleton variant="text" width={105} height={30} /> : <Typography sx={{ fontWeight: 950, fontSize: { sm: 20, md: 22 }, letterSpacing: "-0.045em" }}>{brandName}</Typography>}
              <Typography sx={{ display: { xs: "none", md: "block" }, color: "#718078", fontSize: 10, letterSpacing: "0.18em", fontWeight: 800 }}>MOVE WITH INTENT</Typography>
            </Box>
          </Box>

          <Box component="form" onSubmit={submitSearch} sx={{ display: { xs: "none", md: "flex" }, alignItems: "center", flex: 1, maxWidth: 620, bgcolor: "#f3f6f3", border: "1px solid #dfe8e0", borderRadius: 999, px: 1.5, py: 0.25, transition: "border-color 160ms ease, box-shadow 160ms ease", "&:focus-within": { borderColor: "#6e9a7b", boxShadow: "0 0 0 4px rgba(62,120,94,0.1)" } }}>
            <Search sx={{ color: "#6d8174", mr: 1 }} />
            <InputBase value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search products, categories, and stories" inputProps={{ "aria-label": "Search products" }} sx={{ flex: 1, color: "#17352a", fontSize: 14 }} />
            <Button type="submit" size="small" sx={{ minWidth: 0, px: 2, borderRadius: 999, color: "#12372a", fontWeight: 800, textTransform: "none" }}>Search</Button>
          </Box>

          <Stack direction="row" alignItems="center" spacing={{ xs: 0, sm: 0.5 }} sx={{ ml: "auto" }}>
            <Button component={Link} href="/tracking" onClick={handleNav("/tracking")} startIcon={<LocalShippingOutlined />} sx={{ display: { xs: "none", lg: "flex" }, color: "#365345", textTransform: "none", fontWeight: 750, whiteSpace: "nowrap" }}>Track order</Button>
            <Tooltip title={session ? "Account" : "Sign in"}>
              <IconButton onClick={(event) => { if (disableNav) return; setShopAnchor(null); setAboutAnchor(null); setAccountAnchor(event.currentTarget); }} aria-label={session ? "Open account menu" : "Sign in"} sx={{ color: "#12372a" }}>
                <AccountCircleOutlined />
              </IconButton>
            </Tooltip>
            <Button component={Link} href={session ? "/account" : "/signin"} onClick={handleNav(session ? "/account" : "/signin")} sx={{ display: { xs: "none", lg: "flex" }, color: "#365345", textTransform: "none", fontWeight: 800, px: 0.5 }}>{session ? "Account" : "Sign in"}</Button>
            <Tooltip title="Shopping cart">
              <IconButton onClick={handleCartClick} aria-label={`Open cart${cartCount ? `, ${cartCount} items` : ""}`} sx={{ color: "#12372a", ml: { sm: 0.5 } }}>
                <Badge badgeContent={cartCount || null} color="secondary" max={99} overlap="circular">
                  <ShoppingBagOutlined />
                </Badge>
              </IconButton>
            </Tooltip>
          </Stack>
        </Toolbar>

        <Box component="nav" aria-label="Primary navigation" sx={{ display: { xs: "none", md: "flex" }, alignItems: "center", justifyContent: "center", gap: 0.5, borderTop: "1px solid #f0f3f0", px: 3, minHeight: 49 }}>
          <Button component={Link} href="/shop" onClick={handleNav("/shop")} sx={{ color: "#12372a", textTransform: "none", fontWeight: 850, px: 2 }}>Shop all</Button>
          <Button component={Link} href="/shop#trending-collection" onClick={handleNav("/shop#trending-collection")} sx={{ color: "#365345", textTransform: "none", fontWeight: 700, px: 2 }}>Trending</Button>
          <Button onClick={(event) => { if (!disableNav) { setAccountAnchor(null); setAboutAnchor(null); setShopAnchor(event.currentTarget); } }} endIcon={<ExpandMore sx={{ fontSize: 17 }} />} sx={{ color: "#365345", textTransform: "none", fontWeight: 700, px: 2 }}>Categories</Button>
          <Button component={Link} href="/blog" onClick={handleNav("/blog")} sx={{ color: "#365345", textTransform: "none", fontWeight: 700, px: 2 }}>{displayHeader.Blog || "Journal"}</Button>
          <Button onClick={(event) => { if (!disableNav) { setAccountAnchor(null); setShopAnchor(null); setAboutAnchor(event.currentTarget); } }} endIcon={<ExpandMore sx={{ fontSize: 17 }} />} sx={{ color: "#365345", textTransform: "none", fontWeight: 700, px: 2 }}>{displayHeader.AboutUs || "About"}</Button>
          <Button component={Link} href="/help-center" onClick={handleNav("/help-center")} startIcon={<HelpOutline sx={{ fontSize: 18 }} />} sx={{ color: "#365345", textTransform: "none", fontWeight: 700, px: 2 }}>Help</Button>
        </Box>
      </AppBar>

      <Menu anchorEl={shopAnchor} open={shopOpen} onClose={() => setShopAnchor(null)} MenuListProps={{ "aria-label": "Shop categories" }}>
        <MenuItem component={Link} href="/shop" onClick={handleNav("/shop")}>All products</MenuItem>
        {categoryLinks.map((item) => <MenuItem key={item.href} component={Link} href={item.href} onClick={handleNav(item.href)}>{item.label}</MenuItem>)}
      </Menu>

      <Menu anchorEl={accountAnchor} open={accountOpen} onClose={() => setAccountAnchor(null)} MenuListProps={{ "aria-label": "Account menu" }}>
        <MenuItem component={Link} href={session ? "/account" : "/signin"} onClick={handleNav(session ? "/account" : "/signin")}>{session ? "My account" : "Sign in"}</MenuItem>
        <MenuItem component={Link} href="/account/orders" onClick={handleNav("/account/orders")}>Orders</MenuItem>
        <MenuItem component={Link} href="/account/support" onClick={handleNav("/account/support")}>Support</MenuItem>
        {session && <MenuItem component={Link} href="/api/auth/signout" onClick={handleNav("/api/auth/signout")}>Sign out</MenuItem>}
      </Menu>

      <Menu anchorEl={aboutAnchor} open={aboutOpen} onClose={() => setAboutAnchor(null)} MenuListProps={{ "aria-label": "About menu" }}>
        {aboutLinks.map((item) => <MenuItem key={item.href} component={Link} href={item.href} onClick={handleNav(item.href)}>{item.label}</MenuItem>)}
      </Menu>

      <Popover open={cartOpen} anchorEl={cartAnchor} onClose={() => setCartAnchor(null)} anchorOrigin={{ vertical: "bottom", horizontal: "right" }} transformOrigin={{ vertical: "top", horizontal: "right" }} PaperProps={{ sx: { width: { xs: "calc(100vw - 24px)", sm: 380 }, maxWidth: 380, p: 2, borderRadius: 3, mt: 1, boxShadow: "0 18px 50px rgba(15,23,42,0.18)" } }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
          <Box><Typography sx={{ fontWeight: 900, color: "#12372a" }}>Your cart</Typography><Typography variant="caption" sx={{ color: "#718078" }}>{cartCount ? `${cartCount} ${cartCount === 1 ? "item" : "items"}` : "Ready when you are"}</Typography></Box>
          <IconButton size="small" onClick={() => setCartAnchor(null)} aria-label="Close cart preview"><Close fontSize="small" /></IconButton>
        </Stack>
        {cartLoading ? <Stack spacing={1}><Skeleton variant="rounded" height={58} /><Skeleton variant="rounded" height={58} /></Stack> : cartError ? <Typography sx={{ color: "error.main", fontSize: 14 }}>{cartError}</Typography> : cartItems.length === 0 ? (
          <Box sx={{ py: 3, textAlign: "center" }}><ShoppingBagOutlined sx={{ color: "#8eaf96", fontSize: 34, mb: 1 }} /><Typography sx={{ color: "#607267", fontSize: 14 }}>Your cart is empty.</Typography><Button component={Link} href="/shop" onClick={handleNav("/shop")} endIcon={<ArrowForwardRounded />} sx={{ mt: 1, color: "#12372a", textTransform: "none", fontWeight: 800 }}>Start shopping</Button></Box>
        ) : (
          <>
            <List dense disablePadding sx={{ maxHeight: 280, overflowY: "auto" }}>
              {cartItems.map((item) => <ListItem key={item.productId} disableGutters sx={{ py: 0.75 }}><ListItemAvatar><Avatar src={item.image || undefined} alt={item.title || "item"} variant="rounded" sx={{ width: 48, height: 48, mr: 1.25, bgcolor: "#edf4ee", color: "#3e785e" }}>{String(item.title || "W").slice(0, 1).toUpperCase()}</Avatar></ListItemAvatar><ListItemText primary={item.title || "Item"} secondary={`Qty ${item.quantity} · ${formatPrice(item.price)}`} primaryTypographyProps={{ fontWeight: 750, fontSize: 14, color: "#17352a" }} secondaryTypographyProps={{ fontSize: 12 }} /></ListItem>)}
            </List>
            <Divider sx={{ my: 1.5 }} />
            <Stack direction="row" alignItems="center" justifyContent="space-between"><Typography sx={{ fontWeight: 800, color: "#365345" }}>Subtotal</Typography><Typography sx={{ fontWeight: 900, color: "#12372a" }}>{formatPrice(cartSubtotal)}</Typography></Stack>
            <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}><Button fullWidth variant="outlined" component={Link} href="/cart" onClick={handleNav("/cart")} sx={{ borderRadius: 999, color: "#12372a", borderColor: "#a8bea9", textTransform: "none", fontWeight: 800 }}>View cart</Button><Button fullWidth variant="contained" component={Link} href="/checkout" onClick={handleNav("/checkout")} sx={{ borderRadius: 999, bgcolor: "#12372a", textTransform: "none", fontWeight: 800 }}>Checkout</Button></Stack>
          </>
        )}
      </Popover>

      <Drawer anchor="left" open={mobileOpen} onClose={() => setMobileOpen(false)} PaperProps={{ sx: { width: "min(88vw, 360px)", bgcolor: "#fbfdfb", color: "#12372a" } }}>
        <Box role="presentation" sx={{ p: 2.5 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 3 }}><Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>{logo}<Typography sx={{ fontWeight: 950, fontSize: 21, letterSpacing: "-0.04em" }}>{brandName}</Typography></Box><IconButton onClick={() => setMobileOpen(false)} aria-label="Close navigation"><Close /></IconButton></Stack>
          <Box component="form" onSubmit={submitSearch} sx={{ display: "flex", alignItems: "center", bgcolor: "#f0f5f1", border: "1px solid #dbe7dc", borderRadius: 999, px: 1.5, mb: 2.5 }}><Search sx={{ color: "#6d8174", mr: 1 }} /><InputBase value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search the shop" inputProps={{ "aria-label": "Search products" }} sx={{ flex: 1, py: 0.8 }} /></Box>
          <List disablePadding>
            <ListItem disablePadding><ListItemButton component={Link} href="/shop" onClick={handleNav("/shop")} sx={{ borderRadius: 2, fontWeight: 850 }}>Shop all</ListItemButton></ListItem>
            <ListItem disablePadding><ListItemButton component={Link} href="/shop#trending-collection" onClick={handleNav("/shop#trending-collection")} sx={{ borderRadius: 2 }}>Trending</ListItemButton></ListItem>
            <Typography sx={{ mt: 2, mb: 0.5, px: 2, color: "#718078", fontSize: 11, letterSpacing: "0.14em", fontWeight: 850 }}>CATEGORIES</Typography>
            {categoryLinks.map((item) => <ListItem key={item.href} disablePadding><ListItemButton component={Link} href={item.href} onClick={handleNav(item.href)} sx={{ borderRadius: 2 }}>{item.label}</ListItemButton></ListItem>)}
            <Divider sx={{ my: 1.5 }} />
            <ListItem disablePadding><ListItemButton component={Link} href="/blog" onClick={handleNav("/blog")} sx={{ borderRadius: 2 }}>{displayHeader.Blog || "Journal"}</ListItemButton></ListItem>
            {aboutLinks.map((item) => <ListItem key={item.href} disablePadding><ListItemButton component={Link} href={item.href} onClick={handleNav(item.href)} sx={{ borderRadius: 2 }}>{item.label}</ListItemButton></ListItem>)}
            <ListItem disablePadding><ListItemButton component={Link} href="/help-center" onClick={handleNav("/help-center")} sx={{ borderRadius: 2 }}>Help center</ListItemButton></ListItem>
            <ListItem disablePadding><ListItemButton component={Link} href="/tracking" onClick={handleNav("/tracking")} sx={{ borderRadius: 2 }}>Track an order</ListItemButton></ListItem>
          </List>
          <Divider sx={{ my: 2 }} />
          <Stack spacing={1}><Button component={Link} href={session ? "/account" : "/signin"} onClick={handleNav(session ? "/account" : "/signin")} startIcon={<AccountCircleOutlined />} sx={{ justifyContent: "flex-start", color: "#12372a", textTransform: "none", fontWeight: 800 }}>{session ? "My account" : "Sign in"}</Button><Button component={Link} href="/cart" onClick={handleNav("/cart")} startIcon={<ShoppingBagOutlined />} sx={{ justifyContent: "flex-start", color: "#12372a", textTransform: "none", fontWeight: 800 }}>Cart {cartCount ? `(${cartCount})` : ""}</Button></Stack>
        </Box>
      </Drawer>
    </Box>
  );
}
