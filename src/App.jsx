import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Trash2,
  Pencil,
  Check,
  X,
  Inbox,
  GripHorizontal,
  RotateCw,
  Circle,
  CheckCircle2,
  ListChecks,
  LogOut,
  Cloud,
  Loader2,
  Mail,
} from 'lucide-react';

const DAYS = [
  { key: 'monday', label: 'Segunda' },
  { key: 'tuesday', label: 'Terça' },
  { key: 'wednesday', label: 'Quarta' },
  { key: 'thursday', label: 'Quinta' },
  { key: 'friday', label: 'Sexta' },
  { key: 'saturday', label: 'Sábado' },
  { key: 'sunday', label: 'Domingo' },
];

const DAY_KEYS = new Set(DAYS.map((day) => day.key));

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

function uid() {
  return Math.random().toString(36).slice(2, 9) + Date.now().toString(36);
}

function createSubtask(text = '') {
  return {
    id: uid(),
    text,
    completed: false,
  };
}

function createTask() {
  return {
    id: uid(),
    title: 'Nova tarefa',
    description: '',
    assignedDays: [],
    recurring: false,
    completed: false,
    subtasks: [],
    createdAt: new Date().toISOString(),
    userId: null,
  };
}

function normalizeTask(task) {
  const legacyAssignedDays = Array.isArray(task?.assigned_days)
    ? task.assigned_days.filter((day) => DAY_KEYS.has(day))
    : Array.isArray(task?.assignedDays)
      ? task.assignedDays.filter((day) => DAY_KEYS.has(day))
      : [];

  const singleLegacyDay = typeof task?.day === 'string' && DAY_KEYS.has(task.day) ? [task.day] : [];
  let assignedDays = legacyAssignedDays.length ? legacyAssignedDays : singleLegacyDay;

  const recurring = Boolean(task?.recurring);
  if (!recurring && assignedDays.length > 1) {
    assignedDays = assignedDays.slice(0, 1);
  }

  const subtasksSource = Array.isArray(task?.subtasks) ? task.subtasks : [];
  const subtasks = subtasksSource.map((subtask) => ({
    id: subtask?.id || uid(),
    text: typeof subtask?.text === 'string' ? subtask.text : '',
    completed: Boolean(subtask?.completed),
  }));

  return {
    id: task?.id || uid(),
    title: typeof task?.title === 'string' ? task.title : 'Sem título',
    description: typeof task?.description === 'string' ? task.description : '',
    assignedDays,
    recurring,
    completed: Boolean(task?.completed),
    subtasks,
    createdAt: task?.created_at || task?.createdAt || new Date().toISOString(),
    userId: task?.user_id || task?.userId || null,
  };
}

function taskToDb(task, userId) {
  return {
    title: task.title,
    description: task.description,
    assigned_days: task.assignedDays,
    recurring: task.recurring,
    completed: task.completed,
    subtasks: task.subtasks,
    user_id: userId,
  };
}

function getDayLabel(dayKey) {
  return DAYS.find((d) => d.key === dayKey)?.label || 'Sem dia definido';
}

function getAssignedDaysLabel(task) {
  if (!task.assignedDays?.length) return 'Sem dia definido';
  return task.assignedDays.map(getDayLabel).join(' • ');
}

function getTaskCategory(task) {
  if (task.completed) return 'complete';
  if (task.recurring) return 'recurring';
  return 'incomplete';
}

function StatusBadge({ task }) {
  const category = getTaskCategory(task);

  if (category === 'complete') {
    return (
      <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs text-emerald-300">
        Completa
      </span>
    );
  }

  if (category === 'recurring') {
    return (
      <span className="rounded-full border border-sky-400/20 bg-sky-400/10 px-3 py-1 text-xs text-sky-300">
        Recorrente
      </span>
    );
  }

  return (
    <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-xs text-amber-300">
      Incompleta
    </span>
  );
}

