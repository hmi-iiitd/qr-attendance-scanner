/* =========================================================
   Course config — edit this once per course before hosting.

   Safe to commit. Do not put student names, roll numbers,
   or QR tokens in this file.
   ========================================================= */

window.ATTENDANCE_CONFIG = {
  /* Shown on the scanner so it is clear which course this is. */
  COURSE_NAME: "CSEXXX – Course Name",

  /* OAuth Web client ID from Google Cloud Console (not a secret).
     Create one Internal web client per course Pages site.
     Authorized JavaScript origin (no repo path):
     https://YOUR_GITHUB_USERNAME.github.io */
  CLIENT_ID: "YOUR_CLIENT_ID",

  /* From the sheet URL: /spreadsheets/d/<THIS_ID>/edit */
  SPREADSHEET_ID: "YOUR_SPREADSHEET_ID",

  /* Restrict Google sign-in to IIIT Delhi accounts. */
  HOSTED_DOMAIN: "iiitd.ac.in",
};
