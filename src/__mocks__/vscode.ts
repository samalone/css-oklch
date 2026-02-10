export const workspace = {
  getConfiguration: () => ({
    get: (key: string, defaultValue: unknown) => defaultValue,
  }),
};
