// ============================================================
// 4. Mule-Network & Money-Layering Detector
// Fan-out / structuring / betweenness on FinancialTransaction graph
// ============================================================
const { getFirDb } = require('../fir/db');

function detectMules({ limit = 25 } = {}) {
  const db = getFirDb();

  const accounts = db.prepare(`
    SELECT ba.AccountID id, ba.AccountNo, ba.BankName, ba.IFSC, ba.IsFlagged,
           p.PersonMasterID personId, p.FullName person, p.RiskScore risk,
           d.DistrictName district
    FROM BankAccount ba
    LEFT JOIN PersonMaster p ON p.PersonMasterID = ba.PersonMasterID
    LEFT JOIN District d ON d.DistrictID = p.DistrictID
  `).all();
  const byId = new Map(accounts.map((a) => [a.id, a]));

  const txns = db.prepare(`
    SELECT TxnID, FromAccountID, ToAccountID, Amount, TxnDate, Channel, IsSuspicious, CaseMasterID
    FROM FinancialTransaction
  `).all();

  // Graph degree + volume
  const outDeg = new Map();
  const inDeg = new Map();
  const outAmt = new Map();
  const inAmt = new Map();
  const smallTxnOut = new Map(); // structuring: many small outgoing
  const counterparties = new Map();

  for (const t of txns) {
    outDeg.set(t.FromAccountID, (outDeg.get(t.FromAccountID) || 0) + 1);
    inDeg.set(t.ToAccountID, (inDeg.get(t.ToAccountID) || 0) + 1);
    outAmt.set(t.FromAccountID, (outAmt.get(t.FromAccountID) || 0) + (t.Amount || 0));
    inAmt.set(t.ToAccountID, (inAmt.get(t.ToAccountID) || 0) + (t.Amount || 0));
    if ((t.Amount || 0) > 0 && (t.Amount || 0) < 10000) {
      smallTxnOut.set(t.FromAccountID, (smallTxnOut.get(t.FromAccountID) || 0) + 1);
    }
    if (!counterparties.has(t.FromAccountID)) counterparties.set(t.FromAccountID, new Set());
    if (!counterparties.has(t.ToAccountID)) counterparties.set(t.ToAccountID, new Set());
    counterparties.get(t.FromAccountID).add(t.ToAccountID);
    counterparties.get(t.ToAccountID).add(t.FromAccountID);
  }

  // Approximate betweenness via degree centrality proxy (full Brandes is O(VE) — overkill for demo)
  const scored = [];
  for (const a of accounts) {
    const od = outDeg.get(a.id) || 0;
    const id_ = inDeg.get(a.id) || 0;
    const fanOut = counterparties.get(a.id)?.size || 0;
    const struct = smallTxnOut.get(a.id) || 0;
    const inVol = inAmt.get(a.id) || 0;
    const outVol = outAmt.get(a.id) || 0;
    const suspiciousCount = txns.filter(
      (t) => t.IsSuspicious && (t.FromAccountID === a.id || t.ToAccountID === a.id),
    ).length;

    // Mule score: high fan-in + fan-out, structuring, flagged, suspicious
    let score = 0;
    const flags = [];
    if (fanOut >= 4) { score += 25; flags.push(`fan-out ${fanOut} counterparties`); }
    if (id_ >= 3 && od >= 2) { score += 20; flags.push('layering hop (in+out)'); }
    if (struct >= 3) { score += 20; flags.push(`structuring: ${struct} sub-₹10k txs`); }
    if (a.IsFlagged) { score += 15; flags.push('already flagged mule'); }
    if (suspiciousCount >= 2) { score += 15; flags.push(`${suspiciousCount} suspicious txns`); }
    if (inVol > 0 && outVol > 0 && Math.abs(inVol - outVol) / Math.max(inVol, outVol) < 0.25) {
      score += 10; flags.push('pass-through balance (~equal in/out)');
    }
    if (score < 25) continue;

    scored.push({
      accountId: a.id,
      accountNo: a.AccountNo,
      bank: a.BankName,
      ifsc: a.IFSC,
      person: a.person,
      personId: a.personId,
      district: a.district,
      muleScore: Math.min(100, score),
      fanOut,
      inDegree: id_,
      outDegree: od,
      inVolume: Math.round(inVol),
      outVolume: Math.round(outVol),
      suspiciousTxns: suspiciousCount,
      alreadyFlagged: !!a.IsFlagged,
      signals: flags,
      freezeRecommend: score >= 70,
    });
  }

  scored.sort((a, b) => b.muleScore - a.muleScore);
  const top = scored.slice(0, limit);

  // Sample money trails: victim-ish (high out, low in from flagged) → mule → next
  const trails = [];
  const suspicious = txns.filter((t) => t.IsSuspicious).sort((a, b) => b.Amount - a.Amount).slice(0, 15);
  for (const t of suspicious) {
    const from = byId.get(t.FromAccountID);
    const to = byId.get(t.ToAccountID);
    if (!from || !to) continue;
    // next hop
    const next = txns.find((x) => x.FromAccountID === t.ToAccountID && x.TxnID !== t.TxnID);
    const nextTo = next ? byId.get(next.ToAccountID) : null;
    trails.push({
      amount: t.Amount,
      channel: t.Channel,
      date: t.TxnDate,
      from: { account: from.AccountNo, person: from.person, bank: from.BankName },
      mule: { account: to.AccountNo, person: to.person, bank: to.BankName, flagged: !!to.IsFlagged },
      next: nextTo ? { account: nextTo.AccountNo, person: nextTo.person, bank: nextTo.BankName } : null,
      caseId: t.CaseMasterID,
    });
  }

  return {
    summary: {
      accountsScanned: accounts.length,
      transactions: txns.length,
      muleCandidates: scored.length,
      freezeList: scored.filter((s) => s.freezeRecommend).length,
      method: 'Fan-out / layering / structuring / pass-through heuristics on UPI-style txn graph',
    },
    mules: top,
    trails: trails.slice(0, 12),
    freezeList: top.filter((m) => m.freezeRecommend).map((m) => ({
      accountNo: m.accountNo, bank: m.bank, person: m.person, muleScore: m.muleScore, signals: m.signals,
    })),
  };
}

module.exports = { detectMules };
