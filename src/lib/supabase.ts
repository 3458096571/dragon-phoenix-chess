import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://sgopefgakclpsgwmrmvm.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNnb3BlZmdha2NscHNnd21ybXZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwNzc5ODgsImV4cCI6MjA5MjY1Mzk4OH0.B8bkJNC3REfaiXycmwc_j4ONo9TbgfWT5txIgy1P5sY';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

export default supabase;
