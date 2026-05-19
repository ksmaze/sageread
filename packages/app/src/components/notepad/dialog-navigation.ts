type Scheduler = (callback: () => void) => void;

const scheduleNextTurn: Scheduler = (callback) => {
  setTimeout(callback, 0);
};

export function runAfterDialogClose(
  closeDialog: () => void,
  action: () => void,
  schedule: Scheduler = scheduleNextTurn,
) {
  closeDialog();
  schedule(action);
}
