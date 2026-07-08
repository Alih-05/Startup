import posthog from 'posthog-js';

export function initPostHog() {
    if (typeof window !== 'undefined') {
        const apiKey = import.meta.env.VITE_POSTHOG_KEY;
        const host = import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com';

        if (apiKey) {
            posthog.init(apiKey, {
                api_host: host,
                defaults: '2026-01-30',
                person_profiles: 'identified_only',
                capture_exceptions: true,
            });
        } else {
            console.warn('PostHog API key is missing in environment variables.');
        }
    }
    return posthog;
}

export { posthog };