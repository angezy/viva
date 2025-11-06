const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const JWT_SECRET = process.env.JWT_SECRET;
const sql = require('mssql');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// Setup uploads directory
const uploadsDir = path.join(__dirname, '..', 'public', 'uploads');
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `${unique}${ext}`);
  }
});
const upload = multer({ storage });
const { getPool } = require("../utils/dbConnection");
// Mount additional routers
try {
  router.use('/', require('./dashboardRoute'));
} catch (e) {
  // If the dashboardRoute is missing during startup, log and continue so other routes still work
  console.warn('dashboardRoute not mounted:', e && e.message ? e.message : e);
}


// Helper function to normalize result
function normalizeResult(result) {
  if (!result) return [];
  if (Array.isArray(result)) return result;       
  if (result.recordset) return result.recordset;  
  return [];
}

// List all views in the database
router.get("/api/views", async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .query(`SELECT TABLE_SCHEMA, TABLE_NAME FROM INFORMATION_SCHEMA.VIEWS`);
    res.json(normalizeResult(result));
  } catch (err) {
    console.error("/api/views error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Get all values from a selected table
router.get("/api/table-values", async (req, res) => {
  const { schema, name } = req.query;
  if (!schema || !name) return res.status(400).json({ error: "Missing schema or name" });
  try {
    const pool = await getPool();
    console.log("Fetching table:", schema, name);
    const result = await pool.request().query(`SELECT * FROM [${schema}].[${name}]`);
    res.json(normalizeResult(result));
  } catch (err) {
    console.error("/api/table-values error:", err);
    res.status(500).json({ error: err.message });
  }
});


// List all tables in the database
router.get("/api/tables", async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .query(`SELECT TABLE_SCHEMA, TABLE_NAME 
              FROM INFORMATION_SCHEMA.TABLES 
              WHERE TABLE_TYPE = 'BASE TABLE'`);
    res.json(normalizeResult(result));
  } catch (err) {
    console.error("/api/tables error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Get current date from SQL
router.get("/api/date", async (req, res) => {
  try {
    const pool = await getPool();
    let result = await pool.request().query("SELECT GETDATE() AS now");

    const rows = normalizeResult(result);

    console.log("Full result:", result);
    console.log("Normalized rows:", rows);

    if (rows.length > 0) {
      console.log("First row:", rows[0]);
    }
    
    res.json(rows);
  } catch (err) {
    console.error("/api/date error:", err);
    res.status(500).json({ error: err.message });
  }
});



// REGISTER
router.post("/api/register", async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: "All fields are required" });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const pool = await getPool();

    await pool.request()
      .input("Username", sql.NVarChar, username)
      .input("Email", sql.NVarChar, email)
      .input("PasswordHash", sql.NVarChar, hashedPassword)
      .input("Role", sql.NVarChar, "user")
      .query(`
        INSERT INTO User_tbl (Username, Email, PasswordHash, Role, CreatedAt)
        VALUES (@Username, @Email, @PasswordHash, @Role, GETDATE())
      `);

    res.status(201).json({ message: "User registered successfully ✅" });
  } catch (err) {
    console.error("/api/register error:", err);
    res.status(500).json({ error: "Registration failed ❌" });
  }
});

