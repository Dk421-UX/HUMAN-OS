-- Human OS: Database Schema Setup
-- Run this in the Supabase SQL Editor

-- 1. Profiles Table (Extends Supabase Auth users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS for profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow individual read/update" ON public.profiles
    FOR ALL USING (auth.uid() = id);

-- 2. Conversations Table
CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    response JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS for conversations
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow users to view own conversations" ON public.conversations
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Allow users to insert own conversations" ON public.conversations
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create index for speed
CREATE INDEX IF NOT EXISTS idx_conversations_user ON public.conversations(user_id);

-- 3. Patterns Table
CREATE TABLE IF NOT EXISTS public.patterns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    score INTEGER CHECK (score >= 0 AND score <= 100),
    confidence INTEGER CHECK (confidence >= 0 AND confidence <= 100),
    category TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (user_id, name)
);

ALTER TABLE public.patterns
    ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Enable RLS for patterns
ALTER TABLE public.patterns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow users to view own patterns" ON public.patterns
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Allow users to upsert own patterns" ON public.patterns
    FOR ALL USING (auth.uid() = user_id);

-- Create index
CREATE INDEX IF NOT EXISTS idx_patterns_user ON public.patterns(user_id);

-- 4. Pattern Connections Table
CREATE TABLE IF NOT EXISTS public.pattern_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    source TEXT NOT NULL,
    target TEXT NOT NULL,
    weight INTEGER CHECK (weight >= 0 AND weight <= 100),
    evidence_count INTEGER DEFAULT 1,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (user_id, source, target)
);

-- Enable RLS for connections
ALTER TABLE public.pattern_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow users to view own connections" ON public.pattern_connections
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Allow users to manage own connections" ON public.pattern_connections
    FOR ALL USING (auth.uid() = user_id);

-- Create index
CREATE INDEX IF NOT EXISTS idx_connections_user ON public.pattern_connections(user_id);

-- 5. Psychological DNA Table
CREATE TABLE IF NOT EXISTS public.psychological_dna (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    dimension TEXT NOT NULL,
    score INTEGER CHECK (score >= 0 AND score <= 100),
    trend TEXT CHECK (trend IN ('rising', 'falling', 'stable')),
    confidence INTEGER CHECK (confidence >= 0 AND confidence <= 100),
    history JSONB DEFAULT '[]'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (user_id, dimension)
);

-- Enable RLS for DNA
ALTER TABLE public.psychological_dna ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow users to view own DNA" ON public.psychological_dna
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Allow users to update own DNA" ON public.psychological_dna
    FOR ALL USING (auth.uid() = user_id);

-- Create index
CREATE INDEX IF NOT EXISTS idx_dna_user ON public.psychological_dna(user_id);

-- 6. Insights Table
CREATE TABLE IF NOT EXISTS public.insights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    confidence INTEGER CHECK (confidence >= 0 AND confidence <= 100),
    areas TEXT[] NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS for insights
ALTER TABLE public.insights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow users to view own insights" ON public.insights
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Allow users to manage own insights" ON public.insights
    FOR ALL USING (auth.uid() = user_id);

-- Create index
CREATE INDEX IF NOT EXISTS idx_insights_user ON public.insights(user_id);

-- 7. Timeline Events Table
CREATE TABLE IF NOT EXISTS public.timeline_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL, -- e.g., 'pattern_discovered', 'dna_evolved', 'insight_generated', 'connection_formed', 'milestone'
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS for timeline
ALTER TABLE public.timeline_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow users to view own timeline" ON public.timeline_events
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Allow users to manage own timeline" ON public.timeline_events
    FOR ALL USING (auth.uid() = user_id);

-- Create index
CREATE INDEX IF NOT EXISTS idx_timeline_user ON public.timeline_events(user_id);

-- 8. Blind Spots Table
CREATE TABLE IF NOT EXISTS public.blind_spots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    contradiction TEXT NOT NULL,
    revealed_truth TEXT NOT NULL,
    confidence INTEGER CHECK (confidence >= 0 AND confidence <= 100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.blind_spots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow users to view own blind spots" ON public.blind_spots
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Allow users to manage own blind spots" ON public.blind_spots
    FOR ALL USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_blind_spots_user ON public.blind_spots(user_id);

-- 9. Internal Conflicts Table
CREATE TABLE IF NOT EXISTS public.internal_conflicts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    part_a TEXT NOT NULL,
    part_b TEXT NOT NULL,
    tension TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.internal_conflicts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow users to view own internal conflicts" ON public.internal_conflicts
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Allow users to manage own internal conflicts" ON public.internal_conflicts
    FOR ALL USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_internal_conflicts_user ON public.internal_conflicts(user_id);

-- 10. Root Drivers Table
CREATE TABLE IF NOT EXISTS public.root_drivers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    root_driver TEXT NOT NULL,
    creates_patterns TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.root_drivers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow users to view own root drivers" ON public.root_drivers
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Allow users to manage own root drivers" ON public.root_drivers
    FOR ALL USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_root_drivers_user ON public.root_drivers(user_id);

-- 11. Story Narratives Table
CREATE TABLE IF NOT EXISTS public.narratives (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    phase TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.narratives ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow users to view own narratives" ON public.narratives
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Allow users to manage own narratives" ON public.narratives
    FOR ALL USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_narratives_user ON public.narratives(user_id);

-- 12. Auto Profile Trigger (Optional: inserts a profile record when a user signs up)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (new.id, new.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
