import { nextRallyStep } from "../core/contact";
import {
  clone,
  initialScenario,
  decodeScenario,
  parseScenario,
  type Scenario,
  type Step,
} from "../core/scenario";
export const STORAGE_KEY = "courtside.scenario.v1";
export class Store {
  scenario: Scenario;
  index = 0;
  mode: "edit" | "view" = "edit";
  selected = "A1";
  playing = false;
  picking = false;
  startupMessage = "";
  private listeners = new Set<() => void>();
  constructor() {
    this.scenario = initialScenario();
    if (location.hash) {
      try {
        this.scenario = decodeScenario(location.hash);
      } catch (e) {
        this.startupMessage = (e as Error).message;
      }
    } else {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) this.scenario = parseScenario(saved);
      } catch {
        this.startupMessage = "Không đọc được bản lưu; đã mở kịch bản mới.";
      }
    }
  }
  get step(): Step {
    return this.scenario.steps[this.index];
  }
  subscribe(fn: () => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  emit(persist = false) {
    if (persist) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.scenario));
      } catch {
        this.startupMessage = "Bộ nhớ trình duyệt đầy; hãy xuất JSON để lưu.";
      }
      if (location.hash)
        history.replaceState(null, "", location.pathname + location.search);
    }
    this.listeners.forEach((fn) => fn());
  }
  edit(fn: (s: Step) => void) {
    fn(this.step);
    this.emit(true);
  }
  select(index: number) {
    this.index = Math.max(0, Math.min(index, this.scenario.steps.length - 1));
    this.picking = false;
    this.emit();
  }
  add(copy = false) {
    if (this.scenario.steps.length >= 100) return;
    const step = copy
      ? clone(this.step)
      : nextRallyStep(this.step, this.selected);
    this.scenario.steps.splice(this.index + 1, 0, step);
    this.index++;
    if (step.shot) this.selected = step.shot.hitter;
    this.emit(true);
  }
  remove() {
    if (this.scenario.steps.length <= 1) return;
    this.scenario.steps.splice(this.index, 1);
    this.index = Math.min(this.index, this.scenario.steps.length - 1);
    this.emit(true);
  }
  load(s: Scenario) {
    this.scenario = clone(s);
    this.index = 0;
    this.picking = false;
    this.emit(true);
  }
}
