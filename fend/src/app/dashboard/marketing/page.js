"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";
import CampaignOutlinedIcon from "@mui/icons-material/CampaignOutlined";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import LaunchRoundedIcon from "@mui/icons-material/LaunchRounded";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import ScheduleOutlinedIcon from "@mui/icons-material/ScheduleOutlined";
import ShieldOutlinedIcon from "@mui/icons-material/ShieldOutlined";
import journeyFallback from "../../../../data/customer-email-journey.json";
import styles from "./marketing.module.css";

const TinyMceEditor = dynamic(() => import("@tinymce/tinymce-react").then((module) => module.Editor), { ssr: false });

const triggerOptions = [
  { value: "account_created_or_opt_in", label: "Account created or email opt-in", keys: ["account_created", "email_opt_in"] },
  { value: "account_created", label: "Account created", keys: ["account_created"] },
  { value: "email_opt_in", label: "Email marketing opt-in", keys: ["email_opt_in"] },
  { value: "signed_up_no_purchase", label: "Signed up without a purchase", keys: ["signed_up_no_purchase"] },
  { value: "cart_inactive", label: "Cart inactive", keys: ["cart_inactive"] },
  { value: "payment_confirmed", label: "Payment confirmed", keys: ["payment_confirmed"] },
  { value: "order_packed", label: "Order packed or tracking created", keys: ["order_packed"] },
  { value: "out_for_delivery", label: "Out for delivery", keys: ["out_for_delivery"] },
  { value: "order_delivered", label: "Order delivered", keys: ["order_delivered"] },
];

const scheduleOptions = [
  { value: "immediate", label: "Immediately" },
  { value: "delay", label: "After a delay" },
  { value: "event", label: "When the event occurs" },
];

const triggerOptionFor = (step) => {
  const keys = Array.isArray(step?.triggerKeys) ? step.triggerKeys : [];
  return triggerOptions.find((option) => option.keys.length === keys.length && option.keys.every((key) => keys.includes(key)))
    || triggerOptions.find((option) => option.value === step?.triggerKey)
    || triggerOptions[0];
};

const scheduleTypeFor = (step) => scheduleOptions.some((option) => option.value === step?.scheduleType)
  ? step.scheduleType
  : /immediate|right away|now/i.test(step?.timing || "")
    ? "immediate"
    : /status changes|carrier milestone|when .* occurs/i.test(step?.timing || "") ? "event" : "delay";

const delayMinutesFor = (step) => {
  const explicit = Number(step?.delayMinutes);
  if (Number.isFinite(explicit) && explicit > 0) return Math.min(43_200, Math.round(explicit));
  const timing = String(step?.timing || "").toLowerCase();
  const amount = Number(timing.match(/(\d+(?:\.\d+)?)/)?.[1] || 0);
  if (/day/.test(timing)) return Math.round((amount || 1) * 1_440);
  if (/hour/.test(timing)) return Math.round((amount || 1) * 60);
  return Math.round(amount || 60);
};

const delayUnitFor = (minutes) => minutes % 1_440 === 0 ? "days" : minutes % 60 === 0 ? "hours" : "minutes";
const delayValueFor = (minutes) => minutes % 1_440 === 0 ? minutes / 1_440 : minutes % 60 === 0 ? minutes / 60 : minutes;
const delayToMinutes = (value, unit) => Math.min(43_200, Math.max(1, Math.round(Number(value) * (unit === "days" ? 1_440 : unit === "hours" ? 60 : 1)) || 1));
const timingFor = (scheduleType, minutes) => scheduleType === "immediate" ? "Immediately" : scheduleType === "event" ? "When the event occurs" : `${delayValueFor(minutes)} ${delayUnitFor(minutes).replace(/s$/, "")}${delayValueFor(minutes) === 1 ? "" : "s"} after the trigger`;

const emptyStep = {
  key: "new-touchpoint",
  stage: "New touchpoint",
  triggerKey: "account_created",
  triggerKeys: ["account_created"],
  trigger: "Customer activity matches this step",
  scheduleType: "immediate",
  delayMinutes: 0,
  timing: "When ready",
  type: "Marketing",
  subject: "A helpful update from Weluxo",
  body: "Hi there,\n\nAdd the email copy for this touchpoint.",
  purpose: "Keep the customer informed with a clear next step.",
  cta: "Learn more",
  href: "/shop",
};

const clone = (value) => JSON.parse(JSON.stringify(value));

