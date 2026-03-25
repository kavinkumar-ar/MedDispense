# MedDispense

MedDispense is a modern, high-performance Pharmacy Queue and Prescription Management System. It is intentionally designed to powerfully streamline daily pharmacy operations, track live patient queues, and rigidly enforce role-based access controls across the entire healthcare team.

## 🚀 Key Features

- **Strict Role-Based Access Control (RBAC):** Military-grade secure routing and dashboard access exclusively tailored for `Admin`, `Doctor`, `Pharmacist`, and `Patient` roles. Attempted access to unauthorized routes is instantly blocked natively at the component level.
- **Live Queue Management:** Real-time visibility into patient wait times, active token numbers, and priority statuses (e.g., Urgent, Elderly).
- **Pharmacist Workflow:** Dedicated counters displaying specific medical staff, real-time workload monitoring, dynamic inventory-aware drug dispensing, and safety approval flows.
- **Prescription Tracking:** End-to-end prescription tracking ranging from initial pending reviews to successfully dispensed medications.
- **Performance Optimized:** Built for speed. It heavily utilizes `@tanstack/react-query` caching and synchronous `localStorage` fallbacks integrated directly with Supabase's secure JWT validation to eliminate rendering stutters.

## 🛠️ Tech Stack

- **Frontend Core:** React, Vite, TypeScript
- **Styling & UI:** Tailwind CSS, shadcn/ui, Framer Motion
- **State Management:** `@tanstack/react-query`
- **Backend & Database:** Dedicated Supabase (PostgreSQL, GoTrue Auth, Edge Functions)

## 📦 Local Setup

1. **Clone the repository:**
   ```sh
   git clone <YOUR_GIT_URL>
   cd quick-dispense-ai-main
   ```

2. **Install dependencies:**
   ```sh
   npm install
   ```

3. **Configure Environment Variables:**
   Create a `.env` file in the root directory and add your dedicated Supabase credentials:
   ```env
   VITE_SUPABASE_URL="https://your-project-url.supabase.co"
   VITE_SUPABASE_PUBLISHABLE_KEY="your-anon-publishable-key"
   VITE_SUPABASE_PROJECT_ID="your-project-id"
   ```

4. **Run the Development Server:**
   ```sh
   npm run dev
   ```

## 🗄️ Database Setup & Demo Data

This application requires a dedicated Supabase instance to function due to its complex triggers and security rules.
1. Run `setup_database.sql` directly in your Supabase SQL Editor to build the schemas, User profiles, and RLS policies.
2. Disable **Confirm Email** inside your Supabase Authentication settings.
3. Register your primary `Admin`, `Doctor`, and `Pharmacist` accounts via the website, and manually adjust their status in the `user_roles` database table.
4. *(Optional)* Run `seed_multi_patients.sql` or `seed_data_only.sql` to instantly populate the application with rich, varied dummy records (Patients, Queues, Prescriptions) mapped to your actual doctors.

## 🔒 Security Architecture

MedDispense employs a strict **"Deny-by-Default"** security mechanism. Unauthorized route access is instantly blocked via synchronous local state verifications that tightly bind to the React Router, guaranteeing zero-latency protection against malicious navigation routing.

## 🚀 Vercel Deployment

This project is perfectly optimized for immediate deployment on **Vercel**. 
Vercel automatically handles the Single Page Application (SPA) `index.html` rewrites required by React Router using the included `vercel.json` configuration file, ensuring no 404 errors ever occur on page refresh.

---
*Built initially as a Lovable prototype and extensively architected into a seamless, high-performance production application.*
