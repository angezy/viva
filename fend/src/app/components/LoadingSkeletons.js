import { Box, Card, CardContent, Container, Divider, Grid, Skeleton, Stack } from "@mui/material";

const skeletonSx = { bgcolor: "#eee8df" };
const surfaceSx = {
  bgcolor: "var(--color-surface)",
  border: "1px solid var(--color-border)",
  borderRadius: 2.5,
};

function SkeletonCard({ imageHeight = 180, compact = false, cardHeight = 360, cardWidth = 300, cardMaxWidth = 300, variant = "catalog" }) {
  const isHome = variant === "home";

  return (
    <Card sx={{ ...surfaceSx, width: cardWidth, maxWidth: cardMaxWidth, overflow: "hidden", height: cardHeight, display: "flex", flexDirection: "column" }}>
      <Skeleton variant="rectangular" height={imageHeight} sx={skeletonSx} />
      <CardContent sx={{ p: isHome ? 2 : compact ? 1.75 : 2.25, flex: 1, display: "flex", flexDirection: "column" }}>
        {isHome ? (
          <>
            <Skeleton variant="text" width="76%" height={22} sx={skeletonSx} />
            <Skeleton variant="text" width="30%" height={22} sx={skeletonSx} />
            <Skeleton variant="rounded" width={108} height={32} sx={{ ...skeletonSx, mt: "auto", borderRadius: 1.5 }} />
          </>
        ) : (
          <>
            <Skeleton variant="text" width="38%" height={18} sx={skeletonSx} />
            <Skeleton variant="text" width="82%" height={28} sx={skeletonSx} />
            <Skeleton variant="text" width="68%" sx={skeletonSx} />
            <Skeleton variant="rounded" width="100%" height={38} sx={{ ...skeletonSx, mt: "auto", borderRadius: 1.5 }} />
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function ProductGridSkeleton({ count = 8, compact = false, cardHeight, imageHeight, columns, gridSpacing, cardWidth = 300, cardMaxWidth = 300, variant = "catalog" }) {
  const resolvedCardHeight = cardHeight ?? (compact ? 390 : 360);
  const resolvedImageHeight = imageHeight ?? (compact ? 210 : 180);
  const resolvedColumns = columns ?? (compact ? 3 : 4);

  return (
    <Grid container spacing={gridSpacing ?? { xs: 2, md: 3 }} aria-hidden="true" justifyContent="center">
      {Array.from({ length: count }, (_, index) => (
        <Grid size={{ xs: 12, sm: 6, md: 12 / resolvedColumns }} key={index} sx={{ display: "flex", justifyContent: "center" }}>
          <SkeletonCard imageHeight={resolvedImageHeight} compact={compact} cardHeight={resolvedCardHeight} cardWidth={cardWidth} cardMaxWidth={cardMaxWidth} variant={variant} />
        </Grid>
      ))}
    </Grid>
  );
}

export function AccountPageSkeleton({ variant = "overview" }) {
  const isGrid = variant === "saved";

  return (
    <Box component="main" aria-busy="true" aria-label="Account page loading" sx={{ color: "var(--color-text-primary)" }}>
      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" gap={2} sx={{ mb: 3 }}>
        <Box>
          <Skeleton variant="text" width={210} height={38} sx={skeletonSx} />
          <Skeleton variant="text" width={280} height={22} sx={skeletonSx} />
        </Box>
        <Stack direction="row" spacing={1}>
          <Skeleton variant="rounded" width={92} height={38} sx={{ ...skeletonSx, borderRadius: 2 }} />
          <Skeleton variant="rounded" width={92} height={38} sx={{ ...skeletonSx, borderRadius: 2 }} />
        </Stack>
      </Stack>

      {isGrid ? (
        <ProductGridSkeleton count={6} compact />
      ) : variant === "overview" ? (
        <>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", md: "repeat(5, minmax(0, 1fr))" }, gap: 2, mb: 2 }} aria-hidden="true">
            {Array.from({ length: 5 }, (_, index) => (
              <Card sx={{ ...surfaceSx, minHeight: 102, p: 1.75 }} key={index}>
                  <Skeleton variant="text" width="62%" sx={skeletonSx} />
                  <Skeleton variant="text" width="46%" height={38} sx={skeletonSx} />
              </Card>
            ))}
          </Box>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "minmax(0, 2fr) minmax(280px, 1fr)" }, gap: 2 }}>
            <Card sx={{ ...surfaceSx, p: 2.25 }}>
                <Skeleton variant="text" width="32%" height={28} sx={skeletonSx} />
                <Skeleton variant="text" width="58%" sx={skeletonSx} />
                <Skeleton variant="rounded" height={190} sx={{ ...skeletonSx, mt: 2, borderRadius: 2 }} />
            </Card>
            <Card sx={{ ...surfaceSx, p: 2.25, minHeight: 260 }}>
                <Skeleton variant="text" width="52%" height={28} sx={skeletonSx} />
                <Stack spacing={2} sx={{ mt: 2 }}>
                  {Array.from({ length: 4 }, (_, index) => <Skeleton key={index} variant="rounded" height={24} sx={skeletonSx} />)}
                </Stack>
            </Card>
          </Box>
        </>
      ) : (
        <Card sx={{ ...surfaceSx, p: 2.25 }}>
          <Skeleton variant="text" width="30%" height={28} sx={skeletonSx} />
          <Skeleton variant="text" width="48%" sx={skeletonSx} />
          <Stack spacing={1.5} sx={{ mt: 2 }}>
            {Array.from({ length: 5 }, (_, index) => <Skeleton key={index} variant="rounded" height={58} sx={{ ...skeletonSx, borderRadius: 2 }} />)}
          </Stack>
        </Card>
      )}
    </Box>
  );
}

export function CheckoutPageSkeleton() {
  return (
    <Box component="main" aria-busy="true" aria-label="Checkout page loading" sx={{ minHeight: "100vh", py: 3, bgcolor: "var(--color-background)" }}>
      <Container maxWidth="lg">
        <Stack direction="row" justifyContent="space-between" sx={{ mb: 3 }}>
          <Skeleton variant="text" width={110} height={38} sx={skeletonSx} />
          <Skeleton variant="rounded" width={130} height={36} sx={{ ...skeletonSx, borderRadius: 2 }} />
        </Stack>
        <Card sx={{ ...surfaceSx, mb: 4, p: { xs: 1.5, sm: 2 } }}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={{ xs: 1.25, sm: 2 }} justifyContent="space-between">
            {Array.from({ length: 5 }, (_, index) => (
              <Stack key={index} direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
                <Skeleton variant="circular" width={28} height={28} sx={skeletonSx} />
                <Skeleton variant="text" sx={{ ...skeletonSx, width: { xs: 150, sm: 82 } }} />
              </Stack>
            ))}
          </Stack>
        </Card>
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 7 }}>
            <Card sx={{ ...surfaceSx, p: 3 }}>
              <Skeleton variant="text" width="40%" height={34} sx={skeletonSx} />
              <Stack spacing={2} sx={{ mt: 2 }}>
                {Array.from({ length: 4 }, (_, index) => <Skeleton key={index} variant="rounded" height={52} sx={{ ...skeletonSx, borderRadius: 2 }} />)}
              </Stack>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, md: 5 }}>
            <Card sx={{ ...surfaceSx, p: 3 }}>
              <Skeleton variant="text" width="45%" height={32} sx={skeletonSx} />
              <Stack spacing={1.5} sx={{ mt: 2 }}>
                {Array.from({ length: 3 }, (_, index) => <Skeleton key={index} variant="rounded" height={62} sx={{ ...skeletonSx, borderRadius: 2 }} />)}
              </Stack>
              <Divider sx={{ my: 2, borderColor: "var(--color-border)" }} />
              <Skeleton variant="rounded" height={28} sx={skeletonSx} />
              <Skeleton variant="rounded" height={46} sx={{ ...skeletonSx, mt: 2, borderRadius: 2 }} />
            </Card>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
}

