export function authMessage(error){
 const messages={
  over_email_send_rate_limit:'The email service has reached its sending limit. A new email could not be sent. Check your inbox for an earlier code, or try resending later. If this continues, contact support.',
  over_request_rate_limit:'Too many account requests were made recently. Wait a little before trying again.',
  email_address_not_authorized:'The email service is not configured to deliver to this address yet. Contact support to finish email setup.',
  email_not_confirmed:'Your email still needs verification. Enter the verification code from your inbox.',
  otp_expired:'This verification code or link is invalid, expired, or has already been used. Request a new email, or log in if you already verified.',
  flow_state_not_found:'This link cannot finish sign-in in this browser. Open it in the browser where you signed up, or log in if your email is already verified.',
  bad_code_verifier:'Open the verification link in the same browser where you requested it. If your email is already verified, log in.'
 };
 return messages[error.code]||(error.status===429?'The account service is temporarily limiting requests. Wait before trying again. It did not specify whether the limit was for email or account attempts.':error.message||'The request failed. Check your connection and try again.');
}
export const PENDING_EMAIL='lifeos-pending-verification';
export function rememberVerification(email,reason='sent'){
 try{sessionStorage.setItem(PENDING_EMAIL,JSON.stringify({email,reason,createdAt:Date.now()}));}catch{}
}