export default function MarketingPage() {
  const [content, setContent] = useState(() => clone(journeyFallback));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [bodyEditor, setBodyEditor] = useState(null);

  useEffect(() => {
    let mounted = true;

    fetch("/api/dashboard/marketing", { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error("load");
        return response.json();
      })
      .then((data) => {
        if (!mounted) return;
        setContent(data);
        setDirty(false);
      })
      .catch(() => mounted && setError("We could not load the latest marketing content. The saved draft is still available."))
      .finally(() => mounted && setLoading(false));

    return () => {
      mounted = false;
    };
  }, []);

  const steps = useMemo(() => Array.isArray(content.steps) ? content.steps : [], [content.steps]);
  const guardrails = useMemo(() => Array.isArray(content.guardrails) ? content.guardrails : [], [content.guardrails]);
  const metrics = useMemo(() => ({
    total: steps.length,
    marketing: steps.filter((step) => step.type !== "Transactional").length,
    transactional: steps.filter((step) => step.type === "Transactional").length,
    guardrails: guardrails.length,
  }), [guardrails, steps]);

  const markChanged = () => {
    setDirty(true);
    setMessage("");
    setError("");
  };

  const updateField = (field, value) => {
    setContent((current) => ({ ...current, [field]: value }));
    markChanged();
  };

  const updateStep = (index, field, value) => {
    setContent((current) => ({
      ...current,
      steps: (current.steps || []).map((step, stepIndex) =>
        stepIndex === index ? { ...step, [field]: value } : step
      ),
    }));
    markChanged();
  };

  const updateStepAutomation = (index, field, value) => {
    setContent((current) => ({
      ...current,
      steps: (current.steps || []).map((step, stepIndex) => {
        if (stepIndex !== index) return step;
        const next = { ...step };
        if (field === "trigger") {
          const option = triggerOptions.find((item) => item.value === value) || triggerOptions[0];
          next.triggerKey = option.keys[0];
          next.triggerKeys = option.keys;
          next.trigger = option.label;
        }
        if (field === "scheduleType") {
          next.scheduleType = value;
          next.delayMinutes = value === "delay" ? delayMinutesFor(step) : 0;
          next.timing = timingFor(value, next.delayMinutes || 60);
        }
        if (field === "delayMinutes") {
          next.scheduleType = "delay";
          next.delayMinutes = delayToMinutes(value, delayUnitFor(delayMinutesFor(step)));
          next.timing = timingFor("delay", next.delayMinutes);
        }
        if (field === "delayUnit") {
          next.scheduleType = "delay";
          next.delayMinutes = delayToMinutes(delayValueFor(delayMinutesFor(step)), value);
          next.timing = timingFor("delay", next.delayMinutes);
        }
        return next;
      }),
    }));
    markChanged();
  };

  const addStep = () => {
    setContent((current) => ({
      ...current,
      steps: [...(current.steps || []), { ...emptyStep }],
    }));
    markChanged();
  };

  const removeStep = (index) => {
    setContent((current) => ({
      ...current,
      steps: (current.steps || []).filter((_, stepIndex) => stepIndex !== index),
    }));
    markChanged();
  };

  const updateGuardrail = (index, value) => {
    setContent((current) => ({
      ...current,
      guardrails: (current.guardrails || []).map((item, itemIndex) => itemIndex === index ? value : item),
    }));
    markChanged();
  };

  const addGuardrail = () => {
    setContent((current) => ({
      ...current,
      guardrails: [...(current.guardrails || []), "Add a clear rule for this journey."],
    }));
    markChanged();
  };

  const removeGuardrail = (index) => {
    setContent((current) => ({
      ...current,
      guardrails: (current.guardrails || []).filter((_, itemIndex) => itemIndex !== index),
    }));
    markChanged();
  };

  const openBodyEditor = (index) => {
    setBodyEditor({ index, draft: steps[index]?.body || "" });
    setMessage("");
    setError("");
  };

  const closeBodyEditor = () => setBodyEditor(null);

  const saveBodyEditor = () => {
    if (!bodyEditor) return;
    updateStep(bodyEditor.index, "body", bodyEditor.draft);
    closeBodyEditor();
  };

  const saveChanges = async () => {
    setSaving(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/dashboard/marketing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "save");
      setContent(data.content || content);
      setDirty(false);
      setMessage("Changes saved");
    } catch (saveError) {
      setError(saveError.message === "Admin access required" ? "Your admin session has expired. Please sign in again." : "Save failed. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.topbar}>
          <div className={styles.breadcrumbs}>
            <Link href="/dashboard/Overview" className={styles.backLink}>
              <ArrowBackRoundedIcon fontSize="inherit" />
              Overview
            </Link>
            <span aria-hidden="true">/</span>
            <span>Marketing</span>
          </div>
          <div className={styles.topActions}>
            <Link href="/" target="_blank" rel="noreferrer" className={styles.secondaryButton}>
              View storefront
              <LaunchRoundedIcon fontSize="small" />
            </Link>
            <button type="button" className={styles.primaryButton} onClick={saveChanges} disabled={saving || !dirty}>
              <SaveOutlinedIcon fontSize="small" />
              {saving ? "Saving..." : "Save changes"}
            </button>
          </div>
        </header>

        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <div className={styles.eyebrow}><CampaignOutlinedIcon fontSize="small" /> Lifecycle marketing</div>
            <h1>Turn every customer moment into a better experience.</h1>
            <p>Build a thoughtful customer journey with the right message, timing, and next step at every stage.</p>
          </div>
          <div className={styles.heroStatus}>
            <span className={styles.liveDot} />
            <div>
              <strong>{content.status || "Ready to activate"}</strong>
              <span>{loading ? "Syncing latest draft" : dirty ? "Unsaved changes" : "Latest saved content loaded"}</span>
            </div>
          </div>
        </section>

        {(message || error) && (
          <div className={`${styles.notice} ${error ? styles.noticeError : styles.noticeSuccess}`} role={error ? "alert" : "status"}>
            {error || message}
          </div>
        )}

        <section className={styles.metricGrid} aria-label="Journey summary">
          <Metric icon={<AutoAwesomeOutlinedIcon />} label="Total touchpoints" value={metrics.total} detail="Across the full lifecycle" />
          <Metric icon={<CampaignOutlinedIcon />} label="Marketing messages" value={metrics.marketing} detail="Consent-based outreach" tone="violet" />
          <Metric icon={<ScheduleOutlinedIcon />} label="Order updates" value={metrics.transactional} detail="Always-on transactional" tone="amber" />
          <Metric icon={<ShieldOutlinedIcon />} label="Guardrails" value={metrics.guardrails} detail="Rules protecting trust" tone="green" />
        </section>

        <section className={styles.panel} aria-labelledby="settings-title">
          <PanelHeading id="settings-title" eyebrow="Campaign settings" title="Set the foundation" copy="Keep the journey name and activation status clear for the whole team." />
          <div className={styles.settingsGrid}>
            <Field label="Journey name" value={content.title} onChange={(value) => updateField("title", value)} />
            <label className={styles.field}>
              <span>Status</span>
              <select value={content.status || ""} onChange={(event) => updateField("status", event.target.value)}>
                <option>Ready to activate</option>
                <option>Draft</option>
                <option>Active</option>
                <option>Paused</option>
              </select>
            </label>
            <Field
              label="Description"
              value={content.description}
              onChange={(value) => updateField("description", value)}
              multiline
              className={styles.descriptionField}
            />
          </div>
        </section>

        <section className={styles.section} aria-labelledby="touchpoints-title">
          <div className={styles.sectionHeading}>
            <PanelHeading id="touchpoints-title" eyebrow="Journey builder" title="Customer touchpoints" copy="Edit each message inline. Keep timing and triggers specific so the journey stays useful." />
            <button type="button" className={styles.addButton} onClick={addStep}>
              <AddRoundedIcon fontSize="small" />
              Add touchpoint
            </button>
          </div>

          <div className={styles.stepList}>
            {steps.map((step, index) => (
              <article className={styles.stepCard} key={`${step.number || "step"}-${index}`}>
                <div className={styles.stepRail}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  {index < steps.length - 1 && <i aria-hidden="true" />}
                </div>
                <div className={styles.stepContent}>
                  <div className={styles.stepHeader}>
                    <div>
                      <span className={styles.stepEyebrow}>Touchpoint {index + 1}</span>
                      <h3>{step.stage || "Untitled touchpoint"}</h3>
                    </div>
                    <div className={styles.stepActions}>
                      <span className={`${styles.typePill} ${step.type === "Transactional" ? styles.typeTransactional : ""}`}>
                        {step.type === "Transactional" ? "Transactional" : "Marketing"}
                      </span>
                      <button type="button" className={styles.deleteButton} onClick={() => removeStep(index)} aria-label={`Remove ${step.stage || `touchpoint ${index + 1}`}`}>
                        <DeleteOutlineRoundedIcon fontSize="small" />
                      </button>
                    </div>
                  </div>

                  <div className={styles.fieldGrid}>
                    <Field label="Stage name" value={step.stage} onChange={(value) => updateStep(index, "stage", value)} />
                    <label className={styles.field}>
                      <span>Message type</span>
                      <select value={step.type || "Marketing"} onChange={(event) => updateStep(index, "type", event.target.value)}>
                        <option>Marketing</option>
                        <option>Transactional</option>
                      </select>
                    </label>
                    <label className={styles.field}>
                      <span>Trigger event</span>
                      <select value={triggerOptionFor(step).value} onChange={(event) => updateStepAutomation(index, "trigger", event.target.value)}>
                        {triggerOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                      </select>
                    </label>
                    <label className={styles.field}>
                      <span>Schedule</span>
                      <select value={scheduleTypeFor(step)} onChange={(event) => updateStepAutomation(index, "scheduleType", event.target.value)}>
                        {scheduleOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                      </select>
                    </label>
                    {scheduleTypeFor(step) === "delay" ? (
                      <label className={styles.field}>
                        <span>Send after</span>
                        <div className={styles.inlineControl}>
                          <input
                            type="number"
                            min="1"
                            value={delayValueFor(delayMinutesFor(step))}
                            onChange={(event) => updateStepAutomation(index, "delayMinutes", event.target.value)}
                          />
                          <select value={delayUnitFor(delayMinutesFor(step))} onChange={(event) => updateStepAutomation(index, "delayUnit", event.target.value)} aria-label="Delay unit">
                            <option value="minutes">minutes</option>
                            <option value="hours">hours</option>
                            <option value="days">days</option>
                          </select>
                        </div>
                        <small className={styles.fieldHint}>The timer starts when the selected trigger happens.</small>
                      </label>
                    ) : (
                      <div className={styles.automationHint}>
                        <span>Timing</span>
                        <strong>{timingFor(scheduleTypeFor(step), delayMinutesFor(step))}</strong>
                      </div>
                    )}
                    <Field label="Email subject" value={step.subject} onChange={(value) => updateStep(index, "subject", value)} className={styles.wideField} />
                    <EmailBodyField value={step.body} onOpen={() => openBodyEditor(index)} className={styles.wideField} />
                    <Field label="Purpose" value={step.purpose} onChange={(value) => updateStep(index, "purpose", value)} multiline className={styles.wideField} />
                    <Field label="Button label" value={step.cta} onChange={(value) => updateStep(index, "cta", value)} />
                    <Field label="Button URL" value={step.href} onChange={(value) => updateStep(index, "href", value)} />
                  </div>
                </div>
              </article>
            ))}
            {steps.length === 0 && <EmptyState copy="No touchpoints yet. Add the first step to start building this journey." action="Add touchpoint" onClick={addStep} />}
          </div>
        </section>

        <section className={`${styles.panel} ${styles.guardrailPanel}`} aria-labelledby="guardrails-title">
          <div className={styles.sectionHeading}>
            <PanelHeading id="guardrails-title" eyebrow="Trust & compliance" title="Journey guardrails" copy="Simple rules keep communication useful, timely, and respectful." />
            <button type="button" className={styles.addButton} onClick={addGuardrail}>
              <AddRoundedIcon fontSize="small" />
              Add rule
            </button>
          </div>
          <div className={styles.guardrailList}>
            {guardrails.map((guardrail, index) => (
              <div className={styles.guardrailRow} key={`guardrail-${index}`}>
                <span className={styles.ruleNumber}>{String(index + 1).padStart(2, "0")}</span>
                <input aria-label={`Guardrail ${index + 1}`} value={guardrail} onChange={(event) => updateGuardrail(index, event.target.value)} />
                <button type="button" className={styles.deleteButton} onClick={() => removeGuardrail(index)} aria-label={`Remove guardrail ${index + 1}`}>
                  <DeleteOutlineRoundedIcon fontSize="small" />
                </button>
              </div>
            ))}
            {guardrails.length === 0 && <EmptyState copy="No guardrails yet. Add a rule to protect the customer experience." action="Add rule" onClick={addGuardrail} />}
          </div>
        </section>

        <footer className={styles.footerActions}>
          <div>
            <strong>{dirty ? "You have unsaved changes" : "Your journey is up to date"}</strong>
            <span>Changes are saved to the marketing workspace and ready for review.</span>
          </div>
          <button type="button" className={styles.primaryButton} onClick={saveChanges} disabled={saving || !dirty}>
            <SaveOutlinedIcon fontSize="small" />
            {saving ? "Saving..." : "Save changes"}
          </button>
        </footer>
      </div>

      {bodyEditor && (
        <div className={styles.editorBackdrop} role="presentation" onMouseDown={closeBodyEditor}>
          <section className={styles.editorDialog} role="dialog" aria-modal="true" aria-labelledby="email-body-editor-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className={styles.editorHeader}>
              <div>
                <span className={styles.stepEyebrow}>Email body editor</span>
                <h2 id="email-body-editor-title">Optimize {steps[bodyEditor.index]?.stage || "touchpoint"}</h2>
                <p>Format your copy, add links, and clean up the reading flow before saving it to this touchpoint.</p>
              </div>
              <button type="button" className={styles.editorClose} onClick={closeBodyEditor} aria-label="Close email body editor">×</button>
            </div>
            <div className={styles.editorCanvas}>
              <TinyMceEditor
                apiKey={process.env.NEXT_PUBLIC_TINYMCE_API_KEY || "no-api-key"}
                value={bodyEditor.draft}
                onEditorChange={(value) => setBodyEditor((current) => current ? { ...current, draft: value } : current)}
                init={{
                  height: 430,
                  menubar: false,
                  plugins: ["autolink", "lists", "link", "image", "table", "code", "preview"],
                  toolbar: "undo redo | blocks | bold italic underline removeformat | bullist numlist | link image table | preview code",
                  automatic_uploads: true,
                  images_file_types: "jpg,jpeg,png,gif,webp",
                  images_upload_handler: async (blobInfo) => {
                    const formData = new FormData();
                    formData.append("image", blobInfo.blob(), blobInfo.filename());
                    const response = await fetch("/api/dashboard/marketing/upload", {
                      method: "POST",
                      body: formData,
                      credentials: "include",
                    });
                    const data = await response.json().catch(() => ({}));
                    if (!response.ok || !data.location) throw new Error(data.error || "Image upload failed");
                    return data.location;
                  },
                  branding: false,
                  promotion: false,
                  content_style: "body { font-family: Inter, Arial, sans-serif; font-size: 15px; line-height: 1.65; padding: 12px; color: #1f2d42; } p { margin: 0 0 1em; }",
                }}
              />
            </div>
            <div className={styles.editorFooter}>
              <span>HTML formatting is cleaned before it is saved.</span>
              <div>
                <button type="button" className={styles.secondaryButton} onClick={closeBodyEditor}>Cancel</button>
                <button type="button" className={styles.primaryButton} onClick={saveBodyEditor}>Save email body</button>
              </div>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

function PanelHeading({ id, eyebrow, title, copy }) {
  return (
    <div className={styles.panelHeading}>
      <span>{eyebrow}</span>
      <h2 id={id}>{title}</h2>
      <p>{copy}</p>
    </div>
  );
}

function Metric({ icon, label, value, detail, tone = "blue" }) {
  return (
    <div className={`${styles.metric} ${styles[`metric${tone[0].toUpperCase()}${tone.slice(1)}`]}`}>
      <div className={styles.metricIcon}>{icon}</div>
      <div className={styles.metricCopy}>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{detail}</small>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, multiline = false, rows = 3, className = "" }) {
  return (
    <label className={`${styles.field} ${className}`}>
      <span>{label}</span>
      {multiline ? (
        <textarea value={value || ""} onChange={(event) => onChange(event.target.value)} rows={rows} />
      ) : (
        <input value={value || ""} onChange={(event) => onChange(event.target.value)} />
      )}
    </label>
  );
}

function EmailBodyField({ value, onOpen, className = "" }) {
  return (
    <div className={`${styles.field} ${className}`}>
      <div className={styles.fieldHeader}>
        <span>Email body</span>
        <button type="button" className={styles.optimizeButton} onClick={onOpen}>
          <AutoAwesomeOutlinedIcon fontSize="inherit" />
          Optimize with TinyMCE
        </button>
      </div>
      <button type="button" className={styles.bodyPreview} onClick={onOpen}>
        <span>{plainText(value) || "Add the email body copy for this touchpoint."}</span>
        <span className={styles.bodyPreviewHint}>Open editor</span>
      </button>
    </div>
  );
}

function plainText(value) {
  return String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function EmptyState({ copy, action, onClick }) {
  return (
    <div className={styles.emptyState}>
      <span>{copy}</span>
      <button type="button" className={styles.textButton} onClick={onClick}>{action}</button>
    </div>
  );
}