export function CartPageSkeleton() {
  return (
    <Box component="main" aria-busy="true" aria-label="Cart page loading" sx={{ minHeight: "100vh", py: { xs: 3, md: 6 }, bgcolor: "var(--color-background)" }}>
      <Container maxWidth="lg">
        <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" gap={2} sx={{ mb: 3 }}>
          <Box>
            <Skeleton variant="text" width={110} height={34} sx={skeletonSx} />
            <Skeleton variant="text" width={190} sx={skeletonSx} />
          </Box>
          <Skeleton variant="rounded" height={38} sx={{ ...skeletonSx, width: { xs: "100%", sm: 150 }, borderRadius: 1.5 }} />
        </Stack>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", sm: "repeat(4, minmax(0, 1fr))" }, gap: 1.5, mb: 4 }}>
          {Array.from({ length: 4 }, (_, index) => <Skeleton key={index} variant="rounded" height={20} sx={{ ...skeletonSx, borderRadius: 1 }} />)}
        </Box>
        <Skeleton variant="text" height={46} sx={{ ...skeletonSx, width: { xs: "52%", sm: 250 }, mb: 3 }} />
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "minmax(0, 7fr) minmax(300px, 3fr)" }, gap: 3, alignItems: "start" }}>
          <Card sx={{ ...surfaceSx, p: { xs: 2, md: 2.5 } }}>
            <Stack spacing={2}>
              {Array.from({ length: 3 }, (_, index) => (
                <Stack key={index} direction="row" spacing={1.5} alignItems="center" sx={{ minHeight: 104 }}>
                  <Skeleton variant="rounded" width={96} height={96} sx={{ ...skeletonSx, flexShrink: 0, borderRadius: 1.5 }} />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Skeleton variant="text" width="56%" height={24} sx={skeletonSx} />
                    <Skeleton variant="text" width="34%" sx={skeletonSx} />
                    <Skeleton variant="rounded" width={110} height={34} sx={{ ...skeletonSx, mt: 1, borderRadius: 1.5 }} />
                  </Box>
                </Stack>
              ))}
            </Stack>
          </Card>
          <Card sx={{ ...surfaceSx, p: { xs: 2, md: 2.5 } }}>
            <Skeleton variant="text" width="48%" height={32} sx={skeletonSx} />
            <Stack spacing={1.5} sx={{ mt: 2 }}>
              {Array.from({ length: 4 }, (_, index) => <Skeleton key={index} variant="text" width={index === 3 ? "100%" : "72%"} height={24} sx={skeletonSx} />)}
            </Stack>
            <Skeleton variant="rounded" height={46} sx={{ ...skeletonSx, mt: 2, borderRadius: 1.5 }} />
          </Card>
        </Box>
      </Container>
    </Box>
  );
}

