# Deployment

Use Supabase for the database and authentication, Render for the API, and Vercel for the frontend. Their free tiers are suitable for a small church, although Render may pause the API after inactivity and take a few seconds to wake up. Nothing needs to run on a church computer.

The deployment requires free accounts at [GitHub](https://github.com/), [Supabase](https://supabase.com/), [Render](https://render.com/), and [Vercel](https://vercel.com/). Account creation, billing verification, and secret entry must be completed by the project owner; never commit `.env` or the Supabase service-role key.

## 1. Push the repository to GitHub

Do not commit `.env`. Keep the service-role key only in the deployment provider's environment settings.

## 2. Prepare Supabase

Create a Supabase project, copy its project URL, anon key, service-role key, and Postgres connection string, then run [supabase-auth.sql](supabase-auth.sql) in the Supabase SQL Editor. The connection string is available under **Project Settings > Database > Connection string**.

Under **Authentication > URL Configuration**, temporarily set the Site URL to the Vercel URL you will create in step 4, then add that same URL to the Redirect URLs.

## 3. Deploy the API on Render

Create a **Web Service** connected to this GitHub repository.

- Build command: `pnpm install --frozen-lockfile && pnpm --filter @workspace/api-server run build`
- Start command: `pnpm --filter @workspace/api-server run start`
- Health check path: `/api/healthz`

Add these environment variables:

```text
DATABASE_URL=your-supabase-postgres-connection-string
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
CORS_ORIGIN=https://your-frontend.vercel.app
```

Render supplies `PORT` automatically. Copy the Render service URL, for example `https://church-records-api.onrender.com`.

## 4. Deploy the frontend on Vercel

Create a Vercel project from the same repository. Set the project root to `artifacts/church-member-records`.

- Build command: `cd ../.. && pnpm install --frozen-lockfile && pnpm --filter @workspace/church-member-records run build`
- Output directory: `dist/public`

Add these environment variables:

```text
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
VITE_API_URL=https://church-records-api.onrender.com
```

After Vercel gives you the final frontend URL, update Render's `CORS_ORIGIN` to that exact URL and redeploy the API.

The repository includes `vercel.json` so browser refreshes on application routes return to the React app. Set `VITE_API_URL` to the deployed Render API URL, without a trailing slash.

## 5. Finish Supabase Auth settings

In Supabase Authentication settings, add the Vercel URL to **Site URL** and **Redirect URLs**. Run [supabase-auth.sql](supabase-auth.sql) in the Supabase SQL editor if the auth tables or audit table are not already present.

## 6. Create the first administrator

Create the user in Supabase Authentication, then promote the account with:

```sql
update public.profiles p
set role = 'superadmin', updated_at = now()
from auth.users u
where p.id = u.id
  and lower(u.email) = lower('your-superadmin-email@example.com');
```

The church can then access the Vercel URL from any device with internet access.