process.env.NODE_ENV = "test";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@127.0.0.1:5432/postgres";
process.env.DATABASE_SSL = "disable";
process.env.SESSION_SECRET =
  "test_session_secret_that_is_longer_than_thirty_two_characters";
process.env.FRONTEND_ORIGIN = "http://localhost:5173";
process.env.LOG_LEVEL = "silent";
