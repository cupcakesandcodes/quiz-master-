const { MongoMemoryServer } = require('mongodb-memory-server');

module.exports = async () => {
    const mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    process.env.MONGO_MEMORY_URI = uri;
    global.__MONGOD__ = mongod;
};
