"""Reproduce the draft validation figures from raw JSON; requires matplotlib."""
from pathlib import Path
import json
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

root = Path(__file__).resolve().parent
summary = json.loads((root / "summary.json").read_text(encoding="utf-8"))
seeds = [1, 17, 101]
def run(seed, arm):
    return json.loads((root / f"seed-{seed}-{arm}.json").read_text(encoding="utf-8"))
plt.rcParams.update({
    "font.family": "DejaVu Sans", "font.size": 10,
    "axes.spines.top": False, "axes.spines.right": False,
    "figure.facecolor": "#faf8f2", "axes.facecolor": "#faf8f2",
    "text.color": "#242b2a", "axes.labelcolor": "#242b2a",
})
fig, axes = plt.subplots(2, 2, figsize=(13, 9), constrained_layout=True)
styles = ["-", "--", ":"]
for seed, style in zip(seeds, styles):
    for arm, color, label in [("rain-low", "#777777", "5 mm/h"), ("rain-high", "#0072b2", "20 mm/h")]:
        r = run(seed, arm)
        axes[0,0].plot([s["hydraulicSeconds"] for s in r["samples"]],
                       [s["incisionM"] * 1000 for s in r["samples"]],
                       linestyle=style, color=color, label=f"{label}; seed {seed}")
axes[0,0].axhline(0, color="#242b2a", linewidth=.7)
axes[0,0].set(xlabel="Hydraulic time (s)", ylabel="Median fixed-section incision (mm)",
              title="AC3a: slight aggradation; rain claim fails")
axes[0,0].legend(fontsize=8, ncols=2, frameon=False)
axes[0,0].text(.02,.04,"Required wet minus dry: +100 mm minimum\nMeasured: −0.493 to −0.724 mm",
               transform=axes[0,0].transAxes, fontsize=9)
x=np.arange(3)
uniform=[s["ac3b"]["uniformWidthM"] for s in summary["seeds"]]
band=[s["ac3b"]["bandWidthM"] for s in summary["seeds"]]
axes[0,1].bar(x-.15,uniform,.3,color="#777777",label="Uniform rock")
axes[0,1].bar(x+.15,band,.3,color="#242b2a",label="Hard band")
axes[0,1].set(xticks=x,xticklabels=[str(s) for s in seeds],xlabel="Seed",
              ylabel="Half-depth width at row 74 (m)",title="AC3b: no narrowing or eligible knickpoint")
axes[0,1].set_ylim(0, 600)
axes[0,1].legend(frameon=True, facecolor="#faf8f2", framealpha=1)
axes[0,1].text(.03,.84,"No width change.\nClock approval pending.",
              transform=axes[0,1].transAxes,fontsize=9, bbox=dict(facecolor="#faf8f2", edgecolor="none", pad=4))
excess=[s["ac3c"]["depositionDifferenceM3"] for s in summary["seeds"]]
axes[1,0].bar(x,excess,.5,color="#9c6500",label="Flatter minus steeper reach")
margin=summary["seeds"][0]["ac3c"]["depositionMarginM3"]
axes[1,0].axhline(margin,color="#242b2a",linestyle="--",label="Required deposit excess")
axes[1,0].set(xticks=x,xticklabels=[str(s) for s in seeds],xlabel="Seed",
              ylabel="New deposit difference (m³)",title="AC3c: right direction, insufficient magnitude",ylim=(0,75))
axes[1,0].legend(frameon=False,fontsize=9)
for i,v in enumerate(excess): axes[1,0].text(i,v+1,f"{v:.3f}",ha="center")
for seed,style in zip(seeds,styles):
    sections=run(seed,"uniform")["calibration"]["sections"]
    axes[1,1].plot([s["row"] for s in sections],[s["incisionM"]*1000 for s in sections],
                  marker="o",linestyle=style,color="#0072b2",label=f"Seed {seed}")
axes[1,1].axhline(0,color="#242b2a",linewidth=.7)
axes[1,1].set(xlabel="Fixed section row",ylabel="Incision since spin-up (mm)",
              title="Calibration fails: no positive section incision")
axes[1,1].legend(frameon=False,fontsize=9)
fig.suptitle("Uplift Wave 3 · preregistered real-solver results\nEngineering checks pass; scientific acceptance remains unmet",fontsize=15)
fig.savefig(root/"outcomes.png",dpi=170)
plt.close(fig)
