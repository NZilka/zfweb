# Project Overview

**Purpose**: E-commerce site for handmade jewelry + portfolio demonstration
**Goals**:

- Functional online store for selling products
- Showcase modern development practices with AI assistance
- Clean, professional aesthetic
- Cutting edge UI design

# Tech Stack

- **Framework**: Next.js (App Router recommended for modern projects)
- **Language**: TypeScript
- **Frontend**: React, Tailwind CSS, shadcn/ui
- **Database**: Drizzle ORM
- **Package Manager**: PNPM
- **Hosting**: Vercel
- **Auth**: Clerk
- **Analytics**: PostHog
- **Caching/Rate Limiting**: Upstash
- **Error Tracking**: Sentry
- **Payment Processor**: Stripe

# Core Features

## Admin Panel

- Product CRUD operations
- Image upload/management
- Inventory tracking

## Product Schema

- Name, description
- Price, currency
- Images (multiple)
- Categories/tags
- Inventory count
- SKU
- Dimensions/weight (for shipping)
- Materials used
- Available/draft status

## Customer-Facing

- Product listings with filtering
- Individual product pages
- Shopping cart
- Checkout flow with Stripe integration
- Order confirmation
- Customer accounts with order history

## Payment & Checkout

- Stripe PaymentElement for secure card collection
- Guest checkout (no account required)
- Saved payment methods for logged-in users
- Stripe Customer created before payment for consistency
- Webhook handling for payment events
- KV caching for fast payment state lookups

# Design Direction

- Clean, modern, minimalist
- Focus on product photography
- Mobile-first responsive
- Accessible (WCAG compliant)