export function DashboardPageSkeleton() {
  return (
    <Box component="main" aria-busy="true" aria-label="Dashboard page loading" sx={{ width: "100%", maxWidth: 1400, mx: "auto", p: { xs: 2, md: 3 }, bgcolor: "#f8fafc" }}>
      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" gap={2} sx={{ mb: 3 }}>
        <Box>
          <Skeleton variant="text" height={38} sx={{ ...skeletonSx, width: { xs: "62%", sm: 250 } }} />
          <Skeleton variant="text" sx={{ ...skeletonSx, width: { xs: "88%", sm: 430 } }} />
        </Box>
        <Skeleton variant="rounded" height={38} sx={{ ...skeletonSx, width: { xs: "100%", sm: 120 }, borderRadius: 1.5 }} />
      </Stack>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", md: "repeat(5, minmax(0, 1fr))" }, gap: 1.5, mb: 2 }}>
        {Array.from({ length: 5 }, (_, index) => <Skeleton key={index} variant="rounded" height={64} sx={{ ...skeletonSx, borderRadius: 1.5 }} />)}
      </Box>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "minmax(0, 1.6fr) minmax(280px, 1fr)" }, gap: 2 }}>
        <Card sx={{ ...surfaceSx, p: 2.25, minHeight: 330 }}>
          <Skeleton variant="text" width="32%" height={28} sx={skeletonSx} />
          <Skeleton variant="text" width="58%" sx={skeletonSx} />
          <Skeleton variant="rounded" height={220} sx={{ ...skeletonSx, mt: 2, borderRadius: 1.5 }} />
        </Card>
        <Card sx={{ ...surfaceSx, p: 2.25, minHeight: 330 }}>
          <Skeleton variant="text" width="48%" height={28} sx={skeletonSx} />
          <Stack spacing={1.75} sx={{ mt: 2 }}>
            {Array.from({ length: 5 }, (_, index) => <Skeleton key={index} variant="rounded" height={28} sx={{ ...skeletonSx, borderRadius: 1 }} />)}
          </Stack>
        </Card>
      </Box>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" }, gap: 2, mt: 2 }}>
        {Array.from({ length: 2 }, (_, index) => <Card key={index} sx={{ ...surfaceSx, p: 2.25, minHeight: 230 }}><Skeleton variant="text" width="42%" height={28} sx={skeletonSx} /><Stack spacing={1.5} sx={{ mt: 2 }}>{Array.from({ length: 4 }, (_, row) => <Skeleton key={row} variant="rounded" height={24} sx={{ ...skeletonSx, borderRadius: 1 }} />)}</Stack></Card>)}
      </Box>
    </Box>
  );
}

