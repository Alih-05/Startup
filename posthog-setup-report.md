<wizard-report>
# PostHog post-wizard report

The wizard has completed a deep integration of PostHog analytics into the StyleMirror Vite + React + Express application. The existing `posthog-js` setup was upgraded with the correct host, new environment variable names, and exception autocapture. A `PostHogProvider` wrapper was added so all components can access PostHog via React context. User identification (`posthog.identify`) is now called every time Firebase auth state resolves with a logged-in user, and `posthog.reset()` is called on logout. Client-side event capture covers the full user journey: signup, login, logout, AI generation, wardrobe management, look saving, AI outfit suggestions, and the complete payment flow.

| Event Name | Description | File |
|---|---|---|
| `user_signed_up` | Fired when a user completes registration via email or Google OAuth | `src/contexts/AuthContext.tsx` |
| `user_logged_in` | Fired when a user successfully logs in via email or Google OAuth | `src/contexts/AuthContext.tsx` |
| `user_logged_out` | Fired when the user signs out of their account | `src/contexts/AuthContext.tsx` |
| `outfit_generated` | Fired when the AI successfully generates a virtual try-on image | `src/App.tsx` |
| `generation_limit_reached` | Fired when a user hits their plan's generation limit | `src/App.tsx` |
| `look_saved` | Fired when the user saves a generated look to their collection | `src/App.tsx` |
| `look_deleted` | Fired when the user deletes a saved look | `src/App.tsx` |
| `wardrobe_item_added` | Fired when a clothing item is added to the user's wardrobe | `src/App.tsx` |
| `wardrobe_item_deleted` | Fired when the user removes a clothing item from their wardrobe | `src/App.tsx` |
| `plan_upgrade_started` | Fired when the user selects a paid plan and proceeds to payment | `src/App.tsx` |
| `payment_completed` | Fired when a PayPal payment is captured successfully | `src/App.tsx` |
| `payment_cancelled` | Fired when the user cancels a PayPal payment | `src/App.tsx` |
| `payment_failed` | Fired when a PayPal payment attempt fails | `src/App.tsx` |
| `ai_suggestions_requested` | Fired when the user requests AI outfit suggestions from their wardrobe | `src/App.tsx` |

## Next steps

We've built some insights and a dashboard for you to keep an eye on user behavior, based on the events we just instrumented:

- [Analytics basics (wizard) — Dashboard](https://us.posthog.com/project/502708/dashboard/1814895)
- [New User Signups (wizard)](https://us.posthog.com/project/502708/insights/jx7xrFeM)
- [AI Outfit Generations (wizard)](https://us.posthog.com/project/502708/insights/AFPxNmIi)
- [Payment Conversion Funnel (wizard)](https://us.posthog.com/project/502708/insights/FJPEGVgO)
- [Wardrobe & Looks Activity (wizard)](https://us.posthog.com/project/502708/insights/xMeoWncN)
- [Payment Failures & Cancellations (wizard)](https://us.posthog.com/project/502708/insights/IouOtuGr)

## Verify before merging

- [ ] Run a full production build (`npm run build`) and fix any lint or type errors introduced by the generated code.
- [ ] Run the test suite — call sites that were rewritten or instrumented may need updated mocks or fixtures.
- [ ] Add `VITE_PUBLIC_POSTHOG_PROJECT_TOKEN` and `VITE_PUBLIC_POSTHOG_HOST` to `.env.example` and any other bootstrap scripts so collaborators know what values to set.
- [ ] Wire source-map upload (`posthog-cli sourcemap` or your bundler's upload step) into CI so production stack traces de-minify in PostHog Error Tracking.
- [ ] Confirm the returning-visitor path also calls `identify` — the current implementation calls `posthog.identify()` inside the Firebase `onAuthStateChanged` listener, which fires on every page load when the user is already logged in. Verify this is working as expected in a real browser session.

### Agent skill

We've left an agent skill folder in your project. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.

</wizard-report>
