CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  public_key TEXT NOT NULL,
  private_key TEXT NOT NULL,
  balance NUMERIC DEFAULT 0,
  session_id TEXT
);

CREATE TABLE transactions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  type TEXT CHECK (type IN ('deposit', 'withdrawal')),
  amount NUMERIC,
  status TEXT,
  tx_signature TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
