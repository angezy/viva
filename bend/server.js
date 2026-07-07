// Load environment variables from .env file
require('dotenv').config();

const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const { ApolloServer } = require("@apollo/server");
const { expressMiddleware } = require("@apollo/server/express4");
const { typeDefs, resolvers } = require("./graphqlSchema.js");
const router = require("./routes/homeroute");



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
app.use("/", router);

// Simple request logging (development only)
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.url} - from ${req.ip}`);
  next();
});

// Startup diagnostic logs
console.log('Backend startup: NODE_ENV=', process.env.NODE_ENV);
console.log('Backend startup: JWT_SECRET present=', !!process.env.JWT_SECRET);

async function startApolloServer() {
	const server = new ApolloServer({ typeDefs, resolvers });
	await server.start();
	app.use("/graphql", expressMiddleware(server));
}

startApolloServer();

const PORT = 5000;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
