import { useState } from "react";
import { DEFAULT_MODELS } from "./aiService";
import type { AiProvider, AiProviderSettings } from "./types";

const PROVIDER_LABELS: Record<AiProvider, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google Gemini",
};

function maskKey(key: string): string {
  if (key.length <= 8) return "••••••••";
  return `••••••••${key.slice(-4)}`;
}

export function AiSettingsPanel({ aiSettings, onUpdateAiSettings }: {
  aiSettings?: AiProviderSettings;
  onUpdateAiSettings: (s: AiProviderSettings | undefined) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editProvider, setEditProvider] = useState<AiProvider>(aiSettings?.provider ?? "openai");
  const [editApiKey, setEditApiKey] = useState("");
  const [editModel, setEditModel] = useState(aiSettings?.model ?? DEFAULT_MODELS.openai);
  const [showKey, setShowKey] = useState(false);
  const hasSavedKey = Boolean(aiSettings?.apiKey);

  function handleProviderChange(provider: AiProvider) { setEditProvider(provider); setEditModel(DEFAULT_MODELS[provider]); }
  function handleSave() {
    const k = editApiKey.trim() || aiSettings?.apiKey || "";
    if (!k) return;
    void onUpdateAiSettings({ provider: editProvider, apiKey: k, model: editModel, enabled: true });
    setEditApiKey(""); setShowKey(false);
  }
  function handleRemoveKey() { void onUpdateAiSettings(undefined); setEditApiKey(""); setShowKey(false); }
  function handleToggleEnabled() { if (aiSettings) void onUpdateAiSettings({ ...aiSettings, enabled: !aiSettings.enabled }); }

  return (
    <div className="ai-settings" style={{ marginTop: "1rem", borderTop: "1px solid var(--border, #e2e2e6)", paddingTop: "0.75rem" }}>
      <button type="button" className="ghost" onClick={() => setExpanded(!expanded)} style={{ fontSize: "0.85rem", padding: "0.25rem 0" }}>
        {expanded ? "▾ AI settings" : "▸ AI settings"}
        {hasSavedKey && <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", backgroundColor: aiSettings?.enabled ? "#4caf50" : "#bbb", marginLeft: 6 }} />}
      </button>
      {expanded && (
        <div className="stack" style={{ marginTop: "0.5rem", gap: "0.5rem" }}>
          <label style={{ fontSize: "0.8rem", fontWeight: 600 }}>
            Provider
            <select value={editProvider} onChange={(e) => handleProviderChange(e.target.value as AiProvider)} style={{ marginLeft: "0.5rem" }}>
              {(Object.keys(PROVIDER_LABELS) as AiProvider[]).map((prov) => <option key={prov} value={prov}>{PROVIDER_LABELS[prov]}</option>)}
            </select>
          </label>
          <label style={{ fontSize: "0.8rem", fontWeight: 600 }}>
            Model
            <input value={editModel} onChange={(e) => setEditModel(e.target.value)} placeholder={DEFAULT_MODELS[editProvider]} style={{ marginLeft: "0.5rem", width: "180px" }} />
          </label>
          <label style={{ fontSize: "0.8rem", fontWeight: 600 }}>API key</label>
          {hasSavedKey && !showKey ? (
            <div className="row" style={{ gap: "0.5rem", alignItems: "center" }}>
              <code style={{ fontSize: "0.8rem" }}>{maskKey(aiSettings!.apiKey)}</code>
              <button type="button" className="ghost" style={{ fontSize: "0.75rem" }} onClick={() => setShowKey(true)}>Change</button>
            </div>
          ) : (
            <input type="password" value={editApiKey} onChange={(e) => setEditApiKey(e.target.value)} placeholder={`Paste your ${PROVIDER_LABELS[editProvider]} API key`} autoComplete="off" style={{ width: "100%" }} />
          )}
          <div className="row" style={{ gap: "0.5rem", marginTop: "0.25rem" }}>
            <button type="button" className="primary" onClick={handleSave} disabled={!editApiKey.trim() && !hasSavedKey}>Save</button>
            {hasSavedKey && (
              <>
                <button type="button" className={aiSettings?.enabled ? "ghost" : "primary"} onClick={handleToggleEnabled}>{aiSettings?.enabled ? "Disable" : "Enable"}</button>
                <button type="button" className="ghost danger" onClick={handleRemoveKey}>Remove key</button>
              </>
            )}
          </div>
          <small style={{ color: "var(--muted, #888)", lineHeight: 1.3 }}>
            Your API key is encrypted and stored in your vault. It is sent directly to {PROVIDER_LABELS[editProvider]} over HTTPS{editProvider === "anthropic" ? " via a stateless proxy (required for browser CORS)" : ""} and never stored on our servers.
          </small>
        </div>
      )}
    </div>
  );
}
