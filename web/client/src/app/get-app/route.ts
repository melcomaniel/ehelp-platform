/** Beneficiary entry point — citizens use the Flutter mobile app, so /get-app serves the APK. */
const APK_PATH = "/apk/ehelp-mobile-v1.0.0.apk";

export function GET(request: Request) {
  return Response.redirect(new URL(APK_PATH, request.url), 307);
}
