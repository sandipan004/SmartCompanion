import { create } from "zustand";

interface TaskState {
  steps: string[];
  currentStep: number;
  nextStep: () => void;
}

export const useTaskStore = create<TaskState>((set) => ({
  steps: [
    "Pick up clothes from floor.",
    "Put books on shelf.",
    "Clear your desk.",
    "Throw trash away.",
    "Make your bed."
  ],
  currentStep: 0,
  nextStep: () =>
    set((state) => ({
      currentStep:
        state.currentStep < state.steps.length - 1
          ? state.currentStep + 1
          : state.currentStep
    }))
}));