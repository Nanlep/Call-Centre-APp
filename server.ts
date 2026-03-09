import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
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

// --- Migrations & Schema ---
const runMigrations = () => {
  try {
    // 1. Create Companies Table
    db.exec(`
      CREATE TABLE IF NOT EXISTS companies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. Add company_id to users
    try {
      db.prepare("SELECT company_id FROM users LIMIT 1").get();
    } catch (e) {
      console.log("Migrating users table...");
      db.exec("ALTER TABLE users ADD COLUMN company_id INTEGER REFERENCES companies(id)");
      // Create default company for existing users
      const defaultCompany = db.prepare("INSERT INTO companies (name) VALUES (?)").run("Default Company");
      db.prepare("UPDATE users SET company_id = ? WHERE company_id IS NULL").run(defaultCompany.lastInsertRowid);
    }

    // 3. Add company_id to contacts
    try {
      db.prepare("SELECT company_id FROM contacts LIMIT 1").get();
    } catch (e) {
      console.log("Migrating contacts table...");
      db.exec("ALTER TABLE contacts ADD COLUMN company_id INTEGER REFERENCES companies(id)");
      const defaultCompanyId = db.prepare("SELECT id FROM companies LIMIT 1").get() as { id: number };
      if (defaultCompanyId) {
        db.prepare("UPDATE contacts SET company_id = ? WHERE company_id IS NULL").run(defaultCompanyId.id);
      }
    }

    // 4. Add company_id to campaigns
    try {
      db.prepare("SELECT company_id FROM campaigns LIMIT 1").get();
    } catch (e) {
      console.log("Migrating campaigns table...");
      db.exec("ALTER TABLE campaigns ADD COLUMN company_id INTEGER REFERENCES companies(id)");
      const defaultCompanyId = db.prepare("SELECT id FROM companies LIMIT 1").get() as { id: number };
      if (defaultCompanyId) {
        db.prepare("UPDATE campaigns SET company_id = ? WHERE company_id IS NULL").run(defaultCompanyId.id);
      }
    }

    // 5. Create Message Logs Table
    db.exec(`
      CREATE TABLE IF NOT EXISTS message_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        contact_id INTEGER,
        direction TEXT, -- inbound, outbound
        body TEXT,
        status TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        agent_id INTEGER,
        FOREIGN KEY(contact_id) REFERENCES contacts(id),
        FOREIGN KEY(agent_id) REFERENCES users(id)
      );
    `);

  } catch (err) {
    console.error("Migration error:", err);
  }
};

runMigrations();

// Initialize Schema (Base tables)
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT DEFAULT 'agent', -- admin, agent
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    company_id INTEGER REFERENCES companies(id)
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
    source TEXT DEFAULT 'manual', -- manual, google, hubspot, salesforce
    company_id INTEGER REFERENCES companies(id)
  );

  CREATE TABLE IF NOT EXISTS campaigns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT NOT NULL, -- inbound, outbound
    status TEXT DEFAULT 'active',
    company_id INTEGER REFERENCES companies(id)
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
    summary TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    agent_id INTEGER,
    FOREIGN KEY(contact_id) REFERENCES contacts(id),
    FOREIGN KEY(agent_id) REFERENCES users(id)
  );
`);

// Add columns if they don't exist (migrations)
try { db.prepare("ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'offline'").run(); } catch (e) {}
try { db.prepare("ALTER TABLE call_logs ADD COLUMN summary TEXT").run(); } catch (e) {}
try { db.prepare("ALTER TABLE call_logs ADD COLUMN recording_url TEXT").run(); } catch (e) {}

// Seed Data if empty
const contactCount = db.prepare("SELECT count(*) as count FROM contacts").get() as { count: number };
if (contactCount.count === 0) {
  // Create a default company and admin if not exists
  let companyId: number | bigint = 1;
  const existingCompany = db.prepare("SELECT id FROM companies LIMIT 1").get() as { id: number };
  
  if (!existingCompany) {
    const info = db.prepare("INSERT INTO companies (name) VALUES (?)").run("Meti Demo Corp");
    companyId = info.lastInsertRowid;
  } else {
    companyId = existingCompany.id;
  }

  const insertContact = db.prepare("INSERT INTO contacts (name, phone, email, type, notes, company_id) VALUES (?, ?, ?, ?, ?, ?)");
  insertContact.run("Alice Johnson", "+15550101", "alice@example.com", "customer", "Premium plan user", companyId);
  insertContact.run("Bob Smith", "+15550102", "bob@example.com", "lead", "Interested in billing support", companyId);
  insertContact.run("Charlie Brown", "+15550103", "charlie@example.com", "customer", "Reported outage last week", companyId);

  const insertCampaign = db.prepare("INSERT INTO campaigns (name, type, company_id) VALUES (?, ?, ?)");
  insertCampaign.run("Q1 Sales Outreach", "outbound", companyId);
  insertCampaign.run("Support Queue A", "inbound", companyId);

  const insertCampContact = db.prepare("INSERT INTO campaign_contacts (campaign_id, contact_id) VALUES (?, ?)");
  insertCampContact.run(1, 1);
  insertCampContact.run(1, 2);
}

// Seed Admin User if empty
const userCount = db.prepare("SELECT count(*) as count FROM users").get() as { count: number };
if (userCount.count === 0) {
  const company = db.prepare("SELECT id FROM companies LIMIT 1").get() as { id: number };
  const hashedPassword = bcrypt.hashSync("admin123", 10);
  const insertUser = db.prepare("INSERT INTO users (email, password, name, role, company_id) VALUES (?, ?, ?, ?, ?)");
  insertUser.run("admin@meticall.com", hashedPassword, "Admin User", "admin", company.id);
}

async function startServer() {
  // Initialize Gemini
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

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

  // RBAC Middleware
  const requireAdmin = (req: any, res: any, next: any) => {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: "Admin access required" });
    }
    next();
  };

  // --- API Routes ---


  // Auth Routes
  app.post("/api/auth/register", (req, res) => {
    const { email, password, name, companyName } = req.body;
    if (!email || !password || !name || !companyName) return res.status(400).json({ error: "Missing fields" });

    try {
      const hashedPassword = bcrypt.hashSync(password, 10);
      
      // Transaction to create company and user
      const transaction = db.transaction(() => {
        // 1. Create Company
        const compStmt = db.prepare("INSERT INTO companies (name) VALUES (?)");
        const compInfo = compStmt.run(companyName);
        const companyId = compInfo.lastInsertRowid;

        // 2. Create Admin User
        const userStmt = db.prepare("INSERT INTO users (email, password, name, role, company_id) VALUES (?, ?, ?, ?, ?)");
        const userInfo = userStmt.run(email, hashedPassword, name, 'admin', companyId);
        
        return { userId: userInfo.lastInsertRowid, companyId };
      });

      const { userId, companyId } = transaction();
      
      const token = jwt.sign({ id: userId, email, name, role: 'admin', company_id: companyId }, JWT_SECRET, { expiresIn: '8h' });
      
      res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production' });
      res.json({ token, user: { id: userId, email, name, role: 'admin', company_id: companyId, company_name: companyName } });
    } catch (err: any) {
      if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        return res.status(400).json({ error: "Email already exists" });
      }
      console.error(err);
      res.status(500).json({ error: "Registration failed" });
    }
  });

  app.post("/api/auth/login", (req, res) => {
    const { email, password } = req.body;
    const user = db.prepare(`
      SELECT u.*, c.name as company_name 
      FROM users u 
      LEFT JOIN companies c ON u.company_id = c.id 
      WHERE u.email = ?
    `).get(email) as any;

    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign({ id: user.id, email: user.email, name: user.name, role: user.role, company_id: user.company_id }, JWT_SECRET, { expiresIn: '8h' });
    
    res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production' });
    res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role, company_id: user.company_id, company_name: user.company_name } });
  });

  app.post("/api/auth/logout", (req, res) => {
    res.clearCookie('token');
    res.json({ success: true });
  });

  app.get("/api/auth/me", authenticateToken, (req: any, res) => {
    const user = db.prepare(`
      SELECT u.id, u.email, u.name, u.role, u.company_id, c.name as company_name 
      FROM users u 
      LEFT JOIN companies c ON u.company_id = c.id 
      WHERE u.id = ?
    `).get(req.user.id);
    res.json({ user });
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
    const host = process.env.APP_URL || `http://localhost:${PORT}`;

    if (To) {
      // Outbound call
      const dial = twiml.dial({ 
        callerId: process.env.TWILIO_CALLER_ID,
        record: 'record-from-answer-dual',
        recordingStatusCallback: `${host}/api/voice/recording`,
        recordingStatusCallbackEvent: ['completed']
      });
      dial.number(To);
    } else {
      // Inbound call
      const availableAgent = db.prepare("SELECT id FROM users WHERE status = 'available' LIMIT 1").get() as { id: number } | undefined;
      
      if (availableAgent) {
        const dial = twiml.dial({
          record: 'record-from-answer-dual',
          recordingStatusCallback: `${host}/api/voice/recording`,
          recordingStatusCallbackEvent: ['completed']
        });
        dial.client(`agent_${availableAgent.id}`); 
      } else {
        twiml.say("Sorry, no agents are currently available. Please try again later.");
        return res.type("text/xml").send(twiml.toString());
      }
    }

    res.type("text/xml");
    res.send(twiml.toString());
  });

  app.post("/api/voice/recording", (req, res) => {
    const { RecordingUrl, CallSid } = req.body;
    // In a real app, we'd look up the call_log by CallSid (if we saved it)
    // and then update it with the RecordingUrl and trigger AI summary.
    // For now, we'll just log it. We'll simulate AI summary on the frontend or via a manual trigger.
    console.log("Recording available:", RecordingUrl);
    res.sendStatus(200);
  });

  // Agent Status
  app.post("/api/users/status", authenticateToken, (req: any, res) => {
    const { status } = req.body;
    db.prepare("UPDATE users SET status = ? WHERE id = ?").run(status, req.user.id);
    res.json({ success: true, status });
  });

  app.get("/api/users/me", authenticateToken, (req: any, res) => {
    const user = db.prepare("SELECT id, name, email, role, status FROM users WHERE id = ?").get(req.user.id);
    res.json(user);
  });

  // Campaign Contacts
  app.get("/api/campaigns/:id/contacts", authenticateToken, (req: any, res) => {
    // For prototype, just return all contacts if campaign_contacts table is empty/not linked
    // Let's just return all contacts for the company to simulate a campaign list
    const contacts = db.prepare("SELECT * FROM contacts WHERE company_id = ?").all(req.user.company_id);
    res.json(contacts);
  });

  // 3. Data APIs (Scoped by Company)
  app.get("/api/contacts", authenticateToken, (req: any, res) => {
    const contacts = db.prepare("SELECT * FROM contacts WHERE company_id = ?").all(req.user.company_id);
    res.json(contacts);
  });

  app.get("/api/campaigns", authenticateToken, (req: any, res) => {
    const campaigns = db.prepare("SELECT * FROM campaigns WHERE company_id = ?").all(req.user.company_id);
    res.json(campaigns);
  });

  app.get("/api/logs", authenticateToken, (req: any, res) => {
    // Admins see all logs, Agents see only their own? 
    // For now, let's allow everyone in the company to see logs for collaboration
    const callLogs = db.prepare(`
      SELECT l.id, l.contact_id, l.direction, l.duration, l.status, l.timestamp, l.agent_id, c.name as contact_name, u.name as agent_name, 'call' as type
      FROM call_logs l 
      LEFT JOIN contacts c ON l.contact_id = c.id 
      LEFT JOIN users u ON l.agent_id = u.id
      WHERE u.company_id = ?
    `).all(req.user.company_id);

    const messageLogs = db.prepare(`
      SELECT m.id, m.contact_id, m.direction, 0 as duration, m.status, m.timestamp, m.agent_id, c.name as contact_name, u.name as agent_name, 'message' as type
      FROM message_logs m 
      LEFT JOIN contacts c ON m.contact_id = c.id 
      LEFT JOIN users u ON m.agent_id = u.id
      WHERE u.company_id = ?
    `).all(req.user.company_id);

    const logs = [...callLogs, ...messageLogs].sort((a: any, b: any) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

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

  app.post("/api/logs/:id/summary", authenticateToken, async (req: any, res) => {
    const logId = req.params.id;
    const log = db.prepare(`
      SELECT l.*, c.name as contact_name, c.type as contact_type, c.notes as contact_notes 
      FROM call_logs l 
      JOIN contacts c ON l.contact_id = c.id 
      WHERE l.id = ?
    `).get(logId) as any;

    if (!log) return res.status(404).json({ error: "Log not found" });

    try {
      const prompt = `Generate a realistic 2-3 sentence call summary for a ${log.direction} call with ${log.contact_name} (a ${log.contact_type}). 
      The call lasted ${log.duration} seconds. 
      Context notes about this contact: ${log.contact_notes}.
      Make it sound like a professional agent's notes.`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });

      const summary = response.text;
      db.prepare("UPDATE call_logs SET summary = ? WHERE id = ?").run(summary, logId);
      
      io.emit("log_update");
      res.json({ success: true, summary });
    } catch (error) {
      console.error("Error generating summary:", error);
      res.status(500).json({ error: "Failed to generate summary" });
    }
  });

  // --- WhatsApp Integration ---
  app.post("/api/messages/send", authenticateToken, async (req: any, res) => {
    const { to, body, contact_id } = req.body;
    if (!to || !body) return res.status(400).json({ error: "Missing 'to' or 'body'" });

    try {
      const twilioClient = Twilio(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_AUTH_TOKEN
      );
      
      const fromNumber = process.env.TWILIO_WHATSAPP_NUMBER || "whatsapp:+14155238886"; // Twilio sandbox number default
      
      // Format the 'to' number for WhatsApp if not already formatted
      const formattedTo = to.startsWith("whatsapp:") ? to : `whatsapp:${to}`;

      const message = await twilioClient.messages.create({
        body,
        from: fromNumber,
        to: formattedTo
      });

      if (contact_id) {
        const stmt = db.prepare("INSERT INTO message_logs (contact_id, direction, body, status, agent_id) VALUES (?, ?, ?, ?, ?)");
        stmt.run(contact_id, "outbound", body, message.status, req.user.id);
      }

      res.json({ success: true, messageSid: message.sid });
    } catch (error: any) {
      console.error("WhatsApp send error:", error);
      res.status(500).json({ error: "Failed to send WhatsApp message" });
    }
  });

  // --- Team Management APIs (Admin Only) ---
  app.get("/api/team", authenticateToken, requireAdmin, (req: any, res) => {
    const users = db.prepare("SELECT id, name, email, role, created_at FROM users WHERE company_id = ?").all(req.user.company_id);
    res.json(users);
  });

  app.post("/api/team", authenticateToken, requireAdmin, (req: any, res) => {
    const { email, password, name, role } = req.body;
    if (!email || !password || !name) return res.status(400).json({ error: "Missing fields" });

    try {
      const hashedPassword = bcrypt.hashSync(password, 10);
      const stmt = db.prepare("INSERT INTO users (email, password, name, role, company_id) VALUES (?, ?, ?, ?, ?)");
      const info = stmt.run(email, hashedPassword, name, role || 'agent', req.user.company_id);
      
      res.json({ success: true, user: { id: info.lastInsertRowid, email, name, role } });
    } catch (err: any) {
      if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        return res.status(400).json({ error: "Email already exists" });
      }
      res.status(500).json({ error: "Failed to add user" });
    }
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

      const stmt = db.prepare("INSERT INTO contacts (name, phone, email, type, source, company_id) VALUES (?, ?, ?, ?, ?, ?)");
      const transaction = db.transaction((contacts) => {
        for (const contact of contacts) {
          // Check if exists
          const exists = db.prepare("SELECT id FROM contacts WHERE email = ? AND company_id = ?").get(contact.email, req.user.company_id);
          if (!exists) {
            stmt.run(contact.name, contact.phone, contact.email, contact.type, contact.source, req.user.company_id);
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

      const stmt = db.prepare("INSERT INTO contacts (name, phone, email, type, source, company_id) VALUES (?, ?, ?, ?, ?, ?)");
      const transaction = db.transaction((contacts) => {
        for (const contact of contacts) {
          const exists = db.prepare("SELECT id FROM contacts WHERE email = ? AND company_id = ?").get(contact.email, req.user.company_id);
          if (!exists) {
            stmt.run(contact.name, contact.phone, contact.email, contact.type, contact.source, req.user.company_id);
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

      const stmt = db.prepare("INSERT INTO contacts (name, phone, email, type, source, company_id) VALUES (?, ?, ?, ?, ?, ?)");
      const transaction = db.transaction((contacts) => {
        for (const contact of contacts) {
          const exists = db.prepare("SELECT id FROM contacts WHERE email = ? AND company_id = ?").get(contact.email, req.user.company_id);
          if (!exists) {
            stmt.run(contact.name, contact.phone, contact.email, contact.type, contact.source, req.user.company_id);
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
