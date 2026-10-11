import { create } from 'zustand';

interface LoadingState {
  isLoading: boolean;
  message?: string;
  setLoading: (isLoading: boolean, message?: string) => void;
}

export const useLoadingStore = create<LoadingState>((set) => ({
  isLoading: false,
  message: undefined,
  setLoading: (isLoading, message) => set({ isLoading, message }),
}));
