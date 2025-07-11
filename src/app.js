import express from "express";
import cors from "cors";
import morgan from "morgan";
import connectDB from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import helmet from "helmet";

const app = express();

// Middleware
app.use(helmet());        // Security middleware
app.use(cors());          // Enable CORS for all routes
app.use(express.json());  // For parsing application/json
app.use(morgan('dev'));  // Logging middleware for development

// Import routes
app.use('/api/auth', authRoutes);

// Basic route
app.get('/', (req, res) => {
  res.json({ message: 'Hello from Express!' });
});

connectDB(); // Connect to the database

export default app;