
import { useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';
import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip } from 'recharts';

type EntryRow = {
  id: string;
  user_id: string;
  user_email: string | null;
  goal_ref: number;
  date: string;
  progress_score: number | null;
  q1: string | null;
  q3: string | null;
  highlights: string | null;
  challenges: string | null;
  experiment: string | null;
};

type GoalRow = {
  id: string;
  user_id: string;
  title: string;
  position: number;
  locked: boolean;
};

type FormModel = {
  id: string;
  date: string;
  goalRef: string;
  metricValue: number | null;
  prompt1: string;
  prompt3: string;
  wins: string;
  blockers: string;
  experiment: string;
};

function toISODate(d = new Date()) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
const goalRefToNumber = (ref: string) => Math.max(1, Math.min(3, Number(ref.split(' ')[1]) || 1));

export default function Home() {
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);

  const [goals, setGoals] = useState<string[]>(['','','']);
  const [goalLocked, setGoalLocked] = useState<boolean[]>([false,false,false]);
  const [selectedGoal, setSelectedGoal] = useState<string>('Goal 1');
  const [entries, setEntries] = useState<EntryRow[]>([]);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState<FormModel>({
    id: crypto.randomUUID(),
    date: toISODate(),
    goalRef: 'Goal 1',
    metricValue: null,
    prompt1: '',
    prompt3: '',
    wins: '',
    blockers: '',
    experiment: ''
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, sess) => setSession(sess));
    return () => sub.subscription.unsubscribe();
  }, []);

  const sendMagic = async () => {
    if (!email) return;
    setSending(true);
    await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } });
    setSending(false);
    alert('Magic link sent. Check your email.');
  };

  const signOut = async () => { await supabase.auth.signOut(); };

  useEffect(() => {
    const load = async () => {
      if (!session?.user) return;
      setLoading(true);
      const user_id = session.user.id;

      const { data: goalsData } = await supabase
        .from<GoalRow>('goals')
        .select('*').eq('user_id', user_id).order('position', { ascending: true });

      if (goalsData && goalsData.length) {
        const titles = ['','',''] as string[];
        const locks = [false,false,false] as boolean[];
        goalsData.forEach(g => { titles[g.position-1] = g.title; locks[g.position-1] = g.locked; });
        setGoals(titles); setGoalLocked(locks);
      } else {
        setGoals(['','','']); setGoalLocked([false,false,false]);
      }

      const { data: entryData } = await supabase
        .from<EntryRow>('entries')
        .select('*').eq('user_id', user_id).order('date',{ascending:true});
      setEntries(entryData || []);
      setLoading(false);
    };
    load();
  }, [session]);

  const confirmGoal = async (i: number) => {
    if (!session?.user) return;
    const title = goals[i]; if (!title?.trim()) return;
    const payload = { user_id: session.user.id, title, position: i+1, locked: true } as Partial<GoalRow>;
    await supabase.from('goals').upsert(payload, { onConflict: 'user_id,position' });
    const next = [...goalLocked]; next[i] = true; setGoalLocked(next);
  };

  const unlockGoal = async (i: number) => {
    if (!session?.user) return;
    if (!confirm('Edit this goal?')) return;
    await supabase.from('goals').upsert({ user_id: session.user.id, title: goals[i] || '', position: i+1, locked: false }, { onConflict: 'user_id,position' });
    const next = [...goalLocked]; next[i] = false; setGoalLocked(next);
  };

  const addEntry = async () => {
    if (!session?.user) { alert('Please sign in first.'); return; }
    if (!form.prompt1 && !form.prompt3 && form.metricValue == null) return;
    const user_id = session.user.id;
    const user_email = session.user.email ?? null;
    const goal_ref = goalRefToNumber(form.goalRef);

    const row: Omit<EntryRow,'id'> = {
      user_id, user_email, goal_ref,
      date: form.date,
      progress_score: form.metricValue,
      q1: form.prompt1 || null,
      q3: form.prompt3 || null,
      highlights: form.wins || null,
      challenges: form.blockers || null,
      experiment: form.experiment || null
    };
    const { data, error } = await supabase.from('entries').insert(row).select('*').single();
    if (error) { alert('Error saving entry'); return; }
    setEntries(prev => [...prev, data as EntryRow]);
    setForm({ id: crypto.randomUUID(), date: toISODate(), goalRef: selectedGoal, metricValue: null, prompt1:'', prompt3:'', wins:'', blockers:'', experiment:'' });
  };

  const confirmedGoalOptions = [0,1,2]
    .filter(i => goalLocked[i])
    .map(i => {
      const title = goals[i];
      const preview = title ? ` (${title.slice(0,20)}${title.length>20?'…':''})` : '';
      return { label: `Goal ${i+1}${preview}`, value: `Goal ${i+1}` };
    });

  const chartData = useMemo(() => {
    const ref = goalRefToNumber(selectedGoal);
    return entries.filter(e => e.goal_ref === ref)
      .sort((a,b) => a.date.localeCompare(b.date))
      .map(e => ({ date: e.date, value: e.progress_score ?? null }));
  }, [entries, selectedGoal]);

  if (!session) {
    return (
      <div className="container">
        <div className="card" style={{ maxWidth: 520, margin: '60px auto' }}>
          <div className="title" style={{ textAlign: 'center' }}>BrightChirp Client Portal</div>
          <p className="muted" style={{ textAlign: 'center' }}>Sign in with your email. We’ll send a one-time magic link.</p>
          <label>Email</label>
          <input type="email" placeholder="you@company.com" value={email} onChange={e=>setEmail(e.target.value)} />
          <div style={{ height: 12 }} />
          <button onClick={sendMagic} disabled={!email || sending}>{sending ? 'Sending…' : 'Send magic link'}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="header">
        <div className="title">Weekly Reflection Tracker</div>
        <div>
          <span className="muted" style={{ marginRight: 12 }}>{session.user.email}</span>
          <button className="secondary" onClick={signOut}>Sign out</button>
        </div>
      </div>

      <div className="card">
        <div className="section-title">Development Goals</div>
        {[0,1,2].map(i => (
          <div key={i} className="grid" style={{ gap: 10, marginBottom: 8 }}>
            <div>
              <label>{`Goal ${i+1}`}</label>
              <input
                type="text"
                placeholder={`Enter development goal ${i+1}`}
                value={goals[i]}
                disabled={goalLocked[i]}
                onChange={e => { const next=[...goals]; next[i]=e.target.value; setGoals(next); }}
              />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {!goalLocked[i] ? (
                <button onClick={()=>confirmGoal(i)} disabled={!goals[i]}>Confirm</button>
              ) : (
                <button className="secondary" onClick={()=>unlockGoal(i)}>Edit</button>
              )}
            </div>
          </div>
        ))}
        <div className="help">Confirm each goal to lock it. Locked goals appear in the Progress Tracking menu with a short preview.</div>
      </div>

      <div style={{ height: 16 }} />

      <div className="card">
        <div className="grid grid-3">
          <div>
            <label>Date</label>
            <input type="date" value={form.date} onChange={e=>setForm({ ...form, date: e.target.value })} />
          </div>
          <div>
            <label>Progress Tracking</label>
            <select value={selectedGoal} onChange={e=>{ setSelectedGoal(e.target.value); setForm({ ...form, goalRef: e.target.value })}} disabled={confirmedGoalOptions.length===0}>
              {confirmedGoalOptions.length===0 ? <option value="">Confirm a goal above first</option> : null}
              {confirmedGoalOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>
          <div>
            <label>Progress Score (1–10)</label>
            <input type="number" min={1} max={10} placeholder="1–10" value={form.metricValue ?? ''} onChange={e=>setForm({ ...form, metricValue: e.target.value === '' ? null : Number(e.target.value) })} />
          </div>
        </div>

        <div style={{ height: 12 }} />

        <div>
          <label>What progress or momentum did you notice this week?</label>
          <textarea rows={3} value={form.prompt1} onChange={e=>setForm({ ...form, prompt1: e.target.value })} />
        </div>

        <div style={{ height: 8 }} />

        <div>
          <label>What feedback did you receive indicating how you might be tracking toward your goals?</label>
          <textarea rows={3} value={form.prompt3} onChange={e=>setForm({ ...form, prompt3: e.target.value })} />
        </div>

        <div style={{ height: 8 }} />

        <div className="grid">
          <div>
            <label>Highlights from my week were...</label>
            <textarea rows={2} value={form.wins} onChange={e=>setForm({ ...form, wins: e.target.value })} />
          </div>
          <div>
            <label>Challenges this week included...</label>
            <textarea rows={2} value={form.blockers} onChange={e=>setForm({ ...form, blockers: e.target.value })} />
          </div>
          <div>
            <label>One small experiment I want to try next week is...</label>
            <textarea rows={2} value={form.experiment} onChange={e=>setForm({ ...form, experiment: e.target.value })} />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
          <button onClick={addEntry} disabled={loading}>Save Reflection</button>
        </div>
      </div>

      <div style={{ height: 16 }} />

      <div className="card">
        <div className="section-title">{selectedGoal} Progress Trend</div>
        <div className="chart">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis domain={[0,10]} allowDecimals={false} />
              <Tooltip />
              <Line type="monotone" dataKey="value" dot />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
