import { useState } from 'react';
import { LayoutAnimation, Linking, Platform, StyleSheet, Text, TouchableOpacity, UIManager, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Brand } from '@/lib/config';

/**
 * Everything below the service grid on the customer home: how Fixo works, how to
 * describe a job well, why it's worth using (for customers AND pros), FAQs and a
 * closing CTA. Pure static content — mirrors the web home so both feel like one product.
 */

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const STEPS: { t: string; d: string }[] = [
  { t: 'Describe the job', d: 'Pick a service and tell us what’s wrong — type it, add a photo, or record a voice note in your own language.' },
  { t: 'Pros bid for it', d: 'Verified professionals nearby send you their price. No phone calls, no bargaining at your door.' },
  { t: 'You pick one', d: 'Compare price, rating and distance. Accept the bid that suits you — or counter with your own price.' },
  { t: 'Track & pay after', d: 'Watch them arrive on live GPS. Pay only once the work is done — cash or online.' },
];

const FOR_CUSTOMER: { icon: keyof typeof Ionicons.glyphMap; t: string; d: string }[] = [
  { icon: 'shield-checkmark', t: 'Every pro is verified', d: 'Aadhaar checked for duplicates, then a real verification call before their first job.' },
  { icon: 'pricetag', t: 'You set the price', d: 'Compare bids side by side or send a counter-offer. No fixed rate card working against you.' },
  { icon: 'location', t: 'Live tracking', d: 'See exactly where your professional is and when they’ll reach you.' },
  { icon: 'wallet', t: 'Pay after the work', d: 'Cash or online, only once you’re satisfied with the job.' },
];

const FOR_PRO: { icon: keyof typeof Ionicons.glyphMap; t: string; d: string }[] = [
  { icon: 'trending-up', t: 'Quote your own rate', d: 'You see the job first, then decide your price. Nobody sets it for you.' },
  { icon: 'time', t: 'Work when you want', d: 'Go online and offline whenever it suits you. No shifts, no penalties.' },
  { icon: 'card', t: 'Fast payouts', d: 'Earnings land in your Fixo wallet — withdraw straight to your bank.' },
  { icon: 'star', t: 'Build a public rating', d: 'Good work shows up as stars and repeat customers who ask for you by name.' },
];

// Qualitative trust points — no invented counts. Swap for real figures when you have them.
const TRUST: { t: string; d: string }[] = [
  { t: 'Aadhaar + call verified', d: 'Every pro, before their first job' },
  { t: 'Live GPS tracking', d: 'From accepted bid to job done' },
  { t: 'Pay after service', d: 'Cash or online, your choice' },
  { t: 'Rated by customers', d: 'Public ratings on every pro' },
];

const FAQS: { q: string; a: string }[] = [
  { q: 'How is the price decided?', a: 'You describe the job, and nearby professionals send you their bids. Compare them on price, rating and distance, then accept the one you want — or send a counter-offer. Nothing is charged until you accept a bid.' },
  { q: 'Who are these professionals? Are they safe?', a: 'Every professional uploads their Aadhaar, which we check for duplicate accounts, and then our team speaks to them on a verification call before their account is activated. You also see their rating and completed job count before you accept a bid.' },
  { q: 'What if I don’t know how to describe the problem?', a: 'Just record a voice note in Hindi or your own language — no typing needed. You can also add a photo, and the professional can message you before bidding if they need more detail.' },
  { q: 'When and how do I pay?', a: 'After the work is finished. You can pay in cash or online, and the amount is exactly the bid you accepted unless you agreed to extra work.' },
  { q: 'What if the work isn’t done properly?', a: 'Raise a ticket from your booking screen and our support team steps in. Ratings are public, so professionals have a real reason to get it right the first time.' },
  { q: 'Can I cancel after accepting a bid?', a: 'Yes. Cancel from your bookings screen — you’re only charged if the professional has already started the work.' },
];

const PROMPTS = ['What is broken?', 'Which room?', 'Since when?', 'Brand or model', 'When do you need it?'];

function Head({ eyebrow, title, sub }: { eyebrow: string; title: string; sub?: string }) {
  return (
    <View style={s.head}>
      <Text style={s.eyebrow}>{eyebrow.toUpperCase()}</Text>
      <Text style={s.h2}>{title}</Text>
      {sub ? <Text style={s.sub}>{sub}</Text> : null}
    </View>
  );
}

function Faq({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={s.faq}>
      <TouchableOpacity
        style={s.faqQRow}
        activeOpacity={0.7}
        onPress={() => {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          setOpen((o) => !o);
        }}
      >
        <Text style={s.faqQ}>{q}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={17} color={Brand.orange} />
      </TouchableOpacity>
      {open ? <Text style={s.faqA}>{a}</Text> : null}
    </View>
  );
}

