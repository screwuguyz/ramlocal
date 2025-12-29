-- Queue Tickets Table for RAM Dosya Atama
-- Run this SQL in Supabase SQL Editor

-- Create queue_tickets table
CREATE TABLE IF NOT EXISTS queue_tickets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    no INTEGER NOT NULL,
    name TEXT DEFAULT 'Misafir',
    status TEXT DEFAULT 'waiting' CHECK (status IN ('waiting', 'called', 'done')),
    called_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_queue_tickets_status ON queue_tickets(status);
CREATE INDEX IF NOT EXISTS idx_queue_tickets_created ON queue_tickets(created_at DESC);

-- Enable Row Level Security
ALTER TABLE queue_tickets ENABLE ROW LEVEL SECURITY;

-- Allow all operations (public access for kiosk)
CREATE POLICY "Allow all operations on queue_tickets"
ON queue_tickets FOR ALL
USING (true)
WITH CHECK (true);

-- Enable realtime for this table
ALTER PUBLICATION supabase_realtime ADD TABLE queue_tickets;

-- Sequence for ticket numbers (resets daily via app logic)
-- Note: We'll handle numbering in application code
