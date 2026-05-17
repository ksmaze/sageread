import { tauriStorageKey } from "@/constants/tauri-storage";
import { tauriStorage } from "@/lib/tauri-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export interface VectorModelConfig {
  id: string;
  name: string;
  url: string;
  modelId: string;
  apiKey: string;
  description?: string;
  dimension?: number;
}

export interface VectorModelState {
  testText: string;
  vectorModels: VectorModelConfig[];
  selectedVectorModelId: string | null;
  vectorModelEnabled: boolean;

  setTestText: (text: string) => void;
  setVectorModelEnabled: (enabled: boolean) => void;
  setVectorModels: (models: VectorModelConfig[]) => void;
  addVectorModel: (model: VectorModelConfig) => void;
  updateVectorModel: (id: string, updates: Partial<VectorModelConfig>) => void;
  deleteVectorModel: (id: string) => void;
  setSelectedVectorModelId: (id: string | null) => void;
  getSelectedVectorModel: () => VectorModelConfig | null;
  hasVectorCapability: () => boolean;
}

export const useVectorModelStore = create<VectorModelState>()(
  persist(
    (set, get) => ({
      testText: "Hello, world!",
      vectorModels: [],
      selectedVectorModelId: null,
      vectorModelEnabled: false,

      setTestText: (testText) => set({ testText }),
      setVectorModelEnabled: (vectorModelEnabled) => set({ vectorModelEnabled }),
      setVectorModels: (vectorModels) => set({ vectorModels }),
      addVectorModel: (model) => {
        const { vectorModels } = get();
        set({ vectorModels: [...vectorModels, model] });
      },
      updateVectorModel: (id, updates) => {
        const { vectorModels } = get();
        set({
          vectorModels: vectorModels.map((model) => (model.id === id ? { ...model, ...updates } : model)),
        });
      },
      deleteVectorModel: (id) => {
        const { vectorModels, selectedVectorModelId } = get();
        const newModels = vectorModels.filter((model) => model.id !== id);
        const newSelected = selectedVectorModelId === id ? null : selectedVectorModelId;
        set({ vectorModels: newModels, selectedVectorModelId: newSelected });
      },
      setSelectedVectorModelId: (selectedVectorModelId) => set({ selectedVectorModelId }),
      getSelectedVectorModel: () => {
        const { vectorModels, selectedVectorModelId } = get();
        return vectorModels.find((model) => model.id === selectedVectorModelId) || null;
      },
      hasVectorCapability: () => {
        const { vectorModelEnabled } = get();
        if (!vectorModelEnabled) {
          return false;
        }
        const selectedModel = get().getSelectedVectorModel();
        return selectedModel != null && selectedModel.url.trim().length > 0;
      },
    }),
    {
      name: tauriStorageKey.vectorStore,
      storage: createJSONStorage(() => tauriStorage),
      partialize: (state) => ({
        vectorModels: state.vectorModels,
        selectedVectorModelId: state.selectedVectorModelId,
        vectorModelEnabled: state.vectorModelEnabled,
        testText: state.testText,
      }),
    },
  ),
);
