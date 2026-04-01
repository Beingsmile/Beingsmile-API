import mongoose from "mongoose";
import User from "./src/models/User.js";
import dotenv from "dotenv";

dotenv.config();

async function checkAdmin() {
  await mongoose.connect(process.env.MONGO_URI);
  const admins = await User.find({ role: "admin" });
  console.log("Admins found:", admins.map(a => ({ name: a.name, email: a.email, role: a.role })));
  process.exit();
}

checkAdmin();
