// utils/matching.js
import { supabase } from '../supabaseClient';

/** kleine Helfer */
const arr = (v) => (Array.isArray(v) ? v.filter(Boolean) : v != null && v !== '' ? [v] : []);
const lc  = (s) => (typeof s === 'string' ? s.toLowerCase() : s);

/**
 * Match-Score Berechnung – tolerant für Array/String-Felder
 */
export function calculateMatchScore(user, job, filters = {}) {
  let score = 0;

  // Beschäftigungsart (job.employment_type kann String ODER Array sein)
  if (!filters.types?.length) {
    score++;
  } else {
    const jobTypes = arr(job?.employment_type);
    if (jobTypes.some((t) => filters.types.includes(t))) score++;
  }

  // Skills-Matching (beide Seiten können Array/String sein)
  const userSkills = arr(user?.skills);
  const jobSkills  = arr(job?.skills);
  if (userSkills.length && jobSkills.length) {
    const matched = jobSkills.filter((s) => userSkills.includes(s));
    if (matched.length > 0) score++;
  }

  // Entfernung
  if (
    job?.distance_km !== undefined &&
    filters?.radius !== undefined &&
    job.distance_km <= filters.radius
  ) {
    score++;
  }

  // Sprache (job.language kann Array/String/leer sein)
  if (!filters.language) {
    score++;
  } else {
    const langs = arr(job?.language).map((l) => lc(l));
    if (langs.includes(lc(filters.language))) score++;
  }

  // Branche
  if (!filters.industry) {
    score++;
  } else if (lc(job?.industry) === lc(filters.industry)) {
    score++;
  }

  // Sofort verfügbar
  if (filters.availableNow === true && job?.available_now === true) {
    score++;
  }

  // Gehaltswunsch
  if (
    user?.desired_salary != null &&
    job?.salary_min != null &&
    job?.salary_max != null &&
    user.desired_salary >= job.salary_min &&
    user.desired_salary <= job.salary_max
  ) {
    score++;
  }

  return score;
}

/**
 * Preislogik je nach Tarif & Monatszähler
 */
function computeEmployerPrice(plan, monthlyUnlockedCount) {
  if (plan === 'platinum') return 0;
  if (plan === 'premium') {
    // 0 € für die ersten 10 Freischaltungen pro Monat
    return monthlyUnlockedCount < 10 ? 0 : 29;
  }
  return 49.99; // free-Plan
}

/**
 * Arbeitgeber swipt als Zweiter → ggf. direkt zahlen/freischalten
 */
export async function handleEmployerSecondSwipe({ employerId, matchId, navigation }) {
  // Tarif laden
  const { data: planData, error: planErr } = await supabase
    .from('profiles')
    .select('plan')
    .eq('id', employerId)
    .single();
  if (planErr) console.warn('plan load error', planErr);
  const plan = planData?.plan || 'free';

  // Anzahl Freischaltungen in diesem Monat (korrekt: count aus Response nehmen)
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const { count, error: cntErr } = await supabase
    .from('matches')
    .select('id', { count: 'exact', head: true })
    .eq('employer_unlocked', true)
    .eq('employer_id', employerId)
    .gte('employer_unlocked_at', monthStart.toISOString());

  if (cntErr) console.warn('count error', cntErr);
  const monthlyUnlockedCount = count ?? 0;

  // Preis bestimmen
  const price = computeEmployerPrice(plan, monthlyUnlockedCount);

  if (price === 0) {
    // kostenlos freischalten
    const { error: upErr } = await supabase
      .from('matches')
      .update({
        employer_unlocked: true,
        employer_unlocked_at: new Date().toISOString(),
        employer_payment_status: 'free',
        employer_price_charged: 0
      })
      .eq('id', matchId);

    if (upErr) {
      console.error('unlock update error', upErr);
      return { unlocked: false, price: 0, error: upErr.message };
    }

    const { error: payErr } = await supabase.from('match_payments').insert({
      match_id: matchId,
      employer_id: employerId,
      amount: 0,
      status: 'free'
    });

    if (payErr) console.warn('log payment error', payErr);

    return { unlocked: true, price: 0 };
  }

  // Zahlung nötig → weiterleiten
  navigation?.navigate?.('PaymentScreen', {
    matchId,
    amount: price,
    plan
  });

  return { unlocked: false, price };
}