export function TablePageSkeleton({ rows = 7, columns = 5 }) {
  return (
    <Box component="main" aria-busy="true" aria-label="Table loading" sx={{ width: "100%", maxWidth: 1280, mx: "auto", p: { xs: 2, md: 3 } }}>
      <Skeleton variant="text" height={42} sx={{ ...skeletonSx, width: { xs: "55%", md: 240 } }} />
      <Skeleton variant="text" height={22} sx={{ ...skeletonSx, width: { xs: "78%", md: 390 } }} />
      <Card sx={{ ...surfaceSx, mt: 3, overflow: "hidden" }}>
        <Stack direction="row" spacing={2} sx={{ p: 2, bgcolor: "var(--color-surface-muted)" }}>
          {Array.from({ length: columns }, (_, index) => <Skeleton key={index} variant="text" sx={{ ...skeletonSx, flex: 1 }} />)}
        </Stack>
        {Array.from({ length: rows }, (_, row) => (
          <Stack key={row} direction="row" spacing={2} sx={{ p: 2, borderTop: "1px solid var(--color-border)" }}>
            {Array.from({ length: columns }, (_, column) => <Skeleton key={column} variant="text" sx={{ ...skeletonSx, flex: 1 }} />)}
          </Stack>
        ))}
      </Card>
    </Box>
  );
}

export function DetailPageSkeleton() {
  return (
    <Box component="main" aria-busy="true" aria-label="Details loading" sx={{ minHeight: "60vh", py: { xs: 5, md: 8 }, bgcolor: "var(--color-background)" }}>
      <Container maxWidth="md">
        <Card sx={{ ...surfaceSx, overflow: "hidden" }}>
          <Box sx={{ p: { xs: 2.5, md: 4 }, borderBottom: "1px solid var(--color-border)" }}>
            <Skeleton variant="text" width="28%" height={24} sx={skeletonSx} />
            <Skeleton variant="text" width="72%" height={42} sx={skeletonSx} />
          </Box>
          <Box sx={{ p: { xs: 2.5, md: 4 } }}>
            <Stack spacing={1.5}>
              {Array.from({ length: 6 }, (_, index) => <Skeleton key={index} variant="rounded" width={`${90 - (index % 3) * 12}%`} height={20} sx={{ ...skeletonSx, borderRadius: 1 }} />)}
            </Stack>
            <Skeleton variant="rounded" height={170} sx={{ ...skeletonSx, mt: 3, borderRadius: 2 }} />
          </Box>
        </Card>
      </Container>
    </Box>
  );
}

