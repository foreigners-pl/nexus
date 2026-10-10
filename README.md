# Nexus CRM

A modern CRM frontend built with Next.js 14, TypeScript, and Tailwind CSS.

## Tech Stack

- **Next.js 14** - React framework with App Router
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first CSS framework
- **Supabase** - Backend and database (to be integrated)

## Getting Started

### Prerequisites

- Node.js 18.17 or later
- npm (comes with Node.js)

### Installation

1. Clone the repository or open the project in VS Code

2. Install dependencies:
```
npm install
```

3. Configure environment variables:
   - Copy the `.env.local` file and add your Supabase credentials
   - Get your Supabase URL and keys from your Supabase project settings

### Development

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to see the application.

### Build

Build the application for production:

```bash
npm run build
```

### Start Production Server

```bash
npm start
```

## Project Structure

```
nexus/
 app/                # Next.js App Router pages and layouts
    layout.tsx     # Root layout component
    page.tsx       # Home page
    globals.css    # Global styles
 .github/           # GitHub and Copilot configuration
 .env.local         # Environment variables (not committed)
 next.config.ts     # Next.js configuration
 tsconfig.json      # TypeScript configuration
 package.json       # Dependencies and scripts
```

## Environment Variables

The following environment variables are required:

- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key (server-side only)

## CRM Features (To Be Implemented)

- Contact management
- Deal tracking
- Task management
- Dashboard and analytics
- User authentication
- Mobile-responsive design

## Development Guidelines

- Use TypeScript for all new files
- Follow Next.js App Router conventions
- Use Tailwind CSS for styling
- Server components by default, client components when needed
- Ensure all components are properly typed

## License

Private project