// LOGIN
router.post("/api/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    console.error('/api/login missing credentials', { body: req.body });
    return res.status(400).json({ error: "Email and password required" });
  }

  try {
    console.log('/api/login attempt', { email, ip: req.ip });
    const pool = await getPool();
    const result = await pool.request()
      .input("Email", sql.NVarChar, email)
      .query(`SELECT TOP 1 * FROM User_tbl WHERE Email = @Email`);

    const rows = normalizeResult(result);
    if (rows.length === 0) {
      console.error('/api/login no user found', { email });
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const user = rows[0];
    const isMatch = await bcrypt.compare(password, user.PasswordHash);
    if (!isMatch) {
        console.error('/api/login bad password', { email });
        return res.status(401).json({ error: "Invalid credentials" });
    }

    // Update last login info
    await pool.request()
      .input("UserId", sql.Int, user.UserID)
      .input("LastIp", sql.NVarChar, req.ip)
      .query(`UPDATE User_tbl SET LastLogin = GETDATE(), LastIP = @LastIp WHERE UserID = @UserId`);

    // Ensure JWT secret is configured
    if (!JWT_SECRET) {
        console.error('/api/login error: JWT_SECRET is not set', { envJWT: process.env.JWT_SECRET });
      return res.status(500).json({ error: 'Server misconfiguration: auth secret not configured' })
    }

    // Sign JWT (use the actual PK column name)
    const token = jwt.sign(
      { sub: user.UserID, email: user.Email, role: user.Role },
      JWT_SECRET,
      { expiresIn: "1h" }
    );

  // Use the same cookie name the frontend expects (viva_token)
  res.cookie("viva_token", token, { httpOnly: true, secure: process.env.NODE_ENV === 'production' });
  // For SPA clients, return JSON rather than performing a server-side redirect.
  res.status(200).json({ message: 'Logged in' });
} catch (err) {
      console.error("/api/login error:", err && err.stack ? err.stack : err);
      res.status(500).json({ error: "Login failed", detail: err && err.message ? err.message : 'unknown error' });
  }
});



// Header route
router.get("/api/header", async (req, res) => {
  try {
    const pool = await getPool();
    console.log('Connected to DB:', pool.config.database);

    const result = await pool.request().query("SELECT * FROM [dbo].[header_tbl]");
    const rows = normalizeResult(result);
    
    console.log('Header rows:', rows);

    res.json(rows);
  } catch (err) {
    console.error("/api/header error:", err);
    res.status(500).json([]);
  }
});

router.get("/api/head", async (req, res) => {
  try{
    const pool  = await getPool();
    console.log('connect to db :', pool.config.database);
    
    const result = await pool.request().query('SELECT * FROM [dbo].[head_tbl]');
    const rows  = normalizeResult(result);
    console.log('head rows:' , rows);
    res.json(rows);
    
  }catch (err) {
    console.error("api/head error: ", err)
    res.status(500).json([])
  }
  
});


