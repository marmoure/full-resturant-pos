# RestaurantPOS - Installation & Setup Guide

## Prerequisites

- **Node.js** 18 or higher
- **npm** (comes with Node.js)

## Installation Steps

### 1. Install Dependencies

Install all dependencies for both backend and frontend:

```bash
npm run install:all
```

Or install them separately:

```bash
# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### 2. Set Up Database

Generate Prisma client and create the database:

```bash
npm run prisma:generate
npm run prisma:migrate
```

When prompted for a migration name, you can use: `init`

## Running the Application

### Option 1: Run Both Servers Simultaneously (Recommended)

```bash
npm run dev
```

This will start:
- Backend server on http://localhost:5000
- Frontend server on http://localhost:3000

### Option 2: Run Servers Separately

**Terminal 1 - Backend:**
```bash
npm run dev:backend
```

**Terminal 2 - Frontend:**
```bash
npm run dev:frontend
```

## Access the Application

Once both servers are running:

- **Frontend**: Open your browser to http://localhost:3000
- **Backend API**: http://localhost:5000

The frontend will automatically test the connection to the backend and display the status.

## Troubleshooting

### Backend won't start
- Check if port 5000 is already in use
- Verify `.env` file exists in the `backend` directory
- Run `npm run prisma:generate` to ensure Prisma client is generated

### Frontend won't start
- Check if port 3000 is already in use
- Clear node_modules and reinstall: `rm -rf node_modules && npm install`

### Connection errors
- Ensure both backend and frontend servers are running
- Check that backend is running on port 5000
- Verify no firewall is blocking localhost connections

## Additional Commands

### Database Management

```bash
# Open Prisma Studio (database GUI)
npm run prisma:studio

# Create a new migration
npm run prisma:migrate

# Reset database (WARNING: deletes all data)
cd backend
npx prisma migrate reset
```

### Build for Production

```bash
# Build both projects
npm run build

# Build individually
npm run build:backend
npm run build:frontend
```

## Next Steps

After successful installation and startup, you should see a status page showing:
- ✅ Backend Server: Connected
- ✅ Database: Connected

You're now ready to proceed with Phase 2: Authentication & Roles.
