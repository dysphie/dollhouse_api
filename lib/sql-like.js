export const escapeLike = (str) =>
    str.replace(/[\\%_]/g, (ch) => `\\${ch}`);