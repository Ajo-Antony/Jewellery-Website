# 💎 Thoppil Jewellery Website — Supabase Edition

Premium jewellery website with scroll animations, admin dashboard, image uploads via **Supabase Storage**, and persistent data via **Supabase PostgreSQL**.

---

## ✨ Features
- Luxury gold-themed frontend with scroll animations
- Dynamic collections loaded from Supabase
- Customer enquiry form → saved to Supabase
- Admin dashboard — login, add/edit/delete collections, manage enquiries
- Image upload → stored in Supabase Storage (never lost on redeploy)
- Zero npm dependencies — pure Node.js 18+

---

## 🗄️ Step 1 — Set Up Supabase (5 minutes)

### 1.1 Create a Supabase Project
1. Go to [supabase.com](https://supabase.com) → **Start your project**
2. Sign in with GitHub
3. Click **New Project**
4. Fill in:
   - **Name**: `thoppil-jewellery`
   - **Database Password**: choose a strong password
   - **Region**: `Southeast Asia (Singapore)` — closest to Kerala
5. Click **Create new project** — wait ~2 minutes

---

### 1.2 Run the Database Schema
1. In Supabase dashboard → click **SQL Editor** (left sidebar)
2. Click **New Query**
3. Open `supabase-schema.sql` from this project
4. Copy all the SQL and paste it into the editor
5. Click **Run** — you should see `Success`

---

### 1.3 Create Storage Bucket
1. In Supabase dashboard → **Storage** (left sidebar)
2. Click **New bucket**
3. Name: `jewellery-images`
4. ✅ Tick **Public bucket**
5. Click **Save**

---

### 1.4 Get Your API Keys
1. Supabase dashboard → **Settings** → **API**
2. Copy:

```
Project URL:       https://xxxxx.supabase.co
service_role key:  eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## 🚀 Step 2 — Deploy to Render

### 2.1 Push to GitHub
```bash
git add .
git commit -m "Supabase integration"
git push origin main
```

### 2.2 Set Environment Variables on Render
Go to your Render service → **Environment** tab → add:

| Key | Value |
|-----|-------|
| `SUPABASE_URL` | `https://xxxxx.supabase.co` |
| `SUPABASE_SERVICE_KEY` | your service_role key |
| `ADMIN_USERNAME` | `admin` |
| `ADMIN_PASSWORD` | your chosen password |
| `JWT_SECRET` | any long random string |

Click **Save Changes** → Render redeploys ✅

---

## 🖥️ Run Locally

```bash
# Edit .env — add your Supabase keys
# Then:
node server.js

# Website: http://localhost:3000
# Admin:   http://localhost:3000/admin
```

---

## 📁 Project Structure

```
jewellery-site/
├── server.js              ← Backend (Node.js built-ins + Supabase REST)
├── render.yaml            ← Render deploy config
├── railway.json           ← Railway deploy config
├── supabase-schema.sql    ← Run this in Supabase SQL Editor
├── .env                   ← Your Supabase keys go here
├── public/                ← Public website (HTML/CSS/JS)
└── admin/                 ← Admin dashboard
```

---

## 🌐 Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | ✅ | Your Supabase project URL |
| `SUPABASE_SERVICE_KEY` | ✅ | service_role secret key |
| `ADMIN_USERNAME` | Optional | Default: `admin` |
| `ADMIN_PASSWORD` | Optional | Default: `admin123` |
| `JWT_SECRET` | Optional | JWT signing secret |
| `PORT` | Optional | Default: `3000` |

---

*Built for Thoppil Jewellery, Kottayam, Kerala* 💛
