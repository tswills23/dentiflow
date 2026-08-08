# Output format — performance diagnosis

Used by `diagnose`. Short. One prescription.

---

```
## Read — [date range] · [$spend]

**Is there enough data?** [yes / no, and for which question specifically]

**Funnel walk** (stop at first break)
| Stage | Number | Healthy? |
|---|---|---|
| Event firing | | |
| Impressions | | |
| CTR (link) | | <0.8% cold B2B = creative problem |
| LP view → application | | <2% = page problem |
| Applications | | |
| Qualified | | |
| Shows | | |
| Cost per qualified call that showed | | **the only number that matters** |

**The constraint:** [one sentence — where the funnel actually breaks]

**Why:** [2–3 sentences. Which lens explains it.]

**The one change:** [exactly one]

**What I'm NOT changing, and why:** [the discipline lives here]

**Kill rules fired:** [list ads that tripped a rule, or "none"]

**What we'll know by [date]:** [the specific question this change answers]
```

---

**Rules for this mode:**
- One prescription. Not five. If two things are broken, fix the one higher in the funnel.
- If the data can't support a conclusion, say that first and don't prescribe.
- Kill rules get reported even when the ad is one you wrote.
- Append the decision to `data/decisions.md` before you finish.
