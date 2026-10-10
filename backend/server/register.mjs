// Lets the Deno-style function sources run on Node unchanged:
// "npm:@supabase/supabase-js@2" -> "@supabase/supabase-js".
import { register } from "node:module";

register("./hooks.mjs", import.meta.url);
