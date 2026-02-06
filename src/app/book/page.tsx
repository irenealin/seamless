"use client"; // Marks this page as a client component so hooks can run.
import { useRouter } from "next/navigation"; // Imports the Next.js router for client navigation.
import { useState } from "react"; // Imports React state for the form.
export default function Book() { // Defines the email capture page component.
  const router = useRouter(); // Initializes the router instance for redirects.
  const [email, setEmail] = useState(""); // Stores the user's email input value.
  const [isSubmitting, setIsSubmitting] = useState(false); // Tracks whether the form is submitting.
  const [errorMessage, setErrorMessage] = useState<string | null>(null); // Stores any submission error text.
  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => { // Handles the email form submission.
    event.preventDefault(); // Prevents the browser from doing a full page reload.
    setIsSubmitting(true); // Disables the form while the request is in flight.
    setErrorMessage(null); // Clears any previous error message.
    try { // Starts the request/response flow with error handling.
      const response = await fetch("/api/booker-emails", { // Calls the API route that writes to Supabase.
        method: "POST", // Sends a POST request with the email payload.
        headers: { "Content-Type": "application/json" }, // Declares JSON content for the request body.
        body: JSON.stringify({ email }), // Sends the raw email value for storage.
      }); // Completes the request configuration.
      if (!response.ok) { // Checks whether the API returned an error status.
        const payload = await response.json().catch(() => null); // Reads any error response body safely.
        const message = payload?.error ?? "Unable to save your email."; // Chooses a helpful error message.
        throw new Error(message); // Throws to trigger the catch branch.
      } // Ends the non-OK response guard.
      if (typeof window !== "undefined") {
        window.localStorage.setItem("seamless_booker_email", email.trim().toLowerCase());
      }
      router.push("/discover"); // Sends the user to the booking page after success.
    } catch (error) { // Handles network or API errors.
      const message = error instanceof Error ? error.message : "Something went wrong."; // Normalizes the error message.
      setErrorMessage(message); // Displays the error message on the page.
    } finally { // Ensures we always clear the loading state.
      setIsSubmitting(false); // Re-enables the form after the request finishes.
    } // Ends the try/catch/finally block.
  }; // Ends the submit handler definition.
  return ( // Renders the email capture UI.
    <div className="landingPage">{/* Reuses landing page styling and background. */}
      <header className="landingHeader">{/* Matches the landing header layout. */}
        <div className="landingInner">{/* Centers the header content. */}
          <div className="landingBrand">{/* Aligns the logo and brand text. */}
            <span className="landingLogoMark" aria-hidden="true">{/* Shows the brand mark without extra aria text. */}
              <svg viewBox="0 0 120 120" role="img">{/* Renders the inline logo SVG. */}
                <g fill="none" stroke="currentColor" strokeWidth="3.4">{/* Defines the logo strokes. */}
                  <circle cx="60" cy="18" r="16" />{/* Draws the top outer ring. */}
                  <circle cx="60" cy="18" r="10" />{/* Draws the top middle ring. */}
                  <circle cx="60" cy="18" r="5" />{/* Draws the top inner ring. */}
                  <circle cx="60" cy="102" r="16" />{/* Draws the bottom outer ring. */}
                  <circle cx="60" cy="102" r="10" />{/* Draws the bottom middle ring. */}
                  <circle cx="60" cy="102" r="5" />{/* Draws the bottom inner ring. */}
                  <circle cx="18" cy="60" r="16" />{/* Draws the left outer ring. */}
                  <circle cx="18" cy="60" r="10" />{/* Draws the left middle ring. */}
                  <circle cx="18" cy="60" r="5" />{/* Draws the left inner ring. */}
                  <circle cx="102" cy="60" r="16" />{/* Draws the right outer ring. */}
                  <circle cx="102" cy="60" r="10" />{/* Draws the right middle ring. */}
                  <circle cx="102" cy="60" r="5" />{/* Draws the right inner ring. */}
                  <circle cx="60" cy="60" r="22" />{/* Draws the center outer ring. */}
                  <circle cx="60" cy="60" r="14" />{/* Draws the center middle ring. */}
                  <circle cx="60" cy="60" r="7" />{/* Draws the center inner ring. */}
                </g>{/* Ends the logo stroke group. */}
              </svg>{/* Ends the logo SVG. */}
            </span>{/* Ends the logo wrapper. */}
            <div>{/* Wraps the brand name and subheading. */}
              <div className="landingBrandTitle">Seamless</div>{/* Displays the brand name text. */}
              <div className="landingBrandSub">Private dining for corporate events</div>{/* Displays the brand subheading text. */}
            </div>{/* Ends the brand text wrapper. */}
          </div>{/* Ends the brand block. */}
        </div>{/* Ends the header inner container. */}
      </header>{/* Ends the header. */}
      <main>{/* Defines the main content region. */}
        <section className="landingHero">{/* Reuses the hero section spacing. */}
          <div className="landingInner">{/* Centers the hero content. */}
            <div className="landingHeroCopy">{/* Aligns and sizes the hero copy. */}
              <div className="landingEyebrow">Confirm your email</div>{/* Shows a short prompt above the headline. */}
              <h1>Where should we send your booking options?</h1>{/* Asks for the user's email address. */}
              <p>Enter your email and we will take you to the booking details.</p>{/* Explains what happens next. */}
              <form className="landingForm" onSubmit={handleSubmit}>{/* Captures the email and submits it. */}
                <label className="landingHelper" htmlFor="bookerEmail">Email address</label>{/* Provides an accessible label for the input. */}
                <input className="landingInput" id="bookerEmail" type="email" name="email" autoComplete="email" placeholder="you@company.com" value={email} onChange={(event) => setEmail(event.target.value)} required />{/* Binds the email input to state and validates it. */}
                {errorMessage ? (<p className="landingError" aria-live="polite">{errorMessage}</p>) : null}{/* Shows an error message when submission fails. */}
                <div className="landingActions">{/* Aligns the call-to-action button. */}
                  <button className="landingBtn landingBtnPrimary" type="submit" disabled={isSubmitting}>{isSubmitting ? "Saving..." : "Next"}</button>{/* Submits the email and proceeds. */}
                </div>
              </form>
            </div>
          </div>
        </section>
      </main>
    </div>
  ); // Ends the return statement.
} // Ends the page component.
