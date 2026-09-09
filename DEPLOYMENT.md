# Deployment

Use Supabase for the database and authentication, Render for the API, and Vercel for the frontend. Nothing needs to run on a church computer.

## 1. Push the repository to GitHub

Do not commit `.env`. Keep the service-role key only in the deployment provider's environment settings.

## 2. Deploy the API on Render

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

## 3. Deploy the frontend on Vercel

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

## 4. Supabase Auth settings

In Supabase Authentication settings, add the Vercel URL to **Site URL** and **Redirect URLs**. Run [supabase-auth.sql](supabase-auth.sql) in the Supabase SQL editor if the auth tables or audit table are not already present.

## 5. Create the first administrator

Create the user in Supabase Authentication, then promote the account with:

```sql
update public.profiles p
set role = 'superadmin', updated_at = now()
from auth.users u
where p.id = u.id
  and lower(u.email) = lower('your-superadmin-email@example.com');
```

The church can then access the Vercel URL from any device with internet access.