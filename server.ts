import express from 'express';
import { createServer as createViteServer } from 'vite';
import session from 'express-session';
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import path from 'path';
import dotenv from 'dotenv';
import SqliteStore from 'better-sqlite3-session-store';

dotenv.config();

const db = new Database('database.db');
const SessionStore = SqliteStore(session);

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    email TEXT UNIQUE,
    password TEXT,
    avatar_data TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS wardrobe (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    image_data TEXT,
    description TEXT,
    category TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS looks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    name TEXT,
    image_data TEXT, -- The resulting try-on image
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS look_items (
    look_id INTEGER,
    wardrobe_id INTEGER,
    PRIMARY KEY (look_id, wardrobe_id),
    FOREIGN KEY (look_id) REFERENCES looks(id) ON DELETE CASCADE,
    FOREIGN KEY (wardrobe_id) REFERENCES wardrobe(id) ON DELETE CASCADE
  );
`);

// Migrations for existing databases
try {
  db.prepare('ALTER TABLE users ADD COLUMN avatar_data TEXT').run();
  console.log('Added avatar_data column to users table');
} catch (e) {
  // Column already exists or other error
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.set('trust proxy', 1); // Trust first proxy
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ limit: '10mb', extended: true }));
  
  // Debug middleware to log cookies
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.url} - Cookies:`, req.headers.cookie);
    next();
  });

  app.use(session({
    name: 'rama.sid', // Explicit name
    store: new SessionStore({
      client: db,
      expired: {
        clear: true,
        intervalMs: 900000 // 15 minutes
      }
    }),
    secret: process.env.SESSION_SECRET || 'rama-secret-key',
    resave: true, // Try resave true for better session persistence in some environments
    saveUninitialized: true, // Try saveUninitialized true
    proxy: true,
    cookie: {
      secure: true,
      sameSite: 'none',
      maxAge: 1000 * 60 * 60 * 24 * 7, // 1 week
      httpOnly: true
    }
  }));

  // Auth Routes
  app.post('/api/register', async (req, res) => {
    const { username, email, password } = req.body;
    console.log(`Registration attempt for: ${email}`);
    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      const stmt = db.prepare('INSERT INTO users (username, email, password) VALUES (?, ?, ?)');
      const info = stmt.run(username, email, hashedPassword);
      
      const user = { id: info.lastInsertRowid, username, email };
      (req.session as any).userId = user.id;
      
      // Generate a simple token as fallback for iframe cookie issues
      const token = btoa(JSON.stringify({ userId: user.id, timestamp: Date.now() }));
      
      console.log(`User registered successfully: ${user.id}`);
      res.json({ user, token });
    } catch (err: any) {
      console.error('Registration error:', err);
      if (err.message.includes('UNIQUE constraint failed')) {
        res.status(400).json({ error: 'Username or email already exists' });
      } else {
        res.status(500).json({ error: `Registration failed: ${err.message}` });
      }
    }
  });

  app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    console.log(`Login attempt for: ${email}`);
    try {
      const user: any = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
      if (!user || !(await bcrypt.compare(password, user.password))) {
        console.log('Invalid credentials');
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      
      (req.session as any).userId = user.id;
      
      // Generate a simple token as fallback
      const token = btoa(JSON.stringify({ userId: user.id, timestamp: Date.now() }));
      
      console.log(`User logged in: ${user.id}`);
      res.json({ 
        user: { id: user.id, username: user.username, email: user.email },
        token
      });
    } catch (err: any) {
      console.error('Login error:', err);
      res.status(500).json({ error: `Login failed: ${err.message}` });
    }
  });

  // Middleware to extract user from Token if session fails
  app.use((req, res, next) => {
    if (!(req.session as any).userId) {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        try {
          const token = authHeader.split(' ')[1];
          const payload = JSON.parse(atob(token));
          if (payload.userId) {
            (req.session as any).userId = payload.userId;
            console.log(`Authenticated via Token: ${payload.userId}`);
          }
        } catch (e) {
          console.error('Token parsing failed');
        }
      }
    }
    next();
  });

  app.post('/api/logout', (req, res) => {
    req.session.destroy(() => {
      res.json({ success: true });
    });
  });

  app.post('/api/forgot-password', (req, res) => {
    const { email } = req.body;
    console.log(`Password reset requested for: ${email}`);
    // In a real app, you'd send an email here.
    // For this demo, we'll just return success.
    res.json({ success: true, message: 'If an account exists with that email, a reset link has been sent.' });
  });

  app.get('/api/me', (req, res) => {
    const userId = (req.session as any).userId;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });
    
    const user: any = db.prepare('SELECT id, username, email, avatar_data FROM users WHERE id = ?').get(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    res.json({ user });
  });

  app.patch('/api/user', async (req, res) => {
    const userId = (req.session as any).userId;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const { username, password, avatar_data } = req.body;
    
    try {
      if (username) {
        db.prepare('UPDATE users SET username = ? WHERE id = ?').run(username, userId);
      }
      if (password) {
        const hashedPassword = await bcrypt.hash(password, 10);
        db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashedPassword, userId);
      }
      if (avatar_data !== undefined) {
        db.prepare('UPDATE users SET avatar_data = ? WHERE id = ?').run(avatar_data, userId);
      }
      
      const user: any = db.prepare('SELECT id, username, email, avatar_data FROM users WHERE id = ?').get(userId);
      res.json({ user });
    } catch (err: any) {
      if (err.message.includes('UNIQUE constraint failed')) {
        res.status(400).json({ error: 'Username already taken' });
      } else {
        res.status(500).json({ error: err.message });
      }
    }
  });

  app.get('/api/health', (req, res) => {
    try {
      const count: any = db.prepare('SELECT count(*) as count FROM users').get();
      res.json({ status: 'ok', userCount: count.count });
    } catch (err: any) {
      res.status(500).json({ status: 'error', message: err.message });
    }
  });

  // Wardrobe Routes
  app.get('/api/wardrobe', (req, res) => {
    const userId = (req.session as any).userId;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    try {
      const items = db.prepare('SELECT * FROM wardrobe WHERE user_id = ? ORDER BY created_at DESC').all(userId);
      res.json({ items });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/wardrobe', (req, res) => {
    const userId = (req.session as any).userId;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const { image_data, description, category } = req.body;

    try {
      // Check limit
      const count: any = db.prepare('SELECT count(*) as count FROM wardrobe WHERE user_id = ?').get(userId);
      if (count.count >= 10) {
        return res.status(400).json({ error: 'Wardrobe limit reached (max 10 items)' });
      }

      const stmt = db.prepare('INSERT INTO wardrobe (user_id, image_data, description, category) VALUES (?, ?, ?, ?)');
      const info = stmt.run(userId, image_data, description, category || 'other');
      res.json({ id: info.lastInsertRowid });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/wardrobe/:id', (req, res) => {
    const userId = (req.session as any).userId;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const { id } = req.params;

    try {
      db.prepare('DELETE FROM wardrobe WHERE id = ? AND user_id = ?').run(id, userId);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch('/api/wardrobe/:id', (req, res) => {
    const userId = (req.session as any).userId;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const { id } = req.params;
    const { description } = req.body;

    try {
      db.prepare('UPDATE wardrobe SET description = ? WHERE id = ? AND user_id = ?').run(description, id, userId);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Looks Routes
  app.get('/api/looks', (req, res) => {
    const userId = (req.session as any).userId;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    try {
      const looks = db.prepare('SELECT * FROM looks WHERE user_id = ? ORDER BY created_at DESC').all(userId);
      res.json({ looks });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/looks', (req, res) => {
    const userId = (req.session as any).userId;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const { name, image_data, wardrobe_ids } = req.body;

    try {
      const stmt = db.prepare('INSERT INTO looks (user_id, name, image_data) VALUES (?, ?, ?)');
      const info = stmt.run(userId, name || 'New Look', image_data);
      const lookId = info.lastInsertRowid;

      if (wardrobe_ids && Array.isArray(wardrobe_ids)) {
        const itemStmt = db.prepare('INSERT INTO look_items (look_id, wardrobe_id) VALUES (?, ?)');
        for (const wId of wardrobe_ids) {
          itemStmt.run(lookId, wId);
        }
      }

      res.json({ id: lookId });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/looks/:id', (req, res) => {
    const userId = (req.session as any).userId;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const { id } = req.params;

    try {
      db.prepare('DELETE FROM looks WHERE id = ? AND user_id = ?').run(id, userId);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(process.cwd(), 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(process.cwd(), 'dist/index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
