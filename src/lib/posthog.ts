import posthog from 'posthog-js';

export function initPostHog() {
    if (typeof window !== 'undefined') {
        const apiKey = (import.meta as any).env.VITE_POSTHOG_KEY;

        if (apiKey) {
            posthog.init(apiKey, {
                api_host: 'https://app.posthog.com',
                person_profiles: 'identified_only',
            });
        } else {
            console.warn('PostHog API key is missing in environment variables.');
        }
    }
    return posthog;
}

export { posthog };