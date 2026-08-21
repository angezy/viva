const path = require("path");
// Load the backend environment regardless of the directory used to start Node.
require('dotenv').config({ path: path.join(__dirname, '.env') });

const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const { ApolloServer } = require("@apollo/server");
const { expressMiddleware } = require("@as-integrations/express4");
const { typeDefs, resolvers } = require("./graphqlSchema.js");
const router = require("./routes/homeroute");
const supportRouter = require("./routes/supportRoute");
const adminOverviewRouter = require("./routes/adminOverviewRoute");
const adminRecordsRouter = require("./routes/adminRecordsRoute");
const reviewAdminRouter = require("./routes/reviewAdminRoute");
const chatRouter = require("./routes/chatRoute");



const app = express();
const corsOptions = {
  origin: "http://localhost:3000",
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
};
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
app.use(cookieParser());
app.use(bodyParser.json());
app.use("/uploads", express.static(path.join(__dirname, "public", "uploads")));
app.use("/api/uploads", express.static(path.join(__dirname, "public", "uploads")));
app.use("/", adminOverviewRouter);
app.use("/", adminRecordsRouter);
app.use("/", reviewAdminRouter);
app.use("/", supportRouter);
app.use("/", chatRouter);
app.use("/", router);

// Simple request logging (development only)
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.url} - from ${req.ip}`);
  next();
});

// Startup diagnostic logs
console.log('Backend startup: NODE_ENV=', process.env.NODE_ENV);
console.log('Backend startup: JWT_SECRET present=', !!process.env.JWT_SECRET);
console.log('Backend startup: Telegram support configured=', Boolean(process.env.TELEGRAM_BOT_TOKEN && (process.env.TELEGRAM_ADMIN_CHAT_ID || process.env.TELEGRAM_CHAT_ID)));

async function startApolloServer() {
	const server = new ApolloServer({ typeDefs, resolvers });
	await server.start();
	app.use("/graphql", expressMiddleware(server));
}

startApolloServer();

const PORT = 5000;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
