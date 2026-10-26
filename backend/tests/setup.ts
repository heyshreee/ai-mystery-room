import { resolve } from "node:path";

process.env.NODE_ENV = "test";
process.env.MONGODB_URI ??= "mongodb://127.0.0.1:27017/ai_mystery_room_test";
process.env.SESSION_SECRET =
  "test_session_secret_that_is_longer_than_thirty_two_characters";
process.env.FRONTEND_ORIGIN = "http://localhost:5173";
process.env.LOG_LEVEL = "silent";
process.env.MONGOMS_DOWNLOAD_DIR ??= resolve(process.cwd(), ".cache/mongodb-binaries");
process.env.MONGOMS_VERSION ??= "8.0.4";
