import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, Linking, Modal, NativeModules, Platform, Share, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Contacts from 'expo-contacts/legacy';
import * as SMS from 'expo-sms';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGetSocialConfig } from '@workspace/api-client-react';
import { buddyColors as c } from '@/components/BuddyUI';

type Person = { id: string; name: string; phones: string[]; emails: string[]; search: string };
type Phase = 'loading' | 'ready' | 'denied' | 'blocked' | 'unavailable' | 'error';

function inviteBody(cfg?: { inviteUrl?: string; inviteMessage?: string }) {
  const url = cfg?.inviteUrl ?? '';
  const msg = cfg?.inviteMessage ?? 'Join me on Spud to share what we are watching.';
  return { url, body: url && !msg.includes(url) ? `${msg}\n${url}` : msg };
}

function toPeople(data: Contacts.ExistingContact[]): Person[] {
  const out: Person[] = [];
  for (const k of data) {
    const phones = (k.phoneNumbers ?? []).map(p => p.number).filter((n): n is string => !!n);
    const emails = (k.emails ?? []).map(e => e.email).filter((n): n is string => !!n);
    const name = k.name || [k.firstName, k.lastName].filter(Boolean).join(' ') || emails[0] || phones[0];
    if (!name || !k.id || (!phones.length && !emails.length)) continue;
    out.push({ id: k.id, name, phones, emails, search: `${name} ${emails.join(' ')}`.toLowerCase() });
  }
  return out;
}

const initials = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase()).join('');

