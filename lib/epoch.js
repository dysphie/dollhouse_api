export const toEpochSeconds = (isoString) => Math.floor(new Date(isoString).getTime() / 1000);
