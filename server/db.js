import crypto from 'crypto';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables from .env
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("FATAL ERROR: SUPABASE_URL and SUPABASE_KEY environment variables are required to start the server.");
}

console.log("Connecting to Supabase Database...");
const supabase = createClient(supabaseUrl, supabaseKey);

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// User Registration
export async function registerUser(username, password) {
  const lowerName = username.toLowerCase().trim();
  const displayName = username.trim();
  const hash = hashPassword(password);

  try {
    const { error } = await supabase
      .from('users')
      .insert([{ 
        username: lowerName, 
        display_name: displayName, 
        password_hash: hash 
      }]);

    if (error) {
      if (error.code === '23505') { // Unique constraint violation code
        return { success: false, reason: 'Username is already taken.' };
      }
      return { success: false, reason: error.message };
    }
    return { success: true };
  } catch (err) {
    console.error("Supabase Register error:", err);
    return { success: false, reason: 'Database connection error during registration.' };
  }
}

// User Login
export async function loginUser(username, password) {
  const lowerName = username.toLowerCase().trim();
  const hash = hashPassword(password);

  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('username', lowerName)
      .maybeSingle();

    if (error) {
      return { success: false, reason: error.message };
    }
    if (!data || data.password_hash !== hash) {
      return { success: false, reason: 'Invalid username or password.' };
    }

    return {
      success: true,
      user: {
        username: data.display_name,
        stats: {
          wins: data.wins || 0,
          losses: data.losses || 0,
          draws: data.draws || 0,
          gamesPlayed: data.games_played || 0
        }
      }
    };
  } catch (err) {
    console.error("Supabase Login error:", err);
    return { success: false, reason: 'Database connection error during login.' };
  }
}

// Update Stats
export async function recordGameResult(username, result) {
  const lowerName = username.toLowerCase().trim();

  try {
    const { data, error } = await supabase
      .from('users')
      .select('wins, losses, draws, games_played')
      .eq('username', lowerName)
      .maybeSingle();

    if (error || !data) return;

    const updates = {
      games_played: (data.games_played || 0) + 1,
      wins: result === 'win' ? (data.wins || 0) + 1 : (data.wins || 0),
      losses: result === 'loss' ? (data.losses || 0) + 1 : (data.losses || 0),
      draws: result === 'draw' ? (data.draws || 0) + 1 : (data.draws || 0)
    };

    await supabase
      .from('users')
      .update(updates)
      .eq('username', lowerName);
  } catch (err) {
    console.error("Supabase stats record error:", err);
  }
}

// Read Stats
export async function fetchUserStats(username) {
  const lowerName = username.toLowerCase().trim();

  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('username', lowerName)
      .maybeSingle();

    if (error || !data) return null;

    return {
      username: data.display_name,
      stats: {
        wins: data.wins || 0,
        losses: data.losses || 0,
        draws: data.draws || 0,
        gamesPlayed: data.games_played || 0
      }
    };
  } catch (err) {
    console.error("Supabase stats fetch error:", err);
    return null;
  }
}