export function HomePageSkeleton() {
  return (
    <Box component="main" aria-busy="true" aria-label="Home page loading" sx={{ minHeight: "100vh", bgcolor: "var(--color-background)", py: { xs: 3, md: 5 } }}>
      <Container maxWidth="lg">
        <Skeleton variant="rounded" height={46} sx={{ ...skeletonSx, mb: 3, borderRadius: 2 }} />
        <Grid container spacing={3} alignItems="stretch">
          <Grid size={{ xs: 12, md: 6 }} sx={{ display: "flex" }}>
            <Card sx={{ ...surfaceSx, width: "100%", overflow: "hidden" }}>
              <Skeleton variant="rectangular" sx={{ ...skeletonSx, height: { xs: 220, md: 320 } }} />
              <CardContent>
                <Skeleton variant="text" width="88%" height={22} sx={skeletonSx} />
                <Skeleton variant="text" width="72%" height={30} sx={skeletonSx} />
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }} sx={{ display: "flex" }}>
            <Card sx={{ ...surfaceSx, width: "100%", p: { xs: 2, md: 3 }, minHeight: { xs: 320, md: 410 }, display: "flex", flexDirection: "column", gap: 1.5 }}>
              <Skeleton variant="rounded" width={118} height={28} sx={{ ...skeletonSx, borderRadius: 999 }} />
              <Skeleton variant="text" width="82%" height={42} sx={skeletonSx} />
              <Skeleton variant="text" width="94%" sx={skeletonSx} />
              <Skeleton variant="text" width="78%" sx={skeletonSx} />
              <Stack spacing={1} sx={{ mt: 1 }}>
                <Skeleton variant="text" width="88%" sx={skeletonSx} />
                <Skeleton variant="text" width="76%" sx={skeletonSx} />
                <Skeleton variant="text" width="84%" sx={skeletonSx} />
              </Stack>
              <Skeleton variant="rounded" width={138} height={44} sx={{ ...skeletonSx, mt: "auto", borderRadius: 1.5 }} />
            </Card>
          </Grid>
        </Grid>
        <Skeleton variant="rounded" height={52} sx={{ ...skeletonSx, my: 4, borderRadius: 2 }} />
        <Card sx={{ ...surfaceSx, minHeight: { xs: 280, md: 320 }, mb: 4, overflow: "hidden", display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" } }}>
          <Skeleton variant="rectangular" sx={{ ...skeletonSx, height: { xs: 220, md: "100%" } }} />
          <CardContent sx={{ p: { xs: 2.5, md: 4 } }}>
            <Skeleton variant="text" width="82%" height={34} sx={skeletonSx} />
            <Skeleton variant="text" width="94%" sx={skeletonSx} />
            <Skeleton variant="text" width="72%" sx={skeletonSx} />
            <Skeleton variant="rounded" width={120} height={42} sx={{ ...skeletonSx, mt: 2, borderRadius: 1.5 }} />
          </CardContent>
        </Card>
        <Skeleton variant="rounded" height={52} sx={{ ...skeletonSx, mb: 2, borderRadius: 2 }} />
        <Skeleton variant="text" width={150} height={32} sx={{ ...skeletonSx, mb: 2 }} />
        <ProductGridSkeleton count={4} cardHeight={500} imageHeight={220} columns={4} gridSpacing={2} variant="home" />
      </Container>
    </Box>
  );
}

export function CategoryPageSkeleton() {
  return (
    <Box component="main" aria-busy="true" aria-label="Category page loading" sx={{ minHeight: "100vh", bgcolor: "var(--color-background)", py: 5 }}>
      <Container maxWidth="lg">
        <Stack direction="row" spacing={1} sx={{ mb: 4 }}>
          <Skeleton variant="text" width={58} height={24} sx={skeletonSx} />
          <Skeleton variant="text" width={58} height={24} sx={skeletonSx} />
          <Skeleton variant="text" width={120} height={24} sx={skeletonSx} />
        </Stack>
        <Card sx={{ ...surfaceSx, mb: 5, p: { xs: 3, md: 5 }, minHeight: { xs: 220, md: 250 } }}>
          <Skeleton variant="text" width={180} height={22} sx={skeletonSx} />
          <Skeleton variant="text" sx={{ ...skeletonSx, width: { xs: "74%", md: 420 }, height: { xs: 48, md: 66 } }} />
          <Skeleton variant="text" sx={{ ...skeletonSx, width: { xs: "96%", md: 680 } }} />
          <Skeleton variant="text" width={120} sx={skeletonSx} />
        </Card>
        <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "stretch", sm: "center" }} gap={2} sx={{ mb: 3 }}>
          <Box>
            <Skeleton variant="text" width={260} height={32} sx={skeletonSx} />
            <Skeleton variant="text" width={180} sx={skeletonSx} />
          </Box>
          <Skeleton variant="rounded" height={40} sx={{ ...skeletonSx, width: { xs: "100%", sm: 280 }, borderRadius: 1 }} />
        </Stack>
        <ProductGridSkeleton count={6} cardHeight={500} imageHeight={250} columns={3} gridSpacing={3} cardWidth="100%" cardMaxWidth="none" />
      </Container>
    </Box>
  );
}

