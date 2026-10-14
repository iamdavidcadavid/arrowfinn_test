import { io, Socket } from 'socket.io-client';
import { API_URL } from './api';

/**
 * One socket per page. Auth is the httpOnly session cookie, sent by the browser
 * on the handshake (withCredentials). The server derives the tenant + trader
 * room from that cookie at connection time; the client never names a room,
 * broker or account, so there is nothing here to tamper with.
 */
export function createLiveSocket(): Socket {
  return io(`${API_URL}/live`, {
    withCredentials: true,
    transports: ['websocket'],
    reconnection: true,
    reconnectionDelay: 500,
    reconnectionDelayMax: 5000,
  });
}