function ContactPicker({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const cfg = useGetSocialConfig();
  const [phase, setPhase] = useState<Phase>('loading');
  const [limited, setLimited] = useState(false);
  const [people, setPeople] = useState<Person[]>([]);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [attempt, setAttempt] = useState(0);

  // Permission is requested here, only after the user tapped Contacts. Contacts are read once and filtered locally.
  useEffect(() => {
    if (!visible) { setQuery(''); setSelected(new Set()); setPeople([]); setPhase('loading'); return; }
    let cancelled = false;
    (async () => {
      setPhase('loading');
      try {
        if (Platform.OS === 'web' || !(await Contacts.isAvailableAsync())) { if (!cancelled) setPhase('unavailable'); return; }
        let perm = await Contacts.getPermissionsAsync();
        if (!perm.granted) perm = await Contacts.requestPermissionsAsync();
        if (cancelled) return;
        if (!perm.granted) { setPhase(perm.canAskAgain === false ? 'blocked' : 'denied'); return; }
        setLimited((perm as { accessPrivileges?: string }).accessPrivileges === 'limited');
        const all: Contacts.ExistingContact[] = [];
        let offset = 0;
        for (;;) {
          const res = await Contacts.getContactsAsync({
            fields: [Contacts.Fields.Name, Contacts.Fields.PhoneNumbers, Contacts.Fields.Emails],
            sort: Contacts.SortTypes.FirstName, pageSize: 500, pageOffset: offset,
          });
          all.push(...res.data);
          offset += res.data.length;
          if (cancelled || !res.hasNextPage || !res.data.length) break;
        }
        if (cancelled) return;
        setPeople(toPeople(all));
        setPhase('ready');
      } catch {
        if (!cancelled) setPhase('error');
      }
    })();
    return () => { cancelled = true; };
  }, [visible, attempt]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? people.filter(p => p.search.includes(q)) : people;
  }, [people, query]);
  const allSelected = filtered.length > 0 && filtered.every(p => selected.has(p.id));
  const toggle = useCallback((id: string) => setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; }), []);
  const picked = useMemo(() => people.filter(p => selected.has(p.id)), [people, selected]);

  const { body } = inviteBody(cfg.data);
  const ready = !!cfg.data?.inviteUrl;

  const open = async (target: string, label: string) => {
    try {
      if (!(await Linking.canOpenURL(target))) {
        Alert.alert(`${label} is not available`, `This device cannot open ${label.toLowerCase()} right now. Use Invite via Email or Message to share the link instead.`);
        return;
      }
      await Linking.openURL(target);
    } catch {
      Alert.alert(`Could not open ${label.toLowerCase()}`, 'Please try again.');
    }
  };
  const email = (list: Person[]) => {
    const to = [...new Set(list.map(p => p.emails[0]).filter(Boolean))];
    if (!to.length) { Alert.alert('No email addresses', 'No selected contact has an email address.'); return; }
    const subject = encodeURIComponent('Join me on Spud');
    const text = encodeURIComponent(body);
    // Everyone goes in BCC so recipients cannot see each other's addresses.
    const url = to.length === 1 ? `mailto:${encodeURIComponent(to[0])}?subject=${subject}&body=${text}` : `mailto:?bcc=${encodeURIComponent(to.join(','))}&subject=${subject}&body=${text}`;
    void open(url, 'Mail');
  };
  const sendSms = async (nums: string[]) => {
    try {
      if (!(await SMS.isAvailableAsync())) {
        Alert.alert('Messages are not available', 'This device cannot send text messages. Use Invite via Email or Message to share the link instead.');
        return;
      }
      // The composer opens for you to review; Spud never sends and cannot confirm delivery.
      await SMS.sendSMSAsync(nums, body);
    } catch {
      Alert.alert('Could not open Messages', 'Please try again.');
    }
  };
  const message = (list: Person[]) => {
    const nums = [...new Set(list.map(p => p.phones[0]?.replace(/[^\d+]/g, '')).filter(Boolean))];
    if (!nums.length) { Alert.alert('No phone numbers', 'No selected contact has a phone number.'); return; }
    if (nums.length === 1) { void sendSms(nums); return; }
    Alert.alert('Send as a group message?', "A group message shows every recipient's phone number to everyone in the thread. Invite one contact at a time to keep numbers private.", [
      { text: 'Cancel', style: 'cancel' }, { text: 'Continue to group message', onPress: () => void sendSms(nums) },
    ]);
  };
  const compose = (list: Person[]) => {
    if (!ready) { Alert.alert('Invite link not ready', cfg.isError ? 'The invite link did not load.' : 'Please try again in a moment.'); return; }
    const mailCount = list.filter(p => p.emails.length).length, textCount = list.filter(p => p.phones.length).length;
    const buttons: { text: string; style?: 'cancel'; onPress?: () => void }[] = [];
    if (mailCount) buttons.push({ text: list.length > 1 ? `Email ${mailCount} (BCC)` : 'Email', onPress: () => email(list) });
    if (textCount) buttons.push({ text: list.length > 1 ? `Message ${textCount}` : 'Message', onPress: () => message(list) });
    buttons.push({ text: 'Cancel', style: 'cancel' });
    const availability = list.length > 1 && (mailCount < list.length || textCount < list.length)
      ? 'Each option includes only contacts with that email address or phone number. You can use both options for a mixed selection.\n\n' : '';
    Alert.alert(list.length === 1 ? `Invite ${list[0].name}` : `Invite ${list.length} people`, `${availability}You review and send the invitation yourself. Spud never sends anything automatically.`, buttons);
  };

  const status = (icon: keyof typeof Feather.glyphMap, title: string, copy: string, action?: { label: string; run: () => void }) => (
    <View style={styles.status}>
      <Feather name={icon} size={26} color={c.lime} />
      <Text style={styles.statusTitle}>{title}</Text>
      <Text style={styles.statusCopy}>{copy}</Text>
      {action && <TouchableOpacity style={styles.pill} onPress={action.run} accessibilityRole="button"><Text style={styles.pillText}>{action.label}</Text></TouchableOpacity>}
    </View>
  );

  let content: React.ReactNode;
  if (phase === 'loading') content = <View style={styles.skelWrap}>{[0, 1, 2, 3, 4, 5].map(i => <View key={i} style={styles.skel} />)}</View>;
  else if (phase === 'unavailable') content = status('smartphone', 'Contacts need your phone', 'Contacts are only available in the iPhone or Android app.');
  else if (phase === 'blocked') content = status('lock', 'Contacts access is off', 'Turn on Contacts for Spud in Settings. Your address book never leaves this device.', { label: 'Open Settings', run: () => void Linking.openSettings() });
  else if (phase === 'denied') content = status('users', 'Contacts are optional', 'Allow access to pick friends from your phone. Names, numbers and emails stay on this device.', { label: 'Allow Contacts', run: () => setAttempt(a => a + 1) });
  else if (phase === 'error') content = status('alert-circle', 'Could not read contacts', 'Something went wrong reading your address book.', { label: 'Try again', run: () => setAttempt(a => a + 1) });
  else content = (
    <FlatList
      data={filtered} keyExtractor={p => p.id} keyboardShouldPersistTaps="handled"
      initialNumToRender={20} windowSize={9}
      contentContainerStyle={{ paddingBottom: picked.length ? 96 : 24 }}
      ListHeaderComponent={<>
        {limited && <View style={styles.limited}>
          <Text style={styles.limitedText}>You shared only some contacts with Spud.</Text>
          {typeof (Contacts as any).presentAccessPickerAsync === 'function' && <TouchableOpacity onPress={() => { void (Contacts as any).presentAccessPickerAsync().then(() => setAttempt(a => a + 1)).catch(() => {}); }}><Text style={styles.link}>Choose more</Text></TouchableOpacity>}
        </View>}
        <View style={styles.bar}>
          <Text style={styles.barText}>{selected.size ? `${selected.size} selected` : 'Invite friends to Spud'}</Text>
          {selected.size > 0 && <TouchableOpacity style={[styles.barBtn, styles.barBtnGhost]} onPress={() => setSelected(new Set())} accessibilityRole="button"><Text style={[styles.barBtnText, { color: c.lime }]}>CLEAR</Text></TouchableOpacity>}
          <TouchableOpacity style={styles.barBtn} disabled={!filtered.length} onPress={() => setSelected(s => { const n = new Set(s); filtered.forEach(p => allSelected ? n.delete(p.id) : n.add(p.id)); return n; })} accessibilityRole="button">
            <Text style={styles.barBtnText}>{allSelected ? 'DESELECT ALL' : 'SELECT ALL'}</Text>
          </TouchableOpacity>
        </View>
      </>}
      ListEmptyComponent={status('user-x', query ? 'No contacts match' : 'No contacts to invite', query ? 'Try another name or email.' : 'Contacts need a phone number or email to be invited.')}
      renderItem={({ item }) => {
        const on = selected.has(item.id);
        return (
          <View style={styles.row}>
            <TouchableOpacity style={styles.rowMain} activeOpacity={0.7} onPress={() => toggle(item.id)} accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={`Select ${item.name}`}>
              <View style={[styles.initial, on && { backgroundColor: c.lime }]}>
                {on ? <Feather name="check" size={16} color={c.background} /> : <Text style={styles.initialText}>{initials(item.name)}</Text>}
              </View>
              <Text style={styles.personName} numberOfLines={1}>{item.name}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.invite} onPress={() => compose([item])} accessibilityRole="button" accessibilityLabel={`Invite ${item.name}`}>
              <Text style={styles.inviteText}>INVITE</Text>
            </TouchableOpacity>
          </View>
        );
      }}
    />
  );

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.sheet, { paddingTop: insets.top + 6 }]}>
        <View style={styles.head}>
          <TouchableOpacity onPress={onClose} style={styles.back} accessibilityRole="button" accessibilityLabel="Back"><Feather name="arrow-left" size={22} color={c.lime} /></TouchableOpacity>
          <Text style={styles.title}>Contacts</Text>
          <View style={styles.back} />
        </View>
        <View style={styles.search}>
          <Feather name="search" size={18} color={c.muted} />
          <TextInput style={styles.input} value={query} onChangeText={setQuery} placeholder="Search contacts by name or email" placeholderTextColor={c.muted} autoCorrect={false} autoCapitalize="none" accessibilityLabel="Search contacts by name or email" />
          {!!query && <TouchableOpacity onPress={() => setQuery('')} accessibilityLabel="Clear search"><Feather name="x" size={16} color={c.muted} /></TouchableOpacity>}
        </View>
        <View style={{ flex: 1 }}>{content}</View>
        {picked.length > 0 && phase === 'ready' && (
          <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
            <TouchableOpacity style={styles.continue} onPress={() => compose(picked)} accessibilityRole="button" testID="invite-selected">
              {cfg.isPending ? <ActivityIndicator color={c.background} /> : <Feather name="send" size={17} color={c.background} />}
              <Text style={styles.continueText}>Invite {picked.length} selected</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Modal>
  );
}

