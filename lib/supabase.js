import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://qrgcyvfrgepwhjzgtjht.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFyZ2N5dmZyZ2Vwd2hqemd0amh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQwMzE1MjUsImV4cCI6MjA2OTYwNzUyNX0.-fz9RFd-yL1KSAIRoqhSNibcvDLGkP2eSAAgVIZqNTY';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
