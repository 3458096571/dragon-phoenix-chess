import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://hinmabpqnifotpfzhiet.supabase.co';
// Use service_role key for full access (RLS disabled for simplicity)
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhpbm1hYnBxbmlmb3RwZnpoaWV0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDQ4MDE4OCwiZXhwIjoyMDk2MDU2MTg4fQ.p8yE7ATJYYUiTq94fegVF4gs_gKoIJm4qMKmimjT8t8';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

export default supabase;