export default function PageSkeleton({ variant = "default" }) {
  if (variant === "account") return <AccountPageSkeleton />;
  if (variant === "checkout") return <CheckoutPageSkeleton />;
  if (variant === "cart") return <CartPageSkeleton />;
  if (variant === "dashboard") return <DashboardPageSkeleton />;
  if (variant === "table") return <TablePageSkeleton />;
  if (variant === "home") return <HomePageSkeleton />;
  if (variant === "category") return <CategoryPageSkeleton />;

  return (
    <Box component="main" aria-busy="true" aria-label="Page loading" sx={{ minHeight: "100vh", py: { xs: 4, md: 7 }, bgcolor: "var(--color-background)" }}>
      <Container maxWidth="lg">
        <Stack spacing={1} sx={{ mb: 4 }}>
          <Skeleton variant="text" height={34} sx={{ ...skeletonSx, width: { xs: "42%", md: 220 } }} />
          <Skeleton variant="text" height={22} sx={{ ...skeletonSx, width: { xs: "76%", md: 420 } }} />
        </Stack>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" }, gap: 2, mb: 5 }}>
          <Skeleton variant="rounded" sx={{ ...skeletonSx, height: { xs: 180, md: 270 }, borderRadius: 2.5 }} />
          <Skeleton variant="rounded" sx={{ ...skeletonSx, height: { xs: 180, md: 270 }, borderRadius: 2.5 }} />
        </Box>
        <Skeleton variant="text" height={34} sx={{ ...skeletonSx, width: { xs: "42%", md: 250 }, mb: 2 }} />
        <ProductGridSkeleton count={6} />
      </Container>
    </Box>
  );
}

export function ShopPageSkeleton() {
  return (
    <Box component="main" aria-busy="true" aria-label="Shop page loading" sx={{ minHeight: "100vh", bgcolor: "var(--color-background)" }}>
      <Box sx={{ bgcolor: "#e6ebef", py: { xs: 6, md: 8 } }}>
        <Container maxWidth="md">
          <Stack spacing={1.25} alignItems="center">
            <Skeleton variant="text" height={50} sx={{ ...skeletonSx, width: { xs: "72%", sm: 360 } }} />
            <Skeleton variant="text" height={24} sx={{ ...skeletonSx, width: { xs: "90%", sm: 520 } }} />
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ width: "100%", mt: 2 }}>
              <Skeleton variant="rounded" height={52} sx={{ ...skeletonSx, flex: 1, borderRadius: 1.5 }} />
              <Skeleton variant="rounded" height={52} sx={{ ...skeletonSx, width: { xs: "100%", sm: 150 }, borderRadius: 1.5 }} />
            </Stack>
          </Stack>
        </Container>
      </Box>
      <Container maxWidth="lg" sx={{ py: { xs: 4, md: 6 } }}>
        <Stack spacing={1} sx={{ mb: 3 }}>
          <Skeleton variant="text" height={34} sx={{ ...skeletonSx, width: { xs: "48%", md: 230 } }} />
          <Skeleton variant="text" sx={{ ...skeletonSx, width: { xs: "76%", md: 360 } }} />
        </Stack>
        <ProductGridSkeleton count={8} cardHeight={500} imageHeight={220} columns={3} gridSpacing={3} />
      </Container>
    </Box>
  );
}
