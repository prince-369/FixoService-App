import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';

// Required so the auth popup can close and return to the app.
WebBrowser.maybeCompleteAuthSession();

/**
 * Google OAuth client IDs.
 *  - webClientId: reused from the Fixo web app.
 *  - For a production standalone app you should also create Android & iOS
 *    OAuth clients in Google Cloud Console and add them here.
 *
 * Console setup (one-time, for the popup to work):
 *  Google Cloud Console → Credentials → your OAuth Web client →
 *  "Authorised redirect URIs" → add: https://auth.expo.io/@<your-expo-username>/fixo-service
 */
export const GOOGLE_WEB_CLIENT_ID =
  '76224661304-pp7nolkvi6m7067vstpoqjpmgk2lujk3.apps.googleusercontent.com';

export function useGoogleAuth() {
  // Returns [request, response, promptAsync]. response.params.id_token is the
  // credential the server expects at /auth/customer/google.
  return Google.useIdTokenAuthRequest({
    clientId: GOOGLE_WEB_CLIENT_ID,
  });
}
