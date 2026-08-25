# OTP-Based Attendance Management System

A modern, robust web application for managing student attendance using time-limited OTPs. Built with FastAPI (Python), React (Vite), Tailwind CSS, and PostgreSQL.

## Features

- **Email Whitelist & Access Control**: Admins can register and manage authorized student email IDs; only whitelisted emails can log in.
- **Admin Dashboard**: Start/End sessions, generate secure 6-digit OTPs, view live attendance, manage authorized student email whitelist, and export data as CSV.
- **Student Dashboard**: Mark attendance using the live OTP, view past attendance history.
- **Security**: Time-limited OTPs, duplicate attendance prevention, and robust session validation.


## Prerequisites

- Node.js (v18+)
- Python (3.9+)
- PostgreSQL (Optional, defaults to local Postgres on 5432, can use SQLite if configured in backend database.py)

## Setup Instructions

### 1. Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Create a virtual environment and activate it:
   ```bash
   python -m venv venv
   # Windows
   .\venv\Scripts\activate
   # macOS/Linux
   source venv/bin/activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Set up environment variables:
   - Copy `.env.example` to `.env`
   - Fill in your `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.
   - Update `INITIAL_ADMIN_EMAIL` to your email address to automatically receive Admin rights on your first login.
   - Ensure your PostgreSQL database is running, or modify the `DATABASE_URL` in `.env`.
5. Start the backend server:
   ```bash
   uvicorn app.main:app --reload
   ```
   The API will be available at `http://localhost:8000`. Swagger docs at `http://localhost:8000/docs`.

### 2. Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up environment variables:
   - Create a `.env` file in the `frontend` folder:
     ```
     VITE_GOOGLE_CLIENT_ID=your_google_client_id_here
     ```
4. Start the Vite development server:
   ```bash
   npm run dev
   ```
   The app will be available at `http://localhost:5173`.

## Architecture

- **Backend**: FastAPI, SQLAlchemy (ORM), Pydantic, Python-Jose (JWT).
- **Frontend**: React (Vite), Tailwind CSS v4, React Router, Axios, Lucide React (Icons).
- **Database**: PostgreSQL schemas for `users`, `attendance_sessions`, `otps`, and `attendance_records`.
