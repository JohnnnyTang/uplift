"""Plot registered baseline/revised evidence; requires Matplotlib."""
from pathlib import Path
import json
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

root = Path(__file__).resolve().parent
summary = json.loads((root / "summary.json").read_text(encoding="utf-8"))
fig, axes = plt.subplots(2, 2, figsize=(12, 8), constrained_layout=True)
colors = {"baseline": "#777777", "conditional": "#0072b2"}
for cohort in ("baseline", "conditional"):
    records = summary[cohort]["seeds"]
    seeds = [str(s["seed"]) for s in records]
    color = colors[cohort]
    label = "Original replay" if cohort == "baseline" else "Revised conditions"
    axes[0, 0].plot(seeds, [1000 * s["ac3a"]["finalSamples"][-1]["incisionDifferenceM"] for s in records], "o" if cohort == "conditional" else "x", color=color, label=label)
    axes[0, 1].plot(seeds, [s["ac3b"]["uniformWidthM"] - s["ac3b"]["bandWidthM"] for s in records], "o" if cohort == "conditional" else "x", color=color, label=label)
    axes[1, 0].plot(seeds, [s["ac3c"]["depositionDifferenceM3"] for s in records], "o" if cohort == "conditional" else "x", color=color, label=label)
for arm, style in (("uniform", "o"), ("hard-band", "s")):
    records = [r for r in summary["mechanism"]["revised"] if r["arm"] == arm]
    axes[1, 1].plot([str(r["seed"]) for r in records], [r["bandBedrockErodedM3"] for r in records], style, label=arm)
axes[0, 0].set(title="Rain: wet minus dry incision", ylabel="Incision difference (mm)")
axes[0, 1].set(title="Hard band: uniform minus band width", ylabel="Width reduction (m)")
axes[1, 0].set(title="Transport: flatter minus steeper deposit", ylabel="Net deposit difference (m³)")
axes[1, 1].set(title="Exposed-rock runs: actual band bedrock loss", ylabel="Bedrock loss in rows 72–75 (m³)")
for ax in axes.flat:
    ax.set_xlabel("Seed")
    ax.spines[["top", "right"]].set_visible(False)
    ax.axhline(0, linewidth=0.5, color="#242b2a")
    ax.legend(frameon=True, facecolor="white", edgecolor="none", framealpha=1, fontsize=8)
fig.suptitle("Wave 3 mechanism-isolation follow-up — conditional evidence\nAxis scales magnify small changes; these plots do not establish classroom visibility")
fig.savefig(root / "outcomes.png", dpi=160)