// Most Chosen Products route for carousel
router.get("/api/most-chosen", async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT 
        PID, 
        Name, 
        Description, 
        imageUrl, 
        Price, 
        ChosenCount
      FROM MostChosenProducts
    `);

    const rows = normalizeResult(result);

    // Normalize field names for frontend compatibility
    const mapped = rows.map(r => ({
      id: r.PID ?? r.pid ?? r.id,
      title: r.Name ?? r.name ?? '',
      description: r.Description ?? r.description ?? '',
      // MostChosenProducts view aliases Img AS imageUrl, prefer that
      imageUrl: r.imageUrl ?? r.Img ?? r.img ?? '',
      price: r.Price ?? r.price ?? 0,
      chosenCount: r.ChosenCount ?? r.chosenCount ?? 0,
    }));

    res.json(mapped);
  } catch (err) {
    console.error("/api/most-chosen error:", err);
    res.status(500).json([]);
  }
});


// Health endpoint for quick availability checks
router.get('/api/health', async (req, res) => {
  try {
    const pool = await getPool();
    const dbOk = !!(pool && pool.connected !== false);
    res.json({ ok: true, env: process.env.NODE_ENV || 'development', jwt: !!process.env.JWT_SECRET, db: dbOk });
  } catch (err) {
    console.error('/api/health error', err && err.stack ? err.stack : err);
    res.status(500).json({ ok: false, error: err && err.message ? err.message : 'db error' });
  }
});



// Get all visible comments
router.get("/api/comment", async (req, res) => {
  try {
    const pool = await getPool();
    let result = await pool.request().query(`
      SELECT CommentId, Name, Text, CreatedAt 
      FROM Comments
      WHERE ShowComment = 1
      ORDER BY CreatedAt DESC
    `);
    const rows = normalizeResult(result);

    // Normalize field names for frontend compatibility: id, name, text, createdAt
    const mapped = rows.map(r => ({
      id: r.CommentId ?? r.commentId ?? r.id,
      name: r.Name ?? r.name ?? '',
      text: r.Text ?? r.text ?? '',
      createdAt: r.CreatedAt ?? r.createdAt ?? null,
    }));

    res.json(mapped);
  } catch (err) {
    console.error("/api/comment GET error:", err);
    res.status(500).json({ error: err.message });
  }
});


router.post("/api/comment", upload.single('image'), async (req, res) => {
  try {
    const { name, text, email } = req.body;
    const file = req.file;

    if (!name || !text || !email) {
      return res.status(400).json({ error: "Name, email and text are required" });
    }

    const imgPath = file ? `public/uploads/${file.filename}` : null;

    const pool = await getPool();
    let request = pool.request().input("Name", name).input("Text", text);
    if (email) request = request.input("Email", email);
    if (imgPath) request = request.input("Img", imgPath);

    const insertColumns = ['Name', 'Text', 'ShowComment'];
    const insertValues = ['@Name', '@Text', '1'];
    if (email) {
      insertColumns.push('Email');
      insertValues.push('@Email');
    }
    if (imgPath) {
      insertColumns.push('Img');
      insertValues.push('@Img');
    }

    const query = `INSERT INTO Comments (${insertColumns.join(', ')}) OUTPUT INSERTED.CommentId, INSERTED.Name, INSERTED.Text, INSERTED.CreatedAt, ${email ? 'INSERTED.Email,' : ''} ${imgPath ? 'INSERTED.Img,' : ''} INSERTED.CommentId INTO #tmp SELECT 1;`;

    let result = await pool
      .request()
      .input("Name", name)
      .input("Text", text)
      .query(`
        INSERT INTO Comments (Name, Text, ShowComment)
        OUTPUT INSERTED.CommentId, INSERTED.Name, INSERTED.Text, INSERTED.CreatedAt
        VALUES (@Name, @Text, 1)
      `);

    const rows = normalizeResult(result);
    const inserted = rows[0];

    const mapped = {
      id: inserted.CommentId ?? inserted.commentId ?? inserted.id,
      name: inserted.Name ?? inserted.name ?? '',
      text: inserted.Text ?? inserted.text ?? '',
      createdAt: inserted.CreatedAt ?? inserted.createdAt ?? null,
      img: imgPath ? imgPath : null,
      email: email ?? null,
    };

    res.json(mapped);
  } catch (err) {
    console.error("/api/comment POST error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Footer route
router.get("/api/footer", async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query("SELECT * FROM [dbo].[footer_tbl]");
    const rows = normalizeResult(result);
    res.json(rows);
  } catch (err) {
    console.error("/api/footer error:", err);
    res.status(500).json([]);
  }
});

// Products route
router.get("/api/products", async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query("SELECT * FROM [dbo].[Products_tbl]");
    const rows = normalizeResult(result);

    const products = rows.map(row => ({
      id: row.PID,
      category: row.Category,
      name: row.Name,
      description: row.Description,
      price: row.Price,
      alt: row.Alt,
      img: row.Img
    }));

    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Home route
router.get("/api/home", async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query("SELECT * FROM dbo.HomeContent_tbl");
    res.json(normalizeResult(result));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Shop route
router.get("/api/shop", async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query("SELECT * FROM [dbo].[Products_tbl]");
    const rows = normalizeResult(result);

    const products = rows.map(row => ({
      id: row.PID,
      category: row.Category,
      name: row.Name,
      description: row.Description,
      price: row.Price,
      alt: row.Alt,
      img: row.Img
    }));

    res.json(products);
  } catch (err) {
    console.error("/api/shop error:", err);
    res.status(500).json({ error: err.message, details: err });
  }
});

// Category route
router.get("/api/category/:categoryId", async (req, res) => {
  try {
    const categoryId = req.params.categoryId;
    const pool = await getPool();
    const result = await pool.request()
      .query(`SELECT * FROM Product_tbl WHERE Category = ${categoryId}`);
    const rows = normalizeResult(result);

    if (rows.length > 0) {
      res.json({ category: rows[0] });
    } else {
      res.status(404).json({ error: "Category not found" });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Product page route
router.get("/api/product/:productId", async (req, res) => {
  try {
    const productId = req.params.productId;
    const pool = await getPool();
    const result = await pool.request()
      .query(`SELECT * FROM Products WHERE ProductId = ${productId}`);
    const rows = normalizeResult(result);

    if (rows.length > 0) {
      res.json({ product: rows[0] });
    } else {
      res.status(404).json({ error: "Product not found" });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
