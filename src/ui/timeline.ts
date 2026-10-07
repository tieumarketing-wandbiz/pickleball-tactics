import { SHOT_NAMES } from "../core/constants";
import type { Store } from "../state/store";
export function renderTimeline(store: Store, select: (index: number) => void) {
  const root = document.querySelector("#steps")!;
  root.replaceChildren();
  store.scenario.steps.forEach((step, index) => {
    const button = document.createElement("button");
    button.className = "step" + (index === store.index ? " active" : "");
    button.disabled = store.playing;
    button.setAttribute("aria-label", `Bước ${index + 1}`);
    button.setAttribute("aria-pressed", String(index === store.index));
    const num = document.createElement("span");
    num.textContent = String(index + 1).padStart(2, "0");
    const label = document.createElement("small");
    label.textContent = step.shot ? SHOT_NAMES[step.shot.type] : "Đội hình";
    button.append(num, label);
    button.onclick = () => select(index);
    root.append(button);
  });
  document.querySelector<HTMLButtonElement>("#delete-step")!.disabled =
    store.playing || store.scenario.steps.length === 1;
  for (const id of ["add-step", "duplicate"])
    document.querySelector<HTMLButtonElement>(`#${id}`)!.disabled =
      store.playing || store.scenario.steps.length >= 100;
}
