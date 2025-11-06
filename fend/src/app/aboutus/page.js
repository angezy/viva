"use client";
import React from "react";
import {
  Box,
  Container,
  Typography,
  Grid,
  Card,
  CardContent,
  CardMedia,
  Button,
} from "@mui/material";

export default function AboutUsPage() {
  return (
    <Box sx={{ fontFamily: 'Inter, Roboto, Arial' }}>
      {/* Hero */}
      <Box
        sx={{
          py: { xs: 6, md: 10 },
          textAlign: 'center',
          background: 'linear-gradient(120deg, #0f1724 0%, #0b3d91 100%)',
          color: 'white',
          mb: 6,
        }}
      >
        <Container maxWidth="md">
          <Typography variant="h3" fontWeight={800} gutterBottom>
            About Us
          </Typography>
          <Typography variant="h6" sx={{ opacity: 0.9, maxWidth: 680, mx: 'auto' }}>
            We craft digital experiences that connect brands with people. Our
            work blends strategy, design, and engineering to produce measurable
            impact.
          </Typography>
        </Container>
      </Box>

      {/* Two-column mission + values */}
      <Container maxWidth="lg" sx={{ mb: 6 }}>
        <Grid container spacing={4}>
          <Grid item xs={12} md={6}>
            <Card sx={{ p: 3, borderRadius: 3, boxShadow: 2, height: '100%' }}>
              <Typography variant="h5" fontWeight={700} gutterBottom>
                Our Mission
              </Typography>
              <Typography color="text.secondary">
                Empower businesses with simple, pragmatic technology. We focus
                on solving real problems with elegant solutions — nothing
                flashy, just work that moves the needle.
              </Typography>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card sx={{ p: 3, borderRadius: 3, boxShadow: 2, height: '100%' }}>
              <Typography variant="h5" fontWeight={700} gutterBottom>
                Our Values
              </Typography>
              <Typography color="text.secondary">
                Honesty, craftsmanship, and partnership guide everything we do.
                We care about clarity, durability, and delivering results our
                clients can rely on.
              </Typography>
            </Card>
          </Grid>
        </Grid>
      </Container>

      {/* Team: exactly 2 people */}
      <Box sx={{ backgroundColor: '#0b1220', color: 'white', py: 8 }}>
        <Container maxWidth="lg">
          <Typography variant="h4" fontWeight={800} textAlign="center" gutterBottom>
            Meet the Founders
          </Typography>

          <Grid container spacing={4} justifyContent="center" sx={{ mt: 2 }}>
            {[
              {
                name: 'Nick Farahmand',
                role: 'CEO & Founder',
                img: '/images/team-nick.jpg' // replace with real paths
              },
              {
                name: 'Parmis Nik Khah',
                role: 'CTO',
                img: '/images/team-parmis.jpg' // replace with real paths
              }
            ].map((member, i) => (
              <Grid item xs={12} md={6} key={i}>
                <Card sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 2, borderRadius: 3, boxShadow: 6 }}>
                  <CardMedia
                    component="img"
                    image={member.img}
                    alt={member.name}
                    sx={{ width: 160, height: 160, borderRadius: 2, objectFit: 'cover' }}
                  />
                  <CardContent sx={{ flex: 1 }}>
                    <Typography variant="h6" fontWeight={800}>
                      {member.name}
                    </Typography>
                    <Typography variant="body2" color="grey.300" sx={{ mb: 1 }}>
                      {member.role}
                    </Typography>
                    <Typography variant="body2" color="grey.300">
                      Passionate about building teams and products that last. We
                      focus on long-term partnerships and measurable outcomes.
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* CTA */}
      <Box sx={{ py: 6, textAlign: 'center' }}>
        <Container>
          <Typography variant="h5" fontWeight={700} gutterBottom>
            Want to work with us?
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Let us build something meaningful together — tell us about your
            project and we will be in touch.
          </Typography>
          <Button variant="contained" color="primary" size="large" sx={{ mt: 3 }}>
            Contact Us
          </Button>
        </Container>
      </Box>

      {/* Founders' story - full page section */}
      <Box sx={{ backgroundColor: '#fff', color: '#111827', py: 10 }}>
        <Container maxWidth="lg">
          <Typography variant="h4" fontWeight={800} gutterBottom>
            Our Story
          </Typography>

          <Typography variant="body1" paragraph sx={{ color: 'text.secondary' }}>
            Nick Farahmand and Parmis Nik Khah started this project with a simple belief:
            that online shopping should feel trustworthy, effortless, and human. Nick, who
            has spent years building product teams and small businesses, brings a practical
            focus on operations and customer experience. Parmis, a technologist and systems
            thinker, loves turning messy problems into simple, reliable workflows. Together
            they make a founder team with complementary strengths — one drives product and
            partnerships while the other ensures the technology and data run smoothly.
          </Typography>

          <Typography variant="body1" paragraph sx={{ color: 'text.secondary' }}>
            Their approach is straightforward: start small, learn fast, and prioritize
            the things that matter to customers. From day one they have focused on curating
            products that have clear value, writing honest product descriptions, and
            delivering friendly customer support. This site is the result of their
            conversations about what online shopping could be — less noise, more clarity.
          </Typography>

          <Typography variant="body1" paragraph sx={{ color: 'text.secondary' }}>
            As a two-person founding team, they value transparency and personal service.
            When you buy from the shop you will often hear directly from them — whether it is
            a welcome message, product recommendation, or help with an order. They are
            excited to grow carefully, partner with makers and small brands, and build a
            business that customers can rely on for years to come.
          </Typography>

          <Typography variant="body1" paragraph sx={{ color: 'text.secondary' }}>
            Thank you for stopping by and supporting this small business — your feedback
            matters. If you have questions, suggestions, or would like to collaborate,
            please reach out. Nick and Parmis are happy to connect and hear how they can
            make the experience better for you.
          </Typography>
        </Container>
      </Box>
    </Box>
  );
}
