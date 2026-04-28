'use client';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useParams, useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import Link from 'next/link';
import {
  ArrowLeft, Phone, Mail, MapPin, Building2, DollarSign,
  MessageCircle, Star, Clock, Edit, Save, X, Loader2,
  Calendar, Activity, Lightbulb, User, CheckCircle
} from 'lucide-react';
import { format, formatDistanceToNow, isPast } from 'date-fns';
import { clsx } from 'clsx';

interface Lead {
  _id: string; name: string; email: string; phone: string;
  propertyInterest: string; location: string; budget: number;
  status: string; priority: string; score: number; source: string; notes: string;
  assignedTo?: { _id: string; name: string; email: string } | null;
  followUpDate?: string; createdAt: string; updatedAt: string; lastActivityAt: string;
}

interface ActivityItem {
  _id: string; type: string; description: string;
  performedBy: { name: string; role: string };
  createdAt: string; metadata?: Record<string, string>;
}

interface Suggestion {
  urgency: string; recommendedDate: string;
  suggestions: string[]; estimatedConversionChance: string; messageTemplate: string;
}

interface EditForm {
  status?: string;
  notes?: string;
  followUpDate?: string;
  assignedTo?: string;
}

const ACTIVITY_ICONS: Record<string, { icon: string; color: string }> = {
  created: { icon: '✨', color: 'bg-blue-500/20 border-blue-500/30' },
  status_updated: { icon: '🔄', color: 'bg-purple-500/20 border-purple-500/30' },
  assigned: { icon: '👤', color: 'bg-green-500/20 border-green-500/30' },
  reassigned: { icon: '🔀', color: 'bg-amber-500/20 border-amber-500/30' },
  notes_updated: { icon: '📝', color: 'bg-slate-500/20 border-slate-500/30' },
  follow_up_set: { icon: '📅', color: 'bg-cyan-500/20 border-cyan-500/30' },
  priority_changed: { icon: '⭐', color: 'bg-orange-500/20 border-orange-500/30' },
  contacted: { icon: '📞', color: 'bg-emerald-500/20 border-emerald-500/30' },
};

const STATUSES = ['New', 'Contacted', 'In Progress', 'Negotiation', 'Closed', 'Lost'];
const STATUS_COLORS: Record<string, string> = {
  New: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
  Contacted: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
  'In Progress': 'bg-purple-500/15 text-purple-400 border-purple-500/20',
  Negotiation: 'bg-orange-500/15 text-orange-400 border-orange-500/20',
  Closed: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  Lost: 'bg-red-500/15 text-red-400 border-red-500/20',
};