export default function HomeStory() {
  return (
    <View style={s.root}>
      {/* ── How it works ── */}
      <Head
        eyebrow="How Fixo works"
        title="Four steps, no haggling at your door."
        sub="You stay in control of the price from the first tap to the last rupee."
      />
      <View style={s.stack}>
        {STEPS.map((step, i) => (
          <View key={step.t} style={s.step}>
            <Text style={s.stepNum}>{String(i + 1).padStart(2, '0')}</Text>
            <View style={s.flex1}>
              <Text style={s.stepT}>{step.t}</Text>
              <Text style={s.stepD}>{step.d}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* ── Describe helper ── */}
      <Head
        eyebrow="Getting a good price"
        title="What should you actually write?"
        sub="The better you describe the problem, the more accurate the bids — and the fewer surprises when the pro arrives."
      />
      <View style={[s.card, s.cardBad]}>
        <View style={[s.tag, s.tagBad]}>
          <Ionicons name="close-circle" size={12} color="#b91c1c" />
          <Text style={[s.tagT, { color: '#b91c1c' }]}>TOO VAGUE</Text>
        </View>
        <Text style={s.quote}>“Tap kharab hai”</Text>
        <Text style={s.cardD}>
          Pros can’t tell what part is broken, how urgent it is, or what tools to bring — so they bid high to cover the
          unknown, or skip your request entirely.
        </Text>
      </View>
      <View style={[s.card, s.cardGood]}>
        <View style={[s.tag, s.tagGood]}>
          <Ionicons name="checkmark-circle" size={12} color="#047857" />
          <Text style={[s.tagT, { color: '#047857' }]}>GETS REAL BIDS</Text>
        </View>
        <Text style={s.quote}>
          “Kitchen tap leaking from the base since 2 days. Steel tap, 2nd floor. Need it fixed today evening.”
        </Text>
        <Text style={s.cardD}>
          Says what, where, since when, and by when. Pros can quote confidently and arrive with the right parts.
        </Text>
      </View>
      <View style={s.chips}>
        {PROMPTS.map((p) => (
          <View key={p} style={s.chip}><Text style={s.chipT}>{p}</Text></View>
        ))}
        <View style={[s.chip, s.chipAccent]}>
          <Ionicons name="mic" size={11} color={Brand.orange} />
          <Text style={[s.chipT, { color: Brand.orange, fontWeight: '800' }]}>Or record a voice note</Text>
        </View>
      </View>

      {/* ── Why Fixo — customers ── */}
      <Head eyebrow="Why Fixo" title="Built for both sides of the job." />
      <View style={s.card}>
        <Text style={s.cardH}>For your home</Text>
        <Text style={s.cardSub}>The person who walks into your house is someone we have personally verified.</Text>
        <View style={s.list}>
          {FOR_CUSTOMER.map((it) => (
            <View key={it.t} style={s.listRow}>
              <Ionicons name={it.icon} size={18} color={Brand.success} style={s.listIcon} />
              <View style={s.flex1}>
                <Text style={s.listT}>{it.t}</Text>
                <Text style={s.listD}>{it.d}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* ── Why Fixo — professionals ── */}
      <LinearGradient colors={[Brand.navy, '#1b2c56']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[s.card, s.cardPro]}>
        <Text style={[s.cardH, { color: Brand.white }]}>For professionals</Text>
        <Text style={[s.cardSub, { color: 'rgba(255,255,255,0.72)' }]}>
          Bring your skill. We’ll bring the customers — and you decide what the work is worth.
        </Text>
        <View style={s.list}>
          {FOR_PRO.map((it) => (
            <View key={it.t} style={s.listRow}>
              <Ionicons name={it.icon} size={18} color="#34d399" style={s.listIcon} />
              <View style={s.flex1}>
                <Text style={[s.listT, { color: Brand.white }]}>{it.t}</Text>
                <Text style={[s.listD, { color: 'rgba(255,255,255,0.68)' }]}>{it.d}</Text>
              </View>
            </View>
          ))}
        </View>
        <TouchableOpacity
          style={s.proBtn}
          activeOpacity={0.85}
          onPress={() => Linking.openURL('https://fixoworker.vercel.app')}
        >
          <Text style={s.proBtnT}>Join as a professional</Text>
          <Ionicons name="arrow-forward" size={14} color={Brand.navy} />
        </TouchableOpacity>
      </LinearGradient>

      {/* ── Trust strip ── */}
      <View style={s.trustWrap}>
        {TRUST.map((t) => (
          <View key={t.t} style={s.trust}>
            <Text style={s.trustT}>{t.t}</Text>
            <Text style={s.trustD}>{t.d}</Text>
          </View>
        ))}
      </View>

      {/* ── FAQ ── */}
      <Head eyebrow="Questions" title="Everything people ask before their first booking." />
      <View style={s.stack}>
        {FAQS.map((f) => <Faq key={f.q} q={f.q} a={f.a} />)}
      </View>

      {/* ── Closing note ── */}
      <LinearGradient colors={[Brand.navy, '#1b2c56']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.cta}>
        <Text style={s.ctaH}>Something broken at home?</Text>
        <Text style={s.ctaP}>Describe it in one line. Get real bids from verified pros in your area.</Text>
      </LinearGradient>
    </View>
  );
}

const s = StyleSheet.create({
  root: { marginTop: 30, paddingBottom: 8 },
  flex1: { flex: 1 },

  head: { marginTop: 28, marginBottom: 14 },
  eyebrow: { fontSize: 10.5, fontWeight: '800', letterSpacing: 1.4, color: Brand.textLight },
  h2: { marginTop: 6, fontSize: 21, fontWeight: '800', color: Brand.text, letterSpacing: -0.4, lineHeight: 27 },
  sub: { marginTop: 7, fontSize: 13.5, lineHeight: 20, color: Brand.textMuted },

  stack: { gap: 10 },

  step: { flexDirection: 'row', gap: 14, backgroundColor: Brand.card, borderRadius: 16, borderWidth: 1, borderColor: Brand.border, padding: 16 },
  stepNum: { fontSize: 13, fontWeight: '800', color: Brand.orange, letterSpacing: 0.5, marginTop: 1 },
  stepT: { fontSize: 15, fontWeight: '800', color: Brand.text },
  stepD: { marginTop: 4, fontSize: 13, lineHeight: 19, color: Brand.textMuted },

  card: { backgroundColor: Brand.card, borderRadius: 18, borderWidth: 1, borderColor: Brand.border, padding: 18, marginBottom: 12 },
  cardBad: { borderColor: '#fecaca' },
  cardGood: { borderColor: '#a7f3d0' },
  cardPro: { borderColor: 'transparent' },
  cardH: { fontSize: 19, fontWeight: '800', color: Brand.text },
  cardSub: { marginTop: 6, fontSize: 13.5, lineHeight: 20, color: Brand.textMuted },
  cardD: { marginTop: 12, fontSize: 13, lineHeight: 19.5, color: Brand.textMuted },

  tag: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  tagBad: { backgroundColor: '#fee2e2' },
  tagGood: { backgroundColor: '#d1fae5' },
  tagT: { fontSize: 9.5, fontWeight: '900', letterSpacing: 0.9 },
  quote: { marginTop: 12, backgroundColor: Brand.bg, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, lineHeight: 22, fontWeight: '600', color: Brand.text },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 2, marginBottom: 4 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: Brand.card, borderWidth: 1, borderColor: Brand.border, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  chipAccent: { borderColor: '#fed7aa', backgroundColor: '#fff7ed' },
  chipT: { fontSize: 12, fontWeight: '700', color: Brand.textMuted },

  list: { marginTop: 16, gap: 14 },
  listRow: { flexDirection: 'row', gap: 12 },
  listIcon: { marginTop: 2 },
  listT: { fontSize: 14, fontWeight: '800', color: Brand.text },
  listD: { marginTop: 2, fontSize: 12.5, lineHeight: 18.5, color: Brand.textMuted },

  proBtn: { marginTop: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Brand.white, borderRadius: 12, paddingVertical: 13 },
  proBtnT: { fontSize: 13.5, fontWeight: '800', color: Brand.navy },

  trustWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 },
  trust: { flexGrow: 1, flexBasis: '46%', backgroundColor: Brand.card, borderWidth: 1, borderColor: Brand.border, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 12, alignItems: 'center' },
  trustT: { fontSize: 13, fontWeight: '800', color: Brand.text, textAlign: 'center' },
  trustD: { marginTop: 3, fontSize: 11, color: Brand.textLight, textAlign: 'center' },

  faq: { backgroundColor: Brand.card, borderRadius: 14, borderWidth: 1, borderColor: Brand.border, paddingHorizontal: 16, overflow: 'hidden' },
  faqQRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 15 },
  faqQ: { flex: 1, fontSize: 13.5, fontWeight: '800', color: Brand.text, lineHeight: 19 },
  faqA: { paddingBottom: 15, fontSize: 13, lineHeight: 19.5, color: Brand.textMuted },

  cta: { marginTop: 28, borderRadius: 20, paddingVertical: 32, paddingHorizontal: 22, alignItems: 'center' },
  ctaH: { fontSize: 20, fontWeight: '800', color: Brand.white, textAlign: 'center', letterSpacing: -0.3 },
  ctaP: { marginTop: 9, fontSize: 13.5, lineHeight: 20, color: 'rgba(255,255,255,0.75)', textAlign: 'center' },
});
