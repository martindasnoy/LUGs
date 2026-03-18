This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

## Environment Variables

Create a local env file from the example:

```bash
cp .env.example .env.local
```

Required values:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (solo scripts/server, nunca en frontend)
- `REBRICKABLE_API_KEY` (server-side only, never expose as `NEXT_PUBLIC_*`)
- `REBRICKABLE_API_BASE_URL` (default: `https://rebrickable.com/api/v3`)

Optional (for Meilisearch-backed part search):

- `MEILISEARCH_HOST`
- `MEILISEARCH_API_KEY`
- `MEILISEARCH_PARTS_INDEX` (default: `parts_catalog`)

## Sync parts into Meilisearch

After `parts_catalog` is populated, build/update the Meilisearch index with:

```bash
npm run sync:meilisearch:parts
```

## Sync Rebrickable categories

After running Supabase migration `0025_create_parts_catalog_and_search_rpc.sql`, sync categories with:

```bash
npm run sync:rebrickable:categories
```

## Sync Rebrickable parts (batch)

Run a resumable batch sync into `parts_catalog`:

```bash
npm run sync:rebrickable:parts
```

If it stops, run it again and it resumes automatically.

To restart from scratch:

```bash
npm run sync:rebrickable:parts -- --reset
```

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
