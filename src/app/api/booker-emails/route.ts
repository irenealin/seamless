import { NextResponse } from "next/server"; // Imports the Next.js response helper.
import { supabase } from "@/lib/supabaseClient"; // Imports the Supabase client for database writes.
export async function POST(request: Request) { // Handles POST requests for saving booker emails.
  const body = await request.json().catch(() => null); // Parses the JSON body safely.
  const rawEmail = typeof body?.email === "string" ? body.email.trim() : ""; // Extracts and trims the email value.
  const email = rawEmail.toLowerCase(); // Normalizes the email to lowercase for storage.
  if (!email || !email.includes("@")) { // Validates that an email-like value was provided.
    return NextResponse.json({ error: "Email is required." }, { status: 400 }); // Returns a 400 error for invalid input.
  } // Ends the validation guard.
  const { error } = await supabase.from("bookers_emails").insert({ email }); // Inserts the email into the Supabase table.
  if (error) { // Checks for database write errors.
    return NextResponse.json({ error: "Unable to save your email." }, { status: 500 }); // Returns a 500 error on failure.
  } // Ends the error guard.
  return NextResponse.json({ ok: true }, { status: 201 }); // Returns a success response when saved.
} // Ends the POST handler.
