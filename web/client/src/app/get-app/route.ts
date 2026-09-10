/** Beneficiary entry point — citizens use the Flutter mobile app, so /get-app serves the APK. */
const APK_PATH = "/apk/ehelp-mobile-v1.0.0.apk";

export function GET() {
  // Relative Location: request.url is the proxy-internal origin on Render.
  return new Response(null, { status: 307, headers: { Location: APK_PATH } });
}