function SubtaskItem({ subtask, onToggle }) {
  return (
    <button
      onClick={onToggle}
      className="flex w-full items-start gap-3 rounded-2xl border border-white/8 bg-black/10 px-3 py-3 text-left transition hover:bg-white/[0.03]"
    >
      <span
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
          subtask.completed
            ? 'border-emerald-400/30 bg-emerald-400/15 text-emerald-300'
            : 'border-white/20 bg-white/5 text-white/40'
        }`}
      >
        <Check size={12} />
      </span>
      <span className={`text-sm ${subtask.completed ? 'text-white/40 line-through' : 'text-white/75'}`}>
        {subtask.text || 'Subtarefa sem texto'}
      </span>
    </button>
  );
}

function TaskCard({ task, onSave, onDelete, onToggleComplete, onToggleSubtask, busy = false }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(task);
  const [newSubtaskText, setNewSubtaskText] = useState('');
  const [localBusy, setLocalBusy] = useState(false);

  useEffect(() => {
    setDraft(task);
    setNewSubtaskText('');
  }, [task]);

  const hasChanges = useMemo(() => JSON.stringify(draft) !== JSON.stringify(task), [draft, task]);
  const isBusy = busy || localBusy;

  const updateDraft = (patch) => setDraft((prev) => ({ ...prev, ...patch }));

  const handleSave = async () => {
    const cleaned = {
      ...draft,
      title: draft.title.trim() || 'Sem título',
      description: draft.description.trim(),
      assignedDays: Array.from(new Set((draft.assignedDays || []).filter((day) => DAY_KEYS.has(day)))),
      subtasks: (draft.subtasks || [])
        .map((subtask) => ({
          ...subtask,
          text: (subtask.text || '').trim(),
        }))
        .filter((subtask) => subtask.text),
    };

    if (!cleaned.recurring && cleaned.assignedDays.length > 1) {
      cleaned.assignedDays = cleaned.assignedDays.slice(0, 1);
    }

    setLocalBusy(true);
    const ok = await onSave(cleaned);
    setLocalBusy(false);
    if (ok) setEditing(false);
  };

  const handleCancel = () => {
    setDraft(task);
    setNewSubtaskText('');
    setEditing(false);
  };

  const toggleRecurringDay = (dayKey) => {
    const current = draft.assignedDays || [];
    const exists = current.includes(dayKey);
    updateDraft({
      assignedDays: exists ? current.filter((day) => day !== dayKey) : [...current, dayKey],
    });
  };

  const handleSingleDayChange = (dayValue) => {
    updateDraft({ assignedDays: dayValue === 'inbox' ? [] : [dayValue] });
  };

  const addSubtaskToDraft = () => {
    const text = newSubtaskText.trim();
    if (!text) return;
    updateDraft({ subtasks: [...(draft.subtasks || []), createSubtask(text)] });
    setNewSubtaskText('');
  };

  const updateDraftSubtask = (subtaskId, patch) => {
    updateDraft({
      subtasks: (draft.subtasks || []).map((subtask) =>
        subtask.id === subtaskId ? { ...subtask, ...patch } : subtask
      ),
    });
  };

  const removeDraftSubtask = (subtaskId) => {
    updateDraft({
      subtasks: (draft.subtasks || []).filter((subtask) => subtask.id !== subtaskId),
    });
  };

  const completedSubtasks = task.subtasks.filter((subtask) => subtask.completed).length;

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-[0_10px_30px_rgba(0,0,0,0.25)] backdrop-blur-sm">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 text-white/45">
          <GripHorizontal size={16} />
          <span className="text-xs uppercase tracking-[0.2em]">Box</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onToggleComplete(task.id)}
            disabled={isBusy}
            className={`rounded-full border p-2 transition disabled:opacity-50 ${
              task.completed
                ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300 hover:bg-emerald-400/20'
                : 'border-white/10 bg-white/5 text-white/80 hover:bg-white/10'
            }`}
            aria-label={task.completed ? 'Marcar como incompleta' : 'Marcar como concluída'}
          >
            <Check size={16} />
          </button>

          {!editing ? (
            <button
              onClick={() => setEditing(true)}
              disabled={isBusy}
              className="rounded-full border border-white/10 bg-white/5 p-2 text-white/80 transition hover:bg-white/10 disabled:opacity-50"
              aria-label="Editar tarefa"
            >
              <Pencil size={16} />
            </button>
          ) : (
            <>
              <button
                onClick={handleSave}
                disabled={isBusy}
                className="rounded-full border border-emerald-400/20 bg-emerald-400/10 p-2 text-emerald-300 transition hover:bg-emerald-400/20 disabled:opacity-50"
                aria-label="Salvar tarefa"
              >
                {isBusy ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              </button>
              <button
                onClick={handleCancel}
                disabled={isBusy}
                className="rounded-full border border-white/10 bg-white/5 p-2 text-white/80 transition hover:bg-white/10 disabled:opacity-50"
                aria-label="Cancelar edição"
              >
                <X size={16} />
              </button>
            </>
          )}

          <button
            onClick={() => onDelete(task.id)}
            disabled={isBusy}
            className="rounded-full border border-red-400/20 bg-red-400/10 p-2 text-red-300 transition hover:bg-red-400/20 disabled:opacity-50"
            aria-label="Excluir tarefa"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {editing ? (
          <>
            <input
              value={draft.title}
              onChange={(e) => updateDraft({ title: e.target.value })}
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-base font-semibold text-white outline-none placeholder:text-white/25 focus:border-white/20"
              placeholder="Título da tarefa"
            />

            <textarea
              value={draft.description}
              onChange={(e) => updateDraft({ description: e.target.value })}
              rows={4}
              className="w-full resize-none rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/85 outline-none placeholder:text-white/25 focus:border-white/20"
              placeholder="Descreva a atividade, observações ou próximos passos"
            />

            <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/10 px-4 py-3 text-sm text-white/85">
              <input
                type="checkbox"
                checked={draft.recurring}
                onChange={(e) => {
                  const checked = e.target.checked;
                  updateDraft({
                    recurring: checked,
                    assignedDays: checked ? draft.assignedDays || [] : (draft.assignedDays || []).slice(0, 1),
                  });
                }}
                className="h-4 w-4 rounded"
              />
              Marcar como tarefa recorrente
            </label>

            <div>
              <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-white/45">
                {draft.recurring ? 'Atribuir a um ou mais dias' : 'Atribuir ao dia'}
              </label>

              {draft.recurring ? (
                <div className="grid grid-cols-2 gap-2">
                  {DAYS.map((day) => {
                    const selected = (draft.assignedDays || []).includes(day.key);
                    return (
                      <button
                        key={day.key}
                        type="button"
                        onClick={() => toggleRecurringDay(day.key)}
                        className={`rounded-2xl border px-3 py-3 text-sm transition ${
                          selected
                            ? 'border-sky-400/30 bg-sky-400/15 text-sky-200'
                            : 'border-white/10 bg-black/10 text-white/70 hover:bg-white/[0.03]'
                        }`}
                      >
                        {day.label}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <select
                  value={draft.assignedDays?.[0] || 'inbox'}
                  onChange={(e) => handleSingleDayChange(e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none focus:border-white/20"
                >
                  <option value="inbox" className="text-black">Sem dia definido</option>
                  {DAYS.map((day) => (
                    <option key={day.key} value={day.key} className="text-black">
                      {day.label}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="rounded-3xl border border-white/10 bg-black/10 p-4">
              <div className="mb-3 flex items-center gap-2">
                <div className="rounded-xl bg-white/8 p-2 text-white/80">
                  <ListChecks size={16} />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white">Subtarefas</h4>
                  <p className="text-xs text-white/45">Adicione passos internos para esta tarefa</p>
                </div>
              </div>

              <div className="space-y-2">
                {(draft.subtasks || []).map((subtask) => (
                  <div key={subtask.id} className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => updateDraftSubtask(subtask.id, { completed: !subtask.completed })}
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border transition ${
                        subtask.completed
                          ? 'border-emerald-400/30 bg-emerald-400/15 text-emerald-300'
                          : 'border-white/10 bg-white/5 text-white/60 hover:bg-white/10'
                      }`}
                    >
                      <Check size={14} />
                    </button>

                    <input
                      value={subtask.text}
                      onChange={(e) => updateDraftSubtask(subtask.id, { text: e.target.value })}
                      className="flex-1 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none focus:border-white/20"
                      placeholder="Texto da subtarefa"
                    />

                    <button
                      type="button"
                      onClick={() => removeDraftSubtask(subtask.id)}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-red-400/20 bg-red-400/10 text-red-300 transition hover:bg-red-400/20"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>

              <div className="mt-3 flex items-center gap-2">
                <input
                  value={newSubtaskText}
                  onChange={(e) => setNewSubtaskText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addSubtaskToDraft();
                    }
                  }}
                  className="flex-1 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-white/20"
                  placeholder="Nova subtarefa"
                />
                <button
                  type="button"
                  onClick={addSubtaskToDraft}
                  className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white/80 transition hover:bg-white/10"
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>
          </>
        ) : (
          <>
            <div>
              <h3 className="text-lg font-semibold text-white">{task.title || 'Sem título'}</h3>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-white/65">
                {task.description || 'Sem descrição ainda.'}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <StatusBadge task={task} />
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
                {getAssignedDaysLabel(task)}
              </span>
              {!!task.subtasks.length && (
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/60">
                  {completedSubtasks}/{task.subtasks.length} subtarefas
                </span>
              )}
            </div>

            {!!task.subtasks.length && (
              <div className="rounded-3xl border border-white/10 bg-black/10 p-3">
                <div className="mb-2 flex items-center gap-2 text-white/55">
                  <ListChecks size={15} />
                  <span className="text-xs uppercase tracking-[0.2em]">Subtarefas</span>
                </div>
                <div className="space-y-2">
                  {task.subtasks.map((subtask) => (
                    <SubtaskItem
                      key={subtask.id}
                      subtask={subtask}
                      onToggle={() => onToggleSubtask(task.id, subtask.id)}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {editing && hasChanges && (
        <p className="mt-3 text-xs text-amber-300/80">Alterações pendentes. Toque em salvar para aplicar.</p>
      )}
    </div>
  );
}

function CategorySection({ title, icon: Icon, tasks, emptyText, onSave, onDelete, onToggleComplete, onToggleSubtask, busy }) {
  return (
    <section className="mb-5 rounded-[28px] border border-white/10 bg-white/[0.04] p-4 shadow-[0_10px_40px_rgba(0,0,0,0.25)]">
      <div className="mb-3 flex items-center gap-3">
        <div className="rounded-2xl bg-white/8 p-2 text-white/80">
          <Icon size={18} />
        </div>
        <div>
          <h2 className="text-base font-semibold">{title}</h2>
          <p className="text-sm text-white/55">{tasks.length} box{tasks.length === 1 ? '' : 'es'}</p>
        </div>
      </div>

      <div className="space-y-3">
        {tasks.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-white/10 bg-black/10 p-5 text-center text-sm text-white/55">
            {emptyText}
          </div>
        ) : (
          tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onSave={onSave}
              onDelete={onDelete}
              onToggleComplete={onToggleComplete}
              onToggleSubtask={onToggleSubtask}
              busy={busy}
            />
          ))
        )}
      </div>
    </section>
  );
}

function LoginScreen({ onSendMagicLink, sending, error }) {
  const [email, setEmail] = useState('');
  const [success, setSuccess] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setSuccess('');
    const ok = await onSendMagicLink(email);
    if (ok) {
      setSuccess('Link enviado. Abra seu email neste dispositivo e toque no link para entrar.');
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#162235_0%,#0a1018_45%,#06080d_100%)] text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-md items-center px-4 py-10">
        <div className="w-full rounded-[32px] border border-white/10 bg-white/[0.04] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl">
          <div className="mb-6 flex items-center gap-3">
            <div className="rounded-2xl bg-white/8 p-3 text-white/85">
              <Cloud size={22} />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.25em] text-white/45">Agenda online</p>
              <h1 className="text-2xl font-semibold">Entrar no seu app</h1>
            </div>
          </div>

          <p className="mb-5 text-sm leading-relaxed text-white/65">
            Entre com seu email para sincronizar suas tarefas entre celular e PC.
          </p>

          <form onSubmit={submit} className="space-y-3">
            <div className="relative">
              <Mail size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/35" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seuemail@exemplo.com"
                className="w-full rounded-2xl border border-white/10 bg-black/20 py-3 pl-11 pr-4 text-sm text-white outline-none placeholder:text-white/25 focus:border-white/20"
                required
              />
            </div>

            <button
              type="submit"
              disabled={sending}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-900 transition hover:opacity-90 disabled:opacity-60"
            >
              {sending ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />}
              Enviar link de acesso
            </button>
          </form>

          {success && <p className="mt-4 text-sm text-emerald-300">{success}</p>}
          {error && <p className="mt-4 text-sm text-red-300">{error}</p>}

          <div className="mt-6 rounded-2xl border border-white/10 bg-black/10 p-4 text-xs leading-relaxed text-white/45">
            Configure primeiro as variáveis <span className="text-white/75">VITE_SUPABASE_URL</span> e <span className="text-white/75">VITE_SUPABASE_ANON_KEY</span> no projeto.
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AgendaInterativaPessoal() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tasks, setTasks] = useState([]);
  const [currentDayIndex, setCurrentDayIndex] = useState(0);
  const [activeView, setActiveView] = useState('week');
  const [error, setError] = useState('');
  const [sendingMagicLink, setSendingMagicLink] = useState(false);
  const carouselRef = useRef(null);

  useEffect(() => {
    if (!supabase) {
      setError('Supabase não configurado. Adicione as variáveis de ambiente do projeto.');
      setAuthLoading(false);
      return;
    }

    let mounted = true;

    supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!mounted) return;
      if (sessionError) setError(sessionError.message);
      setSession(data.session ?? null);
      setAuthLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession ?? null);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session?.user || !supabase) {
      setTasks([]);
      return;
    }
    fetchTasks();
  }, [session?.user?.id]);

  const fetchTasks = async () => {
    if (!session?.user || !supabase) return;
    setLoadingTasks(true);
    setError('');

    const { data, error: fetchError } = await supabase
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: false });

    if (fetchError) {
      setError(fetchError.message);
      setLoadingTasks(false);
      return;
    }

    setTasks((data || []).map(normalizeTask));
    setLoadingTasks(false);
  };

  const sendMagicLink = async (email) => {
    if (!supabase) {
      setError('Supabase não configurado.');
      return false;
    }

    setSendingMagicLink(true);
    setError('');

    const { error: authError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin,
      },
    });

    setSendingMagicLink(false);

    if (authError) {
      setError(authError.message);
      return false;
    }

    return true;
  };

  const signOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setTasks([]);
  };

  const persistTaskInsert = async (task) => {
    if (!supabase || !session?.user) return false;

    setSaving(true);
    setError('');

    const { data, error: insertError } = await supabase
      .from('tasks')
      .insert(taskToDb(task, session.user.id))
      .select('*')
      .single();

    setSaving(false);

    if (insertError) {
      setError(insertError.message);
      return false;
    }

    setTasks((prev) => [normalizeTask(data), ...prev]);
    return true;
  };

  const persistTaskUpdate = async (task) => {
    if (!supabase || !session?.user) return false;

    setSaving(true);
    setError('');

    const { data, error: updateError } = await supabase
      .from('tasks')
      .update(taskToDb(task, session.user.id))
      .eq('id', task.id)
      .select('*')
      .single();

    setSaving(false);

    if (updateError) {
      setError(updateError.message);
      return false;
    }

    const normalized = normalizeTask(data);
    setTasks((prev) => prev.map((item) => (item.id === normalized.id ? normalized : item)));
    return true;
  };

  const persistTaskDelete = async (taskId) => {
    if (!supabase || !session?.user) return false;

    setSaving(true);
    setError('');

    const { error: deleteError } = await supabase.from('tasks').delete().eq('id', taskId);

    setSaving(false);

    if (deleteError) {
      setError(deleteError.message);
      return false;
    }

    setTasks((prev) => prev.filter((task) => task.id !== taskId));
    return true;
  };

  const inboxTasks = useMemo(() => tasks.filter((task) => !task.assignedDays.length), [tasks]);

  const tasksByDay = useMemo(() => {
    return DAYS.reduce((acc, day) => {
      acc[day.key] = tasks.filter((task) => task.assignedDays.includes(day.key));
      return acc;
    }, {});
  }, [tasks]);

  const categorizedTasks = useMemo(() => {
    return {
      recurring: tasks.filter((task) => getTaskCategory(task) === 'recurring'),
      incomplete: tasks.filter((task) => getTaskCategory(task) === 'incomplete'),
      complete: tasks.filter((task) => getTaskCategory(task) === 'complete'),
    };
  }, [tasks]);

  const addTask = async (day = 'inbox') => {
    const newTask = createTask();
    newTask.assignedDays = day === 'inbox' ? [] : [day];
    newTask.userId = session?.user?.id || null;
    await persistTaskInsert(newTask);
  };

  const updateTask = async (updatedTask) => {
    return persistTaskUpdate(normalizeTask(updatedTask));
  };

  const deleteTask = async (taskId) => {
    return persistTaskDelete(taskId);
  };

  const toggleComplete = async (taskId) => {
    const current = tasks.find((task) => task.id === taskId);
    if (!current) return;
    await persistTaskUpdate({ ...current, completed: !current.completed });
  };

  const toggleSubtask = async (taskId, subtaskId) => {
    const current = tasks.find((task) => task.id === taskId);
    if (!current) return;

    await persistTaskUpdate({
      ...current,
      subtasks: current.subtasks.map((subtask) =>
        subtask.id === subtaskId ? { ...subtask, completed: !subtask.completed } : subtask
      ),
    });
  };

  const goToDay = (index) => {
    const clamped = Math.max(0, Math.min(index, DAYS.length - 1));
    setCurrentDayIndex(clamped);
    const container = carouselRef.current;
    if (!container) return;
    const child = container.children[clamped];
    if (!child) return;
    child.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
  };

  const handleScroll = () => {
    const container = carouselRef.current;
    if (!container) return;
    const width = container.clientWidth;
    if (!width) return;
    const index = Math.round(container.scrollLeft / width);
    setCurrentDayIndex(index);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,#162235_0%,#0a1018_45%,#06080d_100%)] text-white">
        <div className="mx-auto flex min-h-screen w-full max-w-md items-center justify-center px-4">
          <div className="flex items-center gap-3 rounded-3xl border border-white/10 bg-white/[0.04] px-5 py-4">
            <Loader2 size={18} className="animate-spin" />
            <span className="text-sm text-white/75">Conectando ao app...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!session) {
    return <LoginScreen onSendMagicLink={sendMagicLink} sending={sendingMagicLink} error={error} />;
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#162235_0%,#0a1018_45%,#06080d_100%)] text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-4 pb-24 pt-5">
        <header className="sticky top-0 z-20 -mx-4 mb-4 border-b border-white/10 bg-[#09111bcc]/80 px-4 pb-4 pt-3 backdrop-blur-xl">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.28em] text-white/45">Agenda interativa</p>
              <h1 className="mt-1 text-2xl font-semibold leading-tight">Seu mapa semanal de tarefas</h1>
              <p className="mt-2 text-xs text-white/45">{session.user.email}</p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => addTask('inbox')}
                disabled={saving || loadingTasks}
                className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/8 text-white shadow-lg transition hover:bg-white/15 disabled:opacity-50"
                aria-label="Criar novo box"
              >
                <Plus size={20} />
              </button>
              <button
                onClick={signOut}
                className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white/80 transition hover:bg-white/10"
                aria-label="Sair"
              >
                <LogOut size={18} />
              </button>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-1">
            <button
              onClick={() => setActiveView('week')}
              className={`rounded-2xl px-4 py-3 text-sm font-medium transition ${
                activeView === 'week' ? 'bg-white text-slate-900' : 'text-white/70 hover:bg-white/5'
              }`}
            >
              Semana
            </button>
            <button
              onClick={() => setActiveView('all')}
              className={`rounded-2xl px-4 py-3 text-sm font-medium transition ${
                activeView === 'all' ? 'bg-white text-slate-900' : 'text-white/70 hover:bg-white/5'
              }`}
            >
              Todos os boxes
            </button>
          </div>
        </header>

        {error && (
          <div className="mb-4 rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        )}

        {loadingTasks ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="flex items-center gap-3 rounded-3xl border border-white/10 bg-white/[0.04] px-5 py-4">
              <Loader2 size={18} className="animate-spin" />
              <span className="text-sm text-white/75">Carregando suas tarefas...</span>
            </div>
          </div>
        ) : activeView === 'all' ? (
          <div>
            <CategorySection
              title="Recorrentes"
              icon={RotateCw}
              tasks={categorizedTasks.recurring}
              emptyText="Nenhuma tarefa recorrente ainda."
              onSave={updateTask}
              onDelete={deleteTask}
              onToggleComplete={toggleComplete}
              onToggleSubtask={toggleSubtask}
              busy={saving}
            />

            <CategorySection
              title="Incompletas"
              icon={Circle}
              tasks={categorizedTasks.incomplete}
              emptyText="Nenhuma tarefa incompleta no momento."
              onSave={updateTask}
              onDelete={deleteTask}
              onToggleComplete={toggleComplete}
              onToggleSubtask={toggleSubtask}
              busy={saving}
            />

            <CategorySection
              title="Completas"
              icon={CheckCircle2}
              tasks={categorizedTasks.complete}
              emptyText="Nenhuma tarefa concluída ainda."
              onSave={updateTask}
              onDelete={deleteTask}
              onToggleComplete={toggleComplete}
              onToggleSubtask={toggleSubtask}
              busy={saving}
            />
          </div>
        ) : (
          <>
            <section className="mb-5 rounded-[28px] border border-white/10 bg-white/[0.04] p-4 shadow-[0_10px_40px_rgba(0,0,0,0.25)]">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="rounded-2xl bg-white/8 p-2 text-white/80">
                    <Inbox size={18} />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold">Caixa de entrada</h2>
                    <p className="text-sm text-white/55">Tarefas sem dia definido</p>
                  </div>
                </div>
                <button
                  onClick={() => addTask('inbox')}
                  disabled={saving}
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/85 transition hover:bg-white/10 disabled:opacity-50"
                >
                  + Novo box
                </button>
              </div>

              <div className="space-y-3">
                {inboxTasks.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-white/10 bg-black/10 p-5 text-center text-sm text-white/55">
                    Nenhuma tarefa solta no momento. Crie boxes aqui para depois atribuí-los a um dia.
                  </div>
                ) : (
                  inboxTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onSave={updateTask}
                      onDelete={deleteTask}
                      onToggleComplete={toggleComplete}
                      onToggleSubtask={toggleSubtask}
                      busy={saving}
                    />
                  ))
                )}
              </div>
            </section>

            <section className="flex-1 rounded-[28px] border border-white/10 bg-white/[0.03] py-4 shadow-[0_10px_40px_rgba(0,0,0,0.25)]">
              <div className="mb-4 flex items-center justify-between px-4">
                <div className="flex items-center gap-2">
                  <div className="rounded-2xl bg-white/8 p-2 text-white/80">
                    <CalendarDays size={18} />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold">Dias da semana</h2>
                    <p className="text-sm text-white/55">Arraste para os lados para navegar</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => goToDay(currentDayIndex - 1)}
                    className="rounded-full border border-white/10 bg-white/5 p-2 text-white/80 transition hover:bg-white/10 disabled:opacity-40"
                    disabled={currentDayIndex === 0}
                    aria-label="Dia anterior"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    onClick={() => goToDay(currentDayIndex + 1)}
                    className="rounded-full border border-white/10 bg-white/5 p-2 text-white/80 transition hover:bg-white/10 disabled:opacity-40"
                    disabled={currentDayIndex === DAYS.length - 1}
                    aria-label="Próximo dia"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>

              <div className="mb-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {DAYS.map((day, index) => {
                  const active = currentDayIndex === index;
                  return (
                    <button
                      key={day.key}
                      onClick={() => goToDay(index)}
                      className={`whitespace-nowrap rounded-full px-4 py-2 text-sm transition ${
                        active
                          ? 'bg-white text-slate-900 shadow-lg'
                          : 'border border-white/10 bg-white/5 text-white/70 hover:bg-white/10'
                      }`}
                    >
                      {day.label}
                    </button>
                  );
                })}
              </div>

              <div
                ref={carouselRef}
                onScroll={handleScroll}
                className="flex snap-x snap-mandatory overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              >
                {DAYS.map((day) => (
                  <div key={day.key} className="min-w-full snap-center px-4">
                    <div className="mb-3 flex items-center justify-between gap-3 rounded-3xl border border-white/10 bg-black/10 p-4">
                      <div>
                        <h3 className="text-xl font-semibold">{day.label}</h3>
                        <p className="text-sm text-white/55">Boxes atribuídos a este dia</p>
                      </div>
                      <button
                        onClick={() => addTask(day.key)}
                        disabled={saving}
                        className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/85 transition hover:bg-white/10 disabled:opacity-50"
                      >
                        + Novo box
                      </button>
                    </div>

                    <div className="space-y-3 pb-2">
                      {tasksByDay[day.key]?.length ? (
                        tasksByDay[day.key].map((task) => (
                          <TaskCard
                            key={task.id}
                            task={task}
                            onSave={updateTask}
                            onDelete={deleteTask}
                            onToggleComplete={toggleComplete}
                            onToggleSubtask={toggleSubtask}
                            busy={saving}
                          />
                        ))
                      ) : (
                        <div className="rounded-3xl border border-dashed border-white/10 bg-black/10 p-6 text-center text-sm text-white/55">
                          Nenhum box atribuído a {day.label.toLowerCase()} ainda.
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
