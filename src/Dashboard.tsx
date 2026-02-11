import {
  Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { AiSettingsPanel } from "./AiSettingsPanel";
import type {
  AiProviderSettings,
  BankAccount, BudgetRow, Category, CategoryPieRow, FamilyMember,
  MerchantPieRow, RuleSuggestion, SixMonthRow, TimeGranularity, Transaction,
} from "./types";

interface DashboardProps {
  firstName: string;
  syncing: boolean;
  periodLabel: string;
  granularity: TimeGranularity;
  categoryChartData: CategoryPieRow[];
  linkedAccounts: BankAccount[];
  plaidToken: string | null;
  plaidReady: boolean;
  selectedCategoryId: string | null;
  groupedByMerchant: MerchantPieRow[];
  sixMonthBars: SixMonthRow[];
  budgetRows: BudgetRow[];
  editingBudgetCategory: string | null;
  editingBudgetValue: string;
  uncategorized: Transaction[];
  ruleSuggestions: RuleSuggestion[];
  categories: Category[];
  familyMembers: FamilyMember[];
  inviteEmail: string;
  newCategoryName: string;
  onSyncNow: () => Promise<void>;
  onReset: () => void;
  onShiftDate: (d: -1 | 1) => void;
  onSetGranularity: (v: TimeGranularity) => void;
  onSetSelectedCategoryId: (v: string | null) => void;
  onOpenAddAccount: () => void;
  onStartEditBudget: (id: string, cur: number) => void;
  onSetEditingBudgetValue: (v: string) => void;
  onSaveBudget: (id: string) => Promise<void>;
  onUpdateTransactionCategory: (txId: string, catId: string) => Promise<void>;
  onAddCategory: (e: React.FormEvent) => Promise<void>;
  onSetNewCategoryName: (v: string) => void;
  onAddFamilyMember: (e: React.FormEvent) => Promise<void>;
  onSetInviteEmail: (v: string) => void;
  currency: (v: number) => string;
  aiSettings?: AiProviderSettings;
  aiCategorizingNow: boolean;
  aiLastResult: string | null;
  onUpdateAiSettings: (s: AiProviderSettings | undefined) => Promise<void>;
  onAiCategorizeNow: () => Promise<void>;
}

export function Dashboard(p: DashboardProps) {
  const selName = p.categoryChartData.find((c) => c.categoryId === p.selectedCategoryId)?.name ?? null;
  const fmt = p.currency;

  return (
    <div className="shell">
      {/* ── Header ─────────────────────── */}
      <header className="top-bar card">
        <div>
          <h1>{`Hi ${p.firstName}, here's your spend view`}</h1>
          <p>Auto-sync is {p.syncing ? "running..." : "up to date"}</p>
        </div>
        <div className="top-actions">
          <button type="button" className="primary" onClick={() => void p.onSyncNow()} disabled={p.syncing}>
            {p.syncing ? "Syncing..." : "Sync now"}
          </button>
          <button type="button" onClick={p.onReset} className="ghost danger">Reset vault</button>
        </div>
      </header>

      {/* ── Period controls ────────────── */}
      <section className="card period-bar">
        <div className="row spread">
          <div className="row">
            <button type="button" onClick={() => p.onShiftDate(-1)}>&#8592; Prev</button>
            <strong>{p.periodLabel}</strong>
            <button type="button" onClick={() => p.onShiftDate(1)}>Next &#8594;</button>
          </div>
          <div className="row">
            {(["month", "year", "previous-year"] as TimeGranularity[]).map((g) => (
              <button key={g} type="button" className={p.granularity === g ? "selected" : ""} onClick={() => p.onSetGranularity(g)}>
                {g === "month" ? "Month" : g === "year" ? "Year" : "Prev year"}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pie chart + Accounts ───────── */}
      <section className="grid">
        <article className="card chart-card">
          <h2>Expenses by category</h2>
          {p.categoryChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={p.categoryChartData} dataKey="value" nameKey="name" outerRadius={110} innerRadius={50} paddingAngle={2}
                  onClick={(entry) => p.onSetSelectedCategoryId(entry.categoryId)} style={{ cursor: "pointer" }}>
                  {p.categoryChartData.map((e) => <Cell key={e.categoryId} fill={e.color} stroke="none" />)}
                </Pie>
                <Tooltip formatter={(v) => fmt(Number(v))} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon">&#128202;</div>
              <p>Connect a bank account and sync to see your spending breakdown</p>
            </div>
          )}
        </article>

        <article className="card">
          <h2>Connected accounts</h2>
          <div className="stack">
            {p.linkedAccounts.map((a) => (
              <div className="pill" key={a.id}>
                <span>{a.institutionName}</span>
                <span>{`${a.accountName} ••••${a.mask}`}</span>
              </div>
            ))}
            {p.linkedAccounts.length === 0 && <small>No accounts connected yet.</small>}
            <button type="button" className="primary" disabled={p.plaidToken ? !p.plaidReady : false} onClick={p.onOpenAddAccount}>
              + Add bank account
            </button>
          </div>
        </article>
      </section>

      {/* ── Drill-down ─────────────────── */}
      {p.selectedCategoryId && (
        <section className="drill-down-enter">
          <div className="selection-label">
            Viewing: {selName}
            <button type="button" onClick={() => p.onSetSelectedCategoryId(null)} aria-label="Clear selection">&times;</button>
          </div>
          <div className="grid" style={{ marginTop: "0.5rem" }}>
            <article className="card chart-card">
              <h2>Category drill-down</h2>
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={p.groupedByMerchant} dataKey="value" nameKey="name" outerRadius={95} innerRadius={35} paddingAngle={2}>
                    {p.groupedByMerchant.map((e) => <Cell key={e.name} fill={e.color} stroke="none" />)}
                  </Pie>
                  <Tooltip formatter={(v) => fmt(Number(v))} />
                </PieChart>
              </ResponsiveContainer>
            </article>
            <article className="card chart-card">
              <h2>Last 6 months trend</h2>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={p.sixMonthBars}>
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v) => fmt(Number(v))} />
                  <Bar dataKey="total" fill="#AA96DA" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </article>
          </div>
        </section>
      )}

      {/* ── Budget ─────────────────────── */}
      <section className="card">
        <h2>Budget vs actual</h2>
        {p.budgetRows.length > 0 ? (
          <div className="budget-scroll">
            {p.budgetRows.map((row) => (
              <div className="budget-row" key={row.categoryId}>
                <div className="row spread">
                  <strong>{row.categoryName}</strong>
                  <small>{`${fmt(row.spent)} / ${fmt(row.budget)}`}</small>
                </div>
                <div className="budget-track">
                  <div className="budget-fill" style={{ width: `${row.pct}%`, backgroundColor: row.color }} />
                  <button type="button" className="edit-budget" onClick={() => p.onStartEditBudget(row.categoryId, row.budget)}
                    aria-label={`Edit ${row.categoryName} budget`}>&#9998;</button>
                </div>
                {p.editingBudgetCategory === row.categoryId && (
                  <form className="row" onSubmit={(e) => { e.preventDefault(); void p.onSaveBudget(row.categoryId); }}>
                    <input type="number" min="0" step="1" value={p.editingBudgetValue}
                      onChange={(e) => p.onSetEditingBudgetValue(e.target.value)} autoFocus />
                    <button type="submit" className="primary">Save</button>
                  </form>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state"><p>Budgets will appear here once you connect an account</p></div>
        )}
      </section>

      {/* ── AI + Categories / Family ──── */}
      <section className="grid">
        <article className="card">
          <h2>AI categorization</h2>

          {/* Uncategorized transactions */}
          <div className="stack">
            {p.uncategorized.length > 0 ? p.uncategorized.map((tx) => (
              <div className="tx-row" key={tx.id}>
                <div><strong>{tx.merchant}</strong><small>{fmt(tx.amount)}</small></div>
                <select value={tx.categoryId} onChange={(e) => void p.onUpdateTransactionCategory(tx.id, e.target.value)}>
                  {p.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            )) : <small>Everything is categorized.</small>}
          </div>

          {/* Categorize-now button + status */}
          {p.aiSettings?.enabled && p.uncategorized.length > 0 && (
            <div style={{ marginTop: "0.75rem" }}>
              <button
                type="button"
                className="primary"
                disabled={p.aiCategorizingNow}
                onClick={() => void p.onAiCategorizeNow()}
              >
                {p.aiCategorizingNow ? "Categorizing..." : `AI categorize (${p.uncategorized.length})`}
              </button>
            </div>
          )}
          {p.aiLastResult && (
            <small className={p.aiLastResult.startsWith("Error") ? "ai-status-error" : "ai-status-ok"} style={{ display: "block", marginTop: "0.5rem" }}>
              {p.aiLastResult}
            </small>
          )}

          {/* Rule suggestions */}
          {p.ruleSuggestions.length > 0 && (
            <div className="suggestions">
              <h3>Suggested rules</h3>
              {p.ruleSuggestions.map((r) => (
                <div key={r.pattern} className="pill">
                  <span>{`"${r.pattern}" \u2192 ${r.categoryName}`}</span>
                  <small>{`${r.count} similar`}</small>
                </div>
              ))}
            </div>
          )}

          {/* AI settings panel */}
          <AiSettingsPanel
            aiSettings={p.aiSettings}
            onUpdateAiSettings={p.onUpdateAiSettings}
          />
        </article>

        <article className="card">
          <h2>Categories</h2>
          <form className="row" onSubmit={(e) => void p.onAddCategory(e)}>
            <input placeholder="New category" value={p.newCategoryName} onChange={(e) => p.onSetNewCategoryName(e.target.value)} />
            <button type="submit">Add</button>
          </form>
          <div className="stack">
            {p.categories.map((c) => (
              <div className="pill" key={c.id}><span>{c.name}</span><small>{c.isDefault ? "Built-in" : "Custom"}</small></div>
            ))}
          </div>

          <h2 style={{ marginTop: "1.5rem" }}>Family</h2>
          <form className="row" style={{ marginTop: "0.5rem" }} onSubmit={(e) => void p.onAddFamilyMember(e)}>
            <input type="email" placeholder="Invite by email" value={p.inviteEmail} onChange={(e) => p.onSetInviteEmail(e.target.value)} />
            <button type="submit">Link</button>
          </form>
          <div className="stack">
            {p.familyMembers.map((m) => (
              <div className="pill" key={m.id}><span>{m.email}</span><small>{m.role}</small></div>
            ))}
            {p.familyMembers.length === 0 && <small>No family members linked yet.</small>}
          </div>
        </article>
      </section>
    </div>
  );
}

