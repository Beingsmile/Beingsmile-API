import app from "./src/app.js";
import './src/utils/cron.js'; // Import cron job to start it

const PORT = process.env.PORT || 5000;

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port http://localhost:${PORT}`);
});