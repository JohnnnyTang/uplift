import { createPairedReplay } from "../../hachure/runtime/src/widgets/paired-replay";
import data from "../../hachure/terrain/src/validation/rain-comparison-data.json";

const replay = createPairedReplay({
  id: "observer",
  data,
  title: "Observer regression fixture",
  labels: ["Lighter rain", "Heavier rain"],
  inputUnit: "mm/h",
  valueUnit: "model m³",
  description: "Test-only callback-failure fixture.",
  onEndpoint(atEnd) {
    document.body.dataset.endpoint = String(atEnd);
  },
  onObserve() {
    throw new Error("Optional observer unavailable");
  },
});
document.querySelector("#app")!.append(replay.root);
replay.unlock();
