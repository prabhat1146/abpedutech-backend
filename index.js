
const { PORT } = require("./config/env");
const connectMongoDB = require("./config/mongoose");

const app = require("./app");

(async () => {
    await connectMongoDB();

    app.listen(PORT, () => {
        console.log(`🚀 Server running on port ${PORT}`);
    });
})();