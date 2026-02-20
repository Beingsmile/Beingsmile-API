import express from "express";
import cors from "cors";
import morgan from "morgan";
import connectDB from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import campaignRoutes from "./routes/campaignRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import helmet from "helmet";
import cookieParser from "cookie-parser";

const app = express();

// Middleware
app.use(helmet());        // Security middleware
// app.use(cors({origin: 'http://localhost:5173',
//   credentials: true,
//   methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"], 
//   allowedHeaders: ["Content-Type", "Authorization"],}));
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'https://beingsmile.org'
];

app.use(cors({
  origin: function (origin, callback) {
    // allow requests with no origin (like mobile apps, curl, Postman)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    } else {
      return callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));
// app.use(express.json());  // For parsing application/json
// Increase the body size limit to 50MB for JSON requests
app.use(express.json({ limit: '50mb' }));

// Increase the body size limit to 50MB for URL encoded form data
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(morgan('dev'));  // Logging middleware for development
app.use(cookieParser());  // For parsing cookies

// Import routes
app.use('/api/auth', authRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/payment', paymentRoutes);


// Basic route
app.get('/', (req, res) => {
  res.json({ message: 'Hello from Beingsmile API!' });
});

connectDB(); // Connect to the database

export default app;