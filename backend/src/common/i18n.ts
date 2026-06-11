import { I18nContext } from 'nestjs-i18n';

const fallbackErrors = {
  roomNotFound: 'Room not found.',
  guestNotFound: 'Guest not found.',
  bookingNotFound: 'Booking not found.',
  paymentNotFound: 'Payment not found.',
  unauthorized: 'Unauthorized.',
  forbidden: 'Forbidden.',
  invalidCredentials: 'Invalid credentials.',
  roomAlreadyBooked: 'Room already booked.',
  bookingOverlapDetected: 'Room is already booked for the selected dates.',
  missingAccessToken: 'Missing access token.',
  invalidAccessToken: 'Invalid or expired access token.',
  missingAuthenticatedUser: 'Missing authenticated user.',
  userNoLongerExists: 'User no longer exists.',
  cannotBookMaintenanceRoom: 'Cannot book a room under maintenance.',
  onlyConfirmedBookingsCanCheckIn: 'Only confirmed bookings can be checked in.',
  onlyCheckedInBookingsCanCheckOut:
    'Only checked-in bookings can be checked out.',
  checkOutAfterCheckIn: 'checkOutDate must be after checkInDate.',
} satisfies Record<string, string>;

type ErrorKey = keyof typeof fallbackErrors;

export function translateError(key: ErrorKey) {
  return I18nContext.current()?.t(`errors.${key}`) ?? fallbackErrors[key];
}
