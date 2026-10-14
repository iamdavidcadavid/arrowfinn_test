'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { applyAccount, applyFill } from '@/lib/merge';
import { createLiveSocket } from '@/lib/socket';
import type { AccountSnapshot, FillEvent, TraderSnapshot } from '@/lib/types';

export const SNAPSHOT_KEY = ['snapshot'] as const;

/**
 * connecting   - first handshake in progress
 * live         - socket up AND snapshot re-fetched since it came up
 * resyncing    - socket back, catching up on anything missed while down
 * disconnected - socket down; numbers on screen may be stale
 * unauthorized - session rejected; caller should send the user to /login
 */
export type FeedStatus = 'connecting' | 'live' | 'resyncing' | 'disconnected' | 'unauthorized';

export interface LiveFill extends Omit<FillEvent, 'account'> {
  receivedAt: number;
}

export function useLiveSnapshot() {
  const queryClient = useQueryClient();
  // Newest pushed state per account. A REST refetch that started before an event
  // and finished after it would otherwise overwrite newer data with older data.
  const latestPushed = useRef(new Map<string, AccountSnapshot>());

  const query = useQuery({
    queryKey: SNAPSHOT_KEY,
    queryFn: async () => {
      let fresh = await api.snapshot();
      for (const acc of latestPushed.current.values()) fresh = applyAccount(fresh, acc);
      return fresh;
    },
  });

  const [status, setStatus] = useState<FeedStatus>('connecting');
  const [fills, setFills] = useState<LiveFill[]>([]);

  useEffect(() => {
    const socket = createLiveSocket();

    // 'ready' is emitted by the server after this socket has joined its room.
    // Re-fetch on every ready (first connect and every reconnect): anything
    // committed before the join is picked up by the fetch, anything after by
    // the stream. That is the whole "did I miss fills?" answer - see README.
    socket.on('ready', async () => {
      setStatus('resyncing');
      try {
        await queryClient.refetchQueries({ queryKey: SNAPSHOT_KEY, exact: true });
        if (socket.connected) setStatus('live');
      } catch {
        // Query error state is surfaced by the page; stay "resyncing" so nothing claims to be live.
      }
    });

    socket.on('fill', (event: FillEvent) => {
      latestPushed.current.set(event.account.accountId, event.account);
      queryClient.setQueryData<TraderSnapshot>(SNAPSHOT_KEY, (prev) => (prev ? applyFill(prev, event) : prev));
      const { account: _omit, ...fill } = event;
      setFills((prev) => [{ ...fill, receivedAt: Date.now() }, ...prev].slice(0, 25));
    });

    socket.on('disconnect', () => setStatus('disconnected'));

    socket.on('connect_error', (err) => {
      if (err.message === 'unauthorized') {
        socket.disconnect();
        setStatus('unauthorized');
        return;
      }
      setStatus((s) => (s === 'connecting' ? 'connecting' : 'disconnected'));
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, [queryClient]);

  return { query, status, fills };
}
