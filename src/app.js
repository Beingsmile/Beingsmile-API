import express from "express";
import cors from "cors";
import morgan from "morgan";
import connectDB from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import campaignRoutes from "./routes/campaignRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import helmet from "helmet";
import cookieParser from "cookie-parser";

const app = express();

// Middleware
app.use(helmet());        // Security middleware

// Increase the body size limit to 50MB for JSON requests
app.use(express.json({ limit: '50mb' }));

// Increase the body size limit to 50MB for URL encoded form data
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'https://beingsmile.org',
  'https://sandbox.aamarpay.com',
  'https://secure.aamarpay.com',
  '*' // Allow any origin for server-to-server callbacks
];

// CORS middleware with permissive origin for Aamarpay callbacks
const corsOptions = {
  origin: function (origin, callback) {
    // allow requests with no origin (like server-to-server requests from Aamarpay)
    if (!origin) return callback(null, true);
    // allow Aamarpay and frontend origins
    if (allowedOrigins.includes(origin) || origin.includes('aamarpay.com')) {
      return callback(null, true);
    }
    // Reject other origins
    return callback(null, true); // Allow all for now during testing
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
};

// Apply CORS globally
app.use(cors(corsOptions));
app.use(morgan('dev'));  // Logging middleware for development
app.use(cookieParser());  // For parsing cookies

// Import routes
app.use('/api/auth', authRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/users', userRoutes);


// Basic route
app.get('/', (req, res) => {
  res.json({ message: 'Hello from Beingsmile API!' });
});

connectDB(); // Connect to the database

export default app;