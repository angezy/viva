"use client";
import { Box, Button, Container, Grid, TextField, Typography, Paper } from "@mui/material";

export default function ContactPage() {
  return (
    <Box sx={{ bgcolor: "#0a0f1c", color: "white", minHeight: "100vh", py: { xs: 6, md: 10 }, fontFamily: "'Space Grotesk','Segoe UI',sans-serif" }}>
      <Container maxWidth="md">
        <Paper
          elevation={0}
          sx={{
            p: { xs: 3, md: 4 },
            borderRadius: 3,
            border: "1px solid rgba(255,255,255,0.08)",
            background: "linear-gradient(135deg, rgba(37,99,235,0.15), rgba(6,182,212,0.15))",
            color: "white",
          }}
        >
          <Typography variant="overline" sx={{ letterSpacing: 1, color: "#93c5fd" }}>
            Contact
          </Typography>
          <Typography variant="h4" fontWeight={800} gutterBottom>
            Let's talk about your next release
          </Typography>
          <Typography sx={{ color: "rgba(255,255,255,0.75)", mb: 3 }}>
            Tell us about your product, goals, and timeline. We'll get back within one business day.
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Name" variant="outlined" InputLabelProps={{ style: { color: "#cbd5e1" } }} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Email" variant="outlined" InputLabelProps={{ style: { color: "#cbd5e1" } }} />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth label="Company" variant="outlined" InputLabelProps={{ style: { color: "#cbd5e1" } }} />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="What are you building?"
                variant="outlined"
                multiline
                minRows={4}
                InputLabelProps={{ style: { color: "#cbd5e1" } }}
              />
            </Grid>
          </Grid>
          <Button variant="contained" sx={{ mt: 3, borderRadius: 2, textTransform: "none", px: 3 }}>
            Send message
          </Button>
        </Paper>
      </Container>
    </Box>
  );
}
