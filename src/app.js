import express from "express";
import cors from "cors";
import morgan from "morgan";
import connectDB from "./config/db.js";

const app = express();

// Middleware
app.use(express.json());  // For parsing application/json
app.use(cors());          // Enable CORS for all routes
app.use(morgan('dev'));  // Logging middleware for development

// Basic route
app.get('/', (req, res) => {
  res.json({ message: 'Hello from Express!' });
});

connectDB(); // Connect to the database

export default app;