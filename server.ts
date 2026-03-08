import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import Twilio from "twilio";
import Database from "better-sqlite3";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Initialize Database
const db = new Database("call_center.db");
db.pragma("journal_mode = WAL");

// Initialize Schema
db.exec(`
  CREATE TABLE IF NOT EXISTS contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    type TEXT DEFAULT 'customer', -- customer, lead
    notes TEXT
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
    FOREIGN KEY(contact_id) REFERENCES contacts(id)
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

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer);
  const PORT = 3000;

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // API Routes
  
  // 1. Token Generation
  app.get("/api/token", (req, res) => {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const apiKey = process.env.TWILIO_API_KEY;
    const apiSecret = process.env.TWILIO_API_SECRET;
    const appSid = process.env.TWILIO_APP_SID;
    const identity = "agent_1"; // In a real app, this would come from auth

    if (!accountSid || !apiKey || !apiSecret || !appSid) {
      return res.status(500).json({ error: "Twilio credentials missing in server environment" });
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

  // 2. TwiML Webhook for Voice
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
      dial.client("agent_1");
    }

    res.type("text/xml");
    res.send(twiml.toString());
  });

  // 3. Data APIs
  app.get("/api/contacts", (req, res) => {
    const contacts = db.prepare("SELECT * FROM contacts").all();
    res.json(contacts);
  });

  app.get("/api/campaigns", (req, res) => {
    const campaigns = db.prepare("SELECT * FROM campaigns").all();
    res.json(campaigns);
  });

  app.get("/api/logs", (req, res) => {
    const logs = db.prepare(`
      SELECT l.*, c.name as contact_name 
      FROM call_logs l 
      LEFT JOIN contacts c ON l.contact_id = c.id 
      ORDER BY l.timestamp DESC
    `).all();
    res.json(logs);
  });

  app.post("/api/logs", (req, res) => {
    const { contact_id, direction, duration, status } = req.body;
    const stmt = db.prepare("INSERT INTO call_logs (contact_id, direction, duration, status) VALUES (?, ?, ?, ?)");
    stmt.run(contact_id, direction, duration, status);
    
    // Notify clients
    io.emit("log_update");
    res.json({ success: true });
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
