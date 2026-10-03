import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, Platform, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { router } from 'expo-router';
import { BuddyError, BuddyRow, BuddySkeleton, buddyColors as c } from '@/components/BuddyUI';
import { FACEBOOK_LIMIT, useFacebookActions, useFacebookConnection } from '@/utils/facebookBuddies';
import type { BuddyPerson } from '@/utils/buddies';

function Btn({ label, onPress, primary, disabled, testID }: { label: string; onPress: () => void; primary?: boolean; disabled?: boolean; testID: string }) {
  return <TouchableOpacity testID={testID} onPress={onPress} disabled={disabled} accessibilityRole="button"
    style={[s.btn, primary ? s.btnPrimary : s.btnGhost, disabled && { opacity: 0.5 }]}>
    <Text style={[s.btnText, { color: primary ? c.background : c.lime }]}>{label}</Text>
  </TouchableOpacity>;
}

export function FacebookDiscovery({ refreshSignal }: { refreshSignal?: number }) {
  const [offset, setOffset] = useState(0);
  const [notice, setNotice] = useState('');
  const [browserOpen, setBrowserOpen] = useState(false);
  const q = useFacebookConnection(offset);
  const { begin, cancel, disconnect } = useFacebookActions();
  const refetchRef = useRef(q.refetch);
  refetchRef.current = q.refetch;
  const data = q.data;

  useEffect(() => {
    const sub = AppState.addEventListener('change', st => { if (st === 'active') void refetchRef.current(); });
    return () => sub.remove();
  }, []);
  useEffect(() => { if (refreshSignal) void refetchRef.current(); }, [refreshSignal]);

  const connect = useCallback(async () => {
    setNotice('');
    setOffset(0);
    try {
      const { authorizationUrl } = await begin.mutateAsync();
      setBrowserOpen(true);
      await WebBrowser.openBrowserAsync(authorizationUrl);
      setBrowserOpen(false);
      const fresh = await refetchRef.current();
      if (fresh.error) throw fresh.error;
      if (fresh.data?.pending) {
        await cancel.mutateAsync();
        setNotice('Facebook connection was not finished, so it was cancelled. You can try again any time.');
      }
    } catch (e) {
      setBrowserOpen(false);
      setNotice(e instanceof Error ? e.message : 'Could not start Facebook connection.');
    }
  }, [begin, cancel]);

  const confirmDisconnect = () => {
    const run = () => disconnect.mutate(undefined, {
      onError: e => setNotice(e.message),
      onSuccess: () => { setOffset(0); setNotice('Facebook disconnected. Your buddies are unchanged.'); },
    });
    if (Platform.OS === 'web') { if (window.confirm('Disconnect Facebook? Your matches will be cleared.')) run(); return; }
    Alert.alert('Disconnect Facebook?', 'Your matches will be cleared. Existing buddies are not affected.', [
      { text: 'Keep connected', style: 'cancel' }, { text: 'Disconnect', style: 'destructive', onPress: run },
    ]);
  };

  const invite = async () => {
    if (!data?.inviteUrl) return;
    try {
      const r = await Share.share(Platform.OS === 'ios' ? { url: data.inviteUrl } : { message: `Join me on Spud: ${data.inviteUrl}` });
      if (r.action === Share.dismissedAction) setNotice('Share cancelled. Nothing was sent.');
    } catch { setNotice('Sharing is not available on this device.'); }
  };

  const open = (p: BuddyPerson) => router.push({ pathname: '/buddies/[userId]', params: { userId: p.userId } } as any);
  const busy = begin.isPending || cancel.isPending || disconnect.isPending || browserOpen;
  const denied = !!data?.error && /permission|denied|declin|allow Facebook friends access/i.test(data.error);

  let body: React.ReactNode;
  if (q.isPending) body = <BuddySkeleton />;
  else if (q.isError) body = <BuddyError message={q.error.message} retry={() => void q.refetch()} />;
  else if (data && !data.configured) body = <View style={s.card} testID="facebook-unavailable">
    <Text style={s.title}>Facebook discovery is not available yet</Text>
    <Text style={s.copy}>It has not been activated for Spud. Name search and invites still work.</Text>
    {notice ? <Text style={s.note} testID="facebook-notice">{notice}</Text> : null}
    <View style={s.actions}>
      {data.inviteUrl ? <Btn testID="facebook-invite" label="Invite friends" onPress={() => void invite()} /> : null}
      {data.connected ? <Btn testID="facebook-disconnect" label="Disconnect Facebook" onPress={confirmDisconnect} disabled={busy} /> : null}
    </View>
  </View>;
  else if (data) body = <View style={{ gap: 12 }}>
    <View style={s.card}>
      <Text style={s.copy}>Facebook only returns friends who also connected Spud and allowed friend access. Spud never posts for you and never sends requests automatically. Shelves stay private until a buddy request is accepted.</Text>
      {data.error ? <Text style={s.err} testID="facebook-error">{denied ? 'Facebook friend permission was not granted. Connect again and allow friends access to see matches.' : data.error}</Text> : null}
      {notice ? <Text style={s.note} testID="facebook-notice">{notice}</Text> : null}
      {data.pending ? <View style={s.row}><ActivityIndicator color={c.lime} /><Text style={s.copy}>Waiting for Facebook to finish...</Text></View> : null}
      <View style={s.actions}>
        {data.pending ? <Btn testID="facebook-cancel" label="Cancel pending" onPress={() => cancel.mutate(undefined, {
          onError: e => setNotice(e.message), onSuccess: () => setNotice('Pending Facebook connection cancelled.'),
        })} disabled={busy} /> :
          data.connected ? <>
            <Btn testID="facebook-refresh" label="Refresh / re-authorize" onPress={() => void connect()} disabled={busy} primary />
            <Btn testID="facebook-disconnect" label="Disconnect" onPress={confirmDisconnect} disabled={busy} />
          </> : <Btn testID="facebook-connect" label="Connect Facebook" onPress={() => void connect()} disabled={busy} primary />}
        {data.inviteUrl ? <Btn testID="facebook-invite" label="Invite friends" onPress={() => void invite()} /> : null}
      </View>
      {data.lastSyncedAt ? <Text style={s.meta}>Last synced {new Date(data.lastSyncedAt).toLocaleString()}</Text> : null}
    </View>
    {data.connected && !data.pending && (data.results.length ? <>
      {data.results.map(p => <BuddyRow key={p.userId} person={{ ...p, firstName: p.firstName ?? '', lastName: p.lastName, username: p.username ?? '' }} onPress={() => open({ ...p, firstName: p.firstName ?? '', username: p.username ?? '' })} />)}
      {(data.total > FACEBOOK_LIMIT || offset > 0) && <View style={s.actions}>
        <Btn testID="facebook-prev" label="Previous" onPress={() => setOffset(Math.max(0, offset - FACEBOOK_LIMIT))} disabled={offset === 0} />
        <Text style={s.meta}>{offset + 1}-{Math.min(offset + data.results.length, data.total)} of {data.total}</Text>
        <Btn testID="facebook-next" label="Next" onPress={() => setOffset(offset + FACEBOOK_LIMIT)} disabled={offset + data.results.length >= data.total} />
      </View>}
    </> : <View style={s.card} testID="facebook-empty">
      <Text style={s.title}>No Facebook matches yet</Text>
      <Text style={s.copy}>No matching friends were found. Invite friends, then refresh.</Text>
      {offset > 0 && <Btn testID="facebook-prev" label="Previous page" onPress={() => setOffset(Math.max(0, offset - FACEBOOK_LIMIT))} />}
    </View>)}
  </View>;

  return <View style={{ marginTop: 30 }} testID="facebook-discovery">
    <Text style={s.label}>FIND FRIENDS FROM FACEBOOK</Text>
    {body}
  </View>;
}

const s = StyleSheet.create({
  label: { color: c.lime, fontFamily: 'Manrope_700Bold', fontSize: 11, letterSpacing: 1.2, marginBottom: 12 },
  card: { backgroundColor: c.panel, borderRadius: 18, padding: 18, gap: 10 },
  title: { color: c.text, fontFamily: 'Manrope_700Bold', fontSize: 15 },
  copy: { color: c.muted, fontFamily: 'Manrope_400Regular', fontSize: 13, lineHeight: 19, flexShrink: 1 },
  err: { color: c.danger, fontFamily: 'Manrope_500Medium', fontSize: 13, lineHeight: 19 },
  note: { color: c.cream, fontFamily: 'Manrope_500Medium', fontSize: 12, lineHeight: 18 },
  meta: { color: c.muted, fontFamily: 'Manrope_500Medium', fontSize: 11 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  btn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 30 },
  btnPrimary: { backgroundColor: c.lime },
  btnGhost: { borderWidth: 1, borderColor: c.panelLight },
  btnText: { fontFamily: 'Manrope_700Bold', fontSize: 12 },
});
