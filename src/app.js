import express from "express";
import cors from "cors";
import morgan from "morgan";
import connectDB from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import campaignRoutes from "./routes/campaignRoutes.js";
import helmet from "helmet";
import cookieParser from "cookie-parser";

const app = express();

// Middleware
app.use(helmet());        // Security middleware
app.use(cors({origin: 'http://localhost:5173',
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"], 
  allowedHeaders: ["Content-Type", "Authorization"],}));
app.use(express.json());  // For parsing application/json
app.use(morgan('dev'));  // Logging middleware for development
app.use(cookieParser());  // For parsing cookies

// Import routes
app.use('/api/auth', authRoutes);
app.use('/api/campaigns', campaignRoutes);

// Basic route
app.get('/', (req, res) => {
  res.json({ message: 'Hello from Beingsmile API!' });
});

connectDB(); // Connect to the database

export default app;