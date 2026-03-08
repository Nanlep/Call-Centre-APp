import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import Twilio from "twilio";
import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";
import { google } from "googleapis";
import * as hubspot from "@hubspot/api-client";
import jsforce from "jsforce";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cors from "cors";
import morgan from "morgan";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const JWT_SECRET = process.env.JWT_SECRET || "meti-call-center-secret-key-change-in-prod";

// Initialize Database
const db = new Database("call_center.db");
db.pragma("journal_mode = WAL");

// ... (Database Schema and Seeding remains the same) ...
// Initialize Schema
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT DEFAULT 'agent', -- admin, agent
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS user_integrations (
    user_id INTEGER,
    provider TEXT NOT NULL, -- google, hubspot, salesforce
    access_token TEXT,
    refresh_token TEXT,
    instance_url TEXT, -- for salesforce
    expires_at DATETIME,
    FOREIGN KEY(user_id) REFERENCES users(id),
    UNIQUE(user_id, provider)
  );

  CREATE TABLE IF NOT EXISTS contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    type TEXT DEFAULT 'customer', -- customer, lead
    notes TEXT,
    source TEXT DEFAULT 'manual' -- manual, google, hubspot, salesforce
  );

  CREATE TABLE IF NOT EXISTS campaigns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT NOT NULL, -- inbound, outbound
    status TEXT DEFAULT 'active'
  );

  CREATE TABLE IF NOT EXISTS campaign_contacts (
    campaign_id INTEGER,
    contact_id INTEGER,
    status TEXT DEFAULT 'pending', -- pending, called, completed
    FOREIGN KEY(campaign_id) REFERENCES campaigns(id),
    FOREIGN KEY(contact_id) REFERENCES contacts(id)
  );

  CREATE TABLE IF NOT EXISTS call_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    contact_id INTEGER,
    direction TEXT, -- inbound, outbound
    duration INTEGER,
    status TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    agent_id INTEGER,
    FOREIGN KEY(contact_id) REFERENCES contacts(id),
    FOREIGN KEY(agent_id) REFERENCES users(id)
  );
