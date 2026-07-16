const mongoose = require("mongoose");

const connectMongoDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);

        const { host, port, name } = mongoose.connection;

        console.log("✅ MongoDB Connected");
        console.log(`📍 Database : ${name}`);
        console.log(`🌐 Host     : ${host}`);
        console.log(`🔌 Port     : ${port}`);
        console.log(`📊 State    : ${mongoose.connection.readyState === 1 ? "Connected" : "Disconnected"}`);

    } catch (error) {
        console.error("❌ MongoDB Connection Failed");
        console.error(error.message);
        process.exit(1);
    }
};

module.exports = connectMongoDB;