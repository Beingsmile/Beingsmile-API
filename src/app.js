import express from "express";
import cors from "cors";
import morgan from "morgan";
import connectDB from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import campaignRoutes from "./routes/campaignRoutes.js";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import Stripe from "stripe";

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
// app.use('/api/payment')
const stripe = new Stripe(process.env.STRIPE_SK);
app.post("/create-payment-intent", async (req, res) => {
      const { amount, id } = req.body;

      try {
        const paymentIntent = await stripe.paymentIntents.create({
          amount: amount,
          currency: "usd",
          payment_method_types: ["card"],
        });

        res.send({
          clientSecret: paymentIntent.client_secret,
        });
      } catch (error) {
        console.error("Error creating payment intent:", error);
        res.status(500).send({ error: "Failed to create payment intent" });
      }
    });

app.get("/api/transactions", async (req, res) => {
  try {
    const paymentIntents = await stripe.paymentIntents.list({
      limit: 10, // Adjust limit if needed
    });

    res.json(paymentIntents.data);
  } catch (error) {
    console.error("Error fetching transactions:", error);
    res.status(500).json({ error: "Failed to fetch transactions" });
  }
});


// Basic route
app.get('/', (req, res) => {
  res.json({ message: 'Hello from Beingsmile API!' });
});

connectDB(); // Connect to the database

export default app;