function LinkRow({ icon, label, onPress, testID }: { icon: keyof typeof Feather.glyphMap; label: string; onPress: () => void; testID: string }) {
  return (
    <TouchableOpacity style={styles.linkRow} onPress={onPress} accessibilityRole="button" testID={testID}>
      <Feather name={icon} size={19} color={c.lime} />
      <Text style={styles.linkLabel}>{label}</Text>
      <Feather name="chevron-right" size={20} color={c.muted} />
    </TouchableOpacity>
  );
}

/** Two clean rows: device contacts, or the native share sheet. Contacts stay on device. */
export function InviteFriends() {
  const cfg = useGetSocialConfig();
  const [picker, setPicker] = useState(false);
  const { url, body } = inviteBody(cfg.data);
  const share = () => {
    if (!cfg.data || !url) { Alert.alert('Invite link not ready', cfg.isError ? 'The invite link did not load.' : 'Please try again in a moment.'); return; }
    const nativeShare = NativeModules.SpudInviteShare as { share: (url: string, body: string) => Promise<unknown> } | undefined;
    // Expo Go has no app-specific native modules; installed builds use local link metadata.
    const request = Platform.OS === 'ios' && nativeShare
      ? nativeShare.share(url, body)
      : Share.share(Platform.OS === 'ios' ? { message: body, url, title: 'Spud' } : { message: body, title: 'Spud' });
    request.catch(() => Alert.alert('Could not share', 'Please try again.'));
  };
  return (
    <View style={styles.card}>
      <Text style={styles.cardLabel}>BRING YOUR PEOPLE</Text>
      <Text style={styles.cardCopy}>Spud only reads your contacts on this phone when you open Contacts, and never uploads them.</Text>
      <View style={styles.rows}>
        <LinkRow icon="users" label="Contacts" onPress={() => setPicker(true)} testID="invite-contacts" />
        <LinkRow icon="mail" label="Invite via Email or Message" onPress={share} testID="invite-share" />
      </View>
      <ContactPicker visible={picker} onClose={() => setPicker(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: 30 },
  cardLabel: { color: c.lime, fontSize: 12, fontFamily: 'Manrope_700Bold' },
  cardCopy: { color: c.muted, fontSize: 13, lineHeight: 19, fontFamily: 'Manrope_400Regular', marginTop: 6, marginBottom: 12 },
  rows: { borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: c.panelLight },
  linkRow: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: c.panelLight },
  linkLabel: { flex: 1, color: c.text, fontFamily: 'Manrope_600SemiBold', fontSize: 15 },
  sheet: { flex: 1, backgroundColor: c.background },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginBottom: 10 },
  back: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.panel, alignItems: 'center', justifyContent: 'center' },
  title: { color: c.text, fontSize: 17, fontFamily: 'Manrope_700Bold' },
  search: { backgroundColor: c.panel, borderRadius: 22, height: 46, marginHorizontal: 16, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  input: { flex: 1, color: c.text, fontFamily: 'Manrope_500Medium', fontSize: 15 },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, minHeight: 54, backgroundColor: c.panel },
  barText: { flex: 1, color: c.text, fontFamily: 'Manrope_600SemiBold', fontSize: 14 },
  barBtn: { paddingHorizontal: 12, height: 34, borderRadius: 4, backgroundColor: c.lime, alignItems: 'center', justifyContent: 'center' },
  barBtnGhost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: c.panelLight },
  barBtnText: { color: c.background, fontFamily: 'Manrope_700Bold', fontSize: 11, letterSpacing: 0.6 },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64 },
  row: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: c.panelLight },
  initial: { width: 34, height: 34, borderRadius: 17, backgroundColor: c.soft, alignItems: 'center', justifyContent: 'center' },
  initialText: { color: c.background, fontFamily: 'Manrope_700Bold', fontSize: 12 },
  personName: { flex: 1, color: c.text, fontFamily: 'Manrope_500Medium', fontSize: 15 },
  invite: { minWidth: 84, height: 34, borderRadius: 4, backgroundColor: c.panel, flexDirection: 'row', gap: 4, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  inviteOn: { backgroundColor: c.lime },
  inviteText: { color: c.lime, fontFamily: 'Manrope_700Bold', fontSize: 11, letterSpacing: 0.6 },
  status: { alignItems: 'center', backgroundColor: c.panel, borderRadius: 18, padding: 26, gap: 8, margin: 16 },
  statusTitle: { color: c.text, fontFamily: 'Manrope_700Bold', fontSize: 16 },
  statusCopy: { color: c.muted, fontFamily: 'Manrope_400Regular', fontSize: 13, lineHeight: 19, textAlign: 'center' },
  pill: { marginTop: 6, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 30, backgroundColor: c.lime },
  pillText: { color: c.background, fontFamily: 'Manrope_700Bold', fontSize: 13 },
  skelWrap: { gap: 1 },
  skel: { height: 64, backgroundColor: c.panel, opacity: 0.6 },
  limited: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: c.panel, padding: 12 },
  limitedText: { color: c.muted, fontSize: 12, fontFamily: 'Manrope_500Medium' },
  link: { color: c.lime, fontSize: 12, fontFamily: 'Manrope_700Bold' },
  footer: { paddingHorizontal: 16, paddingTop: 10, backgroundColor: c.background, borderTopWidth: StyleSheet.hairlineWidth, borderColor: c.panelLight },
  continue: { height: 50, borderRadius: 25, backgroundColor: c.lime, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  continueText: { color: c.background, fontFamily: 'Manrope_700Bold', fontSize: 15 },
});