export default function LeadDetailPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const { data: session } = useSession();
  const user = session?.user as { role?: string; name?: string } | undefined;
  const isAdmin = user?.role === 'admin';

  const [lead, setLead] = useState<Lead | null>(null);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [agents, setAgents] = useState<{ _id: string; name: string }[]>([]);
  const [showSuggestion, setShowSuggestion] = useState(false);
  const [editForm, setEditForm] = useState<EditForm>({});

  useEffect(() => {
    Promise.all([
      fetch(`/api/leads/${id}`).then(r => r.json()),
      fetch(`/api/leads/${id}/activities`).then(r => r.json()),
    ]).then(([leadData, actData]) => {
      if (leadData.lead) {
        setLead(leadData.lead);
        setEditForm({
          status: leadData.lead.status,
          notes: leadData.lead.notes,
          followUpDate: leadData.lead.followUpDate ? new Date(leadData.lead.followUpDate).toISOString().split('T')[0] : '',
          assignedTo: leadData.lead.assignedTo?._id || '',
        });
      }
      setActivities(actData.activities || []);
      setLoading(false);
    }).catch(() => setLoading(false));

    if (isAdmin) {
      fetch('/api/agents').then(r => r.json()).then(d => setAgents(d.agents || []));
    }
  }, [id, isAdmin]);

  const fetchSuggestion = async () => {
    const res = await fetch(`/api/leads/${id}/suggest`);
    const data = await res.json();
    if (data.suggestion) { setSuggestion(data.suggestion); setShowSuggestion(true); }
  };

  const saveChanges = async () => {
    setSaving(true);
    try {
      const body: Record<string, unknown> = { ...editForm };
      if (editForm.assignedTo !== undefined) body.assignedTo = editForm.assignedTo || null;
      if (editForm.followUpDate !== undefined) body.followUpDate = editForm.followUpDate || null;

      const res = await fetch(`/api/leads/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setLead(data.lead);
      setEditMode(false);
      toast.success('Lead updated!');
      const actRes = await fetch(`/api/leads/${id}/activities`);
      const actData = await actRes.json();
      setActivities(actData.activities || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="w-6 h-6 animate-spin text-brand-400" />
    </div>
  );

  if (!lead) return (
    <div className="text-center py-20">
      <p className="text-slate-400">Lead not found</p>
      <Link href="/leads" className="btn-primary mt-4 inline-flex mx-auto">Back to Leads</Link>
    </div>
  );

  const waLink = `https://wa.me/${lead.phone.replace(/\D/g, '')}`;
  const overdueFollowUp = lead.followUpDate && isPast(new Date(lead.followUpDate)) && !['Closed', 'Lost'].includes(lead.status);

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <Link href="/leads" className="text-slate-400 hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h1 className="page-title">{lead.name}</h1>
          <p className="page-subtitle">Added {formatDistanceToNow(new Date(lead.createdAt), { addSuffix: true })} via {lead.source}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <a href={waLink} target="_blank" rel="noopener noreferrer"
            className="btn-secondary bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20">
            <MessageCircle className="w-4 h-4" /> WhatsApp
          </a>
          <button onClick={fetchSuggestion} className="btn-secondary">
            <Lightbulb className="w-4 h-4 text-yellow-400" /> AI Suggest
          </button>
          {!editMode ? (
            <button onClick={() => setEditMode(true)} className="btn-primary">
              <Edit className="w-4 h-4" /> Edit
            </button>
          ) : (
            <>
              <button onClick={() => setEditMode(false)} className="btn-secondary">
                <X className="w-4 h-4" /> Cancel
              </button>
              <button onClick={saveChanges} disabled={saving} className="btn-primary">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save
              </button>
            </>
          )}
        </div>
      </div>

      {/* Overdue warning */}
      {overdueFollowUp && (
        <div className="flex items-center gap-3 p-3.5 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
          <Clock className="w-4 h-4 flex-shrink-0" />
          <span>Follow-up was due {formatDistanceToNow(new Date(lead.followUpDate!), { addSuffix: true })}. Please take action now.</span>
        </div>
      )}

      {/* AI Suggestion panel */}
      {showSuggestion && suggestion && (
        <div className="card border border-yellow-500/20 bg-yellow-500/5 animate-slide-up">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-yellow-400 flex-shrink-0" />
              <h3 className="font-semibold text-yellow-400">AI Follow-up Suggestion</h3>
              <span className={clsx('text-xs px-2 py-0.5 rounded-full font-semibold border',
                suggestion.urgency === 'high' ? 'bg-red-500/15 text-red-400 border-red-500/20' :
                suggestion.urgency === 'medium' ? 'bg-amber-500/15 text-amber-400 border-amber-500/20' :
                'bg-emerald-500/15 text-emerald-400 border-emerald-500/20'
              )}>
                {suggestion.urgency.toUpperCase()} urgency
              </span>
            </div>
            <button onClick={() => setShowSuggestion(false)} className="text-slate-500 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="mt-3 space-y-2">
            {suggestion.suggestions.map((s, i) => (
              <div key={i} className="flex gap-2 text-sm text-slate-300">
                <CheckCircle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                {s}
              </div>
            ))}
          </div>
          <div className="mt-3 p-3 bg-slate-900/60 rounded-lg">
            <p className="text-xs text-slate-500 mb-1.5 font-medium uppercase tracking-wider">Suggested Message Template</p>
            <pre className="text-sm text-slate-300 whitespace-pre-wrap font-body">{suggestion.messageTemplate}</pre>
          </div>
          <div className="flex gap-4 mt-3 text-xs text-slate-500">
            <span>Recommended follow-up: <strong className="text-slate-300">{format(new Date(suggestion.recommendedDate), 'MMM d, yyyy')}</strong></span>
            <span>Conversion chance: <strong className="text-yellow-400">{suggestion.estimatedConversionChance}</strong></span>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-5">
        {/* Left — Lead info */}
        <div className="lg:col-span-2 space-y-4">
          {/* Details card */}
          <div className="card space-y-4">
            <h3 className="font-semibold text-white flex items-center gap-2">
              <Building2 className="w-4 h-4 text-brand-400" /> Lead Details
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <Info label="Email" value={<a href={`mailto:${lead.email}`} className="text-brand-400 hover:underline">{lead.email}</a>} />
              <Info label="Phone" value={<a href={waLink} target="_blank" className="text-emerald-400 hover:underline">{lead.phone}</a>} />
              <Info label="Location" value={lead.location} />
              <Info label="Property Interest" value={lead.propertyInterest} />
              <Info label="Budget" value={<span className="text-brand-400 font-bold text-base">PKR {(lead.budget / 1_000_000).toFixed(2)}M</span>} />
              <Info label="Source" value={lead.source} />
              <Info label="Score" value={
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-slate-700 rounded-full h-2 max-w-24">
                    <div className="h-2 rounded-full" style={{ width: `${lead.score}%`, background: lead.priority === 'High' ? '#ef4444' : lead.priority === 'Medium' ? '#f59e0b' : '#10b981' }} />
                  </div>
                  <span className="font-semibold">{lead.score}/100</span>
                </div>
              } />
              <Info label="Priority" value={
                <span className={clsx(lead.priority === 'High' ? 'badge-high' : lead.priority === 'Medium' ? 'badge-medium' : 'badge-low')}>
                  <Star className="w-3 h-3" /> {lead.priority}
                </span>
              } />
            </div>
          </div>

          {/* Edit form */}
          {editMode && (
            <div className="card border border-brand-500/20 animate-slide-up space-y-4">
              <h3 className="font-semibold text-white">Edit Lead</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Status</label>
                  <select value={editForm.status} onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))} className="input">
                    {STATUSES.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                {isAdmin && (
                  <div>
                    <label className="label">Assign to Agent</label>
                    <select value={editForm.assignedTo || ''} onChange={e => setEditForm(f => ({ ...f, assignedTo: e.target.value }))} className="input">
                      <option value="">— Unassigned —</option>
                      {agents.map(a => <option key={a._id} value={a._id}>{a.name}</option>)}
                    </select>
                  </div>
                )}
                <div className="col-span-2">
                  <label className="label">Follow-up Date</label>
                  <input type="date" value={editForm.followUpDate || ''} onChange={e => setEditForm(f => ({ ...f, followUpDate: e.target.value }))} className="input" />
                </div>
                <div className="col-span-2">
                  <label className="label">Notes</label>
                  <textarea value={editForm.notes || ''} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
                    className="input resize-none min-h-24" />
                </div>
              </div>
            </div>
          )}

          {/* Notes display */}
          {!editMode && lead.notes && (
            <div className="card">
              <h3 className="font-semibold text-white mb-2 flex items-center gap-2">
                <Activity className="w-4 h-4 text-brand-400" /> Notes
              </h3>
              <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">{lead.notes}</p>
            </div>
          )}
        </div>

        {/* Right — Status + Timeline */}
        <div className="space-y-4">
          {/* Quick status */}
          <div className="card">
            <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-brand-400" /> Current Status
            </h3>
            <span className={clsx('status-badge border text-sm font-semibold px-3 py-1.5', STATUS_COLORS[lead.status])}>
              {lead.status}
            </span>
            {lead.assignedTo && (
              <div className="mt-3 flex items-center gap-2 text-sm text-slate-400">
                <User className="w-4 h-4" />
                <span>Assigned to <strong className="text-slate-200">{lead.assignedTo.name}</strong></span>
              </div>
            )}
            {lead.followUpDate && (
              <div className={clsx('mt-2 flex items-center gap-2 text-sm',
                overdueFollowUp ? 'text-red-400' : 'text-slate-400')}>
                <Calendar className="w-4 h-4" />
                Follow-up: <strong>{format(new Date(lead.followUpDate), 'MMM d, yyyy')}</strong>
              </div>
            )}
          </div>

          {/* Activity timeline */}
          <div className="card">
            <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
              <Clock className="w-4 h-4 text-brand-400" /> Activity Timeline
            </h3>
            {activities.length === 0 ? (
              <p className="text-slate-500 text-sm text-center py-6">No activities yet</p>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                {activities.map((act, i) => {
                  const style = ACTIVITY_ICONS[act.type] || { icon: '•', color: 'bg-slate-500/20 border-slate-500/30' };
                  return (
                    <div key={act._id} className="flex gap-3 relative">
                      {i < activities.length - 1 && (
                        <div className="absolute left-4 top-8 bottom-0 w-px bg-white/5" />
                      )}
                      <div className={clsx('w-8 h-8 rounded-lg border flex items-center justify-center text-sm flex-shrink-0 z-10', style.color)}>
                        {style.icon}
                      </div>
                      <div className="flex-1 min-w-0 pb-3">
                        <p className="text-sm text-slate-300 leading-snug">{act.description}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-slate-500">{act.performedBy?.name}</span>
                          <span className="text-xs text-slate-600">·</span>
                          <span className="text-xs text-slate-600">
                            {formatDistanceToNow(new Date(act.createdAt), { addSuffix: true })}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">{label}</p>
      <div className="text-slate-200 text-sm font-medium">{value}</div>
    </div>
  );
}
