const express = require("express");
const jwt = require("jsonwebtoken");
const sql = require("mssql");
const { getPool } = require("../utils/dbConnection");

const router = express.Router();

function requireAdmin(req, res, next) {
  const authorization = req.headers?.authorization || "";
  const bearer = authorization.toLowerCase().startsWith("bearer ") ? authorization.slice(7).trim() : null;
  const token = bearer || req.cookies?.viva_token;
  if (!token || !process.env.JWT_SECRET) return res.status(401).json({ error: "Authentication required" });
  try {
    const user = jwt.verify(token, process.env.JWT_SECRET);
    if (String(user.role || "").toLowerCase() !== "admin") return res.status(403).json({ error: "Administrator access required" });
    req.adminUser = user;
    next();
  } catch (_error) {
    return res.status(401).json({ error: "Invalid or expired session" });
  }
}

function rows(result) {
  return result?.recordset || result || [];
}

function mapReview(row = {}) {
  return {
    id: row.Id,
    name: row.CustomerName,
    email: row.CustomerEmail || null,
    rating: Number(row.Rating) || 0,
    title: row.Title || "",
    text: row.ReviewText || "",
    status: row.Status,
    isFeatured: Boolean(row.IsFeatured),
    createdAt: row.CreatedAt || null,
    publishedAt: row.PublishedAt || null,
    updatedAt: row.UpdatedAt || null,
  };
}

router.get("/api/admin/reviews", requireAdmin, async (req, res) => {
  const requestedStatus = String(req.query.status || "all").trim();
  const status = ["Pending", "Approved", "Rejected"].includes(requestedStatus) ? requestedStatus : null;
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input("Status", sql.NVarChar(20), status)
      .query(`
        SELECT [Id], [CustomerName], [CustomerEmail], [Rating], [Title], [ReviewText], [Status],
               [IsFeatured], [CreatedAt], [PublishedAt], [UpdatedAt]
        FROM [CRM].[Reviews]
        WHERE @Status IS NULL OR [Status] = @Status
        ORDER BY CASE [Status] WHEN N'Pending' THEN 0 WHEN N'Approved' THEN 1 ELSE 2 END,
                 [CreatedAt] DESC;
      `);
    res.json({ reviews: rows(result).map(mapReview) });
  } catch (error) {
    console.error("GET /api/admin/reviews failed", error);
    res.status(500).json({ error: "Unable to load reviews. Apply the review database migration first." });
  }
});

router.patch("/api/admin/reviews/:reviewId", requireAdmin, async (req, res) => {
  const reviewId = String(req.params.reviewId || "").trim();
  const action = String(req.body?.action || "").trim().toLowerCase();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(reviewId)) {
    return res.status(400).json({ error: "Invalid review id" });
  }
  if (!["publish", "reject", "feature", "unfeature"].includes(action)) {
    return res.status(400).json({ error: "Action must be publish, reject, feature, or unfeature" });
  }

  try {
    const pool = await getPool();
    const request = pool.request().input("ReviewId", sql.UniqueIdentifier, reviewId);
    let query;
    if (action === "publish") {
      query = `UPDATE [CRM].[Reviews] SET [Status] = N'Approved', [PublishedAt] = COALESCE([PublishedAt], SYSUTCDATETIME()), [UpdatedAt] = SYSUTCDATETIME() WHERE [Id] = @ReviewId;`;
    } else if (action === "reject") {
      query = `UPDATE [CRM].[Reviews] SET [Status] = N'Rejected', [IsFeatured] = 0, [UpdatedAt] = SYSUTCDATETIME() WHERE [Id] = @ReviewId;`;
    } else {
      request.input("IsFeatured", sql.Bit, action === "feature");
      query = `UPDATE [CRM].[Reviews] SET [IsFeatured] = @IsFeatured, [UpdatedAt] = SYSUTCDATETIME() WHERE [Id] = @ReviewId AND [Status] = N'Approved';`;
    }
    const result = await request.query(`${query} SELECT TOP 1 [Id], [CustomerName], [CustomerEmail], [Rating], [Title], [ReviewText], [Status], [IsFeatured], [CreatedAt], [PublishedAt], [UpdatedAt] FROM [CRM].[Reviews] WHERE [Id] = @ReviewId;`);
    const review = rows(result).at(-1);
    if (!review) return res.status(404).json({ error: "Review not found" });
    res.json({ ok: true, review: mapReview(review) });
  } catch (error) {
    console.error("PATCH /api/admin/reviews failed", error);
    res.status(500).json({ error: "Unable to update review" });
  }
});

module.exports = router;
