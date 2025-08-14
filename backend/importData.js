const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
const Package = require("./models/Package");

dotenv.config();

const filePath = path.join(__dirname, "summary.json");

async function importData() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");

    await Package.deleteMany();
    console.log("Old data deleted");

    const rawData = fs.readFileSync(filePath, "utf-8");
    const data = JSON.parse(rawData);
    console.log("Loaded records from JSON:", data.length);

    const processedData = data.map(pkg => {
      // Rename 'broken' to 'biBroken'
      if (pkg.broken !== undefined) {
        pkg.biBroken = pkg.broken;
        delete pkg.broken;
      }

      // Process comments to set latest comment and build type
      if (pkg.comments && Object.keys(pkg.comments).length > 0) {
        const allComments = Object.entries(pkg.comments)
          .flatMap(([buildType, arr]) =>
            (arr || []).map(c => ({
              ...c,
              buildType,
              timestamp: c.timestamp || c.date || new Date()
            }))
          )
          .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        if (allComments.length > 0) {
          const latest = allComments[0];
          pkg.latest_comment = latest.text;
          pkg.latest_build_type = latest.buildType;
        } else {
          pkg.latest_comment = null;
          pkg.latest_build_type = null;
        }
      } else {
        pkg.latest_comment = null;
        pkg.latest_build_type = null;
      }

      // Default status if missing
      pkg.status = pkg.status || "Empty";

      return pkg;
    });

    await Package.insertMany(processedData);

    const count = await Package.countDocuments();
    console.log("Inserted records:", count);

    console.log("✅ Data imported successfully from JSON!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error importing data:", error);
    process.exit(1);
  }
}

importData();
