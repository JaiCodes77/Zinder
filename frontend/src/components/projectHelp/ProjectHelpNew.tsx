import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronLeft, ChevronRight, Loader2, Search } from 'lucide-react';
import { FloatingField } from '../FloatingField';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';
import { RequestCard } from './RequestCard';
import { TechChip } from './TechChip';
import { EASE, SUGGESTED_TECH } from './helpers';
import type { ProjectRequest, Urgency } from './types';

type ProjectHelpNewProps = {
  myName: string;
  myUserId: number;
  onCancel: () => void;
  onSubmit: (payload: {
    title: string;
    description: string;
    tech_stack: string[];
    urgency: Urgency;
  }) => Promise<ProjectRequest>;
  onCreated: (project: ProjectRequest) => void;
};

type Step = 0 | 1 | 2;
type SubmitPhase = 'idle' | 'loading' | 'success';

const STEPS = ['Basics', 'Tech stack', 'Review'] as const;

export const ProjectHelpNew: React.FC<ProjectHelpNewProps> = ({
  myName,
  myUserId,
  onCancel,
  onSubmit,
  onCreated,
}) => {
  const reduced = usePrefersReducedMotion();
  const [step, setStep] = useState<Step>(0);
  const [direction, setDirection] = useState(1);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [techStack, setTechStack] = useState<string[]>([]);
  const [techQuery, setTechQuery] = useState('');
  const [urgency, setUrgency] = useState<Urgency>('medium');
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<SubmitPhase>('idle');

  const filteredSuggestions = useMemo(() => {
    const q = techQuery.trim().toLowerCase();
    return SUGGESTED_TECH.filter(
      (t) => !techStack.includes(t) && (!q || t.toLowerCase().includes(q))
    );
  }, [techQuery, techStack]);

  const go = (next: Step, dir: number) => {
    setDirection(dir);
    setError(null);
    setStep(next);
  };

  const validateStep = (): boolean => {
    if (step === 0) {
      if (title.trim().length < 3) {
        setError('Title needs at least 3 characters.');
        return false;
      }
      if (description.trim().length < 10) {
        setError('Description needs at least 10 characters.');
        return false;
      }
    }
    if (step === 1 && techStack.length === 0) {
      setError('Pick at least one technology.');
      return false;
    }
    return true;
  };

  const addTech = (raw: string) => {
    const tag = raw.trim().replace(/,/g, '');
    if (!tag || techStack.includes(tag)) return;
    setTechStack((prev) => [...prev, tag]);
    setTechQuery('');
  };

  const previewProject: ProjectRequest = {
    id: 0,
    user_id: myUserId,
    user_name: myName || 'You',
    title: title.trim() || 'Untitled request',
    description: description.trim() || 'Your description will show here.',
    tech_stack: techStack.length ? techStack : ['…'],
    timestamp: new Date().toISOString(),
  };

  const handlePublish = async () => {
    if (!validateStep()) return;
    setPhase('loading');
    setError(null);
    try {
      const created = await onSubmit({
        title: title.trim(),
        description: description.trim(),
        tech_stack: techStack,
        urgency,
      });
      setPhase('success');
      window.setTimeout(() => onCreated(created), reduced ? 200 : 700);
    } catch (err: unknown) {
      setPhase('idle');
      setError(err instanceof Error ? err.message : 'Could not publish your request.');
    }
  };

  const variants = {
    enter: (dir: number) =>
      reduced ? { opacity: 0 } : { x: dir > 0 ? 48 : -48, opacity: 0 },
    center: { x: 0, opacity: 1 },
    exit: (dir: number) =>
      reduced ? { opacity: 0 } : { x: dir > 0 ? -48 : 48, opacity: 0 },
  };

  return (
    <div className="w-full max-w-xl mx-auto">
      <button
        type="button"
        onClick={onCancel}
        className="flex items-center gap-1.5 text-[13px] text-fg-muted hover:text-fg mb-5 transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
        Cancel
      </button>

      <div className="mb-6">
        <h1 className="text-lg font-semibold tracking-tight text-fg">New request</h1>
        <p className="text-[13px] text-fg-muted mt-0.5">
          Step {step + 1} of {STEPS.length} — {STEPS[step]}
        </p>

        {/* Slim progress */}
        <div className="flex items-center gap-2 mt-4">
          {STEPS.map((label, i) => (
            <div key={label} className="flex-1 flex flex-col gap-1.5">
              <div className="h-1 rounded-full bg-white/8 overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-accent-brand"
                  initial={false}
                  animate={{ width: i <= step ? '100%' : '0%' }}
                  transition={reduced ? { duration: 0 } : { duration: 0.3, ease: EASE }}
                  style={{
                    boxShadow: i === step ? '0 0 8px rgba(185,144,255,0.5)' : undefined,
                  }}
                />
              </div>
              <span
                className={`text-[10px] font-mono ${
                  i === step ? 'text-accent-brand' : i < step ? 'text-fg-muted' : 'text-fg-subtle'
                }`}
              >
                {label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {error && (
        <div className="mb-4 px-3.5 py-2.5 rounded-[12px] bg-danger/8 border border-danger/20 text-danger text-[13px]">
          {error}
        </div>
      )}

      <div className="relative overflow-hidden min-h-[320px]">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={step}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={reduced ? { duration: 0 } : { duration: 0.28, ease: EASE }}
            className="space-y-4"
          >
            {step === 0 && (
              <>
                <FloatingField label="Title" value={title} onChange={setTitle} required />
                <FloatingField
                  label="Description"
                  as="textarea"
                  rows={6}
                  value={description}
                  onChange={setDescription}
                  required
                />
                <p className="text-[12px] text-fg-subtle">
                  Tip: wrap snippets in backticks like `npm run build` for inline code in the thread.
                </p>
              </>
            )}

            {step === 1 && (
              <>
                <div className="field flex items-center gap-2 px-3">
                  <Search className="w-3.5 h-3.5 text-fg-subtle" />
                  <input
                    type="text"
                    value={techQuery}
                    onChange={(e) => setTechQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ',') {
                        e.preventDefault();
                        if (techQuery.trim()) addTech(techQuery);
                        else if (filteredSuggestions[0]) addTech(filteredSuggestions[0]);
                      }
                    }}
                    placeholder="Search or type a tech — Enter to add"
                    className="w-full bg-transparent text-sm text-fg placeholder-fg-subtle focus:outline-none border-none py-2.5"
                  />
                </div>
                {techStack.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {techStack.map((t) => (
                      <TechChip
                        key={t}
                        tech={t}
                        size="md"
                        onRemove={() => setTechStack(techStack.filter((x) => x !== t))}
                      />
                    ))}
                  </div>
                )}
                <div>
                  <p className="text-[12px] text-fg-muted mb-2">Suggestions</p>
                  <div className="flex flex-wrap gap-1.5">
                    {filteredSuggestions.slice(0, 16).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => addTech(t)}
                        className="px-2.5 py-1 rounded-md text-[12px] font-mono border border-white/12 text-fg-muted hover:border-accent-brand/40 hover:text-accent-brand transition-colors"
                      >
                        + {t}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <div>
                  <p className="text-[13px] font-medium text-fg-muted mb-2">Urgency</p>
                  <div className="flex gap-2">
                    {(
                      [
                        { key: 'low' as const, label: 'Low' },
                        { key: 'medium' as const, label: 'Medium' },
                        { key: 'high' as const, label: 'High' },
                      ] as const
                    ).map(({ key, label }) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setUrgency(key)}
                        className={`flex-1 px-3 py-2 rounded-[12px] text-[13px] border transition-colors ${
                          urgency === key
                            ? 'bg-accent-brand/12 text-accent-brand border-accent-brand/30'
                            : 'bg-white/4 text-fg-muted border-white/12'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <p className="text-[11px] text-fg-subtle mt-2">
                    Urgency is client-only for now (not stored by the API) — used for list sorting.
                  </p>
                </div>

                <div>
                  <p className="text-[13px] font-medium text-fg-muted mb-2">Card preview</p>
                  <RequestCard
                    project={previewProject}
                    status="pending"
                    urgency={urgency}
                    preview
                    onClick={() => {}}
                  />
                </div>
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="flex justify-between gap-3 mt-6 pt-4 border-t border-white/12">
        <button
          type="button"
          onClick={() => (step === 0 ? onCancel() : go((step - 1) as Step, -1))}
          className="btn-ghost flex items-center gap-1.5 px-4 py-2 rounded-[12px] text-[13px]"
          disabled={phase !== 'idle'}
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          {step === 0 ? 'Cancel' : 'Back'}
        </button>

        {step < 2 ? (
          <button
            type="button"
            onClick={() => {
              if (validateStep()) go((step + 1) as Step, 1);
            }}
            className="btn-primary flex items-center gap-1.5 px-4 py-2 rounded-[12px] text-[13px]"
          >
            Continue
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        ) : (
          <button
            type="button"
            onClick={handlePublish}
            disabled={phase !== 'idle'}
            className="btn-primary flex items-center justify-center gap-2 min-w-[9.5rem] px-4 py-2 rounded-[12px] text-[13px]"
          >
            <AnimatePresence mode="wait" initial={false}>
              {phase === 'idle' && (
                <motion.span
                  key="idle"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  Publish request
                </motion.span>
              )}
              {phase === 'loading' && (
                <motion.span
                  key="loading"
                  className="flex items-center gap-2"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                >
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Publishing…
                </motion.span>
              )}
              {phase === 'success' && (
                <motion.span
                  key="success"
                  className="flex items-center gap-2"
                  initial={{ opacity: 0, scale: 0.7 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 22 }}
                >
                  <Check className="w-4 h-4" />
                  Published
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        )}
      </div>
    </div>
  );
};
