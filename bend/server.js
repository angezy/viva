// Load environment variables from .env file
require('dotenv').config();

const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const { ApolloServer } = require("apollo-server-express");
const { typeDefs, resolvers } = require("./graphqlSchema.js");
const router = require("./routes/homeroute");



const app = express();
app.use(cors({
	origin: "http://localhost:3000",
	methods: ["GET", "POST", "PUT", "DELETE"],
	credentials: true
}));
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
	server.applyMiddleware({ app });
}

startApolloServer();

const PORT = 5000;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));