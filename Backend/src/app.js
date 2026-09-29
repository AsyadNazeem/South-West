const express = require("express");
const cors = require("cors");
require("dotenv").config();

const sequelize = require("./config/database");
const authRoutes = require("./routes/authRoutes");
const customerRoutes = require("./routes/customerRoutes");
const customerAddressRoutes = require("./routes/customerAddressRoutes");

const app = express();

app.use(cors());
app.use(express.json());

// Routes
app.get("/", (req, res) => {
    res.json({
        message: "South West Backend is running",
    });
});

app.use("/auth", authRoutes);
app.use("/customers", customerRoutes);
app.use("/customers", customerAddressRoutes);

const PORT = process.env.PORT || 5001;

async function startServer() {
    try {
        await sequelize.authenticate();

        console.log("✅ MySQL database connected successfully");

        app.listen(PORT, () => {
            console.log(`🚀 South West Backend running on port ${PORT}`);
        });
    } catch (error) {
        console.error("❌ Unable to connect to MySQL:");
        console.error(error.message);
    }
}

startServer();
