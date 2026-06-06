type ProcessingListener = (active: boolean) => void;

let activeProcessingCount = 0;
const listeners = new Set<ProcessingListener>();

function notifyProcessingListeners(): void {
  const active = isExternalSourceAiProcessingActive();
  listeners.forEach((listener) => listener(active));
}

export function isExternalSourceAiProcessingActive(): boolean {
  return activeProcessingCount > 0;
}

export function beginExternalSourceAiProcessing(): () => void {
  activeProcessingCount += 1;
  notifyProcessingListeners();
  let completed = false;

  return () => {
    if (completed) {
      return;
    }
    completed = true;
    activeProcessingCount = Math.max(0, activeProcessingCount - 1);
    notifyProcessingListeners();
  };
}

export function subscribeExternalSourceAiProcessing(listener: ProcessingListener): () => void {
  listeners.add(listener);
  listener(isExternalSourceAiProcessingActive());

  return () => {
    listeners.delete(listener);
  };
}
