import mongoose from "mongoose";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config();

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error("❌ MONGODB_URI is missing in your .env file.");
  process.exit(1);
}

// Helper to convert Extended JSON ($oid, $date) into native MongoDB objects
const reviveBSON = (obj) => {
  if (obj === null || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(reviveBSON);

  if (Object.keys(obj).length === 1 && obj["$oid"]) {
    return new mongoose.Types.ObjectId(obj["$oid"]);
  }
  
  if (Object.keys(obj).length === 1 && obj["$date"]) {
    return new Date(obj["$date"]);
  }

  const revived = {};
  for (const key in obj) {
    revived[key] = reviveBSON(obj[key]);
  }
  return revived;
};

const seedDatabase = async () => {
  try {
    console.log("⏳ Connecting to MongoDB Atlas...");
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected securely to Atlas.");

    console.log("📂 Reading seed_data.json...");
    const rawData = fs.readFileSync(new URL("./seed_data.json", import.meta.url), "utf-8");
    const data = JSON.parse(rawData);

    // Process and insert each collection securely
    for (const [collectionName, documents] of Object.entries(data)) {
      if (documents.length === 0) continue;

      const revivedDocs = reviveBSON(documents);

      // Convert camelCase collection names from JSON to MongoDB's standard lowercase plural forms
      const targetCollection = collectionName.toLowerCase();

      try {
        const collection = mongoose.connection.db.collection(targetCollection);
        
        // Wipe the entire existing collection to prevent unique index conflicts (like email or firebaseUid)
        await collection.deleteMany({});
        console.log(`🗑️  Nuked old data from '${targetCollection}'`);

        const result = await collection.insertMany(revivedDocs);
        console.log(`✅ Seeded ${result.insertedCount} documents into '${targetCollection}' collection.`);
      } catch (err) {
        console.error(`⚠️ Error seeding collection ${targetCollection}:`, err.message);
      }
    }

    console.log("🎉 Database seeding completed successfully!");
  } catch (err) {
    console.error("❌ Fatal Error during seeding:", err);
  } finally {
    console.log("🔌 Disconnecting from Atlas...");
    await mongoose.disconnect();
    process.exit(0);
  }
};

seedDatabase();
