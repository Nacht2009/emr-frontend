/** Headers con JWT para peticiones al recepcionista local (excepto /api/auth/login). */
export function headersApiJson() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('emr_token')}`,
  }
}

export function headersApiAuth() {
  return {
    Authorization: `Bearer ${localStorage.getItem('emr_token')}`,
  }
}