`);

// Seed Data if empty
const contactCount = db.prepare("SELECT count(*) as count FROM contacts").get() as { count: number };
if (contactCount.count === 0) {
  const insertContact = db.prepare("INSERT INTO contacts (name, phone, email, type, notes) VALUES (?, ?, ?, ?, ?)");
  insertContact.run("Alice Johnson", "+15550101", "alice@example.com", "customer", "Premium plan user");
  insertContact.run("Bob Smith", "+15550102", "bob@example.com", "lead", "Interested in billing support");
  insertContact.run("Charlie Brown", "+15550103", "charlie@example.com", "customer", "Reported outage last week");

  const insertCampaign = db.prepare("INSERT INTO campaigns (name, type) VALUES (?, ?)");
  insertCampaign.run("Q1 Sales Outreach", "outbound");
  insertCampaign.run("Support Queue A", "inbound");

  const insertCampContact = db.prepare("INSERT INTO campaign_contacts (campaign_id, contact_id) VALUES (?, ?)");
  insertCampContact.run(1, 1);
  insertCampContact.run(1, 2);
}

// Seed Admin User if empty
const userCount = db.prepare("SELECT count(*) as count FROM users").get() as { count: number };
if (userCount.count === 0) {
  const hashedPassword = bcrypt.hashSync("admin123", 10);
  const insertUser = db.prepare("INSERT INTO users (email, password, name, role) VALUES (?, ?, ?, ?)");
  insertUser.run("admin@meticall.com", hashedPassword, "Admin User", "admin");
}

async function startServer() {
  const app = express();
  app.set('trust proxy', 1); // Trust first proxy (required for rate limiting behind nginx)
  const httpServer = createServer(app);
  const io = new Server(httpServer);
  const PORT = 3000;

  // --- Enterprise Security & Logging Middleware ---
  
  // 1. Secure HTTP Headers
  app.use(helmet({
    contentSecurityPolicy: false, // Disabled for dev/iframe compatibility, enable in strict prod
    crossOriginEmbedderPolicy: false,
  }));

  // 2. CORS Configuration
  app.use(cors({
    origin: process.env.APP_URL || "*", // Restrict to app domain in prod
    credentials: true,
  }));

  // 3. Rate Limiting (Prevent Brute Force & DDoS)
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: "Too many requests from this IP, please try again later."
  });
  app.use("/api/", limiter); // Apply to API routes

  // 4. Request Logging
  app.use(morgan("combined")); // Standard Apache combined log format

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  // Auth Middleware
  const authenticateToken = (req: any, res: any, next: any) => {
    const token = req.cookies.token || req.headers['authorization']?.split(' ')[1];
    if (!token) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
      if (err) return res.sendStatus(403);
      req.user = user;
      next();
    });
  };

  // --- API Routes ---


  // Auth Routes
  app.post("/api/auth/register", (req, res) => {
    const { email, password, name } = req.body;
    if (!email || !password || !name) return res.status(400).json({ error: "Missing fields" });

    try {
      const hashedPassword = bcrypt.hashSync(password, 10);
      const stmt = db.prepare("INSERT INTO users (email, password, name) VALUES (?, ?, ?)");
      const info = stmt.run(email, hashedPassword, name);
      
      const token = jwt.sign({ id: info.lastInsertRowid, email, name, role: 'agent' }, JWT_SECRET, { expiresIn: '8h' });
      
      res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production' });
      res.json({ token, user: { id: info.lastInsertRowid, email, name, role: 'agent' } });
    } catch (err: any) {
      if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        return res.status(400).json({ error: "Email already exists" });
      }
      res.status(500).json({ error: "Registration failed" });
    }
  });

  app.post("/api/auth/login", (req, res) => {
    const { email, password } = req.body;
    const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email) as any;

    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign({ id: user.id, email: user.email, name: user.name, role: user.role }, JWT_SECRET, { expiresIn: '8h' });
    
    res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production' });
    res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
  });

  app.post("/api/auth/logout", (req, res) => {
    res.clearCookie('token');
    res.json({ success: true });
  });

  app.get("/api/auth/me", authenticateToken, (req: any, res) => {
    res.json({ user: req.user });
  });

  // Protected Routes
  
  // 1. Token Generation
  app.get("/api/token", authenticateToken, (req: any, res) => {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const apiKey = process.env.TWILIO_API_KEY;
    const apiSecret = process.env.TWILIO_API_SECRET;
    const appSid = process.env.TWILIO_APP_SID;
    // Use the authenticated user's name or ID as identity
    const identity = `agent_${req.user.id}`; 

    if (!accountSid || !apiKey || !apiSecret || !appSid) {
      // Return mock token for demo if credentials missing
      return res.json({ token: "mock_token", identity });
    }

    const AccessToken = Twilio.jwt.AccessToken;
    const VoiceGrant = AccessToken.VoiceGrant;

    const voiceGrant = new VoiceGrant({
      outgoingApplicationSid: appSid,
      incomingAllow: true,
    });

    const token = new AccessToken(accountSid, apiKey, apiSecret, { identity });
    token.addGrant(voiceGrant);

    res.json({ token: token.toJwt(), identity });
  });

  // 2. TwiML Webhook for Voice (Public, but verified by Twilio signature in prod - skipped here for simplicity)
  app.post("/api/voice", (req, res) => {
    const twiml = new Twilio.twiml.VoiceResponse();
    const { To } = req.body;

    if (To) {
      // Outbound call
      const dial = twiml.dial({ callerId: process.env.TWILIO_CALLER_ID });
      dial.number(To);
    } else {
      // Inbound call
      const dial = twiml.dial();
      // In a real app, we'd route to available agents. For now, broadcast.
      dial.client("agent_1"); 
    }

    res.type("text/xml");
    res.send(twiml.toString());
  });

  // 3. Data APIs
  app.get("/api/contacts", authenticateToken, (req, res) => {
    const contacts = db.prepare("SELECT * FROM contacts").all();
    res.json(contacts);
  });

  app.get("/api/campaigns", authenticateToken, (req, res) => {
    const campaigns = db.prepare("SELECT * FROM campaigns").all();
    res.json(campaigns);
  });

  app.get("/api/logs", authenticateToken, (req, res) => {
    const logs = db.prepare(`
      SELECT l.*, c.name as contact_name, u.name as agent_name
      FROM call_logs l 
      LEFT JOIN contacts c ON l.contact_id = c.id 
      LEFT JOIN users u ON l.agent_id = u.id
      ORDER BY l.timestamp DESC
    `).all();
    res.json(logs);
  });

  app.post("/api/logs", authenticateToken, (req: any, res) => {
    const { contact_id, direction, duration, status } = req.body;
    const stmt = db.prepare("INSERT INTO call_logs (contact_id, direction, duration, status, agent_id) VALUES (?, ?, ?, ?, ?)");
    stmt.run(contact_id, direction, duration, status, req.user.id);
    
    // Notify clients
    io.emit("log_update");
    res.json({ success: true });
  });

  // --- CRM Integration Routes ---

  // Get Integrations Status
  app.get("/api/integrations", authenticateToken, (req: any, res) => {
    const integrations = db.prepare("SELECT provider FROM user_integrations WHERE user_id = ?").all(req.user.id);
    const connected = integrations.map((i: any) => i.provider);
    res.json({
      google: connected.includes('google'),
      hubspot: connected.includes('hubspot'),
      salesforce: connected.includes('salesforce')
    });
  });

  // Google Sheets Sync (Mock Implementation for Demo)
  app.post("/api/integrations/google/sync", authenticateToken, async (req: any, res) => {
    // In a real app, this would use the stored access token to fetch from Sheets API
    // For demo, we'll simulate fetching contacts
    try {
      const mockContacts = [
        { name: "Google Lead 1", phone: "+15550201", email: "lead1@gmail.com", type: "lead", source: "google" },
        { name: "Google Lead 2", phone: "+15550202", email: "lead2@gmail.com", type: "lead", source: "google" }
      ];

      const stmt = db.prepare("INSERT INTO contacts (name, phone, email, type, source) VALUES (?, ?, ?, ?, ?)");
      const transaction = db.transaction((contacts) => {
        for (const contact of contacts) {
          // Check if exists
          const exists = db.prepare("SELECT id FROM contacts WHERE email = ?").get(contact.email);
          if (!exists) {
            stmt.run(contact.name, contact.phone, contact.email, contact.type, contact.source);
          }
        }
      });
      transaction(mockContacts);
      
      // Mark as connected if not already
      const check = db.prepare("SELECT * FROM user_integrations WHERE user_id = ? AND provider = 'google'").get(req.user.id);
      if (!check) {
        db.prepare("INSERT INTO user_integrations (user_id, provider) VALUES (?, 'google')").run(req.user.id);
      }

      res.json({ success: true, count: mockContacts.length });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Sync failed" });
    }
  });

  // HubSpot Sync (Mock Implementation)
  app.post("/api/integrations/hubspot/sync", authenticateToken, async (req: any, res) => {
    try {
      const mockContacts = [
        { name: "HubSpot Deal 1", phone: "+15550301", email: "deal1@hubspot.com", type: "customer", source: "hubspot" }
      ];

      const stmt = db.prepare("INSERT INTO contacts (name, phone, email, type, source) VALUES (?, ?, ?, ?, ?)");
      const transaction = db.transaction((contacts) => {
        for (const contact of contacts) {
          const exists = db.prepare("SELECT id FROM contacts WHERE email = ?").get(contact.email);
          if (!exists) {
            stmt.run(contact.name, contact.phone, contact.email, contact.type, contact.source);
          }
        }
      });
      transaction(mockContacts);

      const check = db.prepare("SELECT * FROM user_integrations WHERE user_id = ? AND provider = 'hubspot'").get(req.user.id);
      if (!check) {
        db.prepare("INSERT INTO user_integrations (user_id, provider) VALUES (?, 'hubspot')").run(req.user.id);
      }

      res.json({ success: true, count: mockContacts.length });
    } catch (err) {
      res.status(500).json({ error: "Sync failed" });
    }
  });

  // Salesforce Sync (Mock Implementation)
  app.post("/api/integrations/salesforce/sync", authenticateToken, async (req: any, res) => {
    try {
      const mockContacts = [
        { name: "SFDC Opportunity 1", phone: "+15550401", email: "opp1@salesforce.com", type: "lead", source: "salesforce" }
      ];

      const stmt = db.prepare("INSERT INTO contacts (name, phone, email, type, source) VALUES (?, ?, ?, ?, ?)");
      const transaction = db.transaction((contacts) => {
        for (const contact of contacts) {
          const exists = db.prepare("SELECT id FROM contacts WHERE email = ?").get(contact.email);
          if (!exists) {
            stmt.run(contact.name, contact.phone, contact.email, contact.type, contact.source);
          }
        }
      });
      transaction(mockContacts);

      const check = db.prepare("SELECT * FROM user_integrations WHERE user_id = ? AND provider = 'salesforce'").get(req.user.id);
      if (!check) {
        db.prepare("INSERT INTO user_integrations (user_id, provider) VALUES (?, 'salesforce')").run(req.user.id);
      }

      res.json({ success: true, count: mockContacts.length });
    } catch (err) {
      res.status(500).json({ error: "Sync failed" });
    }
  });

  // Socket.io connection
  io.on("connection", (socket) => {
    console.log("Client connected");
    socket.on("disconnect", () => {
      console.log("Client disconnected");
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
