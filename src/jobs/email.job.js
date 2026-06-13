// Email job placeholder
// Use a queue system (e.g., Bull) for async email processing
//
// export async function sendWelcomeEmail(user) {
//   // Send email logic
// }

export async function sendWelcomeEmail(_user) {
  console.log(`[EMAIL] Welcome email would be sent to ${_user.email}`);
}